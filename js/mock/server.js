/*
 * Мок Laravel REST API (ТЗ §11–13).
 * Повторяет поведение будущего бэкенда: авторизация по токену, проверка ответов только на сервере,
 * идемпотентность по client_attempt_id, единоразовые награды через wallet_ledger с уникальным
 * (user_id, event_type, source_id), версии вопросов, права editor/admin.
 *
 * Вселенная бесконечна:
 *  - миры идут цепочкой (сид + миры, опубликованные через CMS); финал мира открывает следующий;
 *  - после первого мира открываются бесконечные «экспедиции» — процедурные города из проверенных
 *    заданий с упором на ошибки и слабые навыки игрока.
 * Хранилище — localStorage (вместо PostgreSQL). Клиент общается с ним только через DS.api.
 */
(function () {
  'use strict';

  var DB_KEY = 'dereksci_mock_db_v2';
  var SEED = window.DS_SEED;
  var ADAPTIVE_N = 10;          // последние N первичных ответов по навыку (ТЗ §9)
  var ADAPTIVE_MIN = 5;         // меньше — «недостаточно данных»
  var ADAPTIVE_THRESHOLD = 0.7; // ниже — рекомендуем повторение
  var XP_PER_QUESTION = 10;
  var COINS_PER_LESSON = 5;
  var EXPEDITION_SIZE = 5;
  var EXPEDITION_XP = 15, EXPEDITION_COINS = 3;
  var EXPEDITION_MILESTONES = [1, 5, 10, 25, 50, 100];
  var CLAIM_OPTIONS = [
    { id: 'supported', text: 'Подтверждается' },
    { id: 'contradicted', text: 'Противоречит' },
    { id: 'insufficient', text: 'Недостаточно данных' }
  ];
  var TYPE_SKILL = {
    sentence_select: 'find_explicit_information', fill_choice: 'understand_main_idea', claim_check: 'evaluate_claims',
    sequence_order: 'restore_sequence', source_select: 'choose_source'
  };

  /* ---------------- хранилище ---------------- */
  function now() { return new Date().toISOString(); }
  function uid(prefix) { return (prefix || '') + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); }
  function clone(x) { return x == null ? x : JSON.parse(JSON.stringify(x)); }

  function seedQuestion(q) {
    var payload = clone(q);
    ['id', 'type', 'skill_id', 'difficulty', 'answer_key'].forEach(function (k) { delete payload[k]; });
    return {
      id: q.id, type: q.type, skill_id: q.skill_id, difficulty: q.difficulty || 'beginner',
      language: 'ru', audience_tags: ['school', 'general'], created_at: now(), updated_at: now(),
      versions: [{ version: 1, status: 'published', payload: payload, answer_key: q.answer_key.slice(), created_at: now(),
        author: q.id.indexOf('w2-') === 0 ? 'demo-seed' : 'import:читалка (1).docx' }]
    };
  }
  function seedDb() {
    return {
      users: [], tokens: {}, sessions: [], attempts: [], progress: [], ledger: [],
      user_achievements: [], mistakes: [], events: [], audit: [], city_seen: [], world_seen: [], expeditions: [],
      questions: SEED.questions.map(seedQuestion),
      lesson_extra: {}, // lesson_id -> [question_id] (задания, добавленные через CMS)
      cms: { worlds: [], cities: [], lessons: [] } // миры/города/уроки, созданные через CMS
    };
  }
  /* «Миграции»: добиваем недостающие поля и новые сид-задания, не трогая прогресс */
  function migrate(d) {
    ['world_seen', 'expeditions', 'city_seen', 'audit', 'events', 'mistakes'].forEach(function (k) { d[k] = d[k] || []; });
    d.lesson_extra = d.lesson_extra || {};
    d.cms = d.cms || { worlds: [], cities: [], lessons: [] };
    var have = {}; d.questions.forEach(function (q) { have[q.id] = 1; });
    SEED.questions.forEach(function (q) { if (!have[q.id]) d.questions.push(seedQuestion(q)); });
    d.users.forEach(function (u) {
      if (u.intro_seen && !d.world_seen.some(function (x) { return x.user_id === u.id && x.world_id === 'text-detective'; }))
        d.world_seen.push({ user_id: u.id, world_id: 'text-detective', at: now() });
    });
    return d;
  }
  function load() {
    try { var raw = localStorage.getItem(DB_KEY); if (raw) return migrate(JSON.parse(raw)); } catch (e) { /* ignore */ }
    return seedDb();
  }
  function save() { try { localStorage.setItem(DB_KEY, JSON.stringify(db)); } catch (e) { /* ignore */ } }
  var db = load();

  /* ---------------- ошибки ---------------- */
  function ApiError(status, code, message, details) {
    this.status = status; this.code = code; this.message = message; this.details = details || null;
  }
  function fail(status, code, message, details) { throw new ApiError(status, code, message, details); }

  /* ---------------- контент (сид + CMS) ---------------- */
  function byOrder(a, b) { return a.order - b.order; }
  function allWorlds(includeDrafts) {
    return SEED.worlds.map(function (w) { return Object.assign({ editable: false }, w); })
      .concat(db.cms.worlds.map(function (w) { return Object.assign({ editable: true }, w); }))
      .filter(function (w) { return includeDrafts || w.status === 'published'; })
      .sort(byOrder);
  }
  function allCitiesRaw() { return SEED.cities.concat(db.cms.cities); }
  function allLessonsRaw() { return SEED.lessons.concat(db.cms.lessons); }
  function worldById(id, includeDrafts) { return allWorlds(includeDrafts).find(function (w) { return w.id === id; }); }
  function citiesOfWorld(worldId) { return allCitiesRaw().filter(function (c) { return c.world_id === worldId; }).sort(byOrder); }
  function cityById(id) { return allCitiesRaw().find(function (c) { return c.id === id; }); }
  function lessonsOfCity(cityId) { return allLessonsRaw().filter(function (l) { return l.city_id === cityId; }).sort(byOrder); }
  function lessonById(id) { return allLessonsRaw().find(function (l) { return l.id === id; }); }
  function lessonsOfWorld(worldId) {
    var out = []; citiesOfWorld(worldId).forEach(function (c) { out = out.concat(lessonsOfCity(c.id)); }); return out;
  }
  /* Единая цепочка уроков по всем опубликованным мирам: мир N+1 открывается после мира N */
  function chain() {
    var out = []; allWorlds(false).forEach(function (w) { out = out.concat(lessonsOfWorld(w.id)); }); return out;
  }
  function questionById(id) { return db.questions.find(function (q) { return q.id === id; }); }
  function publishedVersion(q) {
    for (var i = q.versions.length - 1; i >= 0; i--) if (q.versions[i].status === 'published') return q.versions[i];
    return null;
  }
  function versionByRef(ref) { // "qid@v3"
    var parts = ref.split('@v'); var q = questionById(parts[0]); if (!q) return null;
    var v = q.versions.find(function (x) { return x.version === Number(parts[1]); });
    return v ? { q: q, v: v } : null;
  }
  function lessonQuestionIds(lesson) { return (lesson.questions || []).concat(db.lesson_extra[lesson.id] || []); }
  function cityOfQuestion(qid) {
    var l = allLessonsRaw().find(function (x) { return lessonQuestionIds(x).indexOf(qid) !== -1; });
    return l ? { lesson_id: l.id, city_id: l.city_id } : { lesson_id: null, city_id: null };
  }

  /* ---------------- прогресс ---------------- */
  function progressOf(userId, lessonId) {
    return db.progress.find(function (p) { return p.user_id === userId && p.lesson_id === lessonId; });
  }
  function isPassed(userId, lessonId) { var p = progressOf(userId, lessonId); return !!(p && p.completed_at); }
  function isUnlocked(userId, lessonId) {
    var ch = chain();
    var idx = ch.findIndex(function (l) { return l.id === lessonId; });
    if (idx < 0) return false;
    return idx === 0 || isPassed(userId, ch[idx - 1].id);
  }
  function lessonStatus(userId, lessonId) {
    if (isPassed(userId, lessonId)) return 'completed';
    return isUnlocked(userId, lessonId) ? 'unlocked' : 'locked';
  }
  function cityCompleted(userId, cityId) {
    var ls = lessonsOfCity(cityId);
    return ls.length > 0 && ls.every(function (l) { return isPassed(userId, l.id); });
  }
  function cityStatus(userId, city) {
    if (cityCompleted(userId, city.id)) return 'completed';
    var first = lessonsOfCity(city.id)[0];
    return first && isUnlocked(userId, first.id) ? 'unlocked' : 'locked';
  }
  function worldCompleted(userId, worldId) {
    var cs = citiesOfWorld(worldId);
    return cs.length > 0 && cs.every(function (c) { return cityCompleted(userId, c.id); });
  }
  function worldStatus(userId, w) {
    if (worldCompleted(userId, w.id)) return 'completed';
    var first = lessonsOfWorld(w.id)[0];
    return first && isUnlocked(userId, first.id) ? 'unlocked' : 'locked';
  }
  function nextWorldAfter(worldId) {
    var ws = allWorlds(false); var i = ws.findIndex(function (w) { return w.id === worldId; });
    return i >= 0 ? ws[i + 1] || null : null;
  }
  function expeditionsUnlocked(userId) {
    var first = allWorlds(false)[0];
    return !!first && worldCompleted(userId, first.id);
  }

  function wallet(userId) {
    var xp = 0, coins = 0;
    db.ledger.forEach(function (e) { if (e.user_id === userId) { xp += e.xp_delta; coins += e.coin_delta; } });
    return { xp: xp, coins: coins };
  }
  /* Аналог уникального индекса (user_id, event_type, source_id) + DB::transaction() */
  function awardOnce(userId, eventType, sourceId, xp, coins) {
    var exists = db.ledger.some(function (e) { return e.user_id === userId && e.event_type === eventType && e.source_id === sourceId; });
    if (exists) return null;
    var entry = { id: uid('led_'), user_id: userId, event_type: eventType, source_id: sourceId, xp_delta: xp, coin_delta: coins, created_at: now() };
    db.ledger.push(entry);
    if (xp || coins) logEvent(userId, 'reward_granted', { event_type: eventType, source_id: sourceId, xp: xp, coins: coins });
    return entry;
  }

  /* ---------------- достижения ---------------- */
  function achievements() {
    var list = [
      { key: 'first_case', title: 'Первое дело', description: 'Пройти первый урок', icon: 'search' },
      { key: 'five_lessons', title: '5 уроков', description: 'Пройти пять уроков', icon: 'star' },
      { key: 'city_restored', title: 'Город восстановлен', description: 'Пройти все уроки одного города', icon: 'building-2' }
    ];
    allWorlds(false).forEach(function (w) {
      citiesOfWorld(w.id).forEach(function (c) {
        list.push({ key: c.badge.key, title: c.badge.title, description: 'Восстановить: ' + c.title, icon: c.badge.icon || c.icon, world_id: w.id });
      });
      if (w.badge) list.push({ key: w.badge.key, title: w.badge.title, description: 'Пройти мир «' + w.title + '»', icon: w.badge.icon, world_id: w.id });
    });
    EXPEDITION_MILESTONES.forEach(function (m) {
      list.push({ key: 'explorer_' + m, title: m === 1 ? 'Первая экспедиция' : m + ' экспедиций', description: 'Завершить экспедиций: ' + m, icon: m >= 25 ? 'rocket' : 'tent' });
    });
    return list;
  }
  function grantAchievement(userId, key) {
    if (db.user_achievements.some(function (a) { return a.user_id === userId && a.key === key; })) return null;
    var a = achievements().find(function (x) { return x.key === key; });
    if (!a) return null;
    db.user_achievements.push({ user_id: userId, key: key, awarded_at: now() });
    awardOnce(userId, 'achievement', key, 0, 0);
    return a;
  }

  /* ---------------- аналитика ---------------- */
  function logEvent(userId, name, props) {
    db.events.push({ id: uid('ev_'), user_id: userId, name: name, props: props || {}, created_at: now() });
    if (db.events.length > 5000) db.events.splice(0, db.events.length - 5000);
  }

  /* ---------------- пользователи ---------------- */
  function worldSeen(userId, worldId) { return db.world_seen.some(function (x) { return x.user_id === userId && x.world_id === worldId; }); }
  function publicUser(u) {
    var w = wallet(u.id);
    var active = db.sessions.find(function (s) { return s.user_id === u.id && s.status === 'in_progress' && s.mode === 'lesson'; });
    var activeLesson = active && lessonById(active.lesson_id);
    return {
      id: u.id, display_name: u.display_name, email: u.email || null, locale: u.locale,
      settings: u.settings, roles: u.roles.slice(), learning_profile: u.learning_profile,
      onboarding_completed: !!u.onboarding_completed, intro_seen: worldSeen(u.id, 'text-detective'),
      xp: w.xp, coins: w.coins,
      can_access_cms: hasRole(u, 'editor'),
      active_session: activeLesson ? {
        id: active.id, lesson_id: active.lesson_id, title: activeLesson.title,
        answered: active.items.filter(function (i) { return i.done; }).length, total: active.items.length
      } : null
    };
  }
  function hasRole(u, role) {
    if (role === 'editor') return u.roles.indexOf('editor') !== -1 || u.roles.indexOf('admin') !== -1;
    return u.roles.indexOf(role) !== -1;
  }
  function requireRole(u, role) { if (!hasRole(u, role)) fail(403, 'forbidden', 'Недостаточно прав: требуется роль «' + role + '».'); }

  /* ---------------- вопросы для игрока (без answer_key) ---------------- */
  function publicQuestion(item) {
    var ref = versionByRef(item.question_version_id);
    var p = ref.v.payload;
    var options;
    if (ref.q.type === 'claim_check') options = CLAIM_OPTIONS;
    else if (ref.q.type === 'sequence_order') options = item.option_order.map(function (id) { return p.options.find(function (o) { return o.id === id; }); });
    else options = p.options;
    return {
      question_version_id: item.question_version_id, type: ref.q.type, skill_id: ref.q.skill_id,
      title: p.title, robot_line: p.robot_line || null, instruction: p.instruction, stem: p.stem, body: p.body || null,
      options: clone(options), has_hint: !!p.hint,
      source_title: p.source_title || null, source_author: p.source_author || null
    };
  }

  function shuffled(arr, avoidIdentity) {
    var a = arr.slice();
    for (var t = 0; t < 10; t++) {
      for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var x = a[i]; a[i] = a[j]; a[j] = x; }
      if (!avoidIdentity || a.join() !== arr.join()) break;
    }
    return a;
  }
  function makeItem(qid, order) {
    var q = questionById(qid); var v = q && publishedVersion(q);
    if (!v) return null;
    var item = { question_id: qid, question_version_id: qid + '@v' + v.version, skill_id: q.skill_id, order: order,
      attempts: 0, done: false, solved: false, first_correct: null, hint_used: false };
    if (q.type === 'sequence_order') item.option_order = shuffled(v.payload.options.map(function (o) { return o.id; }), true);
    return item;
  }

  function sessionPublic(s) {
    var answered = s.items.filter(function (i) { return i.done; }).length;
    var meta = s.lesson_id ? lessonById(s.lesson_id) : null;
    var exp = s.expedition_id ? db.expeditions.find(function (e) { return e.id === s.expedition_id; }) : null;
    var city = meta ? cityById(meta.city_id) : null;
    return {
      id: s.id, mode: s.mode, lesson_id: s.lesson_id, status: s.status, expedition_id: s.expedition_id || null,
      title: meta ? meta.title : exp ? 'Экспедиция №' + exp.n + ': ' + exp.title : 'Повторение ошибок',
      city_id: meta ? meta.city_id : null, world_id: city ? city.world_id : null,
      progress: { answered: answered, total: s.items.length }, started_at: s.started_at, finished_at: s.finished_at,
      result: s.result
    };
  }
  function ownSession(user, id) {
    var s = db.sessions.find(function (x) { return x.id === id && x.user_id === user.id; });
    if (!s) fail(404, 'not_found', 'Сессия не найдена.'); // чужие сессии неотличимы от несуществующих
    return s;
  }

  function sameSet(a, b) { if (a.length !== b.length) return false; var s = a.slice().sort().join('|'); return s === b.slice().sort().join('|'); }
  function sameSeq(a, b) { return a.length === b.length && a.every(function (x, i) { return x === b[i]; }); }

  /* ---------------- навыки / адаптивность ---------------- */
  function skillStats(userId) {
    var res = {};
    Object.keys(SEED.skills).forEach(function (k) { res[k] = []; });
    db.attempts.filter(function (a) { return a.user_id === userId && a.attempt_no === 1; })
      .forEach(function (a) { if (res[a.skill_id]) res[a.skill_id].push(a.is_correct); });
    return Object.keys(res).map(function (k) {
      var last = res[k].slice(-ADAPTIVE_N);
      var correct = last.filter(Boolean).length;
      var status = last.length < ADAPTIVE_MIN ? 'insufficient_data' : (correct / last.length < ADAPTIVE_THRESHOLD ? 'needs_review' : 'ok');
      return { skill_id: k, title: SEED.skills[k], sample: last.length, correct: correct,
        accuracy: last.length ? correct / last.length : null, status: status };
    });
  }

  /* ---------------- экспедиции (бесконечный режим) ---------------- */
  var EXP_ADJ = ['Туманных', 'Шепчущих', 'Звёздных', 'Хрустальных', 'Поющих', 'Ночных', 'Летающих', 'Тихих', 'Перепутанных', 'Янтарных', 'Северных', 'Затерянных', 'Солнечных', 'Зеркальных'];
  var EXP_NOUN = ['Маяков', 'Карт', 'Ключей', 'Страниц', 'Часов', 'Мостов', 'Фонарей', 'Свитков', 'Загадок', 'Компасов', 'Архивов', 'Перьев', 'Башен'];
  var EXP_PLACE = ['Город', 'Остров', 'Долина', 'Гавань', 'Обсерватория', 'Оазис'];
  var EXP_ICONS = ['map', 'tent', 'mountain-snow', 'sailboat', 'orbit', 'castle', 'trees', 'ship', 'sun', 'tower-control', 'tree-palm', 'rocket'];
  var EXP_COLORS = ['#5b6cff', '#14a37f', '#e07a1f', '#c2489b', '#2b8ac6', '#7b5cff', '#d1495b', '#0f9aa8'];
  function expeditionMeta(n) {
    // детерминированное имя по номеру: имена не повторяются подряд
    var place = EXP_PLACE[(n * 5) % EXP_PLACE.length];
    var adj = EXP_ADJ[(n * 7 + 3) % EXP_ADJ.length];
    var noun = EXP_NOUN[(n * 3 + 1) % EXP_NOUN.length];
    return { title: place + ' ' + adj + ' ' + noun, icon: EXP_ICONS[n % EXP_ICONS.length], color: EXP_COLORS[(n * 3) % EXP_COLORS.length] };
  }
  /* Подбор заданий: из пройденных уроков, сначала ошибки и слабые навыки, без повторов из прошлой экспедиции */
  function pickExpeditionQuestions(userId) {
    var passedLessons = chain().filter(function (l) { return isPassed(userId, l.id); });
    var pool = [];
    passedLessons.forEach(function (l) { lessonQuestionIds(l).forEach(function (qid) {
      var q = questionById(qid); if (q && publishedVersion(q) && pool.indexOf(qid) === -1) pool.push(qid);
    }); });
    var mistakes = {}; db.mistakes.forEach(function (m) { if (m.user_id === userId && !m.resolved_at) mistakes[m.question_id] = 1; });
    var recent = {};
    db.expeditions.filter(function (e) { return e.user_id === userId; }).slice(-2)
      .forEach(function (e) { e.question_ids.forEach(function (q) { recent[q] = 1; }); });
    var stats = skillStats(userId);
    var weak = {}; stats.forEach(function (s) { weak[s.skill_id] = s.status === 'needs_review' ? 3 : s.status === 'insufficient_data' ? 1.5 : 1; });
    // навыки по слабости: слабые попадают в слоты чаще
    var skills = stats.slice().sort(function (a, b) { return (a.accuracy == null ? .5 : a.accuracy) - (b.accuracy == null ? .5 : b.accuracy); }).map(function (s) { return s.skill_id; });
    var slots = [skills[0], skills[1], skills[0], skills[2], skills[3], skills[4], skills[1]];
    var picked = [];
    function weight(qid) {
      var q = questionById(qid);
      return (mistakes[qid] ? 6 : 1) * (weak[q.skill_id] || 1) * (recent[qid] ? 0.15 : 1);
    }
    function pickFrom(cands) {
      var total = cands.reduce(function (s, q) { return s + weight(q); }, 0);
      var r = Math.random() * total;
      for (var i = 0; i < cands.length; i++) { r -= weight(cands[i]); if (r <= 0) return cands[i]; }
      return cands[cands.length - 1];
    }
    for (var i = 0; i < slots.length && picked.length < EXPEDITION_SIZE; i++) {
      var cands = pool.filter(function (qid) { return picked.indexOf(qid) === -1 && questionById(qid).skill_id === slots[i]; });
      if (cands.length) picked.push(pickFrom(cands));
    }
    while (picked.length < EXPEDITION_SIZE) {
      var rest = pool.filter(function (qid) { return picked.indexOf(qid) === -1; });
      if (!rest.length) break;
      picked.push(pickFrom(rest));
    }
    return shuffled(picked);
  }
  function expeditionPublic(e) {
    return e ? { id: e.id, n: e.n, title: e.title, icon: e.icon, color: e.color, status: e.status, size: e.question_ids.length,
      best_score: e.best_score, created_at: e.created_at, completed_at: e.completed_at } : null;
  }

  /* ---------------- карта мира ---------------- */
  function worldMap(user, world) {
    var uidv = user.id;
    var ch = chain();
    var current = ch.find(function (l) { return lessonStatus(uidv, l.id) === 'unlocked'; });
    var cs = citiesOfWorld(world.id);
    var next = nextWorldAfter(world.id);
    return {
      world: { id: world.id, title: world.title, subtitle: world.subtitle, icon: world.icon, color: world.color, order: world.order,
        intro: world.intro || [], intro_button: world.intro_button, intro_after: world.intro_after,
        status: worldStatus(uidv, world), intro_seen: worldSeen(uidv, world.id), source: world.source || null },
      next_world: next ? { id: next.id, title: next.title } : null,
      current_lesson_id: current ? current.id : null,
      completed: worldCompleted(uidv, world.id),
      fragments: cs.map(function (c) { return cityCompleted(uidv, c.id) ? c.fragment : null; }),
      cities: cs.map(function (c) {
        var ls = lessonsOfCity(c.id);
        return {
          id: c.id, world_id: c.world_id, order: c.order, title: c.title, mode: c.mode, description: c.description, icon: c.icon, color: c.color, scene: c.scene || null,
          skill_id: c.skill_id, type: c.type, story_intro: c.story_intro || [], intro_button: c.intro_button, story_outro: c.story_outro || [],
          status: cityStatus(uidv, c), intro_seen: db.city_seen.some(function (x) { return x.user_id === uidv && x.city_id === c.id; }),
          fragment: cityCompleted(uidv, c.id) ? c.fragment : null, badge: c.badge,
          lessons_total: ls.length, lessons_completed: ls.filter(function (l) { return isPassed(uidv, l.id); }).length,
          lessons: ls.map(function (l) {
            var p = progressOf(uidv, l.id);
            return { id: l.id, order: l.order, title: l.title, status: lessonStatus(uidv, l.id),
              questions_count: lessonQuestionIds(l).length, best_score: p ? p.best_score : null };
          })
        };
      })
    };
  }

  /* ================= РОУТЫ ================= */
  var routes = [];
  function route(method, pattern, auth, handler) {
    var keys = [];
    var re = new RegExp('^' + pattern.replace(/:(\w+)/g, function (_, k) { keys.push(k); return '([^/]+)'; }) + '$');
    routes.push({ method: method, re: re, keys: keys, auth: auth, handler: handler });
  }

  /* ---- auth (Sanctum) ---- */
  route('POST', '/auth/register', false, function (ctx) {
    var name = String(ctx.body.display_name || '').trim();
    var password = String(ctx.body.password || '');
    if (name.length < 2 || name.length > 32) fail(422, 'validation', 'Проверьте данные', { display_name: 'От 2 до 32 символов' });
    if (password.length < 4) fail(422, 'validation', 'Проверьте данные', { password: 'Минимум 4 символа' });
    if (db.users.some(function (u) { return u.display_name.toLowerCase() === name.toLowerCase(); }))
      fail(422, 'validation', 'Проверьте данные', { display_name: 'Такой никнейм уже занят' });
    var u = { id: uid('u_'), display_name: name, email: ctx.body.email || null, password: password, locale: 'ru',
      roles: [], settings: { font_scale: 1, reduce_motion: false }, learning_profile: null,
      onboarding_completed: false, created_at: now() };
    db.users.push(u);
    var token = uid('tok_'); db.tokens[token] = u.id;
    return { token: token, user: publicUser(u) };
  });
  route('POST', '/auth/login', false, function (ctx) {
    var name = String(ctx.body.display_name || '').trim().toLowerCase();
    var u = db.users.find(function (x) { return x.display_name.toLowerCase() === name; });
    if (!u || u.password !== String(ctx.body.password || '')) fail(422, 'validation', 'Неверный никнейм или пароль', { password: 'Неверный никнейм или пароль' });
    var token = uid('tok_'); db.tokens[token] = u.id;
    return { token: token, user: publicUser(u) };
  });
  route('POST', '/auth/logout', true, function (ctx) { delete db.tokens[ctx.token]; return { ok: true }; });

  /* ---- профиль ---- */
  route('GET', '/me', true, function (ctx) { return publicUser(ctx.user); });
  route('PATCH', '/me/learning-profile', true, function (ctx) {
    var allowed = ['school', 'student', 'teacher', 'adult'];
    if (allowed.indexOf(ctx.body.role_type) === -1) fail(422, 'validation', 'Неизвестный профиль');
    var first = !ctx.user.onboarding_completed;
    ctx.user.learning_profile = { role_type: ctx.body.role_type, track_id: ctx.body.track_id || 'reading', age_band: ctx.body.age_band || null };
    // Профиль «учитель» — образовательный, НЕ даёт серверных прав (ТЗ §2, §11.2 п.5)
    if (ctx.body.complete_onboarding && first) { ctx.user.onboarding_completed = true; logEvent(ctx.user.id, 'onboarding_completed', { role_type: ctx.body.role_type }); }
    return publicUser(ctx.user);
  });
  route('PATCH', '/me/settings', true, function (ctx) {
    var s = ctx.user.settings;
    if (ctx.body.font_scale != null) s.font_scale = Math.min(1.4, Math.max(0.9, Number(ctx.body.font_scale) || 1));
    if (ctx.body.reduce_motion != null) s.reduce_motion = !!ctx.body.reduce_motion;
    if (ctx.body.display_name) {
      var n = String(ctx.body.display_name).trim();
      if (n.length < 2 || n.length > 32) fail(422, 'validation', 'Никнейм: от 2 до 32 символов');
      ctx.user.display_name = n;
    }
    return publicUser(ctx.user);
  });

  /* ---- вселенная, миры, города ---- */
  route('GET', '/tracks', true, function () { return SEED.tracks; });
  route('GET', '/universe', true, function (ctx) {
    var u = ctx.user;
    var ch = chain();
    var current = ch.find(function (l) { return lessonStatus(u.id, l.id) === 'unlocked'; });
    var currentCity = current ? cityById(current.city_id) : null;
    var open = db.expeditions.find(function (e) { return e.user_id === u.id && e.status === 'open'; });
    return {
      current_lesson_id: current ? current.id : null,
      current_world_id: currentCity ? currentCity.world_id : null,
      worlds: allWorlds(false).map(function (w) {
        var ls = lessonsOfWorld(w.id), cs = citiesOfWorld(w.id);
        return { id: w.id, order: w.order, title: w.title, subtitle: w.subtitle, icon: w.icon, color: w.color, source: w.source || null,
          status: worldStatus(u.id, w), lessons_total: ls.length,
          lessons_completed: ls.filter(function (l) { return isPassed(u.id, l.id); }).length,
          cities_total: cs.length, cities_completed: cs.filter(function (c) { return cityCompleted(u.id, c.id); }).length };
      }),
      expeditions: {
        unlocked: expeditionsUnlocked(u.id),
        completed_count: db.expeditions.filter(function (e) { return e.user_id === u.id && e.status === 'completed'; }).length,
        current: expeditionPublic(open)
      }
    };
  });
  route('GET', '/worlds/:worldId/map', true, function (ctx) {
    var world = worldById(ctx.params.worldId);
    if (!world) fail(404, 'not_found', 'Мир не найден');
    return worldMap(ctx.user, world);
  });
  route('GET', '/cities/:cityId/map', true, function (ctx) {
    var c = cityById(ctx.params.cityId);
    var world = c && worldById(c.world_id);
    if (!world) fail(404, 'not_found', 'Город не найден');
    return worldMap(ctx.user, world);
  });
  route('POST', '/worlds/:worldId/seen', true, function (ctx) {
    var w = worldById(ctx.params.worldId); if (!w) fail(404, 'not_found', 'Мир не найден');
    if (!worldSeen(ctx.user.id, w.id)) db.world_seen.push({ user_id: ctx.user.id, world_id: w.id, at: now() });
    logEvent(ctx.user.id, 'world_opened', { world_id: w.id });
    return { ok: true };
  });
  route('POST', '/cities/:cityId/seen', true, function (ctx) {
    var c = cityById(ctx.params.cityId); if (!c) fail(404, 'not_found', 'Город не найден');
    if (!db.city_seen.some(function (x) { return x.user_id === ctx.user.id && x.city_id === c.id; }))
      db.city_seen.push({ user_id: ctx.user.id, city_id: c.id, at: now() });
    logEvent(ctx.user.id, 'city_opened', { city_id: c.id });
    return { ok: true };
  });
  route('GET', '/lessons/:lessonId', true, function (ctx) {
    var l = lessonById(ctx.params.lessonId); if (!l) fail(404, 'not_found', 'Урок не найден');
    var p = progressOf(ctx.user.id, l.id);
    return { id: l.id, city_id: l.city_id, title: l.title, order: l.order, pass_threshold: l.pass_threshold, xp: l.xp,
      questions_count: lessonQuestionIds(l).length, status: lessonStatus(ctx.user.id, l.id), best_score: p ? p.best_score : null };
  });
  route('GET', '/worlds/:worldId/final', true, function (ctx) {
    var w = worldById(ctx.params.worldId);
    if (!w) fail(404, 'not_found', 'Мир не найден');
    if (!worldCompleted(ctx.user.id, w.id)) fail(403, 'locked', 'Финал откроется после прохождения всех городов этого мира.');
    var next = nextWorldAfter(w.id);
    return { world_id: w.id, world_title: w.title, phrase: w.final_phrase, title: w.final_title, scene: w.final_scene || [],
      badge: w.final_badge, badge_icon: w.badge ? w.badge.icon : 'award',
      tail: w.final_tail || { notice: 'ПОЛУЧЕНО НОВОЕ ДЕЛО', derek: 'Похоже, нас уже ждут!' },
      next: next ? { type: 'world', world_id: next.id, title: next.title } : { type: 'expeditions' } };
  });

  /* ---- экспедиции ---- */
  route('GET', '/expeditions', true, function (ctx) {
    var u = ctx.user;
    var mine = db.expeditions.filter(function (e) { return e.user_id === u.id; });
    var done = mine.filter(function (e) { return e.status === 'completed'; });
    var nextMilestone = EXPEDITION_MILESTONES.find(function (m) { return m > done.length; }) || null;
    var open = mine.find(function (e) { return e.status === 'open'; });
    var openSession = open && db.sessions.find(function (s) { return s.expedition_id === open.id && s.status === 'in_progress'; });
    return {
      unlocked: expeditionsUnlocked(u.id),
      unlock_hint: 'Экспедиции откроются после прохождения первого мира.',
      completed_count: done.length,
      next_milestone: nextMilestone,
      current: expeditionPublic(open),
      current_session: openSession ? sessionPublic(openSession) : null,
      upcoming: expeditionMeta(mine.length + (open ? 0 : 1)),
      history: done.slice(-20).reverse().map(expeditionPublic)
    };
  });
  route('POST', '/expeditions/start', true, function (ctx) {
    var u = ctx.user;
    if (!expeditionsUnlocked(u.id)) fail(403, 'locked', 'Экспедиции откроются после прохождения первого мира.');
    var exp = db.expeditions.find(function (e) { return e.user_id === u.id && e.status === 'open'; });
    if (!exp) {
      var n = db.expeditions.filter(function (e) { return e.user_id === u.id; }).length + 1;
      var qids = pickExpeditionQuestions(u.id);
      if (qids.length < 3) fail(422, 'empty', 'Недостаточно заданий для экспедиции.');
      var meta = expeditionMeta(n);
      exp = { id: uid('exp_'), user_id: u.id, n: n, title: meta.title, icon: meta.icon, color: meta.color,
        question_ids: qids, status: 'open', best_score: null, created_at: now(), completed_at: null };
      db.expeditions.push(exp);
      logEvent(u.id, 'expedition_created', { expedition_id: exp.id, n: n });
    }
    var s = db.sessions.find(function (x) { return x.user_id === u.id && x.expedition_id === exp.id && x.status === 'in_progress'; });
    if (!s) {
      var items = exp.question_ids.map(makeItem).filter(Boolean);
      items.forEach(function (it, i) { it.order = i; });
      s = { id: uid('ses_'), user_id: u.id, lesson_id: null, expedition_id: exp.id, mode: 'expedition', status: 'in_progress',
        items: items, started_at: now(), finished_at: null, result: null };
      db.sessions.push(s);
      logEvent(u.id, 'lesson_started', { expedition_id: exp.id, session_id: s.id });
    }
    return { expedition: expeditionPublic(exp), session: sessionPublic(s) };
  });

  /* ---- сессии урока ---- */
  route('POST', '/lesson-sessions', true, function (ctx) {
    var u = ctx.user;
    var mode = ctx.body.mode === 'review' ? 'review' : 'lesson';
    var s;
    if (mode === 'lesson') {
      var l = lessonById(ctx.body.lesson_id);
      if (!l) fail(404, 'not_found', 'Урок не найден');
      if (!isUnlocked(u.id, l.id)) fail(403, 'locked', 'Этот урок пока закрыт. Пройдите предыдущий урок.');
      s = db.sessions.find(function (x) { return x.user_id === u.id && x.lesson_id === l.id && x.status === 'in_progress'; });
      if (s) return sessionPublic(s); // US-04: продолжить
      var items = lessonQuestionIds(l).map(makeItem).filter(Boolean).slice(0, 5);
      items.forEach(function (it, i) { it.order = i; });
      if (!items.length) fail(422, 'empty', 'В уроке пока нет опубликованных заданий.');
      // одна активная lesson-сессия: остальные помечаем прерванными
      db.sessions.forEach(function (x) {
        if (x.user_id === u.id && x.status === 'in_progress' && x.mode === 'lesson') { x.status = 'abandoned'; logEvent(u.id, 'lesson_abandoned', { lesson_id: x.lesson_id }); }
      });
      s = { id: uid('ses_'), user_id: u.id, lesson_id: l.id, mode: 'lesson', status: 'in_progress', items: items,
        started_at: now(), finished_at: null, result: null, idempotency_key: ctx.body.idempotency_key || null };
      db.sessions.push(s);
      logEvent(u.id, 'lesson_started', { lesson_id: l.id, session_id: s.id });
      return sessionPublic(s);
    }
    // review
    s = db.sessions.find(function (x) { return x.user_id === u.id && x.mode === 'review' && x.status === 'in_progress'; });
    if (s) return sessionPublic(s);
    var pool = db.mistakes.filter(function (m) { return m.user_id === u.id && !m.resolved_at && (!ctx.body.skill_id || m.skill_id === ctx.body.skill_id); });
    if (!pool.length) fail(422, 'nothing_to_review', 'Ошибок для повторения нет — отличная работа!');
    var ritems = pool.slice(0, 5).map(function (m, i) { return makeItem(m.question_id, i); }).filter(Boolean);
    s = { id: uid('ses_'), user_id: u.id, lesson_id: null, mode: 'review', status: 'in_progress', items: ritems,
      started_at: now(), finished_at: null, result: null };
    db.sessions.push(s);
    logEvent(u.id, 'review_started', { session_id: s.id, size: ritems.length });
    return sessionPublic(s);
  });

  route('GET', '/lesson-sessions/:id', true, function (ctx) { return sessionPublic(ownSession(ctx.user, ctx.params.id)); });

  route('GET', '/lesson-sessions/:id/current', true, function (ctx) {
    var s = ownSession(ctx.user, ctx.params.id);
    var item = s.items.find(function (i) { return !i.done; });
    return {
      session: sessionPublic(s),
      question: item ? publicQuestion(item) : null,
      state: item ? { attempts: item.attempts, hint_used: item.hint_used } : null,
      next_action: item ? 'answer' : (s.status === 'completed' ? 'show_result' : 'complete')
    };
  });

  route('POST', '/lesson-sessions/:id/hint', true, function (ctx) {
    var s = ownSession(ctx.user, ctx.params.id);
    var item = s.items.find(function (i) { return !i.done; });
    if (!item) fail(409, 'no_question', 'Нет активного задания');
    var ref = versionByRef(item.question_version_id);
    if (!item.hint_used) { item.hint_used = true; logEvent(ctx.user.id, 'hint_opened', { question_version_id: item.question_version_id }); }
    return { hint: ref.v.payload.hint || 'Перечитай текст ещё раз, не торопись.' };
  });

  route('POST', '/lesson-sessions/:id/answers', true, function (ctx) {
    var u = ctx.user;
    var s = ownSession(u, ctx.params.id);
    var b = ctx.body;
    // Form Request: валидация
    if (!b.client_attempt_id || typeof b.client_attempt_id !== 'string') fail(422, 'validation', 'client_attempt_id обязателен');
    var prev = db.attempts.find(function (a) { return a.session_id === s.id && a.client_attempt_id === b.client_attempt_id; });
    if (prev) return prev.response; // идемпотентность: тот же результат, без повторной записи
    if (s.status !== 'in_progress') fail(409, 'session_closed', 'Сессия уже завершена');
    var item = s.items.find(function (i) { return !i.done; });
    if (!item) fail(409, 'no_question', 'Все задания уже отвечены');
    if (b.question_version_id !== item.question_version_id) fail(409, 'stale_question', 'Задание изменилось, обновите экран');

    var ref = versionByRef(item.question_version_id);
    var type = ref.q.type, key = ref.v.answer_key, p = ref.v.payload;
    var validIds = type === 'claim_check' ? CLAIM_OPTIONS.map(function (o) { return o.id; }) : p.options.map(function (o) { return o.id; });
    var answer, correct;
    if (type === 'sequence_order') {
      answer = Array.isArray(b.ordered_ids) ? b.ordered_ids.map(String) : null;
      if (!answer || !sameSet(answer, validIds)) fail(422, 'validation', 'ordered_ids должен содержать все карточки');
      correct = sameSeq(answer, key);
    } else {
      answer = Array.isArray(b.selected_option_ids) ? b.selected_option_ids.map(String) : null;
      if (!answer || answer.length !== 1 || validIds.indexOf(answer[0]) === -1) fail(422, 'validation', 'Выберите один вариант');
      correct = sameSet(answer, key);
    }

    item.attempts += 1;
    var attemptNo = item.attempts;
    if (attemptNo === 1) item.first_correct = correct;

    var resp = { attempt_id: uid('att_'), is_correct: correct, attempt_no: attemptNo };
    if (correct) {
      item.done = true; item.solved = true;
      resp.feedback = p.feedback_correct || 'Верно!';
      resp.explanation = p.explanation && p.explanation !== p.feedback_correct ? p.explanation : null;
      if (s.mode !== 'lesson') { // повторение и экспедиции закрывают ошибки
        db.mistakes.forEach(function (m) { if (m.user_id === u.id && m.question_id === item.question_id && !m.resolved_at) m.resolved_at = now(); });
      }
    } else {
      // US-03: ошибка сохраняется для повторения (без блокирующих жизней)
      if (!db.mistakes.some(function (m) { return m.user_id === u.id && m.question_id === item.question_id && !m.resolved_at; }))
        db.mistakes.push({ user_id: u.id, question_id: item.question_id, skill_id: item.skill_id, created_at: now(), resolved_at: null });
      if (attemptNo < 2) {
        // US-02 п.5: первая ошибка — подсказка, правильный ответ не раскрываем
        resp.feedback = p.feedback_wrong || 'Пока не то.';
        resp.hint = p.hint || null;
        item.hint_used = item.hint_used || !!p.hint;
      } else {
        item.done = true;
        resp.feedback = 'Разберёмся вместе.';
        resp.explanation = p.explanation || p.feedback_correct || null;
        resp.correct_option_ids = key.slice(); // раскрывается только после 2 ошибок
      }
    }
    var remaining = s.items.filter(function (i) { return !i.done; }).length;
    resp.next_action = !item.done ? 'retry' : (remaining ? 'next_question' : 'complete');
    resp.session_progress = { answered: s.items.length - remaining, total: s.items.length };

    db.attempts.push({ id: resp.attempt_id, session_id: s.id, user_id: u.id, question_version_id: item.question_version_id,
      skill_id: item.skill_id, attempt_no: attemptNo, answer_payload: answer, is_correct: correct,
      client_attempt_id: b.client_attempt_id, answered_at: now(), response: resp });
    logEvent(u.id, 'answer_submitted', { question_version_id: item.question_version_id, attempt_no: attemptNo, is_correct: correct });
    return resp;
  });

  route('POST', '/lesson-sessions/:id/complete', true, function (ctx) {
    var u = ctx.user;
    var s = ownSession(u, ctx.params.id);
    if (s.status === 'completed') return s.result; // повторный запрос — тот же результат, без начислений
    if (s.status !== 'in_progress') fail(409, 'session_closed', 'Сессия была прервана');
    if (s.items.some(function (i) { return !i.done; })) fail(409, 'not_finished', 'Сначала ответьте на все задания');

    /* ---- DB::transaction() ---- */
    var snapshot = JSON.stringify(db);
    try {
      var total = s.items.length;
      var firstCorrect = s.items.filter(function (i) { return i.first_correct === true; }).length;
      var solved = s.items.filter(function (i) { return i.solved; }).length;
      var score = total ? firstCorrect / total : 0;
      var xp = 0, coins = 0, newAch = [];
      function push(a) { if (a) newAch.push(a); }
      s.items.forEach(function (i) {
        if (i.solved) { var e = awardOnce(u.id, 'question_correct', s.id + ':' + i.question_id, XP_PER_QUESTION, 0); if (e) xp += e.xp_delta; }
      });
      var result = { session_id: s.id, mode: s.mode, lesson_id: s.lesson_id, total: total, first_correct: firstCorrect,
        solved: solved, score: score, passed: false, xp_gained: 0, coins_gained: 0, new_achievements: [],
        city_completed: null, world_completed: null, next: null, lesson_outro: null, expedition: null };

      if (s.mode === 'lesson') {
        var l = lessonById(s.lesson_id);
        var city = cityById(l.city_id);
        var passed = score >= l.pass_threshold;
        result.passed = passed;
        var p = progressOf(u.id, l.id);
        if (!p) { p = { user_id: u.id, lesson_id: l.id, best_score: 0, completed_at: null, unlocked_at: now() }; db.progress.push(p); }
        p.best_score = Math.max(p.best_score || 0, score);
        var cityWasDone = cityCompleted(u.id, l.city_id);
        var worldWasDone = worldCompleted(u.id, city.world_id);
        if (passed) {
          if (!p.completed_at) p.completed_at = now();
          var le = awardOnce(u.id, 'lesson_completed', l.id, l.xp, COINS_PER_LESSON);
          if (le) { xp += le.xp_delta; coins += le.coin_delta; }
          if (l.outro) result.lesson_outro = l.outro;
          var passedCount = db.progress.filter(function (x) { return x.user_id === u.id && x.completed_at; }).length;
          push(grantAchievement(u.id, 'first_case'));
          if (passedCount >= 5) push(grantAchievement(u.id, 'five_lessons'));
          if (!cityWasDone && cityCompleted(u.id, l.city_id)) {
            awardOnce(u.id, 'city_completed', city.id, 0, 0);
            push(grantAchievement(u.id, 'city_restored')); push(grantAchievement(u.id, city.badge.key));
            result.city_completed = { city_id: city.id, title: city.title, fragment: city.fragment, badge: city.badge, story_outro: city.story_outro || [],
              fragments: citiesOfWorld(city.world_id).map(function (x) { return cityCompleted(u.id, x.id) ? x.fragment : null; }) };
          }
          if (!worldWasDone && worldCompleted(u.id, city.world_id)) {
            var w = worldById(city.world_id);
            result.world_completed = { world_id: w.id, title: w.title };
            if (w.badge) push(grantAchievement(u.id, w.badge.key));
          }
          var ch = chain();
          var nextL = ch[ch.findIndex(function (x) { return x.id === l.id; }) + 1];
          result.next = result.world_completed ? { type: 'final', world_id: result.world_completed.world_id }
            : (nextL ? { type: 'lesson', lesson_id: nextL.id, city_id: nextL.city_id, title: nextL.title } : null);
        }
        logEvent(u.id, 'lesson_completed', { lesson_id: l.id, session_id: s.id, passed: passed, score: score,
          duration_ms: Date.now() - new Date(s.started_at).getTime() });
      } else if (s.mode === 'expedition') {
        var exp = db.expeditions.find(function (e) { return e.id === s.expedition_id; });
        var ok = score >= 0.6;
        result.passed = ok;
        exp.best_score = Math.max(exp.best_score || 0, score);
        if (ok) {
          exp.status = 'completed'; exp.completed_at = now();
          var ee = awardOnce(u.id, 'expedition_completed', exp.id, EXPEDITION_XP, EXPEDITION_COINS);
          if (ee) { xp += ee.xp_delta; coins += ee.coin_delta; }
          var cnt = db.expeditions.filter(function (e) { return e.user_id === u.id && e.status === 'completed'; }).length;
          EXPEDITION_MILESTONES.forEach(function (m) { if (cnt >= m) push(grantAchievement(u.id, 'explorer_' + m)); });
        }
        result.expedition = { id: exp.id, n: exp.n, title: exp.title, icon: exp.icon, color: exp.color, passed: ok };
        result.next = { type: 'expedition' };
        logEvent(u.id, 'lesson_completed', { expedition_id: exp.id, session_id: s.id, passed: ok, score: score,
          duration_ms: Date.now() - new Date(s.started_at).getTime() });
      }
      result.xp_gained = xp; result.coins_gained = coins; result.new_achievements = newAch;
      result.wallet = wallet(u.id);
      s.status = 'completed'; s.finished_at = now(); s.result = result;
      return result;
    } catch (e) { db = JSON.parse(snapshot); throw e; }
  });

  /* ---- прогресс и повторение ---- */
  route('GET', '/me/progress', true, function (ctx) {
    var u = ctx.user;
    var firsts = db.attempts.filter(function (a) { return a.user_id === u.id && a.attempt_no === 1; });
    var ch = chain();
    var cities = [];
    allWorlds(false).forEach(function (w) {
      citiesOfWorld(w.id).forEach(function (c) {
        var ls = lessonsOfCity(c.id);
        cities.push({ id: c.id, world_id: w.id, world_title: w.title, title: c.title, icon: c.icon, color: c.color, status: cityStatus(u.id, c),
          completed: ls.filter(function (l) { return isPassed(u.id, l.id); }).length, total: ls.length });
      });
    });
    return {
      wallet: wallet(u.id),
      lessons_completed: ch.filter(function (l) { return isPassed(u.id, l.id); }).length,
      lessons_total: ch.length,
      first_try_accuracy: firsts.length >= ADAPTIVE_MIN ? firsts.filter(function (a) { return a.is_correct; }).length / firsts.length : null,
      answers_total: firsts.length,
      cities: cities,
      skills: skillStats(u.id),
      expeditions_completed: db.expeditions.filter(function (e) { return e.user_id === u.id && e.status === 'completed'; }).length
    };
  });
  route('GET', '/me/review', true, function (ctx) {
    var u = ctx.user;
    var open = db.mistakes.filter(function (m) { return m.user_id === u.id && !m.resolved_at; });
    var stats = skillStats(u.id);
    return {
      total: open.length,
      skills: stats.map(function (st) {
        var items = open.filter(function (m) { return m.skill_id === st.skill_id; });
        return Object.assign({}, st, {
          mistakes: items.length,
          questions: items.map(function (m) { var q = questionById(m.question_id); var v = q && publishedVersion(q); return { id: m.question_id, title: v ? v.payload.title : m.question_id }; })
        });
      }),
      active_session: (function () {
        var s = db.sessions.find(function (x) { return x.user_id === u.id && x.mode === 'review' && x.status === 'in_progress'; });
        return s ? sessionPublic(s) : null;
      })()
    };
  });
  route('GET', '/me/achievements', true, function (ctx) {
    return achievements().map(function (a) {
      var got = db.user_achievements.find(function (x) { return x.user_id === ctx.user.id && x.key === a.key; });
      return Object.assign({}, a, { awarded_at: got ? got.awarded_at : null });
    });
  });
  route('POST', '/events', true, function (ctx) {
    var allowed = ['world_opened', 'city_opened', 'lesson_abandoned'];
    if (allowed.indexOf(ctx.body.name) === -1) fail(422, 'validation', 'Неизвестное событие');
    logEvent(ctx.user.id, ctx.body.name, ctx.body.props || {});
    return { ok: true };
  });

  /* ---- CMS: задания ---- */
  function adminQuestionRow(q) {
    var latest = q.versions[q.versions.length - 1];
    var pub = publishedVersion(q);
    var loc = cityOfQuestion(q.id);
    var c = loc.city_id && cityById(loc.city_id);
    return { id: q.id, type: q.type, skill_id: q.skill_id, difficulty: q.difficulty, city_id: loc.city_id, lesson_id: loc.lesson_id,
      world_id: c ? c.world_id : null,
      title: latest.payload.title, status: latest.status, latest_version: latest.version,
      published_version: pub ? pub.version : null, updated_at: q.updated_at };
  }
  function validatePayload(type, payload, key) {
    var errors = {};
    ['title', 'instruction', 'stem'].forEach(function (f) { if (!payload[f] || !String(payload[f]).trim()) errors[f] = 'Обязательное поле'; });
    if (type !== 'claim_check') {
      if (!Array.isArray(payload.options) || payload.options.length < 2) errors.options = 'Минимум 2 варианта';
      else {
        var ids = payload.options.map(function (o) { return o.id; });
        if (new Set(ids).size !== ids.length) errors.options = 'ID вариантов должны быть уникальны';
        if (!Array.isArray(key) || !key.length) errors.answer_key = 'Укажите правильный ответ';
        else if (type === 'sequence_order' && !sameSet(key, ids)) errors.answer_key = 'Для порядка укажите все ID в правильной последовательности';
        else if (type !== 'sequence_order' && (key.length !== 1 || ids.indexOf(key[0]) === -1)) errors.answer_key = 'Укажите один существующий ID варианта';
      }
    } else if (!Array.isArray(key) || key.length !== 1 || ['supported', 'contradicted', 'insufficient'].indexOf(key[0]) === -1) {
      errors.answer_key = 'supported / contradicted / insufficient';
    }
    if (Object.keys(errors).length) fail(422, 'validation', 'Проверьте поля задания', errors);
  }
  function audit(u, entityType, entityId, action, extra) {
    db.audit.push({ id: uid('aud_'), actor_id: u.id, actor: u.display_name, entity_type: entityType, entity_id: entityId, action: action, extra: extra || null, created_at: now() });
  }
  function adminLessonsList() {
    var out = [];
    allWorlds(true).forEach(function (w) {
      citiesOfWorld(w.id).forEach(function (c) {
        lessonsOfCity(c.id).forEach(function (l) { out.push({ id: l.id, city_id: c.id, world_id: w.id, title: w.title + ' › ' + c.title + ' › ' + l.title }); });
      });
    });
    return out;
  }

  route('GET', '/admin/questions', true, function (ctx) {
    requireRole(ctx.user, 'editor');
    var cities = [];
    allWorlds(true).forEach(function (w) { citiesOfWorld(w.id).forEach(function (c) { cities.push({ id: c.id, title: w.title + ' › ' + c.title }); }); });
    return { items: db.questions.map(adminQuestionRow), cities: cities, lessons: adminLessonsList(),
      skills: SEED.skills, editor_tasks: SEED.editor_tasks };
  });
  route('GET', '/admin/questions/:id', true, function (ctx) {
    requireRole(ctx.user, 'editor');
    var q = questionById(ctx.params.id); if (!q) fail(404, 'not_found', 'Задание не найдено');
    return Object.assign(adminQuestionRow(q), { versions: clone(q.versions),
      audit: db.audit.filter(function (a) { return a.entity_id === q.id; }).slice().reverse() });
  });
  route('POST', '/admin/questions', true, function (ctx) {
    requireRole(ctx.user, 'editor');
    var b = ctx.body;
    if (!TYPE_SKILL[b.type]) fail(422, 'validation', 'Неизвестный тип задания', { type: 'Выберите тип' });
    if (!lessonById(b.lesson_id)) fail(422, 'validation', 'Выберите урок', { lesson_id: 'Выберите урок' });
    validatePayload(b.type, b.payload || {}, b.answer_key);
    var id = 'cms-' + uid('');
    var q = { id: id, type: b.type, skill_id: b.skill_id || TYPE_SKILL[b.type], difficulty: b.difficulty || 'beginner',
      language: 'ru', audience_tags: ['school', 'general'], created_at: now(), updated_at: now(),
      versions: [{ version: 1, status: 'draft', payload: clone(b.payload), answer_key: b.answer_key.slice(), created_at: now(), author: ctx.user.display_name }] };
    db.questions.push(q);
    (db.lesson_extra[b.lesson_id] = db.lesson_extra[b.lesson_id] || []).push(id);
    audit(ctx.user, 'question', q.id, 'created', { version: 1 });
    return adminQuestionRow(q);
  });
  route('PUT', '/admin/questions/:id', true, function (ctx) {
    requireRole(ctx.user, 'editor');
    var q = questionById(ctx.params.id); if (!q) fail(404, 'not_found', 'Задание не найдено');
    validatePayload(q.type, ctx.body.payload || {}, ctx.body.answer_key);
    var latest = q.versions[q.versions.length - 1];
    if (latest.status === 'draft') {
      latest.payload = clone(ctx.body.payload); latest.answer_key = ctx.body.answer_key.slice(); latest.author = ctx.user.display_name;
      audit(ctx.user, 'question', q.id, 'draft_updated', { version: latest.version });
    } else {
      // опубликованная версия неизменяема — создаём новую редакцию (ТЗ §10.2)
      var v = { version: latest.version + 1, status: 'draft', payload: clone(ctx.body.payload), answer_key: ctx.body.answer_key.slice(), created_at: now(), author: ctx.user.display_name };
      q.versions.push(v);
      audit(ctx.user, 'question', q.id, 'version_created', { version: v.version });
    }
    q.updated_at = now();
    return adminQuestionRow(q);
  });
  route('POST', '/admin/questions/:id/submit', true, function (ctx) {
    requireRole(ctx.user, 'editor');
    var q = questionById(ctx.params.id); if (!q) fail(404, 'not_found', 'Задание не найдено');
    var latest = q.versions[q.versions.length - 1];
    if (latest.status !== 'draft') fail(409, 'invalid_state', 'На проверку отправляется только черновик');
    latest.status = 'review'; q.updated_at = now();
    audit(ctx.user, 'question', q.id, 'submitted_for_review', { version: latest.version });
    return adminQuestionRow(q);
  });
  route('POST', '/admin/questions/:id/publish', true, function (ctx) {
    requireRole(ctx.user, 'admin');
    var q = questionById(ctx.params.id); if (!q) fail(404, 'not_found', 'Задание не найдено');
    var latest = q.versions[q.versions.length - 1];
    if (latest.status !== 'review') fail(409, 'invalid_state', 'Публикуется только версия на проверке');
    q.versions.forEach(function (v) { if (v.status === 'published') v.status = 'archived'; });
    latest.status = 'published'; latest.published_at = now(); latest.published_by = ctx.user.display_name; q.updated_at = now();
    audit(ctx.user, 'question', q.id, 'published', { version: latest.version });
    return adminQuestionRow(q);
  });
  route('POST', '/admin/questions/:id/reject', true, function (ctx) {
    requireRole(ctx.user, 'admin');
    var q = questionById(ctx.params.id); if (!q) fail(404, 'not_found', 'Задание не найдено');
    var latest = q.versions[q.versions.length - 1];
    if (latest.status !== 'review') fail(409, 'invalid_state', 'Вернуть можно только версию на проверке');
    latest.status = 'draft'; q.updated_at = now();
    audit(ctx.user, 'question', q.id, 'returned_to_draft', { version: latest.version });
    return adminQuestionRow(q);
  });

  /* ---- CMS: миры, города, уроки ---- */
  function cmsWorld(id) {
    var w = db.cms.worlds.find(function (x) { return x.id === id; });
    if (!w) fail(404, 'not_found', 'Мир не найден или создан из сценария (только чтение)');
    return w;
  }
  function str(v, max) { return String(v == null ? '' : v).trim().slice(0, max || 500); }
  function lines(v) { return (Array.isArray(v) ? v : String(v || '').split('\n')).map(function (x) { return str(x, 600); }).filter(Boolean); }
  function worldReport(w) {
    var problems = [];
    var cs = citiesOfWorld(w.id);
    if (!cs.length) problems.push('Нет ни одного города');
    cs.forEach(function (c) {
      var ls = lessonsOfCity(c.id);
      if (!ls.length) problems.push('«' + c.title + '»: нет уроков');
      ls.forEach(function (l) {
        var published = lessonQuestionIds(l).filter(function (qid) { var q = questionById(qid); return q && publishedVersion(q); }).length;
        if (!published) problems.push('«' + c.title + ' › ' + l.title + '»: нет опубликованных заданий');
      });
    });
    return problems;
  }
  route('GET', '/admin/worlds', true, function (ctx) {
    requireRole(ctx.user, 'editor');
    return allWorlds(true).map(function (w) {
      return {
        id: w.id, title: w.title, subtitle: w.subtitle || '', order: w.order, status: w.status, editable: w.editable,
        icon: w.icon, color: w.color, source: w.source || 'CMS', problems: worldReport(w),
        cities: citiesOfWorld(w.id).map(function (c) {
          return { id: c.id, title: c.title, mode: c.mode, type: c.type, icon: c.icon, color: c.color, fragment: c.fragment,
            lessons: lessonsOfCity(c.id).map(function (l) {
              var ids = lessonQuestionIds(l);
              return { id: l.id, title: l.title, questions_total: ids.length,
                questions_published: ids.filter(function (qid) { var q = questionById(qid); return q && publishedVersion(q); }).length };
            }) };
        })
      };
    });
  });
  route('POST', '/admin/worlds', true, function (ctx) {
    requireRole(ctx.user, 'editor');
    var b = ctx.body;
    var title = str(b.title, 80);
    if (title.length < 2) fail(422, 'validation', 'Проверьте поля', { title: 'Название обязательно' });
    var order = allWorlds(true).reduce(function (m, w) { return Math.max(m, w.order); }, 0) + 1;
    var id = 'cw-' + uid('');
    var badgeTitle = str(b.final_badge, 60) || title;
    var w = {
      id: id, track_id: 'reading', title: title, subtitle: str(b.subtitle, 80), order: order, status: 'draft',
      icon: str(b.icon, 40) || 'orbit', color: str(b.color, 9) || '#7b5cff', source: 'CMS',
      badge: { key: 'world_' + id, title: badgeTitle, icon: str(b.icon, 40) || 'orbit' },
      intro: lines(b.intro).map(function (t) { return { speaker: 'derek', text: t }; }),
      intro_button: 'Начать', intro_after: 'Вперёд, напарник!',
      final_phrase: str(b.final_phrase, 120) || title.toUpperCase(), final_title: str(b.final_title, 80) || 'МИР ВОССТАНОВЛЕН',
      final_scene: lines(b.final_scene).map(function (t) { return { speaker: 'derek', text: t }; }),
      final_badge: badgeTitle.toUpperCase(),
      final_tail: { notice: 'ПОЛУЧЕНО НОВОЕ ДЕЛО', derek: 'Похоже, вселенная снова зовёт нас!' },
      created_at: now()
    };
    db.cms.worlds.push(w);
    audit(ctx.user, 'world', id, 'created');
    return { id: id };
  });
  route('POST', '/admin/worlds/:id/cities', true, function (ctx) {
    requireRole(ctx.user, 'editor');
    var w = cmsWorld(ctx.params.id);
    var b = ctx.body;
    var errors = {};
    if (str(b.title).length < 2) errors.title = 'Название обязательно';
    if (!TYPE_SKILL[b.type]) errors.type = 'Выберите тип заданий';
    if (!str(b.fragment)) errors.fragment = 'Фрагмент секретного сообщения обязателен';
    if (Object.keys(errors).length) fail(422, 'validation', 'Проверьте поля', errors);
    var id = 'cc-' + uid('');
    var c = { id: id, world_id: w.id, order: citiesOfWorld(w.id).length + 1, title: str(b.title, 80), mode: str(b.mode, 80),
      skill_id: TYPE_SKILL[b.type], type: b.type, icon: str(b.icon, 40) || 'map-pin', color: str(b.color, 9) || w.color,
      description: str(b.description, 200), story_intro: lines(b.story_intro), intro_button: 'Начать',
      story_outro: lines(b.story_outro).length ? lines(b.story_outro) : ['Город восстановлен!'],
      fragment: str(b.fragment, 40).toUpperCase(), badge: { key: 'badge_' + id, title: str(b.badge_title, 60) || str(b.title, 60), icon: str(b.icon, 40) || 'map-pin' } };
    db.cms.cities.push(c);
    audit(ctx.user, 'city', id, 'created', { world_id: w.id });
    return { id: id };
  });
  route('POST', '/admin/cities/:id/lessons', true, function (ctx) {
    requireRole(ctx.user, 'editor');
    var c = db.cms.cities.find(function (x) { return x.id === ctx.params.id; });
    if (!c) fail(404, 'not_found', 'Город не найден или создан из сценария (только чтение)');
    var title = str(ctx.body.title, 80);
    if (title.length < 2) fail(422, 'validation', 'Проверьте поля', { title: 'Название обязательно' });
    var id = 'cl-' + uid('');
    db.cms.lessons.push({ id: id, city_id: c.id, order: lessonsOfCity(c.id).length + 1, title: title, pass_threshold: 0.6, xp: 20, questions: [] });
    audit(ctx.user, 'lesson', id, 'created', { city_id: c.id });
    return { id: id };
  });
  route('POST', '/admin/worlds/:id/publish', true, function (ctx) {
    requireRole(ctx.user, 'admin');
    var w = cmsWorld(ctx.params.id);
    var problems = worldReport(w);
    if (problems.length) fail(422, 'not_ready', 'Мир не готов к публикации', { problems: problems.join('; ') });
    w.status = 'published'; w.published_at = now();
    audit(ctx.user, 'world', w.id, 'published');
    return { ok: true };
  });

  route('GET', '/admin/analytics', true, function (ctx) {
    requireRole(ctx.user, 'editor');
    var counts = {};
    db.events.forEach(function (e) { counts[e.name] = (counts[e.name] || 0) + 1; });
    var firsts = db.attempts.filter(function (a) { return a.attempt_no === 1; });
    var bySkill = Object.keys(SEED.skills).map(function (k) {
      var xs = firsts.filter(function (a) { return a.skill_id === k; });
      return { skill_id: k, title: SEED.skills[k], answers: xs.length, accuracy: xs.length ? xs.filter(function (a) { return a.is_correct; }).length / xs.length : null };
    });
    var completed = db.events.filter(function (e) { return e.name === 'lesson_completed'; });
    var durations = completed.map(function (e) { return e.props.duration_ms; }).filter(Boolean);
    var started = counts.lesson_started || 0;
    var byCity = [];
    allWorlds(false).forEach(function (w) {
      citiesOfWorld(w.id).forEach(function (c) {
        byCity.push({ id: c.id, title: w.title + ' › ' + c.title, completed_users: db.users.filter(function (u) { return cityCompleted(u.id, c.id); }).length });
      });
    });
    return {
      users: db.users.length, events: counts, skills: bySkill,
      lessons_started: started, lessons_completed: completed.length,
      completion_rate: started ? completed.length / started : null,
      avg_lesson_ms: durations.length ? durations.reduce(function (a, b) { return a + b; }, 0) / durations.length : null,
      expeditions_completed: db.expeditions.filter(function (e) { return e.status === 'completed'; }).length,
      by_city: byCity
    };
  });

  /* ---- только мок: выдача серверных ролей для демонстрации CMS ---- */
  route('POST', '/mock/roles', true, function (ctx) {
    var roles = (ctx.body.roles || []).filter(function (r) { return r === 'editor' || r === 'admin'; });
    ctx.user.roles = roles;
    return publicUser(ctx.user);
  });
  /* Демо-пресеты: мгновенно «проходят» уроки с теми же наградами, что и обычная игра.
     all — пройдено всё; before_final — всё, кроме последнего урока первого мира. */
  route('POST', '/mock/demo-progress', true, function (ctx) {
    var u = ctx.user;
    var preset = ctx.body.preset === 'before_final' ? 'before_final' : 'all';
    var first = allWorlds(false)[0];
    var lessons;
    if (preset === 'all') lessons = chain();
    else { var w1 = lessonsOfWorld(first.id); lessons = w1.slice(0, -1); }
    lessons.forEach(function (l) {
      var city = cityById(l.city_id);
      var cityWasDone = cityCompleted(u.id, city.id), worldWasDone = worldCompleted(u.id, city.world_id);
      var p = progressOf(u.id, l.id);
      if (!p) { p = { user_id: u.id, lesson_id: l.id, best_score: 0, completed_at: null, unlocked_at: now() }; db.progress.push(p); }
      p.best_score = 1; if (!p.completed_at) p.completed_at = now();
      lessonQuestionIds(l).forEach(function (qid) { awardOnce(u.id, 'question_correct', 'demo:' + qid, XP_PER_QUESTION, 0); });
      awardOnce(u.id, 'lesson_completed', l.id, l.xp, COINS_PER_LESSON);
      grantAchievement(u.id, 'first_case');
      if (db.progress.filter(function (x) { return x.user_id === u.id && x.completed_at; }).length >= 5) grantAchievement(u.id, 'five_lessons');
      if (!cityWasDone && cityCompleted(u.id, city.id)) {
        awardOnce(u.id, 'city_completed', city.id, 0, 0);
        grantAchievement(u.id, 'city_restored'); grantAchievement(u.id, city.badge.key);
      }
      if (!worldWasDone && worldCompleted(u.id, city.world_id)) { var w = worldById(city.world_id); if (w.badge) grantAchievement(u.id, w.badge.key); }
      if (!db.city_seen.some(function (x) { return x.user_id === u.id && x.city_id === city.id; })) db.city_seen.push({ user_id: u.id, city_id: city.id, at: now() });
      if (!worldSeen(u.id, city.world_id)) db.world_seen.push({ user_id: u.id, world_id: city.world_id, at: now() });
    });
    logEvent(u.id, 'demo_progress', { preset: preset, lessons: lessons.length });
    return publicUser(u);
  });
  route('POST', '/mock/reset-progress', true, function (ctx) {
    var id = ctx.user.id;
    ['sessions', 'attempts', 'progress', 'ledger', 'user_achievements', 'mistakes', 'city_seen', 'world_seen', 'expeditions'].forEach(function (k) {
      db[k] = db[k].filter(function (x) { return x.user_id !== id; });
    });
    return publicUser(ctx.user);
  });

  /* ================= диспетчер ================= */
  function handle(method, path, body, token) {
    path = path.split('?')[0].replace(/\/+$/, '');
    for (var i = 0; i < routes.length; i++) {
      var r = routes[i];
      if (r.method !== method) continue;
      var m = path.match(r.re); if (!m) continue;
      var params = {}; r.keys.forEach(function (k, j) { params[k] = decodeURIComponent(m[j + 1]); });
      var ctx = { params: params, body: body || {}, token: token, user: null };
      if (r.auth) {
        var userId = token && db.tokens[token];
        ctx.user = userId && db.users.find(function (u) { return u.id === userId; });
        if (!ctx.user) fail(401, 'unauthenticated', 'Требуется вход');
      }
      var out = r.handler(ctx);
      save();
      return clone(out);
    }
    fail(404, 'route_not_found', 'Маршрут не найден: ' + method + ' ' + path);
  }

  window.DSMockServer = {
    request: function (method, path, body, token) {
      var latency = 120 + Math.random() * 220;
      return new Promise(function (resolve, reject) {
        setTimeout(function () {
          if (!navigator.onLine) return reject({ status: 0, code: 'offline', message: 'Нет подключения к интернету' });
          try { resolve(handle(method, path, clone(body), token)); }
          catch (e) {
            if (e instanceof ApiError) reject({ status: e.status, code: e.code, message: e.message, details: e.details });
            else { console.error('[mock-server]', e); reject({ status: 500, code: 'server_error', message: 'Внутренняя ошибка сервера' }); }
          }
        }, latency);
      });
    },
    resetAll: function () { db = seedDb(); save(); }
  };
})();

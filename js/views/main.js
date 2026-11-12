/* Главная, вселенная (цепочка миров), карта мира, карта города, бесконечные экспедиции. */
(function () {
  'use strict';
  var app = DS.app, ui = DS.ui, esc = ui.esc, icon = ui.icon;

  function fragmentsPanel(fragments, compact) {
    return '<div class="secret ' + (compact ? 'secret--compact' : '') + '" aria-label="Секретное сообщение">' +
      '<span class="secret-label">Секретное сообщение</span><div class="secret-words">' +
      fragments.map(function (f, i) {
        return f ? '<span class="secret-word on">' + esc(f) + '</span>' : '<span class="secret-word"><span aria-hidden="true">• • •</span><span class="sr-only">Фрагмент ' + (i + 1) + ' скрыт</span></span>';
      }).join('') + '</div></div>';
  }
  DS.fragmentsPanel = fragmentsPanel;

  function progressBar(done, total, label) {
    return '<div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="' + total + '" aria-valuenow="' + done + '" aria-label="' + esc(label) + '"><span style="width:' + (total ? done / total * 100 : 0) + '%"></span></div>';
  }

  /* старт новой/текущей экспедиции — используется на нескольких экранах */
  DS.startExpedition = function (btn) {
    if (btn) btn.disabled = true;
    return DS.api.post('/expeditions/start').then(function (r) { app.go('#/session/' + r.session.id); },
      function (e) { if (btn) btn.disabled = false; ui.toast(esc(e.message), 'error'); });
  };

  /* ---------------- Главная ---------------- */
  app.views.home = function () {
    var p = Promise.all([DS.api.get('/universe'), DS.api.get('/me/progress'), DS.api.get('/me/review'), app.refreshMe()]).then(function (r) {
      var wid = r[0].current_world_id || (r[0].worlds[0] && r[0].worlds[0].id);
      return DS.api.get('/worlds/' + wid + '/map').then(function (map) { return r.concat([map]); });
    });
    app.load(p, function (r) {
      var uni = r[0], prog = r[1], review = r[2], me = r[3], map = r[4];
      var current = null;
      map.cities.forEach(function (c) { c.lessons.forEach(function (l) { if (l.id === uni.current_lesson_id) current = { city: c, lesson: l }; }); });
      var done = prog.lessons_completed;
      var exp = uni.expeditions;
      var cont;
      if (me.active_session) {
        cont = '<div class="card card--hero"><div><p class="eyebrow">Урок не закончен</p><h2>' + esc(me.active_session.title) + '</h2>' +
          '<p class="muted">Отвечено ' + me.active_session.answered + ' из ' + me.active_session.total + '</p></div>' +
          '<a class="btn btn--primary btn--lg" href="#/lesson/' + esc(me.active_session.lesson_id) + '">' + icon('play', 18) + ' Продолжить</a></div>';
      } else if (current) {
        cont = '<div class="card card--hero" style="--city:' + current.city.color + '"><div><p class="eyebrow">' + esc(map.world.title) + ' · ' + esc(current.city.title) + '</p><h2>' + esc(current.lesson.title) + '</h2>' +
          '<p class="muted">' + current.lesson.questions_count + ' ' + ui.plural(current.lesson.questions_count, 'задание', 'задания', 'заданий') + ' · около ' + Math.max(3, current.lesson.questions_count) + ' мин</p></div>' +
          '<a class="btn btn--primary btn--lg" href="#/city/' + current.city.id + '">' + icon('play', 18) + ' ' + (done ? 'Продолжить обучение' : 'Начать') + '</a></div>';
      } else {
        cont = '<div class="card card--hero card--infinite"><div><p class="eyebrow">Все миры пройдены</p><h2>Вселенная продолжается</h2><p class="muted">Новые миры появятся здесь, как только их опубликуют. А пока — бесконечные экспедиции.</p></div>' +
          '<button class="btn btn--primary btn--lg" data-exp-start>' + icon('compass', 18) + ' ' + (exp.current ? 'Продолжить экспедицию' : 'Новая экспедиция') + '</button></div>';
      }
      var needs = review.skills.filter(function (s) { return s.status === 'needs_review'; });
      app.render(
        '<section class="page">' +
          '<header class="page-head"><h1>' + esc(app.say('Привет, ' + me.display_name + '!', 'Здравствуйте, ' + me.display_name + '!')) + '</h1></header>' +
          ui.bubble(esc(done === 0 ? app.say('Библиотека ждёт напарника. Открываем первое дело?', 'Библиотека ждёт помощи. Начнём с первого города?') :
            app.say('Отличная работа! Пройдено уроков: ' + done + '.', 'Пройдено уроков: ' + done + '.')), done ? 'happy' : 'idle', { compact: true }) +
          cont +
          '<div class="grid-3">' +
            '<div class="card stat-card"><span class="stat-ic stat-ic--xp">' + icon('star', 22) + '</span><b>' + prog.wallet.xp + '</b><small>XP</small></div>' +
            '<div class="card stat-card"><span class="stat-ic stat-ic--coin">' + icon('coins', 22) + '</span><b>' + prog.wallet.coins + '</b><small>монет</small></div>' +
            '<div class="card stat-card"><span class="stat-ic stat-ic--ok">' + icon('check', 22) + '</span><b>' + ui.pct(prog.first_try_accuracy) + '</b><small>с первой попытки</small></div>' +
          '</div>' +
          '<div class="card"><div class="card-head"><h2>' + esc(map.world.title) + '</h2><a href="#/world/' + map.world.id + '" class="link">Карта мира ' + icon('arrow-right', 16) + '</a></div>' +
            fragmentsPanel(map.fragments, true) + '</div>' +
          '<div class="card"><div class="card-head"><h2>Вселенная</h2><a href="#/map" class="link">Все миры ' + icon('arrow-right', 16) + '</a></div>' +
            '<ul class="mini-worlds">' + uni.worlds.map(function (w) {
              return '<li style="--city:' + w.color + '"><span class="mw-ic">' + icon(w.status === 'locked' ? 'lock' : w.icon, 18) + '</span><div><b>' + esc(w.title) + '</b>' +
                progressBar(w.lessons_completed, w.lessons_total, w.title) + '</div><small>' + w.lessons_completed + '/' + w.lessons_total + '</small></li>';
            }).join('') +
            '<li style="--city:#0f9aa8"><span class="mw-ic">' + icon(exp.unlocked ? 'infinity' : 'lock', 18) + '</span><div><b>Экспедиции</b><small class="muted block">' +
              (exp.unlocked ? 'Пройдено: ' + exp.completed_count + ' · без конца' : 'Откроются после первого мира') + '</small></div>' +
              (exp.unlocked ? '<a class="btn btn--ghost btn--sm" href="#/expeditions">Открыть</a>' : '<span></span>') + '</li>' +
            '</ul></div>' +
          (review.total ? '<div class="card card--review"><div><h2>Повторение ошибок</h2><p class="muted">' + review.total + ' ' + ui.plural(review.total, 'задание ждёт', 'задания ждут', 'заданий ждут') + ' повторения' +
            (needs.length ? '. Стоит подтянуть: ' + needs.map(function (s) { return esc(s.title.toLowerCase()); }).join(', ') : '') + '.</p></div>' +
            '<a class="btn btn--ghost" href="#/review">Повторить</a></div>' : '') +
        '</section>'
      );
      var b = app.main.querySelector('[data-exp-start]');
      if (b) b.addEventListener('click', function () { DS.startExpedition(b); });
    });
  };

  function bindLocked(selector, text) {
    app.main.querySelectorAll(selector).forEach(function (el) {
      function msg() { ui.toast(icon('lock', 16) + ' ' + esc(text(el)), 'info'); }
      el.addEventListener('click', msg);
      el.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); msg(); } });
    });
  }

  /* ---------------- Вселенная: все миры по порядку + бесконечные экспедиции ---------------- */
  app.views.map = function () {
    app.load(DS.api.get('/universe'), function (uni) {
      var exp = uni.expeditions;
      var n = uni.worlds.length;
      var stops = uni.worlds.map(function (w, i) {
        var locked = w.status === 'locked';
        var statusText = w.status === 'completed' ? 'Пройден' : locked ? 'Закрыт' : (w.lessons_completed ? 'В процессе' : 'Открыт');
        return '<li class="world-stop world-stop--' + (i % 2 ? 'r' : 'l') + '">' +
          '<a class="city-card world-card city-card--' + w.status + '" style="--city:' + w.color + '" ' + (locked ? 'aria-disabled="true" tabindex="0" data-locked="' + esc(i ? uni.worlds[i - 1].title : '') + '"' : 'href="#/world/' + w.id + '"') + '>' +
            '<span class="city-ic">' + icon(locked ? 'lock' : w.icon, 32) + '</span>' +
            '<span class="city-info"><small>Мир ' + (i + 1) + (w.subtitle ? ' · ' + esc(w.subtitle) : '') + '</small><b>' + esc(w.title) + '</b>' +
            '<span class="city-meta"><span class="pill pill--' + w.status + '">' + (w.status === 'completed' ? icon('check', 13) : locked ? icon('lock', 13) : '') + statusText + '</span>' +
            '<span>' + w.cities_completed + '/' + w.cities_total + ' городов</span></span>' +
            (uni.current_world_id === w.id ? '<span class="you-are-here">Ты здесь</span>' : '') +
            '</span></a>' +
          (w.status === 'completed' ? '<a class="world-final-link" href="#/final/' + w.id + '">' + icon('award', 15) + ' Финал мира</a>' : '') +
          '</li>';
      }).join('');
      stops += '<li class="world-stop world-stop--' + (n % 2 ? 'r' : 'l') + '">' +
        '<a class="city-card world-card city-card--' + (exp.unlocked ? 'unlocked' : 'locked') + '" style="--city:#0f9aa8" ' + (exp.unlocked ? 'href="#/expeditions"' : 'aria-disabled="true" tabindex="0" data-locked="' + esc(uni.worlds[0] ? uni.worlds[0].title : '') + '"') + '>' +
          '<span class="city-ic">' + icon(exp.unlocked ? 'infinity' : 'lock', 32) + '</span>' +
          '<span class="city-info"><small>Бесконечный режим</small><b>Экспедиции</b>' +
          '<span class="city-meta"><span class="pill pill--' + (exp.unlocked ? 'unlocked' : 'locked') + '">' + (exp.unlocked ? 'Открыто' : icon('lock', 13) + 'Закрыто') + '</span>' +
          '<span>' + (exp.unlocked ? 'пройдено: ' + exp.completed_count : 'после первого мира') + '</span></span></span></a></li>';
      stops += '<li class="world-stop world-stop--' + (n % 2 ? 'l' : 'r') + '"><div class="city-card world-card world-card--next">' +
        '<span class="city-ic">' + icon('sparkles', 28) + '</span><span class="city-info"><small>Скоро</small><b>Следующий мир готовится…</b>' +
        '<span class="city-meta">Новые миры добавляются через CMS и встают в цепочку автоматически</span></span></div></li>';

      app.render(
        '<section class="page">' +
          '<header class="page-head"><p class="eyebrow">Читательская грамотность</p><h1>Вселенная знаний</h1>' +
          '<p class="muted">Миры открываются друг за другом. После первого мира открываются бесконечные экспедиции.</p></header>' +
          '<ol class="world-path">' + stops + '</ol>' +
        '</section>'
      );
      bindLocked('[data-locked]', function (el) { return 'Откроется после мира «' + el.getAttribute('data-locked') + '».'; });
    }, 'Загружаем вселенную…');
  };

  /* ---------------- Карта мира ---------------- */
  app.views.world = function (params) {
    app.load(DS.api.get('/worlds/' + params.worldId + '/map'), function (map) {
      var w = map.world;
      if (w.status === 'locked') { app.render(ui.errorState({ code: 'locked', status: 403, message: 'Этот мир откроется после прохождения предыдущего.' })); return; }
      var nextHref = map.next_world ? '#/world/' + map.next_world.id : '#/expeditions';
      app.render(
        '<section class="page" style="--city:' + w.color + '">' +
          '<a class="back-link" href="#/map">' + icon('arrow-left', 18) + ' Вселенная</a>' +
          '<header class="city-head"><span class="city-head-ic">' + icon(w.icon, 36) + '</span><div><p class="eyebrow">Мир ' + w.order + (w.subtitle ? ' · ' + esc(w.subtitle) : '') + '</p><h1>' + esc(w.title) + '</h1>' +
            (w.source === 'демо-контент' ? '<p class="muted small">Демонстрационный мир: показывает, как вселенная продолжается.</p>' : '') + '</div></header>' +
          fragmentsPanel(map.fragments) +
          '<ol class="world-path">' + map.cities.map(function (c, i) {
            var locked = c.status === 'locked';
            var statusText = c.status === 'completed' ? 'Восстановлен' : locked ? 'Закрыт' : (c.lessons_completed ? 'В процессе' : 'Открыт');
            return '<li class="world-stop world-stop--' + (i % 2 ? 'r' : 'l') + '">' +
              '<a class="city-card city-card--' + c.status + '" style="--city:' + c.color + '" ' + (locked ? 'aria-disabled="true" tabindex="0" data-locked' : 'href="#/city/' + c.id + '"') + '>' +
                '<span class="city-ic">' + icon(locked ? 'lock' : c.icon, 30) + '</span>' +
                '<span class="city-info"><small>Город ' + c.order + (c.mode ? ' · ' + esc(c.mode) : '') + '</small><b>' + esc(c.title) + '</b>' +
                '<span class="city-meta"><span class="pill pill--' + c.status + '">' + (c.status === 'completed' ? icon('check', 13) : locked ? icon('lock', 13) : '') + statusText + '</span>' +
                '<span>' + c.lessons_completed + '/' + c.lessons_total + ' уроков</span></span>' +
                (map.current_lesson_id && c.lessons.some(function (l) { return l.id === map.current_lesson_id; }) ? '<span class="you-are-here">Ты здесь</span>' : '') +
                '</span></a></li>';
          }).join('') + '</ol>' +
          (map.completed ? '<div class="result-actions"><a class="btn btn--primary btn--lg" href="#/final/' + w.id + '">' + icon('award', 18) + ' Финал мира</a>' +
            '<a class="btn btn--ghost btn--lg" href="' + nextHref + '">Новое дело: ' + esc(map.next_world ? map.next_world.title : 'экспедиции') + ' ' + icon('arrow-right', 18) + '</a></div>' : '') +
        '</section>'
      );
      bindLocked('[data-locked]', function () { return 'Город откроется после прохождения предыдущего.'; });
      if (!w.intro_seen && w.intro.length) {
        ui.storyScene(w.intro, { title: w.order > 1 ? 'Новое дело' : null, finalLabel: w.intro_button || 'Начать', dismissible: false }).then(function () {
          return DS.api.post('/worlds/' + w.id + '/seen');
        }).then(function () {
          if (w.intro_after) ui.toast(ui.robot('happy', 28) + ' ' + esc(w.intro_after), 'success');
        }).catch(function () {});
      }
    }, 'Загружаем мир…');
  };

  /* ---------------- Карта города ---------------- */
  var OFFSETS = [0, 56, 84, 56, 0, -56, -84, -56];

  app.views.city = function (params) {
    app.load(DS.api.get('/cities/' + params.cityId + '/map'), function (map) {
      var c = map.cities.find(function (x) { return x.id === params.cityId; });
      if (!c) { app.render(ui.errorState({ message: 'Город не найден' })); return; }
      if (c.status === 'locked') { app.render(ui.errorState({ code: 'locked', status: 403, message: 'Этот город откроется после прохождения предыдущего.' })); return; }
      var nextIdx = c.lessons.findIndex(function (l) { return l.status === 'unlocked'; });
      var completed = c.status === 'completed';
      var nextCity = map.cities[map.cities.indexOf(c) + 1];

      var nodes = c.lessons.map(function (l, i) {
        var off = OFFSETS[i % OFFSETS.length];
        var isCurrent = i === nextIdx;
        var label = l.status === 'completed' ? 'Пройден' + (l.best_score != null ? ' · ' + ui.pct(l.best_score) : '') : l.status === 'locked' ? 'Закрыт' : 'Доступен';
        var inner = l.status === 'completed' ? icon('check', 30) : l.status === 'locked' ? icon('lock', 26) : '<span class="node-num">' + (i + 1) + '</span>';
        return '<li class="path-row" style="--off:' + off + 'px">' +
          (l.status === 'locked'
            ? '<button class="node node--locked" type="button" data-locked aria-label="Урок ' + (i + 1) + ': ' + esc(l.title) + '. Закрыт">' + inner + '</button>'
            : '<a class="node node--' + l.status + (isCurrent ? ' node--current' : '') + '" href="#/lesson/' + l.id + '" aria-label="Урок ' + (i + 1) + ': ' + esc(l.title) + '. ' + label + '">' + inner + '</a>') +
          '<div class="node-label"><b>' + esc(l.title) + '</b><small>' + l.questions_count + ' ' + ui.plural(l.questions_count, 'задание', 'задания', 'заданий') + ' · ' + label + '</small>' +
          (isCurrent ? '<a class="btn btn--primary btn--sm" href="#/lesson/' + l.id + '">' + (l.best_score != null ? 'Ещё раз' : 'Начать') + '</a>' : '') + '</div></li>';
      }).join('');
      var chestOff = OFFSETS[c.lessons.length % OFFSETS.length];
      nodes += '<li class="path-row" style="--off:' + chestOff + 'px"><button type="button" class="node node--chest ' + (completed ? 'node--chest-open' : '') + '" data-chest aria-label="Сундук города: ' + (completed ? 'открыт, фрагмент «' + esc(c.fragment) + '»' : 'закрыт') + '">' + icon('gift', 30) + '</button>' +
        '<div class="node-label"><b>' + (completed ? 'Фрагмент: «' + esc(c.fragment) + '»' : 'Сундук города') + '</b><small>' + (completed ? 'Значок «' + esc(c.badge.title) + '»' : 'Пройди все уроки, чтобы открыть') + '</small></div></li>';

      app.render(
        '<section class="page page--city" style="--city:' + c.color + '">' +
          '<a class="back-link" href="#/world/' + map.world.id + '">' + icon('arrow-left', 18) + ' ' + esc(map.world.title) + '</a>' +
          '<header class="city-head"><span class="city-head-ic">' + icon(c.icon, 36) + '</span><div><p class="eyebrow">Город ' + c.order + (c.mode ? ' · ' + esc(c.mode) : '') + '</p><h1>' + esc(c.title) + '</h1><p class="muted">' + esc(c.description || '') + '</p></div></header>' +
          progressBar(c.lessons_completed, c.lessons_total, 'Пройдено уроков города') +
          '<ol class="city-path">' + nodes + '</ol>' +
          (completed && nextCity ? '<div class="center"><a class="btn btn--primary btn--lg" href="#/city/' + nextCity.id + '">Следующий город ' + icon('arrow-right', 18) + '</a></div>' : '') +
          (completed && !nextCity && map.completed ? '<div class="center"><a class="btn btn--primary btn--lg" href="#/final/' + map.world.id + '">' + icon('award', 18) + ' Финал мира</a></div>' : '') +
        '</section>'
      );
      var root = app.main;
      root.querySelectorAll('[data-locked]').forEach(function (b) {
        b.addEventListener('click', function () { ui.toast(icon('lock', 16) + ' Сначала пройди предыдущий урок.', 'info'); });
      });
      root.querySelector('[data-chest]').addEventListener('click', function () {
        if (!completed) { ui.toast(icon('gift', 16) + ' Сундук откроется, когда все уроки города будут пройдены.', 'info'); return; }
        ui.modal({ title: icon(c.badge.icon || c.icon, 22) + ' ' + esc(c.badge.title),
          body: ui.bubble(c.story_outro.map(esc).join('<br><br>'), 'happy') + fragmentsPanel(map.fragments),
          actions: '<button class="btn btn--primary" data-modal-action="ok">Отлично</button>' });
      });
      var cur = root.querySelector('.node--current'); if (cur) cur.scrollIntoView({ block: 'center', behavior: 'auto' });
      if (!c.intro_seen && c.story_intro.length) {
        ui.storyScene(c.story_intro.map(function (t) { return { speaker: 'derek', text: t, scene: c.scene }; }), { title: c.title, finalLabel: c.intro_button || 'Начать' })
          .then(function () { return DS.api.post('/cities/' + c.id + '/seen'); }).catch(function () {});
      }
    }, 'Загружаем город…');
  };

  /* ---------------- Бесконечные экспедиции ---------------- */
  app.views.expeditions = function () {
    app.load(DS.api.get('/expeditions'), function (ex) {
      if (!ex.unlocked) {
        app.render('<section class="page">' + ui.emptyState('Экспедиции пока закрыты', ex.unlock_hint, '<a class="btn btn--primary" href="#/map">Ко вселенной</a>') + '</section>');
        return;
      }
      var cur = ex.current;
      var target = ex.next_milestone;
      var heroCard = cur
        ? '<div class="card card--hero exp-current" style="--city:' + cur.color + '"><span class="exp-ic">' + icon(cur.icon, 30) + '</span><div class="exp-body"><p class="eyebrow">Экспедиция №' + cur.n + (ex.current_session ? ' · идёт' : '') + '</p><h2>' + esc(cur.title) + '</h2>' +
            '<p class="muted">' + (ex.current_session ? 'Отвечено ' + ex.current_session.progress.answered + ' из ' + ex.current_session.progress.total : cur.size + ' заданий' + (cur.best_score != null ? ' · лучший результат ' + ui.pct(cur.best_score) : '')) + '</p></div>' +
            '<button class="btn btn--primary btn--lg" data-exp-start>' + icon('play', 18) + ' ' + (ex.current_session ? 'Продолжить' : cur.best_score != null ? 'Ещё попытка' : 'Начать') + '</button></div>'
        : '<div class="card card--hero exp-current" style="--city:' + ex.upcoming.color + '"><span class="exp-ic">' + icon(ex.upcoming.icon, 30) + '</span><div class="exp-body"><p class="eyebrow">Экспедиция №' + (ex.completed_count + 1) + '</p><h2>' + esc(ex.upcoming.title) + '</h2>' +
            '<p class="muted">5 заданий из пройденных миров · больше там, где были ошибки</p></div>' +
            '<button class="btn btn--primary btn--lg" data-exp-start>' + icon('compass', 18) + ' Отправиться</button></div>';
      app.render(
        '<section class="page">' +
          '<header class="page-head"><p class="eyebrow">Бесконечный режим</p><h1>Экспедиции</h1></header>' +
          ui.bubble(esc(app.say('Каждая экспедиция — новое место во вселенной. Я подбираю задания так, чтобы мы тренировали то, что пока даётся труднее!',
            'Экспедиции бесконечны: задания подбираются по вашим ошибкам и слабым навыкам.')), 'happy', { compact: true }) +
          heroCard +
          '<div class="grid-3">' +
            '<div class="card stat-card"><span class="stat-ic stat-ic--ok">' + icon('flag', 22) + '</span><b>' + ex.completed_count + '</b><small>пройдено</small></div>' +
            '<div class="card stat-card"><span class="stat-ic stat-ic--xp">' + icon('trophy', 22) + '</span><b>' + (target || '∞') + '</b><small>следующая цель</small></div>' +
            '<div class="card stat-card"><span class="stat-ic stat-ic--coin">' + icon('infinity', 22) + '</span><b>∞</b><small>без конца</small></div>' +
          '</div>' +
          (target ? '<div class="card"><div class="card-head"><h2>До достижения «' + (target === 1 ? 'Первая экспедиция' : target + ' экспедиций') + '»</h2><small class="muted">' + ex.completed_count + '/' + target + '</small></div>' +
            progressBar(ex.completed_count, target, 'Прогресс к достижению') + '</div>' : '') +
          '<div class="card"><h2>Пройденные экспедиции</h2>' + (ex.history.length ? '<ul class="exp-history">' + ex.history.map(function (e) {
            return '<li style="--city:' + e.color + '"><span class="exp-ic exp-ic--sm">' + icon(e.icon, 18) + '</span><div><b>№' + e.n + ' · ' + esc(e.title) + '</b><small class="muted block">Результат: ' + ui.pct(e.best_score) + '</small></div>' + icon('check', 18, 'ok-ic') + '</li>';
          }).join('') + '</ul>' : '<p class="muted">Пока ни одной — самое время отправиться!</p>') + '</div>' +
        '</section>'
      );
      var b = app.main.querySelector('[data-exp-start]');
      b.addEventListener('click', function () { DS.startExpedition(b); });
    }, 'Загружаем экспедиции…');
  };
})();

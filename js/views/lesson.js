/* Урок (US-02, US-04), результат, финал приключения. */
(function () {
  'use strict';
  var app = DS.app, ui = DS.ui, esc = ui.esc, icon = ui.icon;

  /* #/lesson/:id — начать или продолжить сессию урока (сервер проверяет, открыт ли урок) */
  app.views.lesson = function (params) {
    app.load(DS.api.post('/lesson-sessions', { lesson_id: params.lessonId, idempotency_key: DS.api.uuid() }), function (s) {
      history.replaceState(null, '', '#/session/' + s.id);
      runSession(s.id);
    }, 'Готовим урок…');
  };
  app.views.session = function (params) { runSession(params.sessionId); };

  function runSession(sessionId) {
    var token = app.routeToken;
    var q = null, ctrl = null, busy = false, pendingAttempt = null, wrongCount = 0, sess = null;

    function live() { return token === app.routeToken; }

    function fetchCurrent() {
      app.load(DS.api.get('/lesson-sessions/' + sessionId + '/current'), function (cur) {
        sess = cur.session;
        if (cur.next_action === 'show_result') return app.go('#/result/' + sessionId);
        if (cur.next_action === 'complete') return complete();
        q = cur.question; wrongCount = cur.state.attempts; pendingAttempt = null;
        draw(cur);
      }, 'Загружаем задание…');
    }

    function draw(cur) {
      var p = cur.session.progress;
      app.render(
        '<section class="lesson">' +
          '<div class="lesson-top">' +
            '<button class="icon-btn" data-exit aria-label="Выйти из урока">' + icon('close', 22) + '</button>' +
            '<div class="progress progress--lesson" role="progressbar" aria-valuemin="0" aria-valuemax="' + p.total + '" aria-valuenow="' + p.answered + '" aria-label="Прогресс урока: ' + p.answered + ' из ' + p.total + '"><span style="width:' + (p.answered / p.total * 100) + '%"></span></div>' +
            '<span class="lesson-count" aria-hidden="true">' + (p.answered + 1) + '/' + p.total + '</span>' +
          '</div>' +
          '<div class="lesson-body">' +
            '<p class="eyebrow">' + esc(cur.session.mode === 'review' ? 'Повторение ошибок' : cur.session.title) + ' · ' + esc(DS.questions.TYPE_LABELS[q.type]) + '</p>' +
            '<h1 class="q-title">' + esc(q.title) + '</h1>' +
            (q.robot_line ? ui.bubble(esc(q.robot_line), 'idle', { compact: true }) : '') +
            '<p class="q-instruction">' + icon('question', 16) + ' ' + esc(q.instruction) + '</p>' +
            '<div class="q-area" data-q></div>' +
            '<div class="hint-box" data-hint hidden></div>' +
          '</div>' +
          '<footer class="lesson-footer" data-footer data-state="idle" aria-live="polite">' +
            '<div class="lesson-footer-inner">' +
              '<div class="feedback" data-feedback></div>' +
              '<div class="lesson-actions">' +
                (q.has_hint ? '<button class="btn btn--ghost" data-hint-btn>' + icon('bulb', 18) + ' Подсказка</button>' : '<span></span>') +
                '<button class="btn btn--primary btn--lg" data-check disabled>Проверить</button>' +
              '</div>' +
            '</div>' +
          '</footer>' +
        '</section>'
      );
      var root = app.main;
      var check = root.querySelector('[data-check]');
      ctrl = DS.questions.mount(root.querySelector('[data-q]'), q, { onChange: function () { if (!busy && check.dataset.mode !== 'next') check.disabled = !ctrl.hasAnswer(); } });
      check.disabled = !ctrl.hasAnswer();
      check.addEventListener('click', onCheck);
      var hb = root.querySelector('[data-hint-btn]');
      if (hb) hb.addEventListener('click', showHint);
      if (cur.state.hint_used && wrongCount > 0) showHint();
      root.querySelector('[data-exit]').addEventListener('click', exitLesson);
    }

    function showHint() {
      var box = app.main.querySelector('[data-hint]');
      var hb = app.main.querySelector('[data-hint-btn]');
      if (hb) hb.disabled = true;
      DS.api.post('/lesson-sessions/' + sessionId + '/hint').then(function (r) {
        if (!live()) return;
        box.hidden = false;
        box.innerHTML = icon('bulb', 18) + '<p><b>Подсказка.</b> ' + esc(r.hint) + '</p>';
      }, function (err) { if (hb) hb.disabled = false; ui.toast(esc(err.message), 'error'); });
    }

    function setFooter(state, html, btnLabel) {
      var f = app.main.querySelector('[data-footer]');
      f.setAttribute('data-state', state);
      f.querySelector('[data-feedback]').innerHTML = html;
      var b = f.querySelector('[data-check]');
      b.textContent = btnLabel; b.disabled = false;
      b.dataset.mode = state === 'wrong' ? 'retry' : (state === 'idle' ? '' : 'next');
      b.focus();
    }

    function onCheck() {
      var b = app.main.querySelector('[data-check]');
      if (busy) return;
      if (b.dataset.mode === 'next') { b.disabled = true; return next(); }
      if (b.dataset.mode === 'retry') {
        app.main.querySelector('[data-footer]').setAttribute('data-state', 'idle');
        app.main.querySelector('[data-feedback]').innerHTML = '';
        b.textContent = 'Проверить'; b.dataset.mode = ''; ctrl.unlock(); b.disabled = !ctrl.hasAnswer();
        return;
      }
      if (!ctrl.hasAnswer()) return;
      busy = true; b.disabled = true; b.textContent = 'Проверяем…';
      ctrl.lock();
      // client_attempt_id сохраняется до успешного ответа: повторная отправка после сбоя сети не создаёт дубль
      var answer = ctrl.getAnswer();
      var key = JSON.stringify(answer);
      if (!pendingAttempt || pendingAttempt.key !== key) pendingAttempt = { key: key, id: DS.api.uuid() };
      var body = Object.assign({ question_version_id: q.question_version_id, client_attempt_id: pendingAttempt.id }, answer);
      DS.api.post('/lesson-sessions/' + sessionId + '/answers', body).then(function (r) {
        busy = false; pendingAttempt = null;
        if (!live()) return;
        updateProgress(r.session_progress);
        if (r.is_correct) {
          ctrl.markCorrect();
          setFooter('correct', '<div class="fb-head">' + ui.robot('happy', 44) + '<b>' + (r.attempt_no === 1 ? 'Верно!' : 'Получилось!') + '</b></div><p>' + esc(r.feedback) + '</p>' +
            (r.explanation ? '<p class="muted small">' + esc(r.explanation) + '</p>' : ''), r.next_action === 'complete' ? 'Завершить' : 'Дальше');
          ui.announce('Верно. ' + r.feedback);
        } else if (r.next_action === 'retry') {
          wrongCount++;
          ctrl.markWrong();
          setFooter('wrong', '<div class="fb-head">' + ui.robot('think', 44) + '<b>Не совсем</b></div><p>' + esc(r.feedback) + '</p>' +
            (r.hint ? '<p class="fb-hint">' + icon('bulb', 16) + ' ' + esc(r.hint) + '</p>' : ''), 'Попробовать ещё раз');
          var hb = app.main.querySelector('[data-hint-btn]'); if (hb) hb.disabled = true;
          ui.announce('Неверно. ' + r.feedback + ' ' + (r.hint || ''));
        } else {
          ctrl.markWrong();
          ctrl.markCorrect(r.correct_option_ids);
          setFooter('failed', '<div class="fb-head">' + ui.robot('sad', 44) + '<b>' + esc(r.feedback) + '</b></div>' +
            (r.explanation ? '<p>' + esc(r.explanation) + '</p>' : '') + '<p class="muted small">Задание добавлено в «Повторение».</p>', r.next_action === 'complete' ? 'Завершить' : 'Дальше');
          ui.announce('Ответ разобран. ' + (r.explanation || ''));
        }
      }, function (err) {
        busy = false;
        if (!live()) return;
        if (err.code === 'stale_question' || err.code === 'no_question') { fetchCurrent(); return; }
        ctrl.unlock(); b.disabled = false; b.textContent = 'Проверить';
        ui.toast((err.code === 'offline' ? 'Нет связи. Ответ не потерян — нажмите «Проверить» ещё раз.' : esc(err.message)), 'error');
      });
    }

    function updateProgress(sp) {
      var bar = app.main.querySelector('.progress--lesson');
      if (!bar || !sp) return;
      bar.setAttribute('aria-valuenow', sp.answered);
      bar.querySelector('span').style.width = (sp.answered / sp.total * 100) + '%';
    }

    function next() { fetchCurrent(); }

    function complete() {
      app.load(DS.api.post('/lesson-sessions/' + sessionId + '/complete', { idempotency_key: sessionId }), function (result) {
        app.updateWallet(result.wallet);
        app.go('#/result/' + sessionId);
      }, 'Подводим итоги…');
    }

    function exitLesson() {
      ui.confirm('Выйти из урока?', 'Прогресс сохранится — вы сможете продолжить с этого задания.', 'Выйти').then(function (ok) {
        if (!ok) return;
        app.go(sess && sess.city_id ? '#/city/' + sess.city_id : sess && sess.mode === 'expedition' ? '#/expeditions' : '#/review');
      });
    }

    fetchCurrent();
  }

  /* ---------------- Результат ---------------- */
  app.views.result = function (params) {
    app.load(DS.api.get('/lesson-sessions/' + params.sessionId), function (s) {
      if (s.status !== 'completed') return app.go('#/session/' + s.id);
      var r = s.result;
      var isReview = r.mode === 'review';
      var isExp = r.mode === 'expedition';
      var mood = isReview ? 'happy' : r.passed ? 'happy' : 'think';
      var title = isReview ? 'Тренировка завершена' : isExp ? (r.passed ? 'Экспедиция пройдена!' : 'Экспедиция не завершена')
        : r.world_completed ? 'Мир пройден!' : r.passed ? 'Урок пройден!' : 'Почти получилось';
      var text = isReview ? 'Исправленные задания убраны из списка повторения.' :
        isExp ? (r.passed ? app.say('Новое место во вселенной исследовано! Следующая экспедиция уже ждёт.', 'Экспедиция завершена. Следующая уже готова.')
          : 'Нужно ответить с первой попытки хотя бы на 60% заданий. Можно попробовать эту экспедицию ещё раз.') :
        r.world_completed ? 'Все города мира «' + r.world_completed.title + '» восстановлены. Пора узнать, кто стоял за этим делом!' :
        r.passed ? app.say('Карточки восстановлены! Отличная детективная работа.', 'Урок завершён успешно.') :
        'Нужно правильно ответить с первой попытки хотя бы на 60% заданий. Попробуй ещё раз — ошибки уже ждут в «Повторении».';
      var primary;
      if (isExp) primary = '<button class="btn btn--primary btn--lg" data-exp-start>' + icon(r.passed ? 'compass' : 'rotate-ccw', 18) + ' ' + (r.passed ? 'Следующая экспедиция' : 'Попробовать ещё раз') + '</button>';
      else if (r.next && r.next.type === 'final') primary = '<a class="btn btn--primary btn--lg" href="#/final/' + r.next.world_id + '">' + icon('award', 18) + ' К финалу мира</a>';
      else if (r.city_completed) primary = '<a class="btn btn--primary btn--lg" href="#/city/' + r.city_completed.city_id + '">К карте города</a>';
      else if (r.next && r.next.type === 'lesson') primary = '<a class="btn btn--primary btn--lg" href="#/city/' + r.next.city_id + '">Следующий урок</a>';
      else if (!isReview && !r.passed) primary = '<a class="btn btn--primary btn--lg" href="#/lesson/' + r.lesson_id + '">Попробовать ещё раз</a>';
      else primary = '<a class="btn btn--primary btn--lg" href="' + (s.city_id ? '#/city/' + s.city_id : '#/home') + '">Продолжить</a>';

      app.render(
        '<section class="page result">' +
          '<div class="result-hero result-hero--' + (r.passed || isReview ? 'ok' : 'retry') + '">' + ui.robot(mood, 120) +
            (isExp && r.expedition ? '<p class="eyebrow">Экспедиция №' + r.expedition.n + ' · ' + esc(r.expedition.title) + '</p>' : '') +
            '<h1>' + title + '</h1><p>' + esc(text) + '</p></div>' +
          '<div class="grid-3">' +
            '<div class="card stat-card"><span class="stat-ic stat-ic--ok">' + icon('check', 22) + '</span><b>' + r.first_correct + '/' + r.total + '</b><small>с первой попытки</small></div>' +
            '<div class="card stat-card"><span class="stat-ic stat-ic--xp">' + icon('star', 22) + '</span><b>+' + r.xp_gained + '</b><small>XP</small></div>' +
            '<div class="card stat-card"><span class="stat-ic stat-ic--coin">' + icon('coin', 22) + '</span><b>+' + r.coins_gained + '</b><small>монет</small></div>' +
          '</div>' +
          (!isReview && r.passed && r.xp_gained === r.solved * 10 && r.coins_gained === 0 ? '<p class="muted small center">Награда за первое прохождение этого урока уже была получена раньше.</p>' : '') +
          (r.new_achievements.length ? '<div class="card"><h2>Новые достижения</h2><ul class="ach-list">' + r.new_achievements.map(function (a) {
            return '<li class="ach ach--on"><span class="ach-ic">' + icon(a.icon, 26) + '</span><b>' + esc(a.title) + '</b><small>' + esc(a.description) + '</small></li>';
          }).join('') + '</ul></div>' : '') +
          (r.city_completed ? '<div class="card card--fragment"><h2>' + icon(r.city_completed.badge.icon, 22) + ' ' + esc(r.city_completed.title) + ' восстановлен</h2>' +
            ui.bubble(r.city_completed.story_outro.map(esc).join('<br><br>'), 'happy', { compact: true }) + DS.fragmentsPanel(r.city_completed.fragments) + '</div>' : '') +
          '<div class="result-actions">' + primary +
            (!isReview && !isExp && r.passed ? '<a class="btn btn--ghost" href="#/lesson/' + r.lesson_id + '">Пройти ещё раз</a>' : '') +
            (isExp ? '<a class="btn btn--ghost" href="#/expeditions">Все экспедиции</a>' : '') +
            (r.first_correct < r.total ? '<a class="btn btn--ghost" href="#/review">Разобрать ошибки</a>' : '') +
          '</div>' +
        '</section>'
      );
      var eb = app.main.querySelector('[data-exp-start]');
      if (eb) eb.addEventListener('click', function () { DS.startExpedition(eb); });
      r.new_achievements.forEach(function (a, i) { setTimeout(function () { ui.toast(icon(a.icon, 18) + ' Достижение: <b>' + esc(a.title) + '</b>', 'success'); }, 400 + i * 600); });
      if (r.lesson_outro && r.passed) {
        ui.storyScene([{ speaker: r.lesson_outro.speaker, text: r.lesson_outro.text }, { speaker: 'derek', text: r.lesson_outro.derek }], { title: 'Промежуточный эпизод' });
      }
      app.refreshMe().catch(function () {});
    }, 'Загружаем результат…');
  };

  /* ---------------- Финал ---------------- */
  /* Финал мира. Игра на этом не заканчивается: «ПОЛУЧЕНО НОВОЕ ДЕЛО» ведёт в следующий мир или в экспедиции. */
  app.views.final = function (params) {
    var worldId = params.worldId || 'text-detective';
    app.load(DS.api.get('/worlds/' + worldId + '/final'), function (f) {
      var nextHref = f.next.type === 'world' ? '#/world/' + f.next.world_id : '#/expeditions';
      var nextLabel = f.next.type === 'world' ? 'Новое дело: ' + f.next.title : 'Новое дело: экспедиции';
      app.render(
        '<section class="page final">' +
          '<div class="final-hero">' + ui.robot('wow', 130) +
            '<p class="eyebrow">' + esc(f.world_title) + ' · сообщение собрано</p>' +
            '<p class="final-phrase">' + esc(f.phrase) + '</p>' +
            '<p class="final-title">' + esc(f.title) + '</p></div>' +
          '<div class="card center"><div class="final-badge">' + icon(f.badge_icon || 'award', 56) + '</div><h2>' + esc(f.badge) + '</h2><p class="muted">Значок за прохождение мира «' + esc(f.world_title) + '».</p></div>' +
          '<div class="card card--notice"><p class="notice-blink">«' + esc(f.tail.notice) + '»</p>' + ui.bubble(esc(f.tail.derek), 'wow', { compact: true }) +
            '<a class="btn btn--primary btn--lg btn--block notice-cta" href="' + nextHref + '">' + icon(f.next.type === 'world' ? 'orbit' : 'infinity', 20) + ' ' + esc(nextLabel) + '</a></div>' +
          '<div class="result-actions">' +
            '<a class="btn btn--ghost btn--lg" href="#/world/' + f.world_id + '">' + icon('rotate-ccw', 18) + ' Повторить миссию</a>' +
            '<a class="btn btn--ghost btn--lg" href="#/map">' + icon('orbit', 18) + ' Вселенная</a>' +
          '</div>' +
        '</section>'
      );
      if (f.scene.length) ui.storyScene(f.scene, { title: 'Финал: ' + f.world_title, finalLabel: 'Получить значок' });
    }, 'Открываем финал…');
  };
})();

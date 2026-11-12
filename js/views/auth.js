/* Приветствие, вход/регистрация, онбординг (US-01). */
(function () {
  'use strict';
  var app = DS.app, ui = DS.ui, esc = ui.esc, icon = ui.icon;

  app.views.welcome = function () {
    app.render(
      '<section class="welcome">' +
        '<div class="welcome-hero">' + ui.robot('happy', 140) + '</div>' +
        '<p class="eyebrow">Образовательная игра</p>' +
        '<h1 class="welcome-title">DerekSci</h1>' +
        '<p class="welcome-slogan" lang="kk">Сөз тапқанға қолқа жоқ</p>' +
        '<p class="welcome-lead">Цифровая библиотека потеряла связь между вопросами и ответами. Помоги роботу DerekSci восстановить пять городов: находи ответы в тексте, разбирайся в объяснениях, проверяй выводы, восстанавливай порядок и выбирай источники.</p>' +
        '<ul class="welcome-points"><li>Уроки по 3–7 минут</li><li>5 городов и секретное сообщение</li><li>Для школьников, студентов, учителей и взрослых</li></ul>' +
        '<div class="welcome-actions">' +
          '<a class="btn btn--primary btn--lg" href="#/auth/register">Начать</a>' +
          '<a class="btn btn--ghost btn--lg" href="#/auth/login">У меня есть аккаунт</a>' +
        '</div>' +
        '<div class="card card--dev demo-box">' +
          '<h2>' + icon('flask-conical', 20) + ' Демо-режим</h2>' +
          '<p class="muted small">Создаёт демо-игрока с готовым прогрессем, чтобы сразу увидеть, как игра продолжается после прохождения.</p>' +
          '<div class="demo-actions">' +
            '<button class="btn btn--ghost" data-demo="all">' + icon('circle-check', 18) + ' Всё пройдено</button>' +
            '<button class="btn btn--ghost" data-demo="before_final">' + icon('flag', 18) + ' Перед финалом</button>' +
          '</div>' +
          '<p class="muted small">«Всё пройдено» — оба мира закрыты, открыты финалы и бесконечные экспедиции. «Перед финалом» — остался один урок до финала первого мира.</p>' +
        '</div>' +
      '</section>'
    );
    app.main.querySelectorAll('[data-demo]').forEach(function (b) {
      b.addEventListener('click', function () { startDemo(b.getAttribute('data-demo'), b); });
    });
  };

  /* Демо-игрок: регистрация → онбординг → готовый прогресс (только мок-бэкенд) */
  function startDemo(preset, btn) {
    app.main.querySelectorAll('[data-demo]').forEach(function (x) { x.disabled = true; });
    btn.textContent = 'Готовим демо…';
    var name = 'Демо-' + Math.floor(1000 + Math.random() * 9000);
    DS.api.register({ display_name: name, password: 'demo1234' })
      .then(function () { return DS.api.patch('/me/learning-profile', { role_type: 'school', track_id: 'reading', complete_onboarding: true }); })
      .then(function () { return DS.api.post('/mock/demo-progress', { preset: preset }); })
      .then(function (me) {
        app.setMe(me);
        ui.toast(icon('flask-conical', 18) + ' Демо-игрок <b>' + esc(name) + '</b> (пароль demo1234)', 'success');
        app.go(preset === 'before_final' ? '#/city/c5' : '#/map');
      }, function (err) { ui.toast(esc(err.message), 'error'); app.views.welcome(); });
  }
  DS.startDemo = startDemo;

  app.views.auth = function (params) {
    var isLogin = params.mode === 'login';
    app.render(
      '<section class="auth">' +
        '<a class="back-link" href="#/welcome">' + icon('back', 18) + ' Назад</a>' +
        ui.bubble(isLogin ? 'С возвращением, напарник! Введи никнейм и пароль.' : 'Давай познакомимся! Придумай никнейм — настоящее имя не нужно.', 'idle') +
        '<form class="card form" novalidate>' +
          '<h1>' + (isLogin ? 'Вход' : 'Создать аккаунт') + '</h1>' +
          '<div class="field"><label for="f-name">Никнейм</label><input id="f-name" name="display_name" autocomplete="username" required minlength="2" maxlength="32"><p class="field-err" id="e-display_name"></p></div>' +
          '<div class="field"><label for="f-pass">Пароль</label><input id="f-pass" name="password" type="password" autocomplete="' + (isLogin ? 'current-password' : 'new-password') + '" required minlength="4"><p class="field-err" id="e-password"></p></div>' +
          (isLogin ? '' : '<p class="muted small">Для несовершеннолетних используйте псевдоним. Публичного профиля и рейтинга нет.</p>') +
          '<p class="form-err" role="alert"></p>' +
          '<button class="btn btn--primary btn--lg btn--block" type="submit">' + (isLogin ? 'Войти' : 'Создать аккаунт') + '</button>' +
          '<p class="center small">' + (isLogin ? 'Нет аккаунта? <a href="#/auth/register">Создать</a>' : 'Уже есть аккаунт? <a href="#/auth/login">Войти</a>') + '</p>' +
        '</form>' +
        '<p class="muted small center">Мок-режим: данные хранятся только в этом браузере.</p>' +
      '</section>'
    );
    var form = app.main.querySelector('form');
    form.querySelector('input').focus();
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = form.querySelector('[type=submit]');
      form.querySelectorAll('.field-err, .form-err').forEach(function (el) { el.textContent = ''; });
      form.querySelectorAll('input').forEach(function (i) { i.removeAttribute('aria-invalid'); });
      var data = { display_name: form.display_name.value, password: form.password.value };
      btn.disabled = true; btn.textContent = 'Подождите…';
      (isLogin ? DS.api.login(data) : DS.api.register(data)).then(function (me) {
        app.setMe(me);
        app.go(me.onboarding_completed ? '#/home' : '#/onboarding');
      }, function (err) {
        btn.disabled = false; btn.textContent = isLogin ? 'Войти' : 'Создать аккаунт';
        if (err.details) Object.keys(err.details).forEach(function (k) {
          var el = form.querySelector('#e-' + k); if (el) el.textContent = err.details[k];
          var inp = form.querySelector('[name="' + k + '"]'); if (inp) inp.setAttribute('aria-invalid', 'true');
        });
        else form.querySelector('.form-err').textContent = err.message;
      });
    });
  };

  var PROFILES = [
    { id: 'school', title: 'Ученик', text: 'Школьник: сказки, истории, первые расследования', icon: 'backpack' },
    { id: 'student', title: 'Студент', text: 'Анализ информации и критическое чтение', icon: 'graduation-cap' },
    { id: 'teacher', title: 'Учитель', text: 'Практика навыков, которые вы развиваете у учеников', icon: 'apple' },
    { id: 'adult', title: 'Другой взрослый', text: 'Учусь в своём темпе', icon: 'coffee' }
  ];
  DS.PROFILES = PROFILES;

  app.views.onboarding = function () {
    var state = { step: 0, role: (app.me.learning_profile && app.me.learning_profile.role_type) || null, track: 'reading', font: app.me.settings.font_scale || 1, motion: !!app.me.settings.reduce_motion };
    var tracks = null;
    DS.api.get('/tracks').then(function (t) { tracks = t; draw(); }, function () { tracks = []; draw(); });

    function draw() {
      var steps = ['Профиль', 'Направление', 'Удобство'];
      var body;
      if (state.step === 0) {
        body = '<h1>Кто ты?</h1><p class="muted">Это образовательный профиль — от него зависят тон подсказок и подбор заданий. Его можно сменить в любой момент.</p>' +
          '<div class="choice-grid" role="radiogroup" aria-label="Образовательный профиль">' + PROFILES.map(function (p) {
            return '<button type="button" role="radio" class="choice ' + (state.role === p.id ? 'is-selected' : '') + '" aria-checked="' + (state.role === p.id) + '" data-role="' + p.id + '">' +
              '<span class="choice-ic">' + icon(p.icon, 26) + '</span><b>' + p.title + '</b><small>' + p.text + '</small></button>';
          }).join('') + '</div>';
      } else if (state.step === 1) {
        body = '<h1>Выбери направление</h1><p class="muted">Одна учётная запись — разные направления.</p>' +
          (tracks ? '<div class="choice-grid" role="radiogroup" aria-label="Направление">' + tracks.map(function (t) {
            var soon = t.status !== 'published';
            return '<button type="button" role="radio" class="choice ' + (state.track === t.id ? 'is-selected' : '') + '" aria-checked="' + (state.track === t.id) + '" data-track="' + t.id + '" ' + (soon ? 'disabled' : '') + '>' +
              '<span class="choice-ic">' + icon(t.icon, 26) + '</span><b>' + esc(t.title) + '</b><small>' + (soon ? icon('lock', 14) + ' Скоро' : esc(t.description)) + '</small></button>';
          }).join('') + '</div>' : ui.loading());
      } else {
        body = '<h1>Настрой под себя</h1><p class="muted">Базовые настройки доступности. Их можно изменить в профиле.</p>' +
          '<div class="card settings">' +
            '<fieldset class="field"><legend>Размер текста</legend><div class="seg">' +
              [[0.9, 'Мельче'], [1, 'Обычный'], [1.15, 'Крупнее'], [1.3, 'Очень крупный']].map(function (f) {
                return '<label class="seg-opt"><input type="radio" name="font" value="' + f[0] + '" ' + (state.font == f[0] ? 'checked' : '') + '><span>' + f[1] + '</span></label>';
              }).join('') + '</div></fieldset>' +
            '<label class="switch"><input type="checkbox" name="motion" ' + (state.motion ? 'checked' : '') + '><span>Меньше анимации</span></label>' +
          '</div>';
      }
      app.render(
        '<section class="onboarding">' +
          '<ol class="stepper" aria-label="Шаги">' + steps.map(function (s, i) {
            return '<li class="' + (i === state.step ? 'on' : i < state.step ? 'done' : '') + '" ' + (i === state.step ? 'aria-current="step"' : '') + '><span>' + (i < state.step ? icon('check', 16) : i + 1) + '</span>' + s + '</li>';
          }).join('') + '</ol>' +
          '<div class="onboarding-body">' + body + '</div>' +
          '<div class="onboarding-actions">' +
            (state.step > 0 ? '<button class="btn btn--ghost" data-back>Назад</button>' : '<span></span>') +
            '<button class="btn btn--primary btn--lg" data-next ' + (state.step === 0 && !state.role ? 'disabled' : '') + '>' + (state.step < 2 ? 'Дальше' : 'Готово') + '</button>' +
          '</div>' +
        '</section>'
      );
      var root = app.main;
      root.querySelectorAll('[data-role]').forEach(function (b) { b.addEventListener('click', function () { state.role = b.getAttribute('data-role'); draw(); root.querySelector('[data-role="' + state.role + '"]').focus(); }); });
      root.querySelectorAll('[data-track]').forEach(function (b) { b.addEventListener('click', function () { state.track = b.getAttribute('data-track'); draw(); }); });
      root.querySelectorAll('[name=font]').forEach(function (i) { i.addEventListener('change', function () { state.font = Number(i.value); document.documentElement.style.setProperty('--font-scale', state.font); }); });
      var mo = root.querySelector('[name=motion]'); if (mo) mo.addEventListener('change', function () { state.motion = mo.checked; });
      var back = root.querySelector('[data-back]'); if (back) back.addEventListener('click', function () { state.step--; draw(); });
      root.querySelector('[data-next]').addEventListener('click', function (e) {
        if (state.step < 2) { state.step++; draw(); return; }
        e.target.disabled = true;
        DS.api.patch('/me/settings', { font_scale: state.font, reduce_motion: state.motion })
          .then(function () { return DS.api.patch('/me/learning-profile', { role_type: state.role, track_id: state.track, complete_onboarding: true }); })
          .then(function (me) { app.setMe(me); app.go('#/map'); }, function (err) { e.target.disabled = false; ui.toast(esc(err.message), 'error'); });
      });
    }
    draw();
  };
})();

/* Профиль, достижения, статистика навыков, повторение ошибок (US-03). */
(function () {
  'use strict';
  var app = DS.app, ui = DS.ui, esc = ui.esc, icon = ui.icon;

  function skillRow(s) {
    var label = s.status === 'insufficient_data' ? 'Недостаточно данных' : s.status === 'needs_review' ? 'Стоит повторить' : 'Хорошо';
    return '<li class="skill skill--' + s.status + '"><div class="skill-head"><b>' + esc(s.title) + '</b><span class="pill pill--' + s.status + '">' + label + '</span></div>' +
      (s.status === 'insufficient_data'
        ? '<p class="muted small">Ответов: ' + s.sample + '. Для оценки нужно хотя бы 5.</p>'
        : '<div class="progress progress--thin" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.round(s.accuracy * 100) + '" aria-label="Точность"><span style="width:' + (s.accuracy * 100) + '%"></span></div>' +
          '<p class="muted small">' + s.correct + ' из ' + s.sample + ' последних ответов — с первой попытки (' + ui.pct(s.accuracy) + ')</p>') + '</li>';
  }

  app.views.profile = function () {
    app.load(Promise.all([app.refreshMe(), DS.api.get('/me/progress'), DS.api.get('/me/achievements')]), function (r) {
      var me = r[0], prog = r[1], ach = r[2];
      var role = me.learning_profile && me.learning_profile.role_type;
      app.render(
        '<section class="page">' +
          '<header class="page-head profile-head"><span class="avatar avatar--lg" aria-hidden="true">' + esc(me.display_name.slice(0, 1).toUpperCase()) + '</span>' +
            '<div><h1>' + esc(me.display_name) + '</h1><p class="muted">' + me.xp + ' XP · ' + me.coins + ' монет · ' + prog.lessons_completed + '/' + prog.lessons_total + ' уроков</p></div></header>' +

          '<div class="card"><h2>Образовательный профиль</h2><p class="muted small">Влияет на тон подсказок. Профиль «Учитель» не даёт административных прав.</p>' +
            '<div class="choice-grid choice-grid--compact" role="radiogroup" aria-label="Образовательный профиль">' + DS.PROFILES.map(function (p) {
              return '<button type="button" role="radio" class="choice ' + (role === p.id ? 'is-selected' : '') + '" aria-checked="' + (role === p.id) + '" data-role="' + p.id + '"><span class="choice-ic">' + icon(p.icon, 24) + '</span><b>' + p.title + '</b></button>';
            }).join('') + '</div></div>' +

          '<div class="card"><h2>Прогресс по мирам</h2><p class="muted small">Экспедиций пройдено: ' + prog.expeditions_completed + '</p><ul class="city-progress">' + prog.cities.map(function (c, i) {
            var head = (i === 0 || prog.cities[i - 1].world_id !== c.world_id) ? '<li class="cp-world">' + esc(c.world_title) + '</li>' : '';
            return head + '<li style="--city:' + c.color + '"><span class="cp-ic">' + icon(c.status === 'locked' ? 'lock' : c.icon, 20) + '</span><div><b>' + esc(c.title) + '</b>' +
              '<div class="progress progress--thin" role="progressbar" aria-valuemin="0" aria-valuemax="' + c.total + '" aria-valuenow="' + c.completed + '" aria-label="' + esc(c.title) + '"><span style="width:' + (c.completed / c.total * 100) + '%"></span></div></div><small>' + c.completed + '/' + c.total + '</small></li>';
          }).join('') + '</ul></div>' +

          '<div class="card"><h2>Навыки</h2><p class="muted small">По первым попыткам в последних 10 заданиях каждого навыка.</p><ul class="skills">' + prog.skills.map(skillRow).join('') + '</ul></div>' +

          '<div class="card"><h2>Достижения</h2><ul class="ach-list">' + ach.map(function (a) {
            return '<li class="ach ' + (a.awarded_at ? 'ach--on' : '') + '"><span class="ach-ic">' + icon(a.awarded_at ? a.icon : 'lock', 26) + '</span><b>' + esc(a.title) + '</b><small>' + esc(a.description) + '</small>' +
              '<span class="sr-only">' + (a.awarded_at ? 'получено' : 'не получено') + '</span></li>';
          }).join('') + '</ul></div>' +

          '<div class="card"><h2>Настройки</h2><form class="settings" data-settings>' +
            '<div class="field"><label for="p-name">Никнейм</label><input id="p-name" name="display_name" value="' + esc(me.display_name) + '" maxlength="32"></div>' +
            '<fieldset class="field"><legend>Размер текста</legend><div class="seg">' +
              [[0.9, 'Мельче'], [1, 'Обычный'], [1.15, 'Крупнее'], [1.3, 'Очень крупный']].map(function (f) {
                return '<label class="seg-opt"><input type="radio" name="font" value="' + f[0] + '" ' + (me.settings.font_scale == f[0] ? 'checked' : '') + '><span>' + f[1] + '</span></label>';
              }).join('') + '</div></fieldset>' +
            '<label class="switch"><input type="checkbox" name="motion" ' + (me.settings.reduce_motion ? 'checked' : '') + '><span>Меньше анимации</span></label>' +
            '<button class="btn btn--primary" type="submit">Сохранить</button></form></div>' +

          '<div class="card card--dev"><h2>Демо-режим мок-бэкенда</h2><p class="muted small">Серверные роли выдаёт администратор в Laravel. Здесь — переключатель только для демонстрации CMS.</p>' +
            '<div class="seg">' + [['', 'Учащийся'], ['editor', 'Редактор'], ['admin', 'Администратор']].map(function (x) {
              var on = x[0] ? me.roles.indexOf(x[0]) !== -1 : !me.roles.length;
              return '<label class="seg-opt"><input type="radio" name="mockrole" value="' + x[0] + '" ' + (on ? 'checked' : '') + '><span>' + x[1] + '</span></label>';
            }).join('') + '</div>' +
            '<p class="muted small" style="margin-top:1rem">Готовый прогресс для текущего игрока — чтобы увидеть продолжение игры после прохождения.</p>' +
            '<div class="row-gap"><button class="btn btn--ghost btn--sm" data-demo-preset="all">' + icon('circle-check', 16) + ' Всё пройдено</button>' +
            '<button class="btn btn--ghost btn--sm" data-demo-preset="before_final">' + icon('flag', 16) + ' Перед финалом</button>' +
            '<button class="btn btn--ghost btn--sm" data-reset>Сбросить мой прогресс</button></div></div>' +

          '<button class="btn btn--ghost" data-logout>' + icon('logout', 18) + ' Выйти</button>' +
        '</section>'
      );
      var root = app.main;
      root.querySelectorAll('[data-role]').forEach(function (b) {
        b.addEventListener('click', function () {
          DS.api.patch('/me/learning-profile', { role_type: b.getAttribute('data-role'), track_id: 'reading' }).then(function (m) {
            app.setMe(m); ui.toast('Профиль обновлён', 'success'); app.views.profile();
          }, function (e) { ui.toast(esc(e.message), 'error'); });
        });
      });
      root.querySelector('[data-settings]').addEventListener('submit', function (e) {
        e.preventDefault();
        var f = e.target;
        DS.api.patch('/me/settings', { display_name: f.display_name.value, font_scale: Number(f.querySelector('[name=font]:checked').value), reduce_motion: f.motion.checked })
          .then(function (m) { app.setMe(m); ui.toast('Настройки сохранены', 'success'); }, function (er) { ui.toast(esc(er.message), 'error'); });
      });
      root.querySelectorAll('[name=mockrole]').forEach(function (i) {
        i.addEventListener('change', function () {
          var roles = i.value === 'admin' ? ['editor', 'admin'] : i.value ? [i.value] : [];
          DS.api.post('/mock/roles', { roles: roles }).then(function (m) { app.setMe(m); ui.toast('Роль: ' + (i.value || 'учащийся'), 'info'); });
        });
      });
      root.querySelectorAll('[data-demo-preset]').forEach(function (b) {
        b.addEventListener('click', function () {
          var preset = b.getAttribute('data-demo-preset');
          b.disabled = true;
          var go = preset === 'before_final' ? DS.api.post('/mock/reset-progress') : Promise.resolve();
          go.then(function () { return DS.api.post('/mock/demo-progress', { preset: preset }); }).then(function (m) {
            app.setMe(m); ui.toast('Демо-прогресс применён', 'success'); app.go(preset === 'before_final' ? '#/city/c5' : '#/map');
          }, function (e) { b.disabled = false; ui.toast(esc(e.message), 'error'); });
        });
      });
      root.querySelector('[data-reset]').addEventListener('click', function () {
        ui.confirm('Сбросить прогресс?', 'XP, монеты, достижения и пройденные уроки будут удалены (только в мок-режиме).', 'Сбросить').then(function (ok) {
          if (ok) DS.api.post('/mock/reset-progress').then(function (m) { app.setMe(m); app.go('#/map'); });
        });
      });
      root.querySelector('[data-logout]').addEventListener('click', function () {
        DS.api.logout().then(function () { app.me = null; app.setMe(null); app.go('#/welcome'); });
      });
    });
  };

  app.views.review = function () {
    app.load(DS.api.get('/me/review'), function (rv) {
      var withMistakes = rv.skills.filter(function (s) { return s.mistakes > 0; });
      var body;
      if (rv.active_session) {
        body = '<div class="card card--hero"><div><p class="eyebrow">Тренировка не закончена</p><h2>Повторение ошибок</h2><p class="muted">Отвечено ' + rv.active_session.progress.answered + ' из ' + rv.active_session.progress.total + '</p></div>' +
          '<a class="btn btn--primary btn--lg" href="#/session/' + rv.active_session.id + '">Продолжить</a></div>';
      } else if (!rv.total) {
        body = ui.emptyState('Ошибок нет', 'Когда в уроке что-то не получится, задание появится здесь для тренировки. Повторение не блокирует основной маршрут.', '<a class="btn btn--primary" href="#/map">К карте</a>');
      } else {
        body = '<div class="card card--hero"><div><h2>Все ошибки</h2><p class="muted">' + rv.total + ' ' + ui.plural(rv.total, 'задание', 'задания', 'заданий') + ' · до 5 за тренировку</p></div>' +
          '<button class="btn btn--primary btn--lg" data-start="">Начать тренировку</button></div>' +
          '<ul class="review-list">' + withMistakes.map(function (s) {
            return '<li class="card"><div class="card-head"><div><h3>' + esc(s.title) + '</h3><p class="muted small">' + s.mistakes + ' ' + ui.plural(s.mistakes, 'задание', 'задания', 'заданий') +
              (s.status === 'needs_review' ? ' · <b class="warn">рекомендуем повторить</b>' : '') + '</p></div>' +
              '<button class="btn btn--ghost btn--sm" data-start="' + s.skill_id + '">Тренировать</button></div>' +
              '<ul class="chips">' + s.questions.map(function (q) { return '<li>' + esc(q.title) + '</li>'; }).join('') + '</ul></li>';
          }).join('') + '</ul>';
      }
      app.render('<section class="page"><header class="page-head"><h1>Повторение</h1></header>' +
        ui.bubble(esc(app.say('Ошибки — это улики! Разберём их, и навык станет крепче.', 'Повторение помогает закрепить навыки. Награды за маршрут оно не отнимает.')), 'think', { compact: true }) +
        body +
        '<div class="card"><h2>Навыки</h2><ul class="skills">' + rv.skills.map(skillRow).join('') + '</ul></div></section>');
      app.main.querySelectorAll('[data-start]').forEach(function (b) {
        b.addEventListener('click', function () {
          b.disabled = true;
          var skill = b.getAttribute('data-start');
          DS.api.post('/lesson-sessions', { mode: 'review', skill_id: skill || null }).then(function (s) { app.go('#/session/' + s.id); },
            function (e) { b.disabled = false; ui.toast(esc(e.message), 'error'); });
        });
      });
    });
  };
})();

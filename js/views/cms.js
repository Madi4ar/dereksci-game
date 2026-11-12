/* CMS: каталог заданий, редактор с предпросмотром, версии и публикация (US-05), аналитика. */
(function () {
  'use strict';
  var app = DS.app, ui = DS.ui, esc = ui.esc, icon = ui.icon;
  var STATUS = { draft: 'Черновик', review: 'На проверке', published: 'Опубликовано', archived: 'Архив' };
  var TYPES = DS.questions.TYPE_LABELS;

  function tabs(active) {
    return '<nav class="tabs" aria-label="Разделы CMS">' +
      '<a href="#/cms" class="' + (active === 'list' ? 'active' : '') + '">Задания</a>' +
      '<a href="#/cms/q/new" class="' + (active === 'new' ? 'active' : '') + '">+ Новое задание</a>' +
      '<a href="#/cms/worlds" class="' + (active === 'worlds' ? 'active' : '') + '">Миры</a>' +
      '<a href="#/cms/analytics" class="' + (active === 'analytics' ? 'active' : '') + '">Аналитика</a></nav>';
  }

  app.views.cms = function () {
    var filter = { city: '', type: '', status: '', q: '' };
    app.load(DS.api.get('/admin/questions'), function (data) {
      function rows() {
        return data.items.filter(function (it) {
          return (!filter.city || it.city_id === filter.city) && (!filter.type || it.type === filter.type) &&
            (!filter.status || it.status === filter.status) && (!filter.q || (it.title + ' ' + it.id).toLowerCase().indexOf(filter.q.toLowerCase()) !== -1);
        });
      }
      function drawTable() {
        var list = rows();
        app.main.querySelector('[data-table]').innerHTML = list.length ? '<table class="table"><thead><tr><th>Задание</th><th>Тип</th><th>Урок</th><th>Статус</th><th>Версия</th></tr></thead><tbody>' +
          list.map(function (it) {
            var lesson = data.lessons.find(function (l) { return l.id === it.lesson_id; });
            return '<tr><td><a href="#/cms/q/' + esc(it.id) + '">' + esc(it.title) + '</a><small class="muted block">' + esc(it.id) + '</small></td>' +
              '<td>' + esc(TYPES[it.type]) + '</td><td>' + esc(lesson ? lesson.title : '—') + '</td>' +
              '<td><span class="pill pill--st-' + it.status + '">' + STATUS[it.status] + '</span></td>' +
              '<td>v' + it.latest_version + (it.published_version && it.published_version !== it.latest_version ? ' <small class="muted">(в игре v' + it.published_version + ')</small>' : '') + '</td></tr>';
          }).join('') + '</tbody></table>' : ui.emptyState('Ничего не найдено', 'Измените фильтры.');
      }
      app.render(
        '<section class="page page--wide">' +
          '<header class="page-head"><p class="eyebrow">Роли: ' + esc(app.me.roles.join(', ')) + '</p><h1>Контент</h1></header>' + tabs('list') +
          '<div class="card card--warn"><h2>Задачи редактора по сценарию</h2><ul class="bullets">' + data.editor_tasks.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul></div>' +
          '<div class="filters">' +
            '<input type="search" placeholder="Поиск по названию или ID" aria-label="Поиск" data-f="q">' +
            '<select data-f="city" aria-label="Город"><option value="">Все города</option>' + data.cities.map(function (c) { return '<option value="' + c.id + '">' + esc(c.title) + '</option>'; }).join('') + '</select>' +
            '<select data-f="type" aria-label="Тип"><option value="">Все типы</option>' + Object.keys(TYPES).map(function (k) { return '<option value="' + k + '">' + TYPES[k] + '</option>'; }).join('') + '</select>' +
            '<select data-f="status" aria-label="Статус"><option value="">Все статусы</option>' + Object.keys(STATUS).map(function (k) { return '<option value="' + k + '">' + STATUS[k] + '</option>'; }).join('') + '</select>' +
          '</div>' +
          '<div class="table-wrap" data-table></div>' +
        '</section>'
      );
      app.main.querySelectorAll('[data-f]').forEach(function (el) {
        el.addEventListener('input', function () { filter[el.getAttribute('data-f')] = el.value; drawTable(); });
      });
      drawTable();
    }, 'Загружаем каталог…');
  };

  /* ---- редактор ---- */
  function optionsToText(opts) { return (opts || []).map(function (o) { return o.id + ' | ' + o.text + (o.note ? ' | ' + o.note : ''); }).join('\n'); }
  function textToOptions(t) {
    return t.split('\n').map(function (l) { return l.trim(); }).filter(Boolean).map(function (l) {
      var p = l.split('|').map(function (x) { return x.trim(); });
      var o = { id: p[0], text: p[1] || '' }; if (p[2]) o.note = p[2]; return o;
    });
  }

  app.views.cmsEdit = function (params) {
    var isNew = params.questionId === 'new';
    var reqs = [DS.api.get('/admin/questions')];
    if (!isNew) reqs.push(DS.api.get('/admin/questions/' + params.questionId));
    app.load(Promise.all(reqs), function (r) {
      var cat = r[0], q = r[1] || null;
      var latest = q ? q.versions[q.versions.length - 1] : null;
      var p = latest ? latest.payload : { title: '', instruction: '', stem: '', options: [] };
      var type = q ? q.type : 'sentence_select';
      var isAdmin = app.me.roles.indexOf('admin') !== -1;

      app.render(
        '<section class="page page--wide">' +
          '<a class="back-link" href="#/cms">' + icon('back', 18) + ' Каталог</a>' +
          '<header class="page-head"><h1>' + (isNew ? 'Новое задание' : esc(p.title)) + '</h1>' +
            (q ? '<p class="muted"><span class="pill pill--st-' + latest.status + '">' + STATUS[latest.status] + '</span> v' + latest.version + ' · ' + esc(TYPES[type]) + ' · ' + esc(q.id) + '</p>' : '') + '</header>' +
          (isNew ? tabs('new') : '') +
          (q && latest.status === 'published' ? '<p class="card card--info small">Опубликованная версия неизменяема: при сохранении создастся новая редакция v' + (latest.version + 1) + '. Пройденные уроки и история попыток не изменятся.</p>' : '') +
          '<div class="editor">' +
            '<form class="card form" data-form novalidate>' +
              (isNew ? '<div class="field"><label for="c-type">Тип</label><select id="c-type" name="type">' + Object.keys(TYPES).map(function (k) { return '<option value="' + k + '">' + TYPES[k] + '</option>'; }).join('') + '</select></div>' +
                '<div class="field"><label for="c-lesson">Урок</label><select id="c-lesson" name="lesson_id">' + cat.lessons.map(function (l) { return '<option value="' + l.id + '"' + (DS.cmsPrefLesson === l.id ? ' selected' : '') + '>' + esc(l.title) + '</option>'; }).join('') + '</select><p class="field-err" data-err="lesson_id"></p></div>' : '') +
              field('title', 'Название', p.title) +
              field('robot_line', 'Реплика DerekSci', p.robot_line, 'area') +
              field('instruction', 'Инструкция', p.instruction) +
              field('body', 'Текст ситуации (для «пропуска» и «утверждения»)', p.body, 'area') +
              field('stem', 'Вопрос / вывод (для пропуска — «___» на месте слова)', p.stem, 'area') +
              '<div class="field" data-opts-field><label for="c-options">Варианты: по строке «id | текст | пояснение»</label><textarea id="c-options" name="options" rows="5">' + esc(optionsToText(p.options)) + '</textarea><p class="field-err" data-err="options"></p></div>' +
              '<div class="field"><label for="c-key">Правильный ответ (ID через запятую; для порядка — все ID по порядку)</label><input id="c-key" name="answer_key" value="' + esc(latest ? latest.answer_key.join(', ') : '') + '"><p class="field-hint small muted" data-key-hint></p><p class="field-err" data-err="answer_key"></p></div>' +
              field('hint', 'Подсказка', p.hint, 'area') +
              field('feedback_correct', 'Отклик на верный ответ', p.feedback_correct, 'area') +
              field('feedback_wrong', 'Отклик на ошибку', p.feedback_wrong, 'area') +
              field('explanation', 'Объяснение (после 2 ошибок)', p.explanation, 'area') +
              field('source_title', 'Источник текста', p.source_title) +
              '<p class="form-err" role="alert"></p>' +
              '<div class="row-gap">' +
                '<button type="submit" class="btn btn--primary">Сохранить черновик</button>' +
                '<button type="button" class="btn btn--ghost" data-preview>Предпросмотр</button>' +
                (q && latest.status === 'draft' ? '<button type="button" class="btn btn--ghost" data-act="submit">Отправить на проверку</button>' : '') +
                (q && latest.status === 'review' && isAdmin ? '<button type="button" class="btn btn--success" data-act="publish">Опубликовать</button><button type="button" class="btn btn--ghost" data-act="reject">Вернуть в черновик</button>' : '') +
                (q && latest.status === 'review' && !isAdmin ? '<span class="muted small">Публикует администратор.</span>' : '') +
              '</div>' +
            '</form>' +
            '<aside class="editor-side">' +
              '<div class="card"><h2>Предпросмотр</h2><div class="preview" data-preview-box><p class="muted small">Нажмите «Предпросмотр».</p></div></div>' +
              (q ? '<div class="card"><h2>Версии</h2><ul class="versions">' + q.versions.slice().reverse().map(function (v) {
                return '<li><b>v' + v.version + '</b> <span class="pill pill--st-' + v.status + '">' + STATUS[v.status] + '</span><small class="muted block">' + esc(v.author || '') + ' · ' + new Date(v.created_at).toLocaleString('ru') + '</small></li>';
              }).join('') + '</ul></div>' +
              '<div class="card"><h2>Журнал изменений</h2>' + (q.audit.length ? '<ul class="versions">' + q.audit.map(function (a) {
                return '<li>' + esc(a.action) + (a.extra && a.extra.version ? ' v' + a.extra.version : '') + '<small class="muted block">' + esc(a.actor) + ' · ' + new Date(a.created_at).toLocaleString('ru') + '</small></li>';
              }).join('') + '</ul>' : '<p class="muted small">Изменений пока нет (импортировано из сценария).</p>') + '</div>' : '') +
            '</aside>' +
          '</div>' +
        '</section>'
      );

      var form = app.main.querySelector('[data-form]');
      function curType() { return isNew ? form.type.value : type; }
      function syncType() {
        var t = curType();
        form.querySelector('[data-opts-field]').hidden = t === 'claim_check';
        form.querySelector('[data-key-hint]').textContent = t === 'claim_check' ? 'supported / contradicted / insufficient' : t === 'sequence_order' ? 'например: e1, e2, e3' : 'например: s3';
      }
      if (isNew) form.type.addEventListener('change', syncType);
      syncType();

      function collect() {
        var payload = {};
        ['title', 'robot_line', 'instruction', 'body', 'stem', 'hint', 'feedback_correct', 'feedback_wrong', 'explanation', 'source_title'].forEach(function (k) {
          var v = form[k].value.trim(); if (v) payload[k] = v;
        });
        if (curType() !== 'claim_check') payload.options = textToOptions(form.options.value);
        var key = form.answer_key.value.split(',').map(function (x) { return x.trim(); }).filter(Boolean);
        return { payload: payload, answer_key: key };
      }
      function showErrors(err) {
        form.querySelectorAll('.field-err').forEach(function (e) { e.textContent = ''; });
        form.querySelector('.form-err').textContent = err.message;
        if (err.details) Object.keys(err.details).forEach(function (k) {
          var el = form.querySelector('[data-err="' + k + '"]'); if (el) el.textContent = err.details[k];
        });
      }

      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var d = collect();
        var req = isNew ? DS.api.post('/admin/questions', { type: form.type.value, lesson_id: form.lesson_id.value, payload: d.payload, answer_key: d.answer_key })
          : DS.api.put('/admin/questions/' + q.id, d);
        req.then(function (row) { ui.toast('Черновик сохранён', 'success'); if (isNew) app.go('#/cms/q/' + row.id); else app.views.cmsEdit(params); }, showErrors);
      });
      form.querySelectorAll('[data-act]').forEach(function (b) {
        b.addEventListener('click', function () {
          DS.api.post('/admin/questions/' + q.id + '/' + b.getAttribute('data-act')).then(function () {
            ui.toast({ submit: 'Отправлено на проверку', publish: 'Опубликовано — новые сессии получат эту версию', reject: 'Возвращено в черновик' }[b.getAttribute('data-act')], 'success');
            app.views.cmsEdit(params);
          }, showErrors);
        });
      });
      form.querySelector('[data-preview]').addEventListener('click', function () {
        var d = collect(); var t = curType();
        var box = app.main.querySelector('[data-preview-box]');
        var pq = Object.assign({ type: t, question_version_id: 'preview' }, d.payload);
        if (t === 'claim_check') pq.options = [{ id: 'supported', text: 'Подтверждается' }, { id: 'contradicted', text: 'Противоречит' }, { id: 'insufficient', text: 'Недостаточно данных' }];
        if (!pq.options || !pq.options.length || !pq.stem) { box.innerHTML = '<p class="field-err">Заполните вопрос и варианты.</p>'; return; }
        box.innerHTML = '<h3 class="q-title">' + esc(pq.title || '') + '</h3>' + (pq.robot_line ? ui.bubble(esc(pq.robot_line), 'idle', { compact: true }) : '') +
          '<p class="q-instruction">' + esc(pq.instruction || '') + '</p><div data-pq></div>';
        DS.questions.mount(box.querySelector('[data-pq]'), pq, {});
      });
    }, 'Загружаем редактор…');
  };

  function field(name, label, value, kind) {
    var id = 'c-' + name;
    return '<div class="field"><label for="' + id + '">' + label + '</label>' +
      (kind === 'area' ? '<textarea id="' + id + '" name="' + name + '" rows="2">' + esc(value || '') + '</textarea>' : '<input id="' + id + '" name="' + name + '" value="' + esc(value || '') + '">') +
      '<p class="field-err" data-err="' + name + '"></p></div>';
  }

  /* ---- аналитика ---- */
  app.views.cmsAnalytics = function () {
    app.load(DS.api.get('/admin/analytics'), function (a) {
      var ev = Object.keys(a.events).sort();
      app.render(
        '<section class="page page--wide"><header class="page-head"><h1>Аналитика</h1></header>' + tabs('analytics') +
          '<div class="grid-4">' +
            stat(a.users, 'пользователей') + stat(a.lessons_started, 'уроков начато') + stat(a.lessons_completed, 'уроков завершено') +
            stat(a.avg_lesson_ms ? Math.round(a.avg_lesson_ms / 60000 * 10) / 10 + ' мин' : '—', 'среднее время урока') +
          '</div>' +
          '<div class="card"><h2>Первые правильные ответы по навыкам</h2><ul class="skills">' + a.skills.map(function (s) {
            return '<li class="skill"><div class="skill-head"><b>' + esc(s.title) + '</b><span>' + ui.pct(s.accuracy) + ' · ' + s.answers + ' отв.</span></div>' +
              '<div class="progress progress--thin" aria-hidden="true"><span style="width:' + ((s.accuracy || 0) * 100) + '%"></span></div></li>';
          }).join('') + '</ul></div>' +
          '<div class="card"><h2>Прогресс по городам</h2><table class="table"><thead><tr><th>Город</th><th>Пользователей прошли</th></tr></thead><tbody>' +
            a.by_city.map(function (c) { return '<tr><td>' + esc(c.title) + '</td><td>' + c.completed_users + '</td></tr>'; }).join('') + '</tbody></table></div>' +
          '<div class="card"><h2>События</h2>' + (ev.length ? '<table class="table"><tbody>' + ev.map(function (k) { return '<tr><td><code>' + esc(k) + '</code></td><td>' + a.events[k] + '</td></tr>'; }).join('') + '</tbody></table>' : '<p class="muted">Событий пока нет.</p>') + '</div>' +
        '</section>'
      );
    });
  };

  /* ---- миры: цепочка вселенной. Новые миры собираются здесь и после публикации встают в конец цепочки ---- */
  var TYPE_OPTIONS = Object.keys(TYPES).map(function (k) { return '<option value="' + k + '">' + TYPES[k] + '</option>'; }).join('');

  app.views.cmsWorlds = function () {
    app.load(DS.api.get('/admin/worlds'), function (worlds) {
      var isAdmin = app.me.roles.indexOf('admin') !== -1;
      app.render(
        '<section class="page page--wide"><header class="page-head"><h1>Миры вселенной</h1>' +
          '<p class="muted">Миры открываются игрокам по порядку. После публикации новый мир встаёт в конец цепочки — финал предыдущего мира ведёт в него. Пока новых миров нет, игроки проходят бесконечные экспедиции.</p></header>' +
          tabs('worlds') +
          '<ol class="cms-worlds">' + worlds.map(function (w, i) {
            return '<li class="card cms-world" style="--city:' + w.color + '">' +
              '<div class="card-head"><div class="cms-world-title"><span class="city-ic city-ic--sm">' + icon(w.icon || 'orbit', 20) + '</span><div><small class="muted">Мир ' + (i + 1) + ' · ' + esc(w.source) + '</small><h2>' + esc(w.title) + '</h2></div></div>' +
                '<span class="pill pill--st-' + (w.status === 'published' ? 'published' : 'draft') + '">' + (w.status === 'published' ? 'Опубликован' : 'Черновик') + '</span></div>' +
              '<ul class="cms-cities">' + (w.cities.length ? w.cities.map(function (c) {
                return '<li><div class="cms-city-head">' + icon(c.icon || 'map-pin', 16) + ' <b>' + esc(c.title) + '</b> <span class="muted small">' + esc(TYPES[c.type] || '') + ' · фрагмент «' + esc(c.fragment) + '»</span></div>' +
                  '<ul class="cms-lessons">' + c.lessons.map(function (l) {
                    return '<li>' + icon('book-open', 14) + ' ' + esc(l.title) + ' <span class="muted small">— заданий: ' + l.questions_published + ' опубл. / ' + l.questions_total + '</span>' +
                      (w.editable ? ' <button class="btn btn--ghost btn--sm" data-add-q="' + l.id + '">+ задание</button>' : '') + '</li>';
                  }).join('') +
                  (w.editable ? '<li><form class="inline-form" data-add-lesson="' + c.id + '"><input name="title" placeholder="Название нового урока" aria-label="Название нового урока" required><button class="btn btn--ghost btn--sm">+ урок</button></form></li>' : '') +
                  '</ul></li>';
              }).join('') : '<li class="muted">Городов пока нет.</li>') + '</ul>' +
              (w.editable ? '<details class="cms-add-city"><summary>+ Добавить город</summary><form class="form" data-add-city="' + w.id + '">' +
                  '<div class="grid-2"><div class="field"><label>Название</label><input name="title" required></div>' +
                  '<div class="field"><label>Режим / подзаголовок</label><input name="mode" placeholder="«Найди ответ»"></div>' +
                  '<div class="field"><label>Тип заданий</label><select name="type">' + TYPE_OPTIONS + '</select></div>' +
                  '<div class="field"><label>Фрагмент секретного сообщения</label><input name="fragment" required></div>' +
                  '<div class="field"><label>Иконка Lucide</label><input name="icon" placeholder="map-pin"></div>' +
                  '<div class="field"><label>Цвет</label><input name="color" type="color" value="' + esc(w.color || '#7b5cff') + '"></div></div>' +
                  '<div class="field"><label>Описание</label><input name="description"></div>' +
                  '<div class="field"><label>Вступление DerekSci (по строке на реплику)</label><textarea name="story_intro" rows="2"></textarea></div>' +
                  '<p class="form-err" role="alert"></p><button class="btn btn--primary btn--sm">Добавить город</button></form></details>' : '') +
              (w.editable && w.status !== 'published' ? '<div class="cms-publish">' +
                  (w.problems.length ? '<p class="small warn">' + icon('triangle-alert', 16) + ' Не готов к публикации: ' + esc(w.problems.join('; ')) + '</p>' : '<p class="small">' + icon('circle-check', 16) + ' Готов к публикации</p>') +
                  (isAdmin ? '<button class="btn btn--success btn--sm" data-publish-world="' + w.id + '" ' + (w.problems.length ? 'disabled' : '') + '>Опубликовать мир</button>' : '<span class="muted small">Публикует администратор.</span>') +
                '</div>' : '') +
              (!w.editable ? '<p class="muted small">Мир из сценария/сид-данных — структура только для чтения, задания редактируются в каталоге.</p>' : '') +
            '</li>';
          }).join('') + '</ol>' +
          '<div class="card"><h2>Новый мир</h2><form class="form" data-new-world>' +
            '<div class="grid-2"><div class="field"><label for="nw-title">Название мира</label><input id="nw-title" name="title" required><p class="field-err" data-err="title"></p></div>' +
            '<div class="field"><label for="nw-sub">Подзаголовок</label><input id="nw-sub" name="subtitle" placeholder="Например: Остров логики"></div>' +
            '<div class="field"><label for="nw-icon">Иконка Lucide</label><input id="nw-icon" name="icon" placeholder="orbit"></div>' +
            '<div class="field"><label for="nw-color">Цвет</label><input id="nw-color" name="color" type="color" value="#7b5cff"></div></div>' +
            '<div class="field"><label for="nw-intro">Вступление (по строке на реплику DerekSci)</label><textarea id="nw-intro" name="intro" rows="3"></textarea></div>' +
            '<div class="grid-2"><div class="field"><label for="nw-phrase">Финальная фраза</label><input id="nw-phrase" name="final_phrase"></div>' +
            '<div class="field"><label for="nw-badge">Значок за мир</label><input id="nw-badge" name="final_badge"></div></div>' +
            '<div class="field"><label for="nw-final">Финальная сцена (по строке на реплику)</label><textarea id="nw-final" name="final_scene" rows="2"></textarea></div>' +
            '<p class="form-err" role="alert"></p><button class="btn btn--primary">Создать черновик мира</button></form></div>' +
        '</section>'
      );
      var root = app.main;
      function formData(f) { var o = {}; Array.prototype.forEach.call(f.elements, function (el) { if (el.name) o[el.name] = el.value; }); return o; }
      function onErr(f) { return function (err) { f.querySelector('.form-err').textContent = err.message + (err.details ? ': ' + Object.keys(err.details).map(function (k) { return err.details[k]; }).join('; ') : ''); }; }
      root.querySelector('[data-new-world]').addEventListener('submit', function (e) {
        e.preventDefault();
        DS.api.post('/admin/worlds', formData(e.target)).then(function () { ui.toast('Черновик мира создан', 'success'); app.views.cmsWorlds(); }, onErr(e.target));
      });
      root.querySelectorAll('[data-add-city]').forEach(function (f) {
        f.addEventListener('submit', function (e) {
          e.preventDefault();
          DS.api.post('/admin/worlds/' + f.getAttribute('data-add-city') + '/cities', formData(f)).then(function () { ui.toast('Город добавлен', 'success'); app.views.cmsWorlds(); }, onErr(f));
        });
      });
      root.querySelectorAll('[data-add-lesson]').forEach(function (f) {
        f.addEventListener('submit', function (e) {
          e.preventDefault();
          DS.api.post('/admin/cities/' + f.getAttribute('data-add-lesson') + '/lessons', formData(f)).then(function () { ui.toast('Урок добавлен', 'success'); app.views.cmsWorlds(); },
            function (err) { ui.toast(esc(err.message), 'error'); });
        });
      });
      root.querySelectorAll('[data-add-q]').forEach(function (b) {
        b.addEventListener('click', function () { DS.cmsPrefLesson = b.getAttribute('data-add-q'); app.go('#/cms/q/new'); });
      });
      root.querySelectorAll('[data-publish-world]').forEach(function (b) {
        b.addEventListener('click', function () {
          ui.confirm('Опубликовать мир?', 'Мир станет доступен игрокам после прохождения предыдущих миров.', 'Опубликовать').then(function (ok) {
            if (!ok) return;
            DS.api.post('/admin/worlds/' + b.getAttribute('data-publish-world') + '/publish').then(function () {
              ui.toast('Мир опубликован и добавлен во вселенную', 'success'); app.views.cmsWorlds();
            }, function (err) { ui.toast(esc(err.message + (err.details ? ': ' + err.details.problems : '')), 'error'); });
          });
        });
      });
    }, 'Загружаем миры…');
  };

  function stat(v, label) { return '<div class="card stat-card"><b>' + esc(v) + '</b><small>' + esc(label) + '</small></div>'; }
})();

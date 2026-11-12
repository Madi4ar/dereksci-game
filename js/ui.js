/* Общие UI-хелперы: экранирование, иконки, робот DerekSci, модалки, тосты, состояния загрузки/ошибки. */
(function () {
  'use strict';
  window.DS = window.DS || {};

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* Иконки Lucide (vendor/lucide.min.js, v1.72.0). Собираем SVG-строку из данных иконки —
     синхронно, без lucide.createIcons() после каждого рендера.
     Принимает имя Lucide в kebab-case ('book-open') или короткий алиас из ALIASES. */
  var ALIASES = {
    home: 'house', review: 'rotate-ccw', profile: 'user', cms: 'layout-dashboard',
    close: 'x', up: 'chevron-up', down: 'chevron-down', grip: 'grip-vertical', bulb: 'lightbulb',
    coin: 'coins', chest: 'gift', arrow: 'arrow-right', back: 'arrow-left', logout: 'log-out',
    question: 'circle-question-mark', menu: 'menu'
  };
  var cache = {};
  function pascal(name) { return name.replace(/(^|-)([a-z0-9])/g, function (_, __, c) { return c.toUpperCase(); }); }
  function icon(name, size, cls) {
    size = size || 20;
    var key = ALIASES[name] || name;
    var nodes = cache[key];
    if (!nodes) {
      var data = window.lucide && window.lucide.icons[pascal(key)];
      if (!data) { console.warn('[icon] нет иконки Lucide:', key); return ''; }
      nodes = cache[key] = data.map(function (n) {
        return '<' + n[0] + Object.keys(n[1]).map(function (a) { return ' ' + a + '="' + n[1][a] + '"'; }).join('') + '/>';
      }).join('');
    }
    return '<svg class="ic lucide lucide-' + key + (cls ? ' ' + cls : '') + '" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + nodes + '</svg>';
  }

  /* Робот DerekSci — персонаж в полный рост (assets/robot/*.webp, эмоции из панели 3×3).
     size — высота в px. Каждая эмоция имеет свою «живую» анимацию (дыхание, прыжок, покачивание…),
     поэтому робот не стоит неподвижно. При «меньше движения» показывается статичный кадр. */
  var ROBOT_W = 294, ROBOT_H = 374, ROBOT_VB_H = 388;
  var ROBOT_MOODS = { idle: 'wave', wave: 'wave', happy: 'jump', jump: 'jump', wow: 'wow', think: 'think',
    proud: 'proud', sad: 'sad', laugh: 'laugh', angry: 'angry', wink: 'wink' };
  function robotPose(pose, extraCls, style) {
    return '<g class="rb-pose' + (extraCls ? ' ' + extraCls : '') + '"' + (style ? ' style="' + style + '"' : '') + '>' +
      '<ellipse class="rb-shadow rb-shadow--' + pose + '" cx="147" cy="377" rx="88" ry="9" fill="rgba(10,16,40,.2)"/>' +
      '<g class="rb-anim rb-a-' + pose + '"><image href="assets/robot/' + pose + '.webp" x="0" y="0" width="' + ROBOT_W + '" height="' + ROBOT_H + '"/></g></g>';
  }
  function robotSvg(cls, size, inner) {
    var h = Math.round(size), w = Math.round(size * ROBOT_W / ROBOT_VB_H);
    return '<svg class="robot ' + cls + '" width="' + w + '" height="' + h + '" viewBox="0 0 ' + ROBOT_W + ' ' + ROBOT_VB_H + '" role="img" aria-label="Робот DerekSci">' + inner + '</svg>';
  }
  function robot(mood, size) {
    var pose = ROBOT_MOODS[mood] || 'wave';
    return robotSvg('robot--' + pose, size || 110, robotPose(pose));
  }
  /* Робот, который по кругу меняет эмоции (экран приветствия) */
  function robotCycle(size, poses) {
    poses = poses || ['wave', 'jump', 'wow', 'proud', 'wink', 'laugh'];
    var dur = poses.length * 3;
    return robotSvg('robot--cycle', size, poses.map(function (p, i) {
      return robotPose(p, 'rb-cycle-item', 'animation-duration:' + dur + 's;animation-delay:' + (i * 3 - dur) + 's;--rb-n:' + poses.length);
    }).join(''));
  }

  function bubble(text, mood, opts) {
    opts = opts || {};
    return '<div class="derek ' + (opts.compact ? 'derek--compact' : '') + '">' +
      '<div class="derek-avatar">' + robot(mood, opts.size || (opts.compact ? 76 : 116)) + '</div>' +
      '<div class="derek-bubble"><span class="sr-only">DerekSci говорит: </span>' + text + '</div></div>';
  }

  function loading(label) {
    return '<div class="state state--loading" role="status" aria-live="polite"><div class="spinner" aria-hidden="true"></div><p>' + esc(label || 'Загрузка…') + '</p></div>';
  }
  function errorState(err, retryLabel) {
    var offline = err && err.code === 'offline';
    var locked = err && (err.code === 'locked' || err.status === 403);
    return '<div class="state state--error" role="alert">' + robot(offline ? 'think' : 'sad', 130) +
      '<h2>' + (offline ? 'Нет подключения' : locked ? 'Пока закрыто' : 'Что-то пошло не так') + '</h2>' +
      '<p>' + esc((err && err.message) || 'Попробуйте ещё раз.') + '</p>' +
      '<div class="row-gap">' + (locked ? '<a class="btn btn--primary" href="#/map">К карте</a>' :
        '<button class="btn btn--primary" data-action="retry">' + esc(retryLabel || 'Повторить') + '</button>') + '</div></div>';
  }
  function emptyState(title, text, action) {
    return '<div class="state state--empty">' + robot('proud', 130) + '<h2>' + esc(title) + '</h2><p>' + esc(text) + '</p>' + (action || '') + '</div>';
  }

  /* ---- модальное окно ---- */
  var lastFocus = null;
  function modal(opts) {
    var root = document.getElementById('modal-root');
    lastFocus = document.activeElement;
    root.innerHTML = '<div class="modal-backdrop" data-close="1"></div>' +
      '<div class="modal ' + (opts.className || '') + '" role="dialog" aria-modal="true" aria-labelledby="modal-title" tabindex="-1">' +
      (opts.dismissible === false ? '' : '<button class="icon-btn modal-close" data-close="1" aria-label="Закрыть">' + icon('close') + '</button>') +
      (opts.title ? '<h2 id="modal-title" class="modal-title">' + opts.title + '</h2>' : '<h2 id="modal-title" class="sr-only">Сообщение</h2>') +
      '<div class="modal-body">' + (opts.body || '') + '</div>' +
      (opts.actions ? '<div class="modal-actions">' + opts.actions + '</div>' : '') + '</div>';
    root.hidden = false;
    var dlg = root.querySelector('.modal');
    var first = dlg.querySelector('[data-autofocus]') || dlg.querySelector('.modal-actions .btn') || dlg;
    setTimeout(function () { first.focus(); }, 30);
    function onKey(e) {
      if (e.key === 'Escape' && opts.dismissible !== false) close();
      if (e.key === 'Tab') { // простая ловушка фокуса
        var f = dlg.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (!f.length) return;
        var a = f[0], z = f[f.length - 1];
        if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
        else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
      }
    }
    function close(val) {
      root.hidden = true; root.innerHTML = '';
      document.removeEventListener('keydown', onKey);
      if (lastFocus && lastFocus.focus) lastFocus.focus();
      if (opts.onClose) opts.onClose(val);
    }
    document.addEventListener('keydown', onKey);
    root.onclick = function (e) {
      var t = e.target.closest('[data-close],[data-modal-action]');
      if (!t) return;
      if (t.hasAttribute('data-close') && opts.dismissible === false) return;
      close(t.getAttribute('data-modal-action') || null);
    };
    return { el: dlg, close: close };
  }
  function confirmDialog(title, text, okLabel) {
    return new Promise(function (resolve) {
      modal({ title: esc(title), body: '<p>' + esc(text) + '</p>',
        actions: '<button class="btn btn--ghost" data-modal-action="cancel">Отмена</button><button class="btn btn--primary" data-modal-action="ok">' + esc(okLabel || 'Да') + '</button>',
        onClose: function (v) { resolve(v === 'ok'); } });
    });
  }

  /* Сюжетная сцена: последовательность реплик DerekSci / рассказчика / неизвестного */
  var SPEAKER = {
    derek: { name: 'DerekSci', mood: 'idle' },
    narrator: { name: '', mood: null },
    unknown: { name: 'Неизвестное сообщение', mood: null },
    keeper: { name: 'Хранитель', mood: null, icon: 'library-big' },
    astronomer: { name: 'Звездочёт', mood: null, icon: 'telescope' }
  };
  function storyScene(lines, opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var i = 0;
      var m = modal({ className: 'modal--story', dismissible: opts.dismissible !== false, title: opts.title ? esc(opts.title) : null, body: '<div class="story" aria-live="polite"></div>',
        actions: '<button class="btn btn--ghost btn--lg story-skip" data-story-skip>' + icon('skip-forward', 18) + '<span>Пропустить</span></button>' +
          '<button class="btn btn--primary btn--lg" data-story-next data-autofocus></button>',
        onClose: function () { resolve(); } });
      var box = m.el.querySelector('.story');
      var btn = m.el.querySelector('[data-story-next]');
      var skip = m.el.querySelector('[data-story-skip]');
      skip.setAttribute('aria-label', 'Пропустить сюжет');
      function render() {
        var l = lines[i]; var sp = SPEAKER[l.speaker] || SPEAKER.derek;
        var mood = l.mood || (l.speaker === 'derek' ? (i === lines.length - 1 ? 'happy' : 'idle') : null);
        var html;
        if (l.speaker === 'derek') html = bubble(esc(l.text), mood);
        else if (l.speaker === 'unknown') html = '<div class="story-glitch"><div class="eye-icon">' + icon('eye', 34) + '</div><p class="story-who">' + sp.name + '</p><p class="story-quote">' + esc(l.text) + '</p></div>';
        else if (l.speaker === 'keeper' || l.speaker === 'astronomer') html = '<div class="story-keeper"><div class="keeper-icon">' + icon(sp.icon, 36) + '</div><p class="story-who">' + sp.name + '</p><p>' + esc(l.text) + '</p></div>';
        else html = '<p class="story-narrator">' + esc(l.text) + '</p>';
        var media = DS.scenes ? DS.scenes.media(l) : '';
        box.innerHTML = media + '<div class="story-step">' + html + '</div><div class="story-dots" aria-hidden="true">' +
          lines.map(function (_, k) { return '<span class="' + (k === i ? 'on' : '') + '"></span>'; }).join('') + '</div>';
        btn.textContent = i < lines.length - 1 ? 'Дальше' : (opts.finalLabel || 'Продолжить');
        skip.hidden = i >= lines.length - 1;
      }
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        if (i < lines.length - 1) { i++; render(); btn.focus(); } else m.close();
      });
      // «Пропустить» закрывает сюжет так же, как последняя кнопка: дальнейшая логика (отметка «просмотрено», переход) не меняется
      skip.addEventListener('click', function (e) { e.stopPropagation(); m.close(); });
      render();
    });
  }

  /* ---- тосты ---- */
  function toast(html, kind) {
    var root = document.getElementById('toast-root');
    var el = document.createElement('div');
    el.className = 'toast toast--' + (kind || 'info');
    el.setAttribute('role', 'status');
    el.innerHTML = html;
    root.appendChild(el);
    setTimeout(function () { el.classList.add('out'); }, 3600);
    setTimeout(function () { el.remove(); }, 4100);
  }

  function announce(text) {
    var el = document.getElementById('sr-live');
    el.textContent = ''; setTimeout(function () { el.textContent = text; }, 40);
  }

  function pct(x) { return x == null ? '—' : Math.round(x * 100) + '%'; }
  function plural(n, one, few, many) {
    var m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
  }

  DS.ui = { esc: esc, icon: icon, robot: robot, robotCycle: robotCycle, bubble: bubble, loading: loading, errorState: errorState, emptyState: emptyState,
    modal: modal, confirm: confirmDialog, storyScene: storyScene, toast: toast, announce: announce, pct: pct, plural: plural };
})();

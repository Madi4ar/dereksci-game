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

  /* Робот DerekSci — 2D SVG со статичными состояниями (ТЗ §3.1 п.7) */
  function robot(mood, size) {
    mood = mood || 'idle'; size = size || 72;
    var eyes, mouth;
    switch (mood) {
      case 'happy':
        eyes = '<path d="M33 45q5-6 10 0M57 45q5-6 10 0" stroke="#0b1d3a" stroke-width="3.5" fill="none" stroke-linecap="round"/>';
        mouth = '<path d="M40 60q10 9 20 0" stroke="#0b1d3a" stroke-width="3.5" fill="none" stroke-linecap="round"/>'; break;
      case 'think':
        eyes = '<circle cx="38" cy="44" r="5" fill="#0b1d3a"/><circle cx="62" cy="42" r="5" fill="#0b1d3a"/><path d="M55 33l12-3" stroke="#0b1d3a" stroke-width="3" stroke-linecap="round"/>';
        mouth = '<path d="M42 61h14" stroke="#0b1d3a" stroke-width="3.5" stroke-linecap="round"/>'; break;
      case 'sad':
        eyes = '<circle cx="38" cy="45" r="5" fill="#0b1d3a"/><circle cx="62" cy="45" r="5" fill="#0b1d3a"/><path d="M31 37l12 3M69 37l-12 3" stroke="#0b1d3a" stroke-width="3" stroke-linecap="round"/>';
        mouth = '<path d="M41 63q9-7 18 0" stroke="#0b1d3a" stroke-width="3.5" fill="none" stroke-linecap="round"/>'; break;
      case 'wow':
        eyes = '<circle cx="38" cy="44" r="6.5" fill="#0b1d3a"/><circle cx="62" cy="44" r="6.5" fill="#0b1d3a"/><circle cx="40" cy="42" r="2" fill="#fff"/><circle cx="64" cy="42" r="2" fill="#fff"/>';
        mouth = '<ellipse cx="50" cy="61" rx="5" ry="6" fill="#0b1d3a"/>'; break;
      default:
        eyes = '<circle cx="38" cy="44" r="5.5" fill="#0b1d3a"/><circle cx="62" cy="44" r="5.5" fill="#0b1d3a"/><circle cx="40" cy="42" r="1.8" fill="#fff"/><circle cx="64" cy="42" r="1.8" fill="#fff"/>';
        mouth = '<path d="M42 59q8 5 16 0" stroke="#0b1d3a" stroke-width="3.5" fill="none" stroke-linecap="round"/>';
    }
    return '<svg class="robot robot--' + mood + '" width="' + size + '" height="' + size + '" viewBox="0 0 100 100" role="img" aria-label="Робот DerekSci">' +
      '<line x1="50" y1="8" x2="50" y2="20" stroke="#7a8bff" stroke-width="4" stroke-linecap="round"/>' +
      '<circle class="robot-ant" cx="50" cy="8" r="5" fill="#ffb020"/>' +
      '<rect x="14" y="20" width="72" height="58" rx="22" fill="#6b7bff"/>' +
      '<rect x="22" y="28" width="56" height="42" rx="16" fill="#e8f0ff"/>' +
      eyes + mouth +
      '<rect x="6" y="40" width="9" height="20" rx="4.5" fill="#4a5ae0"/><rect x="85" y="40" width="9" height="20" rx="4.5" fill="#4a5ae0"/>' +
      '<rect x="34" y="80" width="32" height="12" rx="6" fill="#4a5ae0"/>' +
      '</svg>';
  }

  function bubble(text, mood, opts) {
    opts = opts || {};
    return '<div class="derek ' + (opts.compact ? 'derek--compact' : '') + '">' +
      '<div class="derek-avatar">' + robot(mood, opts.size || (opts.compact ? 52 : 72)) + '</div>' +
      '<div class="derek-bubble"><span class="sr-only">DerekSci говорит: </span>' + text + '</div></div>';
  }

  function loading(label) {
    return '<div class="state state--loading" role="status" aria-live="polite"><div class="spinner" aria-hidden="true"></div><p>' + esc(label || 'Загрузка…') + '</p></div>';
  }
  function errorState(err, retryLabel) {
    var offline = err && err.code === 'offline';
    var locked = err && (err.code === 'locked' || err.status === 403);
    return '<div class="state state--error" role="alert">' + robot(offline ? 'think' : 'sad', 88) +
      '<h2>' + (offline ? 'Нет подключения' : locked ? 'Пока закрыто' : 'Что-то пошло не так') + '</h2>' +
      '<p>' + esc((err && err.message) || 'Попробуйте ещё раз.') + '</p>' +
      '<div class="row-gap">' + (locked ? '<a class="btn btn--primary" href="#/map">К карте</a>' :
        '<button class="btn btn--primary" data-action="retry">' + esc(retryLabel || 'Повторить') + '</button>') + '</div></div>';
  }
  function emptyState(title, text, action) {
    return '<div class="state state--empty">' + robot('happy', 88) + '<h2>' + esc(title) + '</h2><p>' + esc(text) + '</p>' + (action || '') + '</div>';
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
        actions: '<button class="btn btn--primary btn--lg" data-story-next data-autofocus></button>',
        onClose: function () { resolve(); } });
      var box = m.el.querySelector('.story');
      var btn = m.el.querySelector('[data-story-next]');
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
      }
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        if (i < lines.length - 1) { i++; render(); btn.focus(); } else m.close();
      });
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

  DS.ui = { esc: esc, icon: icon, robot: robot, bubble: bubble, loading: loading, errorState: errorState, emptyState: emptyState,
    modal: modal, confirm: confirmDialog, storyScene: storyScene, toast: toast, announce: announce, pct: pct, plural: plural };
})();

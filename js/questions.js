/*
 * Рендеры пяти типов заданий (ТЗ §7). Клиент не знает правильного ответа:
 * он только собирает выбор пользователя и подсвечивает то, что вернул сервер.
 */
(function () {
  'use strict';
  var esc = DS.ui.esc, icon = DS.ui.icon;

  var CLAIM_ICONS = { supported: 'circle-check', contradicted: 'circle-x', insufficient: 'circle-question-mark' };

  function optionButton(o, extra, inner) {
    return '<button type="button" class="opt ' + (extra || '') + '" data-opt="' + esc(o.id) + '" aria-pressed="false">' +
      inner + '<span class="opt-mark" aria-hidden="true"></span></button>';
  }

  function sourceLine(q) {
    return q.source_title ? '<p class="q-source">Источник: ' + esc(q.source_title) + (q.source_author ? ', ' + esc(q.source_author) : '') + '</p>' : '';
  }

  var renderers = {
    sentence_select: function (q) {
      return '<p class="q-stem">' + esc(q.stem) + '</p>' +
        '<div class="opts opts--sentences" role="group" aria-label="Предложения текста">' +
        q.options.map(function (o, i) {
          return optionButton(o, 'opt--sentence', '<span class="opt-num" aria-hidden="true">' + (i + 1) + '</span><span class="opt-text"><span class="sr-only">Предложение ' + (i + 1) + ': </span>' + esc(o.text) + '</span>');
        }).join('') + '</div>' + sourceLine(q);
    },
    fill_choice: function (q) {
      var parts = String(q.stem).split('___');
      return (q.body ? '<div class="q-text">' + esc(q.body) + '</div>' : '') +
        '<p class="q-stem q-stem--fill">' + esc(parts[0]) + '<span class="blank" data-blank aria-live="polite">&nbsp;</span>' + esc(parts.slice(1).join('___')) + '</p>' +
        '<div class="opts opts--chips" role="group" aria-label="Варианты слов">' +
        q.options.map(function (o) { return optionButton(o, 'opt--chip', '<span class="opt-text">' + esc(o.text) + '</span>'); }).join('') +
        '</div>' + sourceLine(q);
    },
    claim_check: function (q) {
      return (q.body ? '<div class="q-text">' + esc(q.body) + '</div>' : '') +
        '<div class="claim"><span class="claim-label">Вывод</span><p>' + esc(q.stem) + '</p></div>' +
        '<div class="opts opts--claim" role="group" aria-label="Оценка вывода">' +
        q.options.map(function (o) {
          return optionButton(o, 'opt--claim opt--' + esc(o.id), '<span class="claim-ic">' + icon(CLAIM_ICONS[o.id], 24) + '</span><span class="opt-text">' + esc(o.text) + '</span>');
        }).join('') + '</div>' + sourceLine(q);
    },
    source_select: function (q) {
      return '<p class="q-stem">' + esc(q.stem) + '</p>' +
        '<div class="opts opts--sources" role="group" aria-label="Источники">' +
        q.options.map(function (o) {
          return optionButton(o, 'opt--source', '<span class="opt-text">' + esc(o.text) + (o.note ? '<small>' + esc(o.note) + '</small>' : '') + '</span>');
        }).join('') + '</div>';
    },
    sequence_order: function (q) {
      return '<p class="q-stem">' + esc(q.stem) + '</p>' +
        '<ol class="seq" aria-label="Карточки для упорядочивания">' +
        q.options.map(function (o) {
          return '<li class="seq-item" data-id="' + esc(o.id) + '">' +
            '<span class="seq-handle" aria-hidden="true" title="Перетащить">' + icon('grip', 18) + '</span>' +
            '<span class="seq-num" aria-hidden="true"></span><span class="seq-text">' + esc(o.text) + '</span>' +
            '<span class="seq-btns"><button type="button" class="icon-btn" data-move="-1" aria-label="Переместить «' + esc(o.text) + '» выше">' + icon('up', 18) + '</button>' +
            '<button type="button" class="icon-btn" data-move="1" aria-label="Переместить «' + esc(o.text) + '» ниже">' + icon('down', 18) + '</button></span></li>';
        }).join('') + '</ol>';
    }
  };

  function mount(container, q, opts) {
    opts = opts || {};
    container.innerHTML = renderers[q.type](q);
    var locked = false;
    var selected = null;
    var isSeq = q.type === 'sequence_order';

    function opts$() { return Array.prototype.slice.call(container.querySelectorAll('[data-opt]')); }
    function setSelected(id) {
      selected = id;
      opts$().forEach(function (b) {
        var on = b.getAttribute('data-opt') === id;
        b.classList.toggle('is-selected', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      if (q.type === 'fill_choice') {
        var o = q.options.find(function (x) { return x.id === id; });
        var blank = container.querySelector('[data-blank]');
        blank.textContent = o ? o.text : ' ';
        blank.classList.toggle('filled', !!o);
      }
      if (opts.onChange) opts.onChange();
    }

    if (!isSeq) {
      container.addEventListener('click', function (e) {
        var b = e.target.closest('[data-opt]');
        if (!b || locked || b.disabled) return;
        opts$().forEach(function (x) { x.classList.remove('is-wrong'); });
        setSelected(b.getAttribute('data-opt'));
      });
    } else {
      setupSequence(container, function () { return locked; }, opts.onChange);
    }

    return {
      hasAnswer: function () { return isSeq || !!selected; },
      getAnswer: function () {
        if (isSeq) return { ordered_ids: Array.prototype.map.call(container.querySelectorAll('.seq-item'), function (li) { return li.getAttribute('data-id'); }) };
        return { selected_option_ids: [selected] };
      },
      lock: function () {
        locked = true; container.classList.add('is-locked');
        container.querySelectorAll('button').forEach(function (b) { b.disabled = true; });
      },
      unlock: function () {
        locked = false; container.classList.remove('is-locked');
        container.querySelectorAll('button').forEach(function (b) { if (!b.classList.contains('is-wrong')) b.disabled = false; });
      },
      markWrong: function () {
        if (isSeq) { container.querySelector('.seq').classList.add('is-wrong'); setTimeout(function () { var s = container.querySelector('.seq'); if (s) s.classList.remove('is-wrong'); }, 900); return; }
        var b = container.querySelector('[data-opt="' + CSS.escape(selected) + '"]');
        if (b) { b.classList.remove('is-selected'); b.classList.add('is-wrong'); b.setAttribute('aria-pressed', 'false'); b.disabled = true; b.querySelector('.opt-mark').innerHTML = '<span class="sr-only">неверно</span>' + icon('x', 18); }
        selected = null;
        if (q.type === 'fill_choice') { var bl = container.querySelector('[data-blank]'); bl.textContent = ' '; bl.classList.remove('filled'); }
      },
      markCorrect: function (ids) {
        if (isSeq) {
          if (ids) { // после двух ошибок сервер раскрыл порядок — показываем его
            var list = container.querySelector('.seq');
            ids.forEach(function (id) { var li = list.querySelector('[data-id="' + CSS.escape(id) + '"]'); if (li) list.appendChild(li); });
            renumber(container);
          }
          container.querySelector('.seq').classList.add(ids ? 'is-revealed' : 'is-correct');
          return;
        }
        var target = ids ? ids : [selected];
        target.forEach(function (id) {
          var b = container.querySelector('[data-opt="' + CSS.escape(id) + '"]');
          if (b) { b.classList.add(ids ? 'is-revealed' : 'is-correct'); b.querySelector('.opt-mark').innerHTML = '<span class="sr-only">правильный ответ</span>' + icon('check', 18); }
        });
        if (q.type === 'fill_choice' && ids) {
          var o = q.options.find(function (x) { return x.id === ids[0]; });
          var bl = container.querySelector('[data-blank]'); bl.textContent = o ? o.text : ''; bl.classList.add('filled');
        }
      }
    };
  }

  function renumber(container) {
    container.querySelectorAll('.seq-item').forEach(function (li, i, all) {
      li.querySelector('.seq-num').textContent = i + 1;
      li.setAttribute('aria-label', 'Позиция ' + (i + 1) + ' из ' + all.length + ': ' + li.querySelector('.seq-text').textContent);
      li.querySelector('[data-move="-1"]').disabled = container.classList.contains('is-locked') || i === 0;
      li.querySelector('[data-move="1"]').disabled = container.classList.contains('is-locked') || i === all.length - 1;
    });
  }

  /* Перетаскивание на pointer events (мышь + сенсор) и доступная альтернатива — кнопки выше/ниже (ТЗ §7.4) */
  function setupSequence(container, isLocked, onChange) {
    var list = container.querySelector('.seq');
    renumber(container);

    list.addEventListener('click', function (e) {
      var b = e.target.closest('[data-move]');
      if (!b || isLocked()) return;
      var li = b.closest('.seq-item');
      var dir = Number(b.getAttribute('data-move'));
      if (dir < 0 && li.previousElementSibling) list.insertBefore(li, li.previousElementSibling);
      else if (dir > 0 && li.nextElementSibling) list.insertBefore(li.nextElementSibling, li);
      renumber(container);
      var same = li.querySelector('[data-move="' + dir + '"]');
      (same.disabled ? li.querySelector('[data-move="' + (-dir) + '"]') : same).focus();
      var pos = Array.prototype.indexOf.call(list.children, li) + 1;
      DS.ui.announce('«' + li.querySelector('.seq-text').textContent + '» — позиция ' + pos);
      if (onChange) onChange();
    });

    var drag = null;
    list.addEventListener('pointerdown', function (e) {
      if (isLocked() || e.target.closest('button')) return;
      var li = e.target.closest('.seq-item'); if (!li) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      var gap = parseFloat(getComputedStyle(list).rowGap) || 8;
      drag = { li: li, startY: e.clientY, gap: gap, id: e.pointerId };
      li.setPointerCapture(e.pointerId);
      li.classList.add('dragging');
    });
    list.addEventListener('pointermove', function (e) {
      if (!drag || e.pointerId !== drag.id) return;
      var li = drag.li, dy = e.clientY - drag.startY;
      var next = li.nextElementSibling, prev = li.previousElementSibling;
      if (next && dy > (next.offsetHeight + drag.gap) / 2) {
        list.insertBefore(next, li); drag.startY += next.offsetHeight + drag.gap;
      } else if (prev && dy < -(prev.offsetHeight + drag.gap) / 2) {
        list.insertBefore(li, prev); drag.startY -= prev.offsetHeight + drag.gap;
      }
      li.style.transform = 'translateY(' + (e.clientY - drag.startY) + 'px)';
    });
    function end(e) {
      if (!drag || (e && e.pointerId !== drag.id)) return;
      drag.li.classList.remove('dragging'); drag.li.style.transform = '';
      drag = null; renumber(container); if (onChange) onChange();
    }
    list.addEventListener('pointerup', end);
    list.addEventListener('pointercancel', end);
  }

  DS.questions = { mount: mount, TYPE_LABELS: {
    sentence_select: 'Выбор предложения', fill_choice: 'Дополни пропуск', claim_check: 'Оценка утверждения',
    sequence_order: 'Порядок', source_select: 'Выбор источника'
  } };
})();

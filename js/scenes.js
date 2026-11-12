/*
 * Анимированные иллюстрации к сюжетным репликам (зацикленные, как GIF, но на SVG + CSS).
 * Реплика в контенте указывает scene: '<имя>'. Вместо сцены можно задать
 * media: { src: 'assets/intro-1.gif', alt: '...' } — тогда покажется готовая GIF/картинка.
 * При «Меньше анимации» и prefers-reduced-motion показывается статичный кадр.
 */
(function () {
  'use strict';
  var ui = DS.ui;

  // вложенная Lucide-иконка внутри SVG-сцены
  function ic(name, x, y, size, color, cls) {
    return '<g transform="translate(' + x + ' ' + y + ')" style="color:' + color + '"><g class="' + (cls || '') + '">' +
      ui.icon(name, size).replace('<svg ', '<svg x="0" y="0" ') + '</g></g>';
  }
  function robotAt(mood, x, y, size, cls) {
    var h = size * 1.4, w = h * 294 / 388;
    return '<g transform="translate(' + (x + (size - w) / 2).toFixed(1) + ' ' + (y + size * .95 - h).toFixed(1) + ')"><g class="' + (cls || '') + '">' + ui.robot(mood, h) + '</g></g>';
  }
  function stars() {
    var pts = [[24, 18], [70, 32], [118, 12], [210, 22], [262, 36], [300, 14], [160, 28]];
    return pts.map(function (p, i) {
      return '<circle class="s-twinkle" style="animation-delay:' + (i * .35) + 's" cx="' + p[0] + '" cy="' + p[1] + '" r="1.6" fill="#fff"/>';
    }).join('');
  }
  function shelf(x) {
    var colors = ['#5b6cff', '#14a37f', '#e07a1f', '#c2489b', '#2b8ac6', '#ffb020'];
    var out = '<rect x="' + x + '" y="62" width="62" height="108" rx="4" fill="#232b58"/>';
    for (var row = 0; row < 3; row++) {
      var y = 70 + row * 34;
      out += '<rect x="' + x + '" y="' + (y + 26) + '" width="62" height="4" fill="#0f1430"/>';
      for (var b = 0; b < 6; b++) {
        out += '<rect x="' + (x + 4 + b * 9.5) + '" y="' + (y + 4 + (b % 3)) + '" width="7.5" height="' + (22 - (b % 3)) + '" rx="1.5" fill="' + colors[(b + row * 2) % colors.length] + '" opacity=".85"/>';
      }
    }
    return out;
  }
  function wrap(name, inner, label) {
    return '<svg class="scene scene--' + name + '" viewBox="0 0 320 180" role="img" aria-label="' + ui.esc(label) + '">' +
      '<rect width="320" height="180" rx="16" fill="#141a3a"/>' + inner + '</svg>';
  }

  var SCENES = {
    /* Ночь, библиотека, экран вспыхивает тревогой */
    alert: function () {
      return wrap('alert',
        stars() + '<circle cx="290" cy="34" r="12" fill="#ffe7a3"/><circle cx="295" cy="30" r="11" fill="#141a3a"/>' +
        shelf(14) + shelf(244) +
        '<rect x="96" y="44" width="128" height="86" rx="10" fill="#2d376e"/>' +
        '<rect x="104" y="52" width="112" height="68" rx="6" fill="#0b1030"/>' +
        '<g class="s-blink">' + ic('triangle-alert', 146, 58, 28, '#ff5d6c') +
        '<text x="160" y="102" text-anchor="middle" font-size="12" font-weight="900" fill="#ff5d6c" font-family="Nunito, sans-serif">ВНИМАНИЕ!</text>' +
        '<text x="160" y="114" text-anchor="middle" font-size="7" font-weight="700" fill="#ff9aa4" font-family="Nunito, sans-serif">СВЯЗЬ ПОТЕРЯНА</text></g>' +
        '<rect x="148" y="130" width="24" height="14" fill="#2d376e"/><rect x="132" y="144" width="56" height="6" rx="3" fill="#2d376e"/>' +
        '<rect class="s-flash" width="320" height="180" rx="16" fill="#ff3b4f"/>',
        'Ночная библиотека, на экране мигает надпись «Внимание! Связь потеряна»');
    },

    /* Робот проверяет карточку: вопрос и неверный ответ */
    mismatch: function () {
      return wrap('mismatch',
        '<rect x="18" y="34" width="132" height="58" rx="10" fill="#fff"/>' +
        '<text x="30" y="56" font-size="9" font-weight="800" fill="#5a647d" font-family="Nunito, sans-serif">ВОПРОС</text>' +
        '<text x="30" y="70" font-size="11.5" font-weight="900" fill="#1b2236" font-family="Nunito, sans-serif">Где спрятан</text>' +
        '<text x="30" y="84" font-size="11.5" font-weight="900" fill="#1b2236" font-family="Nunito, sans-serif">подарок?</text>' +
        '<g class="s-dash"><path d="M154 63h22" stroke="#9ea8ff" stroke-width="3" stroke-dasharray="4 4" fill="none"/>' + ic('arrow-right', 168, 54, 18, '#9ea8ff') + '</g>' +
        '<g class="s-shake"><rect x="190" y="34" width="112" height="58" rx="10" fill="#fde8eb" stroke="#ff5d6c" stroke-width="2"/>' +
        '<text x="202" y="56" font-size="9" font-weight="800" fill="#c7384a" font-family="Nunito, sans-serif">ОТВЕТ</text>' +
        '<text x="202" y="76" font-size="13" font-weight="900" fill="#1b2236" font-family="Nunito, sans-serif">«В полночь»</text>' +
        ic('circle-x', 276, 40, 18, '#c7384a') + '</g>' +
        robotAt('think', 136, 118, 50) +
        '<rect class="s-scan" x="18" y="34" width="284" height="3" rx="1.5" fill="#7af0c8" opacity=".8"/>',
        'Робот DerekSci сканирует карточку: на вопрос «Где спрятан подарок?» стоит ответ «В полночь»');
    },

    /* Путаница: подарок, пирог, Золушка, часы летают с вопросами */
    chaos: function () {
      var items = [
        ['gift', 34, 40, '#ffb020'], ['clock', 250, 34, '#9ea8ff'], ['cake-slice', 46, 118, '#ff8fb1'],
        ['package', 246, 116, '#7af0c8'], ['crown', 92, 18, '#ffe7a3']
      ];
      return wrap('chaos',
        items.map(function (it, i) {
          return '<g class="s-float" style="animation-delay:' + (i * .45) + 's">' + ic(it[0], it[1], it[2], 30, it[3]) + '</g>';
        }).join('') +
        ['?', '?', '?'].map(function (q, i) {
          var pos = [[118, 70], [198, 58], [214, 138]][i];
          return '<text class="s-pop" style="animation-delay:' + (i * .5) + 's" x="' + pos[0] + '" y="' + pos[1] + '" font-size="22" font-weight="900" fill="#ff5d6c" font-family="Nunito, sans-serif">' + q + '</text>';
        }).join('') +
        robotAt('wow', 124, 62, 72),
        'Вокруг растерянного робота летают подарок, часы, пирог и коробка с вопросительными знаками');
    },

    /* Неизвестный значок — глаз из букв */
    eye: function () {
      var letters = 'АБВГДЕЖЗИКЛМНОПРСТУФ'.split('');
      var ring = letters.map(function (ch, i) {
        var a = (i / letters.length) * Math.PI * 2;
        var x = 160 + Math.cos(a) * 66, y = 90 + Math.sin(a) * 40;
        return '<text x="' + x.toFixed(1) + '" y="' + (y + 4).toFixed(1) + '" text-anchor="middle" font-size="10" font-weight="900" fill="#9ea8ff" font-family="Nunito, sans-serif">' + ch + '</text>';
      }).join('');
      return wrap('eye',
        stars() +
        '<g class="s-spin">' + ring + '</g>' +
        '<g class="s-eyeblink"><path d="M104 90q56-50 112 0q-56 50-112 0z" fill="#fff"/>' +
        '<circle cx="160" cy="90" r="20" fill="#5b6cff"/><circle class="s-look" cx="160" cy="90" r="9" fill="#0b1030"/><circle cx="166" cy="84" r="3.5" fill="#fff"/></g>' +
        '<text class="s-type" x="160" y="168" text-anchor="middle" font-size="10" font-weight="800" fill="#ffe7a3" font-family="Nunito, sans-serif">…но умеешь ли ты понимать?</text>',
        'Таинственный глаз, составленный из букв, смотрит на игрока');
    },

    /* Нужен напарник — это ты */
    partner: function () {
      return wrap('partner',
        stars() +
        robotAt('wave', 52, 56, 90) +
        '<g class="s-swing">' + ic('search', 150, 48, 46, '#ffb020') + '</g>' +
        '<g class="s-pop" style="animation-delay:.3s"><rect x="206" y="58" width="96" height="58" rx="14" fill="#fff"/>' +
        ic('user-round', 220, 68, 36, '#5b6cff') +
        '<text x="262" y="93" font-size="13" font-weight="900" fill="#1b2236" font-family="Nunito, sans-serif">ТЫ!</text></g>' +
        ic('sparkles', 286, 34, 20, '#ffe7a3', 's-twinkle'),
        'Робот DerekSci с лупой выбирает напарника — игрока');
    },

    /* Пять разделов библиотеки и секретное сообщение */
    route: function () {
      var cities = [['scroll-text', '#5b6cff'], ['lightbulb', '#14a37f'], ['scale', '#e07a1f'], ['hourglass', '#c2489b'], ['compass', '#2b8ac6']];
      var xs = [36, 98, 160, 222, 284];
      var ys = [64, 44, 70, 44, 64];
      return wrap('route',
        '<path class="s-draw" d="M36 64 Q67 30 98 44 T160 70 T222 44 T284 64" stroke="#9ea8ff" stroke-width="3" stroke-dasharray="6 6" fill="none"/>' +
        cities.map(function (c, i) {
          return '<g class="s-pop s-slow" style="animation-delay:' + (i * .35) + 's"><circle cx="' + xs[i] + '" cy="' + ys[i] + '" r="20" fill="' + c[1] + '"/>' +
            ic(c[0], xs[i] - 11, ys[i] - 11, 22, '#fff') + '</g>';
        }).join('') +
        ['НАЙДИ', 'СМЫСЛ.', 'ПРОВЕРЬ', 'ОСНОВАНИЯ.', 'ВЫБИРАЙ…'].map(function (w, i) {
          var x = 14 + i * 59;
          return '<g class="s-reveal" style="animation-delay:' + (1.8 + i * .3) + 's"><rect x="' + x + '" y="124" width="55" height="22" rx="6" fill="#ffb020"/>' +
            '<text x="' + (x + 27.5) + '" y="139" text-anchor="middle" font-size="7" font-weight="900" fill="#1c2246" letter-spacing="-.1" font-family="Nunito, sans-serif">' + w + '</text></g>';
        }).join('') +
        '<text x="160" y="164" text-anchor="middle" font-size="8.5" font-weight="800" fill="#9ea8ff" font-family="Nunito, sans-serif">5 разделов → 5 частей секретного сообщения</text>',
        'Маршрут через пять городов, после каждого открывается часть секретного сообщения');
    }
  };

  /* ===== Мир 2 «Звёздный архив» ===== */

  /* Обсерватория ночью: архив перепутан, записи разлетаются */
  SCENES.observatory = function () {
    var cards = [['№ 1204', 44, 54, '#ffe7a3'], ['№ 0087', 236, 40, '#9ea8ff'], ['№ 3311', 250, 104, '#7af0c8'], ['№ 0559', 30, 116, '#ff8fb1']];
    return wrap('observatory',
      stars() + stars().replace(/cx="(\d+)"/g, function (_, x) { return 'cx="' + (320 - x) + '"'; }).replace(/cy="(\d+)"/g, function (_, y) { return 'cy="' + (Number(y) + 30) + '"'; }) +
      '<g class="s-shoot"><path d="M250 18 L222 32" stroke="#fff" stroke-width="2" stroke-linecap="round"/><circle cx="250" cy="18" r="2.5" fill="#fff"/></g>' +
      // купол обсерватории
      '<rect x="0" y="150" width="320" height="30" fill="#0e1330"/>' +
      '<rect x="112" y="112" width="96" height="40" rx="4" fill="#2d376e"/>' +
      '<path d="M104 114 Q160 46 216 114 Z" fill="#3a4589"/>' +
      '<rect x="152" y="58" width="16" height="56" fill="#141a3a"/>' +
      '<g class="s-scope"><rect x="150" y="62" width="44" height="12" rx="6" fill="#9ea8ff"/><rect x="188" y="60" width="10" height="16" rx="3" fill="#c9cfff"/></g>' +
      '<rect x="146" y="128" width="28" height="24" rx="3" fill="#ffb020" opacity=".9"/>' +
      // перепутанные карточки каталога
      cards.map(function (c, i) {
        return '<g class="s-float" style="animation-delay:' + (i * .5) + 's"><g transform="translate(' + c[1] + ' ' + c[2] + ')">' +
          '<rect width="46" height="30" rx="5" fill="#fff"/><rect x="5" y="6" width="22" height="3" rx="1.5" fill="' + c[3] + '"/>' +
          '<rect x="5" y="13" width="34" height="2.5" rx="1.2" fill="#c5cbdb"/><rect x="5" y="19" width="28" height="2.5" rx="1.2" fill="#c5cbdb"/>' +
          '<text x="23" y="28" text-anchor="middle" font-size="5.5" font-weight="800" fill="#5a647d" font-family="Nunito, sans-serif">' + c[0] + '</text></g></g>';
      }).join('') +
      '<text class="s-pop" x="96" y="44" font-size="20" font-weight="900" fill="#ff5d6c" font-family="Nunito, sans-serif">?</text>' +
      '<text class="s-pop" style="animation-delay:.8s" x="214" y="92" font-size="18" font-weight="900" fill="#ff5d6c" font-family="Nunito, sans-serif">?</text>',
      'Обсерватория под звёздным небом, вокруг купола разлетаются перепутанные карточки звёздного архива');
  };

  /* Звездочёт просит о помощи: сигналы смешались со слухами */
  SCENES.signals = function () {
    return wrap('signals',
      stars() +
      '<rect x="20" y="30" width="170" height="104" rx="12" fill="#2d376e"/>' +
      '<rect x="28" y="38" width="154" height="88" rx="8" fill="#0b1030"/>' +
      // сигнал-волна бежит по экрану
      '<clipPath id="ds-screen-clip"><rect x="28" y="38" width="154" height="88" rx="8"/></clipPath>' +
      '<g clip-path="url(#ds-screen-clip)"><g class="s-wave"><path d="M28 82 q10 -22 20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0" stroke="#7af0c8" stroke-width="2.5" fill="none"/></g></g>' +
      '<line x1="28" y1="82" x2="182" y2="82" stroke="#7af0c8" stroke-width=".6" opacity=".35"/>' +
      '<text x="36" y="52" font-size="8" font-weight="900" fill="#7af0c8" font-family="Nunito, sans-serif">СИГНАЛ · 10 МИН</text>' +
      '<circle class="s-blink" cx="172" cy="49" r="4" fill="#ff5d6c"/>' +
      '<rect x="92" y="134" width="26" height="10" fill="#2d376e"/><rect x="76" y="144" width="58" height="6" rx="3" fill="#2d376e"/>' +
      // факт / слух меняются местами
      '<g class="s-swapA"><rect x="206" y="40" width="94" height="36" rx="10" fill="#e2f6ec" stroke="#14905f" stroke-width="2"/>' +
      ic('circle-check', 214, 49, 18, '#14905f') +
      '<text x="238" y="63" font-size="12" font-weight="900" fill="#14905f" font-family="Nunito, sans-serif">ФАКТ</text></g>' +
      '<g class="s-swapB"><rect x="206" y="92" width="94" height="36" rx="10" fill="#fde8eb" stroke="#c7384a" stroke-width="2"/>' +
      ic('message-circle-question-mark', 214, 101, 18, '#c7384a') +
      '<text x="238" y="115" font-size="12" font-weight="900" fill="#c7384a" font-family="Nunito, sans-serif">СЛУХ</text></g>' +
      '<g class="s-bob">' + ic('telescope', 238, 140, 28, '#ffe7a3') + '</g>',
      'Экран обсерватории с сигналом, рядом перемешиваются карточки «Факт» и «Слух»');
  };

  /* Пять станций обсерватории по орбите и новое секретное сообщение */
  SCENES.stations = function () {
    var st = [['radio-tower', '#5b6cff'], ['sprout', '#14a37f'], ['flask-conical', '#e07a1f'], ['route', '#c2489b'], ['compass', '#2b8ac6']];
    var cx = 160, cy = 74, rx = 118, ry = 42;
    return wrap('stations',
      stars() +
      '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + rx + '" ry="' + ry + '" fill="none" stroke="#9ea8ff" stroke-width="2" stroke-dasharray="5 6" class="s-draw"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="18" fill="#ffb020"/><circle cx="' + cx + '" cy="' + cy + '" r="26" fill="#ffb020" opacity=".18" class="s-twinkle"/>' +
      ic('telescope', cx - 10, cy - 10, 20, '#1c2246') +
      st.map(function (s, i) {
        var a = -Math.PI / 2 + i * (Math.PI * 2 / 5);
        var x = cx + Math.cos(a) * rx, y = cy + Math.sin(a) * ry;
        return '<g class="s-pop s-slow" style="animation-delay:' + (i * .35) + 's"><circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="15" fill="' + s[1] + '"/>' +
          ic(s[0], x - 9, y - 9, 18, '#fff') + '</g>';
      }).join('') +
      '<g class="s-orbit"><g transform="translate(-9 -9)" style="color:#fff">' + ui.icon('rocket', 18).replace('<svg ', '<svg x="0" y="0" ') + '</g>' +
        '<animateMotion dur="7s" repeatCount="indefinite" rotate="auto" path="M' + (cx + rx) + ' ' + cy + ' A' + rx + ' ' + ry + ' 0 1 1 ' + (cx - rx) + ' ' + cy + ' A' + rx + ' ' + ry + ' 0 1 1 ' + (cx + rx) + ' ' + cy + '"/></g>' +
      ['ЧИТАЙ', 'ВНИМАТЕЛЬНО.', 'ДУМАЙ', 'САМОСТ…', 'ДЕЛИСЬ…'].map(function (w, i) {
        var x = 14 + i * 59;
        return '<g class="s-reveal" style="animation-delay:' + (1.8 + i * .3) + 's"><rect x="' + x + '" y="134" width="55" height="20" rx="6" fill="#ffb020"/>' +
          '<text x="' + (x + 27.5) + '" y="147.5" text-anchor="middle" font-size="' + (w.length > 9 ? 5.6 : 7) + '" font-weight="900" fill="#1c2246" letter-spacing="-.1" font-family="Nunito, sans-serif">' + w + '</text></g>';
      }).join('') +
      '<text x="160" y="170" text-anchor="middle" font-size="8.5" font-weight="800" fill="#9ea8ff" font-family="Nunito, sans-serif">5 станций → новое секретное сообщение</text>',
      'Пять станций обсерватории на орбите вокруг звезды, по орбите летит ракета, открываются слова нового сообщения');
  };

  /* ===================== Города ===================== */
  function txt(x, y, s, size, color, anchor, cls, style) {
    return '<text' + (cls ? ' class="' + cls + '"' : '') + (style ? ' style="' + style + '"' : '') + ' x="' + x + '" y="' + y + '"' + (anchor ? ' text-anchor="' + anchor + '"' : '') +
      ' font-size="' + size + '" font-weight="900" fill="' + color + '" font-family="Nunito, sans-serif">' + s + '</text>';
  }
  function pill(x, y, w, h, fill, label, color, size) {
    return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + Math.min(10, h / 2) + '" fill="' + fill + '"/>' +
      txt(x + w / 2, y + h / 2 + size * .36, label, size, color, 'middle');
  }

  /* Город 1: лупа находит нужное предложение, карточки возвращаются в архив */
  SCENES.archive = function () {
    var lines = [0, 1, 2, 3].map(function (i) {
      return '<rect x="132" y="' + (52 + i * 22) + '" width="' + (i === 2 ? 104 : 120 - i * 8) + '" height="7" rx="3.5" fill="#c5cbdb"/>' +
        '<text x="122" y="' + (59 + i * 22) + '" text-anchor="middle" font-size="7" font-weight="900" fill="#9ea8ff" font-family="Nunito, sans-serif">' + (i + 1) + '</text>';
    }).join('');
    return wrap('archive',
      shelf(14) +
      '<rect x="108" y="34" width="176" height="118" rx="10" fill="#fff"/>' + lines +
      '<rect class="s-blink" x="128" y="94" width="112" height="15" rx="5" fill="#ffb020" opacity=".55"/>' +
      '<g class="s-hunt">' + ic('search', 214, 84, 40, '#5b6cff') + '</g>' +
      [[86, 30, '#5b6cff'], [292, 120, '#14a37f']].map(function (c, i) {
        return '<g class="s-float" style="animation-delay:' + i * .7 + 's"><rect x="' + c[0] + '" y="' + c[1] + '" width="20" height="26" rx="3" fill="' + c[2] + '"/></g>';
      }).join(''),
      'Лупа скользит по строкам текста и подсвечивает предложение с ответом; рядом полки архива');
  };

  /* Город 2: запотевшие очки и «дворники» — из завязки режима 2 */
  SCENES.fog = function () {
    function lens(cx) {
      return '<circle cx="' + cx + '" cy="88" r="38" fill="#2b356d" stroke="#9ea8ff" stroke-width="5"/>' +
        '<circle class="s-fog" cx="' + cx + '" cy="88" r="35" fill="#e8f0ff"/>' +
        '<g class="s-wipe" style="transform-origin:' + cx + 'px 122px"><line x1="' + cx + '" y1="122" x2="' + cx + '" y2="56" stroke="#1c2246" stroke-width="4" stroke-linecap="round"/></g>';
    }
    return wrap('fog',
      lens(108) + lens(212) +
      '<path d="M146 82 q14 -12 28 0" stroke="#9ea8ff" stroke-width="5" fill="none"/>' +
      '<line x1="70" y1="80" x2="34" y2="70" stroke="#9ea8ff" stroke-width="5" stroke-linecap="round"/><line x1="250" y1="80" x2="286" y2="70" stroke="#9ea8ff" stroke-width="5" stroke-linecap="round"/>' +
      '<g class="s-float">' + ic('cup-soda', 20, 112, 30, '#ffb020') + '</g>' +
      txt(160, 164, 'Откуда взялись капли?', 10, '#ffe7a3', 'middle'),
      'Запотевшие очки, по стёклам ходят дворники, туман то появляется, то исчезает');
  };

  /* Город 3: печати «ТОЧНО!» сменяются честными отметками */
  SCENES.stamps = function () {
    var docs = [['circle-check', '#14905f', 'ДА'], ['circle-x', '#c7384a', 'НЕТ'], ['circle-question-mark', '#b35c00', 'НЕ ЯСНО']];
    return wrap('stamps',
      docs.map(function (d, i) {
        var x = 26 + i * 96;
        return '<rect x="' + x + '" y="34" width="76" height="98" rx="8" fill="#fff"/>' +
          [0, 1, 2, 3].map(function (k) { return '<rect x="' + (x + 10) + '" y="' + (48 + k * 12) + '" width="' + (56 - k * 6) + '" height="5" rx="2.5" fill="#c5cbdb"/>'; }).join('') +
          '<g class="s-stampout" style="animation-delay:' + i * .3 + 's"><g transform="rotate(-14 ' + (x + 38) + ' 110)"><rect x="' + (x + 8) + '" y="98" width="60" height="22" rx="4" fill="none" stroke="#ff5d6c" stroke-width="2.5"/>' +
          txt(x + 38, 114, 'ТОЧНО!', 11, '#ff5d6c', 'middle') + '</g></g>' +
          '<g class="s-stampin" style="animation-delay:' + i * .3 + 's">' + ic(d[0], x + 24, 92, 28, d[1]) + '</g>' +
          '<g class="s-stampin" style="animation-delay:' + i * .3 + 's">' + txt(x + 38, 152, d[2], 10, d[1] === '#14905f' ? '#7af0c8' : d[1] === '#c7384a' ? '#ff9aa4' : '#ffc46b', 'middle') + '</g>';
      }).join(''),
      'Три документа: самоуверенные печати «ТОЧНО!» сменяются отметками «да», «нет» и «не ясно»');
  };

  /* Город 4: перепутанные карточки сами встают по порядку */
  SCENES.sorting = function () {
    var words = ['весна', 'лето', 'осень', 'зима'];
    var from = [2, 0, 3, 1]; // где карточка стоит в начале
    var colors = ['#14a37f', '#ffb020', '#e07a1f', '#5b6cff'];
    return wrap('sorting',
      robotAt('think', 22, 50, 70) +
      '<g class="s-flip">' + ic('hourglass', 268, 20, 30, '#ffe7a3') + '</g>' +
      words.map(function (w, i) {
        var dy = (from[i] - i) * 30;
        return '<g class="s-sort" style="--from:' + dy + 'px">' +
          '<rect x="112" y="' + (30 + i * 30) + '" width="140" height="24" rx="8" fill="#fff"/>' +
          '<rect x="112" y="' + (30 + i * 30) + '" width="26" height="24" rx="8" fill="' + colors[i] + '"/>' +
          txt(125, 46 + i * 30, String(i + 1), 11, '#fff', 'middle') + txt(150, 46.5 + i * 30, w, 12, '#1b2236') + '</g>';
      }).join('') +
      '<g class="s-stampin" style="animation-delay:.2s">' + ic('circle-check', 260, 118, 26, '#7af0c8') + '</g>',
      'Перепутанные карточки времён года сами встают по порядку: весна, лето, осень, зима');
  };

  /* Город 5: вопросы находят свои источники */
  SCENES.navigator = function () {
    var rows = [['train-front', 'Расписание', 'calendar-clock'], ['cookie', 'Этикетка', 'tag'], ['shopping-cart', 'Чек', 'receipt']];
    return wrap('navigator',
      '<g class="s-needle-wrap">' + ic('compass', 140, 64, 40, '#ffe7a3', 's-needle') + '</g>' +
      rows.map(function (r, i) {
        var y = 26 + i * 48;
        return '<circle cx="46" cy="' + (y + 20) + '" r="20" fill="#2d376e"/>' + ic(r[0], 34, y + 8, 24, '#9ea8ff') +
          '<path class="s-dash" style="animation-delay:' + i * .4 + 's" d="M70 ' + (y + 20) + ' C120 ' + (y + 20) + ' 190 ' + (y + 20) + ' 214 ' + (y + 20) + '" stroke="#7af0c8" stroke-width="2.5" stroke-dasharray="5 5" fill="none"/>' +
          '<g class="s-pop s-slow" style="animation-delay:' + (.4 + i * .5) + 's"><rect x="208" y="' + (y + 4) + '" width="104" height="32" rx="10" fill="#fff"/>' +
          ic(r[2], 215, y + 11, 18, '#2b8ac6') + txt(238, y + 24.5, r[1], 9.5, '#1b2236') + '</g>';
      }).join(''),
      'От вопросов про поезд, печенье и покупку тянутся стрелки к подходящим источникам: расписанию, этикетке и чеку');
  };

  /* Мир 2 · станция: радиосигналы и журнал */
  SCENES.radio = function () {
    return wrap('radio',
      stars() +
      [0, 1, 2].map(function (i) { return '<circle class="s-ping" style="animation-delay:' + i * .7 + 's" cx="92" cy="74" r="22" fill="none" stroke="#7af0c8" stroke-width="2.5"/>'; }).join('') +
      ic('radio-tower', 66, 50, 52, '#9ea8ff') +
      '<rect x="0" y="150" width="320" height="30" fill="#0e1330"/>' +
      '<rect x="176" y="32" width="122" height="116" rx="10" fill="#fff"/>' + txt(188, 50, 'ЖУРНАЛ', 9, '#5a647d') +
      ['22:10 сигнал', '22:20 сигнал', '22:30 сигнал', 'Источник: спутник'].map(function (l, i) {
        return '<g class="s-reveal" style="animation-delay:' + (.4 + i * .6) + 's">' + txt(188, 70 + i * 20, l, 9.5, i === 3 ? '#14905f' : '#1b2236') + '</g>';
      }).join(''),
      'Радиобашня посылает волны сигнала, в журнале станции по очереди появляются записи');
  };

  /* Мир 2 · оранжерея: полив — и ростки тянутся вверх */
  SCENES.greenhouse = function () {
    var pots = [70, 160, 250];
    return wrap('greenhouse',
      '<circle cx="282" cy="32" r="16" fill="#ffd25e"/>' +
      '<g class="s-tilt">' + ic('droplets', 92, 14, 26, '#7ac8ff') + '</g>' +
      [0, 1, 2].map(function (i) { return '<circle class="s-drop" style="animation-delay:' + i * .35 + 's" cx="' + (104 + i * 6) + '" cy="48" r="2.6" fill="#7ac8ff"/>'; }).join('') +
      pots.map(function (x, i) {
        return '<g class="s-grow" style="animation-delay:' + i * .3 + 's;transform-origin:' + x + 'px 128px">' +
          '<path d="M' + x + ' 128 V' + (96 - i * 8) + '" stroke="#3dbb7c" stroke-width="4" stroke-linecap="round"/>' +
          '<ellipse cx="' + (x - 10) + '" cy="' + (100 - i * 8) + '" rx="11" ry="6" fill="#3dbb7c" transform="rotate(-25 ' + (x - 10) + ' ' + (100 - i * 8) + ')"/>' +
          '<ellipse cx="' + (x + 10) + '" cy="' + (92 - i * 8) + '" rx="11" ry="6" fill="#4fd18f" transform="rotate(25 ' + (x + 10) + ' ' + (92 - i * 8) + ')"/></g>' +
          '<path d="M' + (x - 22) + ' 126 h44 l-6 30 h-32 z" fill="#c9733a"/><rect x="' + (x - 25) + '" y="122" width="50" height="8" rx="3" fill="#e08a4a"/>';
      }).join('') +
      '<rect x="0" y="156" width="320" height="24" fill="#0e1330"/>',
      'В оранжерее после полива ростки в трёх горшках тянутся вверх');
  };

  /* Мир 2 · лаборатория: колба бурлит, лупа отделяет факт от слуха */
  SCENES.lab = function () {
    return wrap('lab',
      '<path d="M66 40 h28 v34 l26 52 q4 12 -10 12 h-60 q-14 0 -10 -12 l26 -52 z" fill="#2d376e" stroke="#9ea8ff" stroke-width="3"/>' +
      '<path d="M50 112 l14 -28 h32 l14 28 q4 10 -8 10 h-44 q-12 0 -8 -10 z" fill="#7af0c8" opacity=".85"/>' +
      [0, 1, 2, 3].map(function (i) { return '<circle class="s-rise" style="animation-delay:' + i * .45 + 's" cx="' + (70 + i * 8) + '" cy="110" r="' + (3 + i % 2) + '" fill="#fff"/>'; }).join('') +
      pill(170, 40, 120, 30, '#e2f6ec', 'ФАКТ ✓', '#14905f', 12) +
      pill(170, 84, 120, 30, '#fde8eb', 'СЛУХ ✗', '#c7384a', 12) +
      pill(170, 128, 120, 30, '#fff3e0', 'НЕ ЯСНО ?', '#b35c00', 12) +
      '<g class="s-hunt2">' + ic('search', 250, 40, 40, '#ffe7a3') + '</g>',
      'В лаборатории бурлит колба, лупа по очереди проверяет карточки «факт», «слух» и «не ясно»');
  };

  /* Мир 2 · маршруты: планеты выстраиваются по удалённости от Солнца */
  SCENES.planets = function () {
    var pl = [['Меркурий', 6, '#c5cbdb'], ['Венера', 9, '#ffd25e'], ['Земля', 10, '#4fa8ff'], ['Марс', 8, '#ff7a59']];
    var order = [3, 0, 2, 1];
    return wrap('planets',
      '<circle cx="8" cy="90" r="46" fill="#ffb020"/><circle cx="8" cy="90" r="58" fill="#ffb020" opacity=".15" class="s-twinkle"/>' +
      [80, 140, 205, 270].map(function (x) { return '<path d="M' + x + ' 20 Q' + (x + 18) + ' 90 ' + x + ' 160" stroke="#3a4589" stroke-width="1.5" fill="none" stroke-dasharray="3 5"/>'; }).join('') +
      pl.map(function (p, i) {
        var x = [80, 140, 205, 270][i];
        var dx = ([80, 140, 205, 270][order.indexOf(i)] - x);
        return '<g class="s-sortx" style="--fx:' + dx + 'px"><circle cx="' + (x + 12) + '" cy="90" r="' + p[1] + '" fill="' + p[2] + '"/>' +
          txt(x + 12, 118, p[0], 8.5, '#c9cfff', 'middle') + '</g>';
      }).join('') +
      txt(160, 164, 'Ближе к Солнцу → дальше', 9, '#9ea8ff', 'middle'),
      'Планеты Меркурий, Венера, Земля и Марс выстраиваются по порядку удалённости от Солнца');
  };

  /* Мир 2 · компасы: стрелки крутятся и указывают на надёжный источник */
  SCENES.compasses = function () {
    return wrap('compasses',
      [56, 160, 264].map(function (x, i) {
        return '<circle cx="' + x + '" cy="70" r="34" fill="#2d376e" stroke="#9ea8ff" stroke-width="3"/>' +
          '<g class="s-settle" style="animation-delay:' + i * .25 + 's;transform-origin:' + x + 'px 70px"><path d="M' + x + ' 42 l7 28 h-14 z" fill="#ff5d6c"/><path d="M' + x + ' 98 l7 -28 h-14 z" fill="#c9cfff"/></g>' +
          '<circle cx="' + x + '" cy="70" r="4" fill="#fff"/>';
      }).join('') +
      '<g class="s-pop s-slow" style="animation-delay:1s"><rect x="110" y="122" width="100" height="40" rx="10" fill="#fff"/>' +
      ic('book-open-check', 120, 131, 22, '#2b8ac6') + txt(148, 147, 'Надёжно', 11, '#1b2236') + '</g>',
      'Три компаса крутят стрелками и затем дружно указывают вниз, на надёжный источник');
  };

  /* ===================== Финалы ===================== */

  /* Мир 1: глаз из букв раскрывается — это Хранитель */
  SCENES.reveal = function () {
    var rays = '';
    for (var i = 0; i < 12; i++) rays += '<rect x="158" y="18" width="4" height="26" rx="2" fill="#ffb020" opacity=".5" transform="rotate(' + i * 30 + ' 160 80)"/>';
    return wrap('reveal',
      stars() +
      '<g class="s-spin" style="transform-origin:160px 80px">' + rays + '</g>' +
      '<g class="s-fadeout"><path d="M112 80q48-42 96 0q-48 42-96 0z" fill="#fff"/><circle cx="160" cy="80" r="17" fill="#5b6cff"/><circle cx="160" cy="80" r="8" fill="#0b1030"/></g>' +
      '<g class="s-appear"><circle cx="160" cy="80" r="32" fill="#ffb020"/>' + ic('library-big', 142, 62, 36, '#1c2246') + '</g>' +
      '<g class="s-appear" style="animation-delay:.4s">' + txt(160, 150, 'ХРАНИТЕЛЬ ЦИФРОВОЙ БИБЛИОТЕКИ', 11, '#ffe7a3', 'middle') + '</g>',
      'Таинственный глаз растворяется, и на его месте появляется знак Хранителя цифровой библиотеки');
  };

  /* Мир 1: связи между вопросами и ответами восстанавливаются */
  SCENES.keeper = function () {
    var qs = ['Где подарок?', 'Когда исчезнет?', 'Чей мешок?'], as = ['В шкатулке', 'В полночь', 'Друга'];
    return wrap('keeper',
      qs.map(function (q, i) {
        var y = 30 + i * 46;
        return pill(18, y, 104, 28, '#fff', q, '#1b2236', 9.5) +
          '<path class="s-link" style="animation-delay:' + i * .5 + 's" d="M124 ' + (y + 14) + ' C160 ' + (y + 14) + ' 160 ' + (y + 14) + ' 196 ' + (y + 14) + '" stroke="#7af0c8" stroke-width="3" fill="none" pathLength="100"/>' +
          pill(198, y, 104, 28, '#e2f6ec', as[i], '#14905f', 9.5);
      }).join('') +
      '<g class="s-twinkle">' + ic('library-big', 148, 148, 24, '#ffb020') + '</g>',
      'Связи между вопросами и ответами восстанавливаются одна за другой');
  };

  /* Мир 1: DerekSci собирался чинить сервер отвёрткой */
  SCENES.screwdriver = function () {
    return wrap('screwdriver',
      '<rect x="196" y="28" width="86" height="126" rx="8" fill="#2d376e"/>' +
      [0, 1, 2, 3].map(function (i) {
        return '<rect x="204" y="' + (38 + i * 28) + '" width="70" height="20" rx="4" fill="#0b1030"/>' +
          '<circle class="s-blink" style="animation-delay:' + i * .25 + 's" cx="264" cy="' + (48 + i * 28) + '" r="3" fill="' + (i % 2 ? '#7af0c8' : '#ffb020') + '"/>';
      }).join('') +
      robotAt('wow', 54, 52, 96) +
      '<g class="s-swing">' + ic('wrench', 140, 64, 40, '#ffe7a3') + '</g>' +
      '<g class="s-pop" style="animation-delay:.6s">' + txt(150, 40, 'Ой!', 18, '#ff8fb1', 'middle') + '</g>',
      'Робот DerekSci с гаечным ключом у сервера: он уже собирался чинить его вручную');
  };

  /* Праздник: конфетти и пять восстановленных систем */
  function celebrateWith(name, icons) {
    var colors = ['#ffb020', '#7af0c8', '#ff8fb1', '#9ea8ff', '#ffe7a3'];
    var conf = '';
    for (var i = 0; i < 14; i++) {
      conf += '<rect class="s-fall" style="animation-delay:' + (i * .23).toFixed(2) + 's" x="' + (14 + i * 21) + '" y="-10" width="6" height="10" rx="1.5" fill="' + colors[i % 5] + '"/>';
    }
    return wrap(name,
      conf +
      icons.map(function (n, k) {
        var a = Math.PI + k * (Math.PI / 4);
        var x = 160 + Math.cos(a) * 118, y = 150 + Math.sin(a) * 104;
        return '<g class="s-pop s-slow" style="animation-delay:' + k * .3 + 's"><circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="17" fill="#2d376e" stroke="#7af0c8" stroke-width="2"/>' +
          ic(n, x - 10, y - 10, 20, '#7af0c8') + '</g>';
      }).join('') +
      robotAt('happy', 125, 96, 70),
      'Робот DerekSci радуется, падает конфетти, вокруг загораются пять восстановленных систем');
  }
  SCENES.celebrate = function () { return celebrateWith('celebrate', ['scroll-text', 'lightbulb', 'scale', 'hourglass', 'compass']); };
  SCENES.celebrate2 = function () { return celebrateWith('celebrate2', ['radio-tower', 'sprout', 'flask-conical', 'route', 'compass']); };

  /* Мир 1: рабочий маршрут — прочитать, найти, проверить, ответить */
  SCENES.routeplan = function () {
    var steps = [['book-open', 'Прочитать'], ['search', 'Найти'], ['shield-check', 'Проверить'], ['message-circle', 'Ответить']];
    return wrap('routeplan',
      steps.map(function (s, i) {
        var x = 18 + i * 76;
        return '<g class="s-pop s-slow" style="animation-delay:' + i * .45 + 's"><rect x="' + x + '" y="46" width="62" height="70" rx="12" fill="#fff"/>' +
          ic(s[0], x + 17, 56, 28, '#5b6cff') + txt(x + 31, 104, s[1], 8.5, '#1b2236', 'middle') + '</g>' +
          (i < 3 ? '<g class="s-reveal" style="animation-delay:' + (i * .45 + .3) + 's">' + ic('chevron-right', x + 62, 72, 16, '#9ea8ff') + '</g>' : '');
      }).join('') +
      '<g class="s-reveal" style="animation-delay:2s">' + txt(160, 148, 'Рабочий маршрут детектива', 11, '#ffe7a3', 'middle') + '</g>',
      'Четыре шага маршрута по очереди появляются: прочитать, найти, проверить, ответить');
  };

  /* Мир 2: архив в порядке — звёзды складываются в созвездие */
  SCENES.constellation = function () {
    var pts = [[46, 120], [96, 74], [150, 96], [196, 46], [252, 70], [282, 122]];
    var path = 'M' + pts.map(function (p) { return p[0] + ' ' + p[1]; }).join(' L');
    return wrap('constellation',
      stars() +
      '<path class="s-link" d="' + path + '" stroke="#9ea8ff" stroke-width="2" fill="none" pathLength="100"/>' +
      pts.map(function (p, i) {
        return '<g class="s-pop s-slow" style="animation-delay:' + i * .3 + 's"><circle cx="' + p[0] + '" cy="' + p[1] + '" r="6" fill="#ffe7a3"/><circle cx="' + p[0] + '" cy="' + p[1] + '" r="11" fill="#ffe7a3" opacity=".2"/></g>';
      }).join('') +
      '<g class="s-reveal" style="animation-delay:2.2s">' + txt(160, 162, 'Каждая запись на своём месте', 11, '#ffe7a3', 'middle') + '</g>',
      'Звёзды одна за другой соединяются линиями в созвездие: архив снова в порядке');
  };

  /* Мир 2: знанием делятся — свет обсерватории доходит до новых миров */
  SCENES.share = function () {
    var worlds = [[52, 44, '#5b6cff'], [262, 40, '#14a37f'], [40, 126, '#c2489b'], [276, 124, '#e07a1f']];
    return wrap('share',
      stars() +
      worlds.map(function (w, i) {
        return '<path class="s-link" style="animation-delay:' + i * .4 + 's" d="M160 92 L' + w[0] + ' ' + w[1] + '" stroke="#ffe7a3" stroke-width="2" stroke-dasharray="4 4" fill="none" pathLength="100"/>' +
          '<g class="s-pop s-slow" style="animation-delay:' + (.5 + i * .4) + 's"><circle cx="' + w[0] + '" cy="' + w[1] + '" r="16" fill="' + w[2] + '"/>' + ic('plus', w[0] - 8, w[1] - 8, 16, '#fff') + '</g>';
      }).join('') +
      '<circle cx="160" cy="92" r="30" fill="#7b5cff"/><circle class="s-ping" cx="160" cy="92" r="30" fill="none" stroke="#ffe7a3" stroke-width="2"/>' +
      ic('telescope', 144, 76, 32, '#fff') +
      txt(160, 168, 'Во вселенной ещё много мест', 10, '#9ea8ff', 'middle'),
      'Из обсерватории расходятся лучи к четырём новым мирам');
  };

  /* HTML медиа-блока для реплики: готовая GIF (media) или SVG-сцена (scene) */
  function media(line) {
    if (line.media && line.media.src) {
      return '<figure class="story-media"><img src="' + ui.esc(line.media.src) + '" alt="' + ui.esc(line.media.alt || '') + '" loading="lazy"></figure>';
    }
    if (line.scene && SCENES[line.scene]) return '<figure class="story-media">' + SCENES[line.scene]() + '</figure>';
    return '';
  }

  DS.scenes = { media: media, list: Object.keys(SCENES) };
})();

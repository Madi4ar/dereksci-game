/* Каркас приложения: hash-роутер, верхняя навигация, общее состояние пользователя.
 * Своего бокового меню нет: приложение встраивается в платформу, у которой слева меню 232px
 * (учитывается в CSS через --ds-host-sidebar). */
(function () {
  'use strict';
  var ui = DS.ui, esc = ui.esc, icon = ui.icon;

  var NAV = [
    { href: '#/home', key: 'home', label: 'Главная', icon: 'home' },
    { href: '#/map', key: 'map', label: 'Вселенная', icon: 'orbit' },
    { href: '#/expeditions', key: 'expeditions', label: 'Экспедиции', icon: 'infinity' },
    { href: '#/review', key: 'review', label: 'Повторение', icon: 'review' },
        { href: '#/cms', key: 'cms', label: 'CMS', icon: 'cms', cms: true }
  ];

  /* маршрут -> { view, shell, auth, nav } */
  var ROUTES = [
    { re: /^\/?$/, view: 'entry' },
    { re: /^\/welcome$/, view: 'welcome', shell: false, auth: false },
    { re: /^\/auth\/(login|register)$/, view: 'auth', shell: false, auth: false, keys: ['mode'] },
    { re: /^\/onboarding$/, view: 'onboarding', shell: false },
    { re: /^\/home$/, view: 'home', nav: 'home' },
    { re: /^\/map$/, view: 'map', nav: 'map' },
    { re: /^\/world\/([\w-]+)$/, view: 'world', nav: 'map', keys: ['worldId'] },
    { re: /^\/city\/([\w-]+)$/, view: 'city', nav: 'map', keys: ['cityId'] },
    { re: /^\/expeditions$/, view: 'expeditions', nav: 'expeditions' },
    { re: /^\/lesson\/([\w-]+)$/, view: 'lesson', nav: 'map', keys: ['lessonId'], lesson: true },
    { re: /^\/session\/([\w-]+)$/, view: 'session', nav: 'map', keys: ['sessionId'], lesson: true },
    { re: /^\/result\/([\w-]+)$/, view: 'result', nav: 'map', keys: ['sessionId'] },
    { re: /^\/final$/, view: 'final', nav: 'map' },
    { re: /^\/final\/([\w-]+)$/, view: 'final', nav: 'map', keys: ['worldId'] },
    { re: /^\/review$/, view: 'review', nav: 'review' },
    { re: /^\/profile$/, view: 'profile', nav: 'profile' },
    { re: /^\/cms$/, view: 'cms', nav: 'cms' },
    { re: /^\/cms\/analytics$/, view: 'cmsAnalytics', nav: 'cms' },
    { re: /^\/cms\/worlds$/, view: 'cmsWorlds', nav: 'cms' },
    { re: /^\/cms\/q\/([\w-]+)$/, view: 'cmsEdit', nav: 'cms', keys: ['questionId'] }
  ];

  var app = {
    me: null,
    views: {},
    routeToken: 0,
    main: null,
    leaveGuard: null, // функция, вызываемая при уходе со страницы урока

    go: function (hash) { if (location.hash === hash) route(); else location.hash = hash; },

    setMe: function (me) {
      app.me = me;
      applySettings(me && me.settings);
      renderShell();
    },
    refreshMe: function () {
      return DS.api.get('/me').then(function (me) { app.setMe(me); return me; });
    },
    render: function (html) { app.main.innerHTML = html; },
    /* загрузка с состояниями loading/error и защитой от гонок переходов */
    load: function (promise, onData, label) {
      var token = app.routeToken;
      app.render(ui.loading(label));
      return promise.then(function (data) {
        if (token !== app.routeToken) return;
        onData(data);
      }, function (err) {
        if (token !== app.routeToken || (err && err.status === 401)) return;
        app.render(ui.errorState(err));
        var r = app.main.querySelector('[data-action="retry"]');
        if (r) r.addEventListener('click', route);
      });
    },
    isAdult: function () {
      var r = app.me && app.me.learning_profile && app.me.learning_profile.role_type;
      return r && r !== 'school';
    },
    /* реплики DerekSci: спокойнее для взрослых (ТЗ §6.1) */
    say: function (kid, adult) { return app.isAdult() && adult ? adult : kid; },
    updateWallet: function (w) {
      if (!app.me || !w) return;
      app.me.xp = w.xp; app.me.coins = w.coins; renderStats();
    }
  };
  DS.app = app;

  function applySettings(s) {
    s = s || {};
    document.documentElement.style.setProperty('--font-scale', s.font_scale || 1);
    document.documentElement.classList.toggle('reduce-motion', !!s.reduce_motion);
  }

  function renderStats() {
    var me = app.me;
    var html = me ? '<span class="stat stat--xp" title="Опыт">' + icon('star', 16) + '<b>' + me.xp + '</b> XP</span>' +
      '<span class="stat stat--coins" title="Монеты">' + icon('coin', 16) + '<b>' + me.coins + '</b></span>' : '';
    document.querySelectorAll('[data-stats]').forEach(function (el) { el.innerHTML = html; });
  }

  function renderShell() {
    var me = app.me;
    var nav = document.getElementById('nav');
    nav.innerHTML = NAV.filter(function (n) { return !n.cms || (me && me.can_access_cms); }).map(function (n) {
      return '<a class="nav-link" href="' + n.href + '" data-nav="' + n.key + '">' + icon(n.icon, 18) + '<span>' + n.label + '</span></a>';
    }).join('');
    var user = document.getElementById('topbar-user');
    user.innerHTML = me ? '<a class="topbar-user" href="#/profile" title="' + esc(profileLabel(me)) + '"><span class="avatar" aria-hidden="true">' + esc(me.display_name.slice(0, 1).toUpperCase()) + '</span>' +
      '<span class="sr-only">Профиль: ' + esc(me.display_name) + '</span></a>' : '';
    renderStats();
    highlightNav();
  }
  function profileLabel(me) {
    var map = { school: 'Ученик', student: 'Студент', teacher: 'Учитель', adult: 'Взрослый учащийся' };
    return (me.learning_profile && map[me.learning_profile.role_type]) || 'Профиль не выбран';
  }
  var currentNav = null;
  function highlightNav() {
    document.querySelectorAll('[data-nav]').forEach(function (a) {
      var on = a.getAttribute('data-nav') === currentNav;
      a.classList.toggle('active', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
  }

  function match(path) {
    for (var i = 0; i < ROUTES.length; i++) {
      var m = path.match(ROUTES[i].re);
      if (m) {
        var params = {};
        (ROUTES[i].keys || []).forEach(function (k, j) { params[k] = m[j + 1]; });
        return { r: ROUTES[i], params: params };
      }
    }
    return null;
  }

  function route() {
    var path = (location.hash || '#/').slice(1);
    var found = match(path);
    if (!found) { app.go('#/home'); return; }
    var r = found.r;
    if (app.leaveGuard) { var g = app.leaveGuard; app.leaveGuard = null; g(); }
    app.routeToken++;

    var needAuth = r.auth !== false;
    if (r.view === 'entry') {
      if (!DS.api.hasToken()) return app.go('#/welcome');
      return ensureMe().then(function (me) { if (me) app.go(me.onboarding_completed ? '#/home' : '#/onboarding'); });
    }
    if (needAuth && !DS.api.hasToken()) return app.go('#/welcome');
    if (!needAuth && DS.api.hasToken()) return app.go('#/');

    DS.root.classList.toggle('no-shell', r.shell === false);
    DS.root.classList.toggle('in-lesson', !!r.lesson);
    currentNav = r.nav || null;
    highlightNav();
    window.scrollTo(0, 0);

    var run = function () {
      if (needAuth && app.me && !app.me.onboarding_completed && r.view !== 'onboarding') return app.go('#/onboarding');
      var view = app.views[r.view];
      app.main.focus({ preventScroll: true });
      view(found.params);
    };
    if (needAuth) ensureMe().then(function (me) { if (me) run(); });
    else run();
  }

  function ensureMe() {
    if (app.me) return Promise.resolve(app.me);
    app.render(ui.loading());
    return app.refreshMe().catch(function (err) {
      if (err && err.status === 401) return null;
      app.render(ui.errorState(err));
      var r = app.main.querySelector('[data-action="retry"]'); if (r) r.addEventListener('click', route);
      return null;
    });
  }

  window.addEventListener('ds:unauthenticated', function () { app.me = null; renderShell(); app.go('#/welcome'); });
  window.addEventListener('hashchange', route);

  function updateOnline() {
    document.getElementById('offline-banner').hidden = navigator.onLine;
  }
  window.addEventListener('online', updateOnline);
  window.addEventListener('offline', updateOnline);

  document.addEventListener('DOMContentLoaded', function () {
    DS.root = document.getElementById('ds-app');
    app.main = document.getElementById('main');
    updateOnline();
    renderShell();
    route();
  });
})();

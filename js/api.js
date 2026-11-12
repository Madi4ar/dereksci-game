/*
 * HTTP-клиент к Laravel REST API.
 * USE_MOCK = true — запросы обслуживает js/mock/server.js.
 * Для подключения реального бэкенда: USE_MOCK = false и BASE_URL = 'https://api.example.kz/api'.
 * Реальный режим рассчитан на Laravel Sanctum SPA (cookie + CSRF): перед логином
 * вызывается GET /sanctum/csrf-cookie, токен XSRF передаётся в заголовке.
 */
(function () {
  'use strict';

  var CONFIG = {
    USE_MOCK: true,
    BASE_URL: '/api',
    SANCTUM_ORIGIN: ''
  };
  var TOKEN_KEY = 'dereksci_token';

  function getToken() { try { return localStorage.getItem(TOKEN_KEY); } catch (e) { return null; } }
  function setToken(t) { try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch (e) { /* ignore */ } }

  function readCookie(name) {
    var m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : null;
  }

  function realRequest(method, path, body) {
    var headers = { 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' };
    if (body) headers['Content-Type'] = 'application/json';
    var xsrf = readCookie('XSRF-TOKEN'); if (xsrf) headers['X-XSRF-TOKEN'] = xsrf;
    var token = getToken(); if (token) headers['Authorization'] = 'Bearer ' + token;
    return fetch(CONFIG.BASE_URL + path, { method: method, headers: headers, credentials: 'include', body: body ? JSON.stringify(body) : undefined })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (data) {
          if (res.ok) return data.data !== undefined ? data.data : data; // API Resources оборачивают в data
          throw { status: res.status, code: data.code || 'http_' + res.status, message: data.message || 'Ошибка запроса', details: data.errors || null };
        });
      }, function () { throw { status: 0, code: 'offline', message: 'Нет подключения к серверу' }; });
  }

  function request(method, path, body) {
    var p = CONFIG.USE_MOCK ? window.DSMockServer.request(method, path, body, getToken()) : realRequest(method, path, body);
    return p.catch(function (err) {
      if (err && err.status === 401) { setToken(null); window.dispatchEvent(new CustomEvent('ds:unauthenticated')); }
      throw err;
    });
  }

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  window.DS = window.DS || {};
  DS.api = {
    config: CONFIG,
    uuid: uuid,
    hasToken: function () { return !!getToken(); },
    get: function (p) { return request('GET', p); },
    post: function (p, b) { return request('POST', p, b || {}); },
    put: function (p, b) { return request('PUT', p, b || {}); },
    patch: function (p, b) { return request('PATCH', p, b || {}); },

    register: function (data) { return request('POST', '/auth/register', data).then(function (r) { setToken(r.token); return r.user; }); },
    login: function (data) { return request('POST', '/auth/login', data).then(function (r) { setToken(r.token); return r.user; }); },
    logout: function () { return request('POST', '/auth/logout').catch(function () {}).then(function () { setToken(null); }); }
  };
})();

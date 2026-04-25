/* ═══════════════════════════════════════════════════════════════════
   Genea Azul — utils.js
   Shared utility functions
   ═══════════════════════════════════════════════════════════════════ */
var GeneaAzul = window.GeneaAzul || {};

GeneaAzul.utils = (function() {

  /* ── String helpers ────────────────────────────────────────────── */
  function isEmpty(str) {
    return str == null || str.length === 0;
  }

  function trimToNull(str) {
    if (isEmpty(str)) return null;
    var trimmed = str.trim();
    return isEmpty(trimmed) ? null : trimmed;
  }

  function toNumber(str) {
    return isEmpty(str) ? null : parseInt(str, 10);
  }

  function maxLengthCheck(input) {
    var limit = Number(input.max).toString().length;
    if (input.value.length > limit) {
      input.value = input.value.slice(0, limit);
    }
  }

  /* HTML-escapes a value for safe insertion into HTML content or attributes */
  function escHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* Formats a number using Argentine locale: 70.512 */
  function formatNumber(num) {
    if (num == null) return '';
    return num.toLocaleString('es-AR');
  }

  /* Count-up animation for a single element */
  function animateCounter($el, target, duration) {
    duration = duration || 1200;
    var start = 0;
    var startTime = null;

    function step(timestamp) {
      if (!startTime) startTime = timestamp;
      var progress = Math.min((timestamp - startTime) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      var current = Math.floor(eased * target);
      $el.text(formatNumber(current));
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  /* Runs counter animations on all [data-target] elements within $container */
  function animateCounters($container) {
    $container.find('[data-target]').each(function() {
      var $el = $(this);
      var target = parseInt($el.attr('data-target'), 10);
      if (!isNaN(target)) animateCounter($el, target);
    });
  }

  /* ── API helpers ───────────────────────────────────────────────── */
  function apiGet(url, successFn, errorFn) {
    $.ajax({
      type: 'GET',
      url: url,
      contentType: 'application/json',
      success: successFn,
      error: errorFn || function() {}
    });
  }

  /* Like apiGet but deduplicates: concurrent or repeated calls for the same
     URL share one request. Successful responses stay cached for the session.
     Failed responses are evicted so subsequent callers can retry — otherwise
     a transient wake-up timeout would permanently break every caller. */
  var _getCache = {};
  function apiGetCached(url, successFn, errorFn) {
    if (!_getCache[url]) {
      var deferred = $.Deferred();
      _getCache[url] = deferred;
      $.ajax({
        type: 'GET',
        url: url,
        contentType: 'application/json',
        success: function(data) { deferred.resolve(data); },
        error: function(xhr) {
          if (_getCache[url] === deferred) delete _getCache[url];
          deferred.reject(xhr);
        }
      });
    }
    _getCache[url]
      .done(successFn  || function() {})
      .fail(errorFn    || function() {});
  }

  function apiPost(url, data, successFn, errorFn) {
    $.ajax({
      type: 'POST',
      url: url,
      dataType: 'json',
      contentType: 'application/json',
      data: JSON.stringify(data),
      success: successFn,
      error: errorFn || function() {}
    });
  }

  /* ── DOM helpers ───────────────────────────────────────────────── */
  /* Shared backend-unavailable error block used by #buscar and #conexiones.
     Matches the contact-button style from #sobre-nosotros. */
  function backendErrorHtml() {
    return '<p class="mb-1">No se pudo conectar con el servidor.</p>'
      + '<p class="text-muted mb-3">Por favor intentá de nuevo o contactanos:</p>'
      + '<div class="d-flex gap-3 justify-content-center flex-wrap">'
      +   '<a href="https://instagram.com/_u/genea.azul" target="_blank" rel="noopener" class="btn btn-outline-secondary btn-sm">'
      +     '<i class="bi bi-instagram me-2"></i>@genea.azul'
      +   '</a>'
      +   '<a href="https://facebook.com/genea.azul" target="_blank" rel="noopener" class="btn btn-outline-secondary btn-sm">'
      +     '<i class="bi bi-facebook me-2"></i>genea.azul'
      +   '</a>'
      +   '<a href="mailto:genea.azul@gmail.com" class="btn btn-outline-secondary btn-sm">'
      +     '<i class="bi bi-envelope me-2"></i>Email'
      +   '</a>'
      + '</div>';
  }

  /* Returns a loading spinner element */
  function spinnerHtml(text) {
    text = text || 'Buscando...';
    return '<div class="d-flex align-items-center gap-2 py-2">'
      + '<div class="spinner-border spinner-border-sm" role="status"></div>'
      + '<span>' + text + '</span>'
      + '</div>';
  }

  /* Prefill connections form from URL hash query-string style
     e.g. #conexiones?name=Juan&surname=Perez&year=1980 */
  /* Lowercase + strip diacritics for accent-insensitive comparison */
  function normalize(str) {
    return (str || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function safeDecode(s) {
    try { return decodeURIComponent(s); } catch(e) { return s; }
  }

  function getQueryParams() {
    var qs = (window.location.search || '').replace(/^\?/, '');
    if (!qs) return {};
    var params = {};
    qs.split('&').forEach(function(pair) {
      var kv = pair.split('=');
      if (kv[0]) params[safeDecode(kv[0])] = safeDecode(kv[1] || '');
    });
    return params;
  }

  return {
    isEmpty:         isEmpty,
    trimToNull:      trimToNull,
    toNumber:        toNumber,
    maxLengthCheck:  maxLengthCheck,
    escHtml:         escHtml,
    formatNumber:    formatNumber,
    animateCounter:  animateCounter,
    animateCounters: animateCounters,
    apiGet:          apiGet,
    apiGetCached:    apiGetCached,
    apiPost:         apiPost,
    normalize:        normalize,
    backendErrorHtml: backendErrorHtml,
    spinnerHtml:     spinnerHtml,
    getQueryParams:  getQueryParams
  };

})();

/* ── Theme switcher ──────────────────────────────────────────────── */
GeneaAzul.toggleTheme = function(theme) {
  var themes = ['heritage', 'modern'];
  if (themes.indexOf(theme) === -1) return;
  var $body = $('body');
  themes.forEach(function(t) { $body.removeClass('theme-' + t); });
  $body.addClass('theme-' + theme);

  $('#theme-stylesheet').attr('href', 'css/theme-' + theme + '.css');

  // Toggle active button state
  $('.ga-theme-btn').removeClass('active');
  $('#btn-theme-' + theme).addClass('active');

  // Persist choice
  try { localStorage.setItem('ga-theme', theme); } catch(e) {}
};

/* Restore saved theme on load */
(function() {
  try {
    var saved = localStorage.getItem('ga-theme');
    if (saved === 'modern') GeneaAzul.toggleTheme('modern');
  } catch(e) {}
})();

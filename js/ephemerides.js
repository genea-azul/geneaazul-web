/* ═══════════════════════════════════════════════════════════════════
   Genea Azul — ephemerides.js
   Fetches and renders "Efemérides de [mes]" on the landing page.
   Births (bi-balloon-heart) and deaths (†) are mixed and sorted by day.
   ═══════════════════════════════════════════════════════════════════ */
var GeneaAzul = window.GeneaAzul || {};

GeneaAzul.ephemerides = (function() {

  function init() {
    if (GeneaAzul.config.onVacations) return;
    fetchEphemerides();
  }

  function fetchEphemerides() {
    GeneaAzul.utils.apiGet(
      GeneaAzul.config.apiBaseUrl + '/api/birthday/ephemerides-this-month',
      function(data) {
        var birthdays = data && data.birthdays ? data.birthdays : [];
        var deaths    = data && data.deaths    ? data.deaths    : [];
        if (birthdays.length === 0 && deaths.length === 0) return;
        renderEphemerides(birthdays, deaths);
      }
    );
  }

  function renderEphemerides(birthdays, deaths) {
    var $body = $('#ephemerides-body');
    var $card = $('#efemerides');

    $('#ephemerides-month').text(monthLabel());

    // Tag each entry with its event type, merge, then sort by day
    var todayDay = parseInt(new Date().toLocaleDateString('es-AR', {
      timeZone: 'America/Argentina/Buenos_Aires',
      day: 'numeric'
    }), 10);

    var all = [];
    birthdays.forEach(function(p) { all.push({ p: p, type: 'birth' }); });
    deaths.forEach(function(p)    { all.push({ p: p, type: 'death' }); });

    all.sort(function(a, b) {
      var da = extractDay(a.type === 'birth' ? a.p.dateOfBirth : a.p.dateOfDeath) || 0;
      var db = extractDay(b.type === 'birth' ? b.p.dateOfBirth : b.p.dateOfDeath) || 0;
      return da - db;
    });

    var $list = $('<div>').addClass('row g-2');
    all.forEach(function(entry) { $list.append(buildItem(entry.p, entry.type, todayDay)); });

    $body.html($list);
    $card.show();
    if (window.location.hash === '#efemerides') {
      $card[0].scrollIntoView({ behavior: 'smooth' });
    }
  }

  function buildItem(p, eventType, todayDay) {
    var isBirth = eventType === 'birth';

    var eventDate = isBirth ? p.dateOfBirth : p.dateOfDeath;
    var day  = extractDay(eventDate);
    var year = extractYear(eventDate);
    var isToday = day !== null && day === todayDay;

    // Day badge: small pill centred at the top edge of the photo circle
    var dayHtml = day
      ? '<span class="ga-ephem-day-badge">' + GeneaAzul.utils.escHtml(String(day)) + '</span>'
      : '';

    // Event-type badge: small icon at the bottom-right of the photo circle
    var typeBadgeHtml = isBirth
      ? '<span class="ga-ephem-type-badge ga-ephem-birth" title="Cumpleaños"><i class="bi bi-balloon-heart"></i></span>'
      : '<span class="ga-ephem-type-badge ga-ephem-death" title="Fallecimiento">&dagger;</span>';

    var yearHtml = year
      ? '<span class="ga-birthday-year">(' + GeneaAzul.utils.escHtml(year) + ')</span>'
      : '';

    var displayName = p.name;
    if (p.aka) displayName += ' «' + p.aka + '»';

    var photoInner = p.profilePicture
      ? '<img src="' + GeneaAzul.utils.escHtml(p.profilePicture) + '" alt="' + GeneaAzul.utils.escHtml(p.name) + '" class="ga-birthday-photo">'
      : '<div class="ga-birthday-photo-placeholder"><i class="bi bi-person"></i></div>';

    var $col  = $('<div>').addClass('col-6 col-sm-4 col-md-3 col-lg-2');
    var $item = $('<div>').addClass('ga-birthday-item text-center' + (isToday ? ' ga-ephem-today' : ''));

    $item.html(
      '<div class="ga-ephem-photo-wrap">'
        + photoInner
        + dayHtml
        + typeBadgeHtml
      + '</div>'
      + '<div class="ga-birthday-name">' + GeneaAzul.utils.escHtml(displayName) + ' ' + yearHtml + '</div>'
    );

    $col.append($item);
    return $col;
  }

  /* Returns "abril de 2026" in Argentine time. */
  function monthLabel() {
    return new Date().toLocaleDateString('es-AR', {
      timeZone: 'America/Argentina/Buenos_Aires',
      month:    'long',
      year:     'numeric'
    });
  }

  /* Extracts the day number from a GEDCOM date string like "15 APR 1985" → 15. */
  function extractDay(dateStr) {
    if (!dateStr) return null;
    var match = dateStr.match(/^(\d{1,2})\s+[A-Z]{3}/);
    return match ? parseInt(match[1], 10) : null;
  }

  /* Extracts the 4-digit year from a GEDCOM date string like "15 APR 1985" → "1985". */
  function extractYear(dateStr) {
    if (!dateStr) return null;
    var match = dateStr.match(/\b(\d{4})\b/);
    return match ? match[1] : null;
  }

  return { init };

})();

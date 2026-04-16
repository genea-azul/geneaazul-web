/* ═══════════════════════════════════════════════════════════════════
   Genea Azul — ephemerides.js
   Fetches and renders "Efemérides de [mes]" on the landing page.
   Shows living personalities born this month (★) and deceased
   personalities who passed away this month (†), ordered by day.
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
    var $card = $('#ephemerides-card');

    $('#ephemerides-month').text(monthLabel());

    var $list = $('<div>').addClass('row g-2');

    birthdays.forEach(function(p) { $list.append(buildItem(p, 'birth')); });
    deaths.forEach(function(p)    { $list.append(buildItem(p, 'death')); });

    $body.html($list);
    $card.show();
  }

  function buildItem(p, eventType) {
    var isBirth = eventType === 'birth';

    var symbolHtml = isBirth
      ? '<span class="ga-ephem-symbol ga-ephem-birth" title="Cumpleaños">★</span>'
      : '<span class="ga-ephem-symbol ga-ephem-death" title="Fallecimiento">†</span>';

    var eventDate = isBirth ? p.dateOfBirth : p.dateOfDeath;
    var day  = extractDay(eventDate);
    var year = extractYear(eventDate);

    var dayHtml = day
      ? '<span class="ga-ephem-day">' + GeneaAzul.utils.escHtml(day) + '</span>'
      : '';

    var yearHtml = year
      ? '<span class="ga-birthday-year">(' + GeneaAzul.utils.escHtml(year) + ')</span>'
      : '';

    var displayName = p.name;
    if (p.aka) displayName += ' «' + p.aka + '»';

    var imgHtml = p.profilePicture
      ? '<img src="' + GeneaAzul.utils.escHtml(p.profilePicture) + '" alt="' + GeneaAzul.utils.escHtml(p.name) + '" class="ga-birthday-photo">'
      : '<div class="ga-birthday-photo-placeholder"><i class="bi bi-person"></i></div>';

    var $col  = $('<div>').addClass('col-6 col-sm-4 col-md-3 col-lg-2');
    var $item = $('<div>').addClass('ga-birthday-item ga-ephem-item text-center');

    $item.html(
      dayHtml
      + symbolHtml
      + imgHtml
      + '<div class="ga-birthday-name">' + GeneaAzul.utils.escHtml(displayName) + ' ' + yearHtml + '</div>'
    );

    $col.append($item);
    return $col;
  }

  /* Returns the current month name in Argentine time, e.g. "abril 2026". */
  function monthLabel() {
    return new Date().toLocaleDateString('es-AR', {
      timeZone: 'America/Argentina/Buenos_Aires',
      month:    'long',
      year:     'numeric'
    });
  }

  /* Extracts the day number from a GEDCOM date string like "15 APR 1985" → "15". */
  function extractDay(dateStr) {
    if (!dateStr) return null;
    var match = dateStr.match(/^(\d{1,2})\s+[A-Z]{3}/);
    return match ? match[1] : null;
  }

  /* Extracts the 4-digit year from a GEDCOM date string like "15 APR 1985" → "1985". */
  function extractYear(dateStr) {
    if (!dateStr) return null;
    var match = dateStr.match(/\b(\d{4})\b/);
    return match ? match[1] : null;
  }

  return { init };

})();

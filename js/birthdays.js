/* ═══════════════════════════════════════════════════════════════════
   Genea Azul — birthdays.js
   Fetches and renders "Azuleños/as que cumplen años hoy" on the
   landing page.
   ═══════════════════════════════════════════════════════════════════ */
var GeneaAzul = window.GeneaAzul || {};

GeneaAzul.birthdays = (function() {

  function init() {
    if (GeneaAzul.config.onVacations) return;
    fetchBirthdays();
  }

  function fetchBirthdays() {
    GeneaAzul.utils.apiGet(
      GeneaAzul.config.apiBaseUrl + '/api/birthday/azul-today',
      function(people) {
        if (!people || people.length === 0) return;
        renderBirthdays(people);
      }
    );
  }

  function renderBirthdays(people) {
    var $body = $('#birthdays-today-body');
    var $card = $('#birthdays-today-card');

    var $list = $('<div>').addClass('row g-2');

    people.forEach(function(p) {
      var birthYear = extractYear(p.dateOfBirth);
      var imgHtml = p.profilePicture
        ? '<img src="' + GeneaAzul.utils.escHtml(p.profilePicture) + '" alt="' + GeneaAzul.utils.escHtml(p.name) + '" class="ga-birthday-photo">'
        : '<div class="ga-birthday-photo-placeholder"><i class="bi bi-person"></i></div>';

      var yearHtml = birthYear
        ? '<span class="ga-birthday-year">(' + GeneaAzul.utils.escHtml(birthYear) + ')</span>'
        : '';

      var $col = $('<div>').addClass('col-6 col-sm-4 col-md-3 col-lg-2');
      var $item = $('<div>').addClass('ga-birthday-item text-center');

      $item.html(
        imgHtml
        + '<div class="ga-birthday-name">' + GeneaAzul.utils.escHtml(p.name) + ' ' + yearHtml + '</div>'
      );

      $col.append($item);
      $list.append($col);
    });

    $body.html($list);
    $card.show();
  }

  /* Extracts the 4-digit year from a GEDCOM date string like "15 APR 1985" or "ABT 1940" */
  function extractYear(dateStr) {
    if (!dateStr) return null;
    var match = dateStr.match(/\b(\d{4})\b/);
    return match ? match[1] : null;
  }

  return { init };

})();

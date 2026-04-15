/**
 * Genea Azul — Configuration
 * See docs/SPEC.md Section 8.1
 */
var GeneaAzul = window.GeneaAzul || {};

GeneaAzul.config = {
    apiBaseUrl: (window.location.hostname === 'localhost')
        ? window.location.origin
        : 'https://gedcom-analyzer-app.fly.dev',
    onVacations: false,
    obfuscateLiving: true,
    familyTreeProcessPersonsBySec: 225,
    familyTreeProcessFixedDelayMillis: 3250,
    minMillisToDisplayWaitCountDown: 7500,
    // Optional: MapTiler API key for Spanish map labels.
    // Get a free key (no credit card) at https://cloud.maptiler.com/account/credentials/
    // Leave empty to use CartoDB tiles (English/local-language labels).
    mapTilerKey: ''
};

/* ── App bootstrap ─────────────────────────────────────────────────
   Initialises global behaviours: hero stat counters, navbar scroll
   effect, and live person count from API.
*/
GeneaAzul.app = (function() {

  function init() {
    animateHeroStats();
    fetchLiveStats();
    initNavbarScroll();
  }

  function animateHeroStats() {
    GeneaAzul.utils.animateCounters($('#hero-stats'));
  }

  function fetchLiveStats() {
    if (GeneaAzul.config.onVacations) return;

    // Persons count from API
    GeneaAzul.utils.apiGet(
      GeneaAzul.config.apiBaseUrl + '/api/gedcom-analyzer/metadata',
      function(meta) {
        if (meta && meta.personsCount) {
          updateHeroStat('#stat-persons', meta.personsCount);
        }
      }
    );

    // Immigrants + countries count from immigration.json
    $.getJSON('data/immigration.json', function(data) {
      var immigrants = data.reduce(function(acc, r) { return acc + r.count; }, 0);
      var countries  = data.reduce(function(acc, r) { return acc + r.country.split('/').length; }, 0);
      updateHeroStat('#stat-immigrants', immigrants);
      updateHeroStat('#stat-countries', countries);
    });

    // Surnames count from surnames.json
    $.getJSON('data/surnames.json', function(data) {
      updateHeroStat('#stat-surnames', data.length);
    });
  }

  function updateHeroStat(selector, value) {
    var $el = $(selector);
    if (!$el.length) return;
    $el.attr('data-target', value);
    GeneaAzul.utils.animateCounter($el, value);
  }

  function initNavbarScroll() {
    var $navbar = $('#main-navbar');
    $(window).on('scroll.navbar', function() {
      $navbar.toggleClass('scrolled', window.scrollY > 20);
    });
  }

  return { init };

})();

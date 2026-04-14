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
    fetchLivePersonCount();
    initNavbarScroll();
  }

  function animateHeroStats() {
    GeneaAzul.utils.animateCounters($('#hero-stats'));
  }

  function fetchLivePersonCount() {
    if (GeneaAzul.config.onVacations) return;
    GeneaAzul.utils.apiGet(
      GeneaAzul.config.apiBaseUrl + '/api/gedcom-analyzer/metadata',
      function(meta) {
        if (meta && meta.personsCount) {
          var $el = $('#stat-persons');
          GeneaAzul.utils.animateCounter($el, meta.personsCount);
          // Also update visible target attribute so re-animation works
          $el.attr('data-target', meta.personsCount);
        }
      }
    );
  }

  function initNavbarScroll() {
    var $navbar = $('#main-navbar');
    $(window).on('scroll.navbar', function() {
      $navbar.toggleClass('scrolled', window.scrollY > 20);
    });
  }

  return { init };

})();

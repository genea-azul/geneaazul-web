/**
 * Genea Azul — Configuration
 * See docs/SPEC.md Section 8.1
 */
var GeneaAzul = window.GeneaAzul || {};

GeneaAzul.config = {
    apiBaseUrl: (window.location.hostname === 'localhost')
        ? window.location.origin
        : 'https://gedcom-analyzer-app.fly.dev',
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
    initSearchClear();
  }

  function animateHeroStats() {
    GeneaAzul.utils.animateCounters($('#hero-stats'));
  }

  function fetchLiveStats() {
    // Persons + surnames count from API
    GeneaAzul.utils.apiGetCached(
      GeneaAzul.config.apiBaseUrl + '/api/gedcom-analyzer/metadata',
      function(meta) {
        if (meta && meta.personsCount) {
          updateHeroStat('#stat-persons', meta.personsCount);
        }
        if (meta && meta.azulSurnamesCount) {
          updateHeroStat('#stat-surnames', meta.azulSurnamesCount);
        }
      }
    );

    // Immigrants + countries count from immigration.json
    $.getJSON('/data/immigration.json', function(data) {
      var immigrants = data.reduce(function(acc, r) { return acc + r.count; }, 0);
      var countries  = data.reduce(function(acc, r) { return acc + r.country.split('/').length; }, 0);
      updateHeroStat('#stat-immigrants', immigrants);
      updateHeroStat('#stat-countries', countries);
    }).fail(function() {});
  }

  function updateHeroStat(selector, value) {
    var $el = $(selector);
    if (!$el.length) return;
    $el.attr('data-target', value);
    GeneaAzul.utils.animateCounter($el, value);
  }

  function initNavbarScroll() {
    var $navbar = $('#main-navbar');
    var $toggler = $navbar.find('.navbar-toggler');
    setNavbarHeightVar($navbar);

    var _navHResize;
    $(window).on('resize.navheight', function() {
      clearTimeout(_navHResize);
      _navHResize = setTimeout(function() { setNavbarHeightVar($navbar); }, 100);
    });

    $(window).on('scroll.navbar', function() {
      $navbar.toggleClass('scrolled', window.scrollY > 20);
    });

    $('#navbarContent').on('show.bs.collapse hide.bs.collapse', function(e) {
      $toggler.attr('aria-label', e.type === 'show' ? 'Cerrar menú' : 'Abrir menú');
    });
  }

  function setNavbarHeightVar($navbar) {
    var h = $navbar.outerHeight() || 56;
    document.documentElement.style.setProperty('--ga-navbar-h', h + 'px');
  }

  function initSearchClear() {
    $(document).on('input', '.ga-search-wrap input', function() {
      $(this).closest('.ga-search-wrap').find('.ga-search-clear')
        .toggle($(this).val() !== '');
    });
    $(document).on('click', '.ga-search-clear', function() {
      $(this).closest('.ga-search-wrap').find('input')
        .val('').trigger('input').trigger('focus');
    });
  }

  return { init: init };

})();

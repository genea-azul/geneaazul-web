/* ═══════════════════════════════════════════════════════════════════
   Genea Azul — router.js
   Hash-based SPA routing + lazy loading of page fragments
   ═══════════════════════════════════════════════════════════════════ */
var GeneaAzul = window.GeneaAzul || {};

GeneaAzul.router = (function() {

  var cache = {};
  var currentRoute = null;

  /* Maps hash routes to page file names */
  var routeMap = {
    'inicio':                    null,               // inline in index.html
    'buscar':                    'buscar',
    'conexiones':                'conexiones',
    'estadisticas':              'estadisticas',
    'estadisticas/inmigracion':  'estadisticas-inmigracion',
    'estadisticas/personalidades':'estadisticas-personalidades',
    'estadisticas/apellidos':    'estadisticas-apellidos',
    'mapa':                      'mapa',
    'historias':                 'historias',
    'testimonios':               'testimonios',
    'colabora':                  'colabora',
    'recursos':                  'recursos',
    'sobre-nosotros':            'sobre-nosotros'
  };

  /* Page initializers — called after HTML fragment is injected */
  var initializers = {
    'buscar':                    function() { if (GeneaAzul.search)      GeneaAzul.search.init(); },
    'conexiones':                function() { if (GeneaAzul.connections) GeneaAzul.connections.init(); },
    'estadisticas':              function() { if (GeneaAzul.stats)       GeneaAzul.stats.init(); },
    'estadisticas-inmigracion':  function() { if (GeneaAzul.stats)       GeneaAzul.stats.initImmigration(); },
    'estadisticas-personalidades':function(){ if (GeneaAzul.stats)       GeneaAzul.stats.initPersonalities(); },
    'estadisticas-apellidos':    function() { if (GeneaAzul.stats)       GeneaAzul.stats.initSurnames(); },
    'mapa':                      function() { if (GeneaAzul.map)         GeneaAzul.map.init(); },
    'historias':                 function() { if (GeneaAzul.stories)     GeneaAzul.stories.init(); }
  };

  /* Parse hash → route key (strip leading # and query string) */
  function parseHash(hash) {
    hash = (hash || window.location.hash || '#inicio');
    hash = hash.replace(/^#/, '');
    hash = hash.split('?')[0];
    return hash || 'inicio';
  }

  /* Resolve route key to page file name */
  function getPageFile(routeKey) {
    return routeMap.hasOwnProperty(routeKey) ? routeMap[routeKey] : null;
  }

  /* Show hero, hide page content container */
  function showHero() {
    $('#inicio-section').removeClass('d-none').addClass('ga-page-fade-in');
    $('#page-content').addClass('d-none').empty();
    updateNavActive('inicio');
  }

  /* Hide hero, show and populate page content */
  function showPage($html, pageFile) {
    $('#inicio-section').addClass('d-none');
    var $pc = $('#page-content');
    $pc.removeClass('d-none ga-page-fade-in').empty();
    $pc.html($html);
    // Trigger reflow then fade in
    requestAnimationFrame(function() { $pc.addClass('ga-page-fade-in'); });
    $pc.get(0).scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* Update navbar active link */
  function updateNavActive(routeKey) {
    var $links = $('#main-navbar').find('[data-route]');
    $links.removeClass('active');
    $links.each(function() {
      var r = $(this).attr('data-route');
      if ($(this).hasClass('dropdown-item')) {
        // Exact match only — prevents parent route bleeding into sibling items
        if (r === routeKey) $(this).addClass('active');
      } else {
        // Prefix match for top-level nav links and the dropdown toggle
        if (r === routeKey || routeKey.indexOf(r + '/') === 0) $(this).addClass('active');
      }
    });
  }

  /* Navigate to a given hash */
  function navigate(hash) {
    if (!hash.startsWith('#')) hash = '#' + hash;
    if (window.location.hash !== hash) {
      window.location.hash = hash;
    } else {
      // Same hash — still trigger load (e.g. direct call)
      handleRoute(parseHash(hash));
    }
  }

  /* Core route handler */
  function handleRoute(routeKey) {
    if (routeKey === currentRoute && routeKey !== 'inicio') return; // already showing
    currentRoute = routeKey;

    updateNavActive(routeKey);

    // Close mobile navbar if open
    var bsNavbar = document.getElementById('navbarContent');
    if (bsNavbar && bsNavbar.classList.contains('show')) {
      var bsCollapse = bootstrap.Collapse.getInstance(bsNavbar);
      if (bsCollapse) bsCollapse.hide();
    }

    /* Story detail: #historias/slug — must be checked before the routeMap fallback */
    if (routeKey.startsWith('historias/')) {
      var slug = routeKey.replace('historias/', '');
      $('#inicio-section').addClass('d-none');
      var $pc = $('#page-content').removeClass('d-none');
      if (GeneaAzul.stories) {
        GeneaAzul.stories.loadStory(slug, $pc);
      }
      return;
    }

    /* Inicio or unknown route: show hero */
    if (routeKey === 'inicio' || !routeMap.hasOwnProperty(routeKey)) {
      showHero();
      return;
    }

    var pageFile = getPageFile(routeKey);
    if (!pageFile) { showHero(); return; }

    /* Use cache if available */
    if (cache[pageFile]) {
      showPage(cache[pageFile].clone(true), pageFile);
      if (initializers[pageFile]) initializers[pageFile]();
      return;
    }

    /* Show loading state */
    $('#inicio-section').addClass('d-none');
    var $pc = $('#page-content').removeClass('d-none');
    $pc.html('<div class="ga-page-loading"><div class="spinner-border spinner-border-sm" role="status"></div><span>Cargando...</span></div>');

    /* Fetch fragment */
    $.ajax({
      url: 'pages/' + pageFile + '.html',
      method: 'GET',
      success: function(html) {
        var $fragment = $(html);
        cache[pageFile] = $fragment.clone(true);
        showPage($fragment, pageFile);
        if (initializers[pageFile]) initializers[pageFile]();
      },
      error: function() {
        $pc.html('<div class="container py-5 text-center"><p class="text-muted">No se pudo cargar la página. Intentá de nuevo.</p></div>');
      }
    });
  }

  /* Bootstrap the router */
  function init() {
    // Handle nav link clicks that have data-route
    $(document).on('click', '[data-route]', function(e) {
      // Let Bootstrap handle dropdown toggles — don't navigate on toggle click
      if ($(this).attr('data-bs-toggle') === 'dropdown') return;
      var route = $(this).attr('data-route');
      if (!route) return;
      // Allow default anchor href to update the hash naturally, only intercept
      // if the click would navigate to a same-page hash
      var href = $(this).attr('href') || '';
      if (href.startsWith('#')) {
        e.preventDefault();
        navigate(href);
      }
    });

    // hashchange event
    $(window).on('hashchange', function() {
      handleRoute(parseHash(window.location.hash));
    });

    // Initial route on page load
    handleRoute(parseHash(window.location.hash));
  }

  return { init, navigate, parseHash };

})();

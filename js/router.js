/* ═══════════════════════════════════════════════════════════════════
   Genea Azul — router.js
   History API SPA routing + lazy loading of page fragments
   ═══════════════════════════════════════════════════════════════════ */
var GeneaAzul = window.GeneaAzul || {};

GeneaAzul.router = (function() {

  var cache = {};
  var currentRoute = null;

  /* Maps route keys to page file names */
  var routeMap = {
    'inicio':                      'inicio',
    'buscar':                      'buscar',
    'conexiones':                  'conexiones',
    'estadisticas':                'estadisticas',
    'estadisticas/inmigracion':    'estadisticas-inmigracion',
    'estadisticas/personalidades': 'estadisticas-personalidades',
    'estadisticas/apellidos':      'estadisticas-apellidos',
    'mapa':                        'mapa',
    'historias':                   'historias',
    'testimonios':                 'testimonios',
    'colabora':                    'colabora',
    'recursos':                    'recursos',
    'cronologia':                  'cronologia',
    'sobre-nosotros':              'sobre-nosotros'
  };

  /* Per-route title + description for SEO */
  var routeMeta = {
    'inicio':                      { title: 'Genea Azul \u2014 Genealog\u00eda azule\u00f1a',     desc: 'Investigaci\u00f3n geneal\u00f3gica comunitaria del partido de Azul, Argentina. Busc\u00e1 tu familia, descubr\u00ed tu historia.' },
    'buscar':                      { title: 'Buscar personas \u2014 Genea Azul',                  desc: 'Busc\u00e1 personas en la base geneal\u00f3gica azule\u00f1a. Encontr\u00e1 familiares y antepasados del partido de Azul.' },
    'conexiones':                  { title: 'Conexiones entre personas \u2014 Genea Azul',        desc: 'Descubr\u00ed c\u00f3mo dos personas est\u00e1n emparentadas en el \u00e1rbol geneal\u00f3gico de Azul.' },
    'estadisticas':                { title: 'Estad\u00edsticas del \u00e1rbol \u2014 Genea Azul', desc: 'Estad\u00edsticas geneal\u00f3gicas del partido de Azul: personas, familias, apellidos e inmigraci\u00f3n.' },
    'estadisticas/inmigracion':    { title: 'Inmigraci\u00f3n en Azul \u2014 Genea Azul',         desc: 'Oleadas inmigratorias que llegaron al partido de Azul, Buenos Aires, Argentina.' },
    'estadisticas/personalidades': { title: 'Personalidades destacadas \u2014 Genea Azul',        desc: 'Personas distinguidas nacidas o relacionadas con el partido de Azul.' },
    'estadisticas/apellidos':      { title: 'Apellidos frecuentes \u2014 Genea Azul',             desc: 'Apellidos m\u00e1s frecuentes en el partido de Azul seg\u00fan la base geneal\u00f3gica.' },
    'mapa':                        { title: 'Mapa migratorio \u2014 Genea Azul',                  desc: 'Mapa interactivo de los pa\u00edses de origen de las familias que llegaron al partido de Azul.' },
    'historias':                   { title: 'Historias de familia \u2014 Genea Azul',             desc: 'Relatos sobre familias y personajes del partido de Azul escritos por la comunidad.' },
    'testimonios':                 { title: 'Testimonios \u2014 Genea Azul',                      desc: 'Testimonios de personas que encontraron su historia con Genea Azul.' },
    'colabora':                    { title: 'Colabor\u00e1 \u2014 Genea Azul',                    desc: 'C\u00f3mo colaborar con el proyecto geneal\u00f3gico comunitario Genea Azul.' },
    'recursos':                    { title: 'Recursos geneal\u00f3gicos \u2014 Genea Azul',       desc: 'Recursos geneal\u00f3gicos \u00fatiles para investigar familias del partido de Azul.' },
    'cronologia':                  { title: 'Cronolog\u00eda de Azul \u2014 Genea Azul',          desc: 'L\u00ednea de tiempo hist\u00f3rica del partido de Azul: eventos, genealog\u00eda y curiosidades.' },
    'sobre-nosotros':              { title: 'Sobre nosotros \u2014 Genea Azul',                   desc: 'Conoc\u00e9 al equipo detr\u00e1s de Genea Azul, el proyecto geneal\u00f3gico comunitario de Azul.' }
  };

  /* Page initializers — called after HTML fragment is injected */
  var initializers = {
    'inicio':                      function() {
      if (GeneaAzul.app)         GeneaAzul.app.initHome();
      if (GeneaAzul.birthdays)   GeneaAzul.birthdays.init();
      if (GeneaAzul.ephemerides) GeneaAzul.ephemerides.init();
    },
    'buscar':                      function() { if (GeneaAzul.search)      GeneaAzul.search.init(); },
    'conexiones':                  function() { if (GeneaAzul.connections) GeneaAzul.connections.init(); },
    'estadisticas':                function() { if (GeneaAzul.stats)       GeneaAzul.stats.init(); },
    'estadisticas-inmigracion':    function() { if (GeneaAzul.stats)       GeneaAzul.stats.initImmigration(); },
    'estadisticas-personalidades': function() { if (GeneaAzul.stats)       GeneaAzul.stats.initPersonalities(); },
    'estadisticas-apellidos':      function() { if (GeneaAzul.stats)       GeneaAzul.stats.initSurnames(); },
    'mapa':                        function() { if (GeneaAzul.map)         GeneaAzul.map.init(); },
    'historias':                   function() { if (GeneaAzul.stories)     GeneaAzul.stories.init(); },
    'cronologia':                  function() { if (GeneaAzul.cronologia)  GeneaAzul.cronologia.init(); }
  };

  /* Fire a GA4 page_view event for the current route */
  function trackPageView(routeKey) {
    if (typeof gtag !== 'function') return;
    var base = routeKey.indexOf('historias/') === 0 ? 'historias' : routeKey;
    var meta = routeMeta[base] || routeMeta['inicio'];
    gtag('event', 'page_view', {
      page_title: meta.title,
      page_path: routeKey === 'inicio' ? '/' : '/' + routeKey
    });
  }

  /* Update document title, meta tags, canonical URL, and og:url */
  function updatePageMeta(routeKey) {
    var base = routeKey.indexOf('historias/') === 0 ? 'historias' : routeKey;
    var meta = routeMeta[base] || routeMeta['inicio'];
    document.title = meta.title;
    $('meta[name="description"]').attr('content', meta.desc);
    $('meta[property="og:title"]').attr('content', meta.title);
    $('meta[property="og:description"]').attr('content', meta.desc);
    $('meta[name="twitter:title"]').attr('content', meta.title);
    $('meta[name="twitter:description"]').attr('content', meta.desc);
    var canonicalUrl = 'https://geneaazul.com.ar' + (routeKey === 'inicio' ? '/' : '/' + routeKey);
    $('link[rel="canonical"]').attr('href', canonicalUrl);
    $('meta[property="og:url"]').attr('content', canonicalUrl);
  }

  /* Parse pathname → route key */
  function parsePath(path) {
    path = (path || window.location.pathname).replace(/^\//, '').replace(/\/$/, '');
    return path || 'inicio';
  }

  /* Resolve route key to page file name */
  function getPageFile(routeKey) {
    return routeMap.hasOwnProperty(routeKey) ? routeMap[routeKey] : null;
  }

  /* Show page content in #page-content */
  function showPage($html) {
    var $pc = $('#page-content');
    $pc.removeClass('ga-page-fade-in').empty();
    $pc.html($html);
    requestAnimationFrame(function() { $pc.addClass('ga-page-fade-in'); });
    if (!window.location.hash) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  /* Scroll to the #hash anchor after fragment injection */
  function scrollToHash() {
    var hash = window.location.hash;
    if (!hash) return;
    requestAnimationFrame(function() {
      var el = document.getElementById(hash.slice(1));
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    });
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

  /* Navigate to a route key */
  function navigate(routeKey) {
    routeKey = (routeKey || '').replace(/^[#/]+/, '');
    var path = routeKey === 'inicio' || routeKey === '' ? '/' : '/' + routeKey;
    if (window.location.pathname !== path) {
      history.pushState(null, '', path);
    }
    handleRoute(routeKey || 'inicio');
  }

  /* Core route handler */
  function handleRoute(routeKey) {
    // estadisticas re-runs on every visit (tab switches re-initialise charts); story slugs
    // re-run so popstate/refresh on a story detail doesn't leave #page-content empty.
    var reRunRoutes = ['estadisticas'];
    if (routeKey === currentRoute && reRunRoutes.indexOf(routeKey) === -1 && routeKey.indexOf('historias/') !== 0) return;
    currentRoute = routeKey;

    updatePageMeta(routeKey);
    trackPageView(routeKey);
    updateNavActive(routeKey);

    // Close mobile navbar if open
    var bsNavbar = document.getElementById('navbarContent');
    if (bsNavbar && bsNavbar.classList.contains('show')) {
      var bsCollapse = bootstrap.Collapse.getInstance(bsNavbar);
      if (bsCollapse) bsCollapse.hide();
    }

    /* Unknown route: redirect to home */
    if (!routeMap.hasOwnProperty(routeKey) && routeKey.indexOf('historias/') !== 0) {
      navigate('inicio');
      return;
    }

    /* Story detail: historias/slug — must be checked before the routeMap fallback */
    if (routeKey.indexOf('historias/') === 0) {
      var slug = routeKey.substring('historias/'.length);
      var $pc = $('#page-content').empty();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      if (GeneaAzul.stories) {
        GeneaAzul.stories.loadStory(slug, $pc);
      }
      return;
    }

    var pageFile = getPageFile(routeKey);

    /* Use cache if available */
    if (cache[pageFile]) {
      showPage(cache[pageFile].clone(true));
      if (initializers[pageFile]) initializers[pageFile]();
      scrollToHash();
      return;
    }

    /* Show loading state */
    var $pc = $('#page-content');
    $pc.html('<div class="ga-page-loading"><div class="spinner-border spinner-border-sm" role="status"></div><span>Cargando...</span></div>');

    /* Fetch fragment — absolute path so it works from any route depth */
    $.ajax({
      url: '/pages/' + pageFile + '.html',
      method: 'GET',
      success: function(html) {
        var $fragment = $(html);
        cache[pageFile] = $fragment.clone(true);
        showPage($fragment);
        if (initializers[pageFile]) initializers[pageFile]();
        scrollToHash();
      },
      error: function() {
        $pc.html('<div class="container py-5 text-center"><p class="text-muted">No se pudo cargar la página. Intentá de nuevo.</p></div>');
      }
    });
  }

  /* Bootstrap the router */
  function init() {
    // Handle nav and content link clicks
    $(document).on('click', '[data-route]', function(e) {
      // Let Bootstrap handle dropdown toggles — don't navigate on toggle click
      if ($(this).attr('data-bs-toggle') === 'dropdown') return;
      var route = $(this).attr('data-route');
      if (!route) return;
      e.preventDefault();
      navigate(route);
    });

    // Auto-expand estadísticas dropdown on mobile when on a sub-route.
    // Uses 'shown' (post-animation) so it runs after Bootstrap's _clearMenus,
    // which fires on the same hamburger-tap click and would otherwise remove 'show'.
    $('#navbarContent').on('shown.bs.collapse', function() {
      if (currentRoute && currentRoute.indexOf('estadisticas') === 0) {
        var $li = $('#main-navbar .nav-item.dropdown');
        $li.addClass('show');
        $li.find('.dropdown-toggle').addClass('show').attr('aria-expanded', 'true');
        $li.find('.dropdown-menu').addClass('show');
      }
    });

    // Browser back/forward navigation
    $(window).on('popstate', function() {
      handleRoute(parsePath(window.location.pathname));
    });

    // Initial route on page load
    handleRoute(parsePath(window.location.pathname));
  }

  return { init: init, navigate: navigate, parsePath: parsePath };

})();

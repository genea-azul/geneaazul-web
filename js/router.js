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
    'inicio':                      null,               // inline in index.html
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
    'inicio':                      { title: 'Genea Azul \u2014 Genealog\u00eda azule\u00f1a', desc: 'Investigaci\u00f3n geneal\u00f3gica comunitaria del partido de Azul, Argentina. Busc\u00e1 tu familia, descubr\u00ed tu historia.' },
    'buscar':                      { title: 'Buscar familia \u2014 Genea Azul',               desc: 'Busc\u00e1 personas en la base geneal\u00f3gica azule\u00f1a. Encontr\u00e1 familiares y antepasados del partido de Azul.' },
    'conexiones':                  { title: 'Conexiones familiares \u2014 Genea Azul',        desc: 'Descubr\u00ed c\u00f3mo dos personas est\u00e1n emparentadas en el \u00e1rbol geneal\u00f3gico de Azul.' },
    'estadisticas':                { title: 'Estad\u00edsticas \u2014 Genea Azul',            desc: 'Estad\u00edsticas geneal\u00f3gicas del partido de Azul: personas, familias, apellidos e inmigraci\u00f3n.' },
    'estadisticas/inmigracion':    { title: 'Inmigraci\u00f3n \u2014 Genea Azul',             desc: 'Oleadas inmigratorias que llegaron al partido de Azul, Buenos Aires, Argentina.' },
    'estadisticas/personalidades': { title: 'Personalidades \u2014 Genea Azul',               desc: 'Personas distinguidas nacidas o relacionadas con el partido de Azul.' },
    'estadisticas/apellidos':      { title: 'Apellidos \u2014 Genea Azul',                    desc: 'Apellidos m\u00e1s frecuentes en el partido de Azul seg\u00fan la base geneal\u00f3gica.' },
    'mapa':                        { title: 'Mapa de or\u00edgenes \u2014 Genea Azul',        desc: 'Mapa interactivo de los pa\u00edses de origen de las familias que llegaron al partido de Azul.' },
    'historias':                   { title: 'Historias de familia \u2014 Genea Azul',         desc: 'Relatos sobre familias y personajes del partido de Azul escritos por la comunidad.' },
    'testimonios':                 { title: 'Testimonios \u2014 Genea Azul',                  desc: 'Testimonios de personas que encontraron su historia con Genea Azul.' },
    'colabora':                    { title: 'Colabor\u00e1 \u2014 Genea Azul',                desc: 'C\u00f3mo colaborar con el proyecto geneal\u00f3gico comunitario Genea Azul.' },
    'recursos':                    { title: 'Recursos \u2014 Genea Azul',                     desc: 'Recursos geneal\u00f3gicos \u00fatiles para investigar familias del partido de Azul.' },
    'cronologia':                  { title: 'Cronolog\u00eda \u2014 Genea Azul',              desc: 'L\u00ednea de tiempo hist\u00f3rica del partido de Azul: eventos, genealog\u00eda y curiosidades.' },
    'sobre-nosotros':              { title: 'Sobre nosotros \u2014 Genea Azul',               desc: 'Conoc\u00e9 al equipo detr\u00e1s de Genea Azul, el proyecto geneal\u00f3gico comunitario de Azul.' }
  };

  /* Page initializers — called after HTML fragment is injected */
  var initializers = {
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
      page_path: '/#' + routeKey
    });
  }

  /* Update document title and meta tags for the current route */
  function updatePageMeta(routeKey) {
    var base = routeKey.indexOf('historias/') === 0 ? 'historias' : routeKey;
    var meta = routeMeta[base] || routeMeta['inicio'];
    document.title = meta.title;
    $('meta[name="description"]').attr('content', meta.desc);
    $('meta[property="og:title"]').attr('content', meta.title);
    $('meta[property="og:description"]').attr('content', meta.desc);
    $('meta[name="twitter:title"]').attr('content', meta.title);
    $('meta[name="twitter:description"]').attr('content', meta.desc);
  }

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
    GeneaAzul.utils.animateCounters($('#hero-stats'));
  }

  /* Hide hero, show and populate page content */
  function showPage($html, pageFile) {
    $('#inicio-section').addClass('d-none');
    var $pc = $('#page-content');
    $pc.removeClass('d-none ga-page-fade-in').empty();
    $pc.html($html);
    // Trigger reflow then fade in
    requestAnimationFrame(function() { $pc.addClass('ga-page-fade-in'); });
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
    if (hash.indexOf('#') !== 0) hash = '#' + hash;
    if (window.location.hash !== hash) {
      window.location.hash = hash;
    } else {
      // Same hash — still trigger load (e.g. direct call)
      handleRoute(parseHash(hash));
    }
  }

  /* Core route handler */
  function handleRoute(routeKey) {
    var reRunRoutes = ['inicio', 'estadisticas'];
    if (routeKey === currentRoute && reRunRoutes.indexOf(routeKey) === -1) return; // already showing
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

    /* Story detail: #historias/slug — must be checked before the routeMap fallback */
    if (routeKey.indexOf('historias/') === 0) {
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
      if (href.indexOf('#') === 0) {
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

  return { init: init, navigate: navigate, parseHash: parseHash };

})();

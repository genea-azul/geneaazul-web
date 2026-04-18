/* ═══════════════════════════════════════════════════════════════════
   Genea Azul — stories.js
   Family stories page logic (Markdown rendering)
   ═══════════════════════════════════════════════════════════════════ */
var GeneaAzul = window.GeneaAzul || {};

GeneaAzul.stories = (function() {

  var _index = null;

  function loadIndex(cb) {
    if (_index) { cb(_index); return; }
    $.getJSON('stories/index.json', function(data) {
      _index = data;
      cb(data);
    }).fail(function() { cb([]); });
  }

  /* ── Init: show index listing ──────────────────────────────────── */
  function init() {
    $('#historias-index').removeClass('d-none');
    $('#historias-story').addClass('d-none');

    loadIndex(function(stories) {
      renderIndex(stories);
    });

    $(document).off('click.stories', '#stories-back-btn')
      .on('click.stories', '#stories-back-btn', function() {
        GeneaAzul.router.navigate('#historias');
      });
  }

  function renderIndex(stories) {
    var $el = $('#stories-list').empty();
    if (!stories || stories.length === 0) {
      $el.html('<div class="col"><p class="text-muted">No hay historias publicadas aún. <a href="#colabora" data-route="colabora">¿Querés escribir una?</a></p></div>');
      return;
    }

    stories.forEach(function(story) {
      var date = story.date ? new Date(story.date + 'T00:00:00').toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: 'long', day: 'numeric' }) : '';
      var $card = $('<div>').addClass('col-md-6 col-lg-4')
        .append(
          $('<article>').addClass('ga-highlight-card h-100')
            .append($('<a>')
              .addClass('ga-highlight-header d-block text-decoration-none')
              .attr('href', '#historias/' + story.slug)
              .attr('data-route-story', story.slug)
              .html('<i class="bi bi-book me-2"></i>' + GeneaAzul.utils.escHtml(story.title))
            )
            .append($('<div>').addClass('ga-highlight-body').text(story.excerpt || ''))
            .append($('<div>').addClass('d-flex justify-content-between align-items-center mt-2')
              .append($('<small>').addClass('text-muted').html(
                (story.author ? '<i class="bi bi-person me-1"></i>' + GeneaAzul.utils.escHtml(story.author) : '')
                + (date ? ' &middot; ' + date : '')
              ))
              .append($('<a>')
                .addClass('ga-highlight-link small')
                .attr('href', '#historias/' + story.slug)
                .attr('data-route-story', story.slug)
                .html('Leer <i class="bi bi-arrow-right ms-1"></i>'))
            )
        );
      $el.append($card);
    });

    // Wire story link clicks
    $el.on('click', '[data-route-story]', function(e) {
      e.preventDefault();
      var slug = $(this).attr('data-route-story');
      GeneaAzul.router.navigate('#historias/' + slug);
    });
  }

  /* ── Load individual story ─────────────────────────────────────── */
  function loadStory(slug, $container) {
    if (!/^[a-z0-9-]+$/.test(slug)) {
      $container.html('<div class="container py-5 text-center"><p class="text-muted">Historia no encontrada.</p>'
        + '<a href="#historias" data-route="historias" class="btn btn-outline-secondary mt-2">'
        + '<i class="bi bi-arrow-left me-1"></i>Volver</a></div>');
      return;
    }

    loadIndex(function(stories) {
      var valid = stories.some(function(s) { return s.slug === slug; });
      if (!valid) {
        $container.html('<div class="container py-5 text-center"><p class="text-muted">Historia no encontrada.</p>'
          + '<a href="#historias" data-route="historias" class="btn btn-outline-secondary mt-2">'
          + '<i class="bi bi-arrow-left me-1"></i>Volver</a></div>');
        return;
      }
      fetchStory(slug, $container);
    });
  }

  function fetchStory(slug, $container) {
    $container.html('<div class="ga-page-loading py-5"><div class="spinner-border spinner-border-sm" role="status"></div><span>Cargando historia...</span></div>');

    $.ajax({
      url: 'stories/' + slug + '.md',
      method: 'GET',
      success: function(markdown) {
        var sanitized = DOMPurify.sanitize(marked.parse(markdown));
        var html = sanitized;
        $container.html(
          '<section class="ga-section container-xl">'
          + '<div class="row justify-content-center"><div class="col-lg-9 col-xl-8">'
          + '<div class="mb-3"><button class="btn btn-sm btn-outline-secondary" id="stories-back-btn2">'
          + '<i class="bi bi-arrow-left me-1"></i>Volver a historias</button></div>'
          + '<article class="ga-story-article">' + html + '</article>'
          + '</div></div></section>'
        );

        $container.off('click.stories-back2', '#stories-back-btn2')
          .on('click.stories-back2', '#stories-back-btn2', function() {
            GeneaAzul.router.navigate('#historias');
          });
      },
      error: function() {
        $container.html(
          '<div class="container py-5 text-center">'
          + '<p class="text-muted">No se pudo cargar la historia.</p>'
          + '<a href="#historias" data-route="historias" class="btn btn-outline-secondary mt-2">'
          + '<i class="bi bi-arrow-left me-1"></i>Volver</a>'
          + '</div>'
        );
      }
    });
  }

  return { init: init, loadStory: loadStory };

})();

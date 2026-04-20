/* ═══════════════════════════════════════════════════════════════════
   Genea Azul — cronologia.js
   Timeline page: renders data/timeline.json into a vertical timeline
   ═══════════════════════════════════════════════════════════════════ */
var GeneaAzul = window.GeneaAzul || {};

GeneaAzul.cronologia = (function() {

  var utils;
  var _data = null;
  var _activeFilter = 'all';

  var MONTH_NAMES = ['ene','feb','mar','abr','may','jun',
                     'jul','ago','sep','oct','nov','dic'];

  var TYPE_ICONS = {
    historia:     'bi-book',
    genealogia:   'bi-diagram-3',
    curiosidades: 'bi-patch-question'
  };

  function init() {
    utils = GeneaAzul.utils;
    if (_data) { renderTimeline(_data); return; }

    var $container = $('#cronologia-timeline');
    $container.html(utils.spinnerHtml('Cargando cronolog\u00eda\u2026'));

    $.getJSON('/data/timeline.json', function(entries) {
      _data = entries;
      renderTimeline(entries);
    }).fail(function() {
      $container.html('<p class="text-muted text-center">No se pudo cargar la cronolog\u00eda.</p>');
    });
  }

  function renderTimeline(entries) {
    _activeFilter = 'all';
    $('#cronologia-search').val('');
    var $container = $('#cronologia-timeline');
    $container.empty();
    if (!entries || entries.length === 0) {
      $container.html('<p class="text-muted text-center">No hay entradas disponibles.</p>');
      return;
    }
    var $list = $('<div>').addClass('ga-tl-list');
    var lastYear = null;
    entries.forEach(function(entry) {
      if (entry.year !== lastYear) {
        $list.append(buildYearHeader(entry.year));
        lastYear = entry.year;
      }
      $list.append(buildEntry(entry));
    });
    $container.append($list);
    initFilterTabs($list);
    scrollToHashIfAny();
  }

  function buildYearHeader(year) {
    var $header = $('<div>').addClass('ga-tl-year-header');
    if (year === null) {
      $header.text('Y a\u00fan m\u00e1s\u2026');
      return $header;
    }
    var anchorId = 'ano-' + year;
    $header.addClass('ga-anchor-section').attr('id', anchorId);
    $header.append(document.createTextNode(year));
    $header.append(
      $('<a>').addClass('ga-anchor-link ms-2')
        .attr({ href: '#' + anchorId, 'aria-label': 'Enlace directo' })
        .append($('<i>').addClass('bi bi-link-45deg'))
    );
    return $header;
  }

  function scrollToHashIfAny() {
    var hash = window.location.hash;
    if (!hash) return;
    var m = hash.match(/^#ano-(\d+)$/);
    if (!m) return;
    var el = document.getElementById('ano-' + m[1]);
    if (!el) return;
    setTimeout(function() {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }

  function formatDate(entry) {
    if (!entry.month) return entry.year !== null ? String(entry.year) : '';
    var month = MONTH_NAMES[entry.month - 1] || String(entry.month);
    if (!entry.day) return month + ' ' + entry.year;
    return entry.day + ' ' + month + ' ' + entry.year;
  }

  function buildEntry(entry) {
    var $entry = $('<div>').addClass('ga-tl-entry')
      .attr('data-type', entry.type)
      .attr('data-title', entry.title || '');

    var $dotWrap = $('<div>').addClass('ga-tl-dot-wrap');
    var dotType = entry.type || 'historia';
    var $dot = $('<div>').addClass('ga-tl-dot ga-tl-dot-' + dotType);
    $dotWrap.append($dot);

    var $content = $('<div>').addClass('ga-tl-content');
    $content.append($('<div>').addClass('ga-tl-meta d-none').text(formatDate(entry)));

    var $card = $('<div>').addClass('ga-tl-card ga-tl-card-' + dotType);

    if (entry.imageUrl) {
      $card.append(
        $('<img>').addClass('ga-tl-img')
          .attr({ src: entry.imageUrl, alt: '', 'aria-hidden': 'true' })
      );
    }

    var $titleRow = $('<div>').addClass('ga-tl-title');
    $titleRow.append($('<i>').addClass('bi ' + (TYPE_ICONS[dotType] || 'bi-clock-history')));
    $titleRow.append($('<span>').text(entry.title));
    $card.append($titleRow);
    var bodyHtml = DOMPurify.sanitize(marked.parseInline(entry.body || ''));
    $card.append($('<div>').addClass('ga-tl-body').html(bodyHtml));

    if (entry.sourceUrl && entry.sourceUrl.indexOf('http') === 0) {
      $card.append(
        $('<a>').addClass('ga-tl-source-link')
          .attr({ href: entry.sourceUrl, target: '_blank', rel: 'noopener' })
          .text(entry.source || 'Fuente')
      );
    } else if (entry.source) {
      $card.append($('<div>').addClass('ga-tl-source-text').text(entry.source));
    }

    if (entry.storySlug) {
      $card.append(
        $('<a>').addClass('ga-tl-story-link')
          .attr('href', '/historias/' + entry.storySlug)
          .attr('data-route', 'historias/' + entry.storySlug)
          .text('\u2192 Leer historia')
      );
    }

    $content.append($card);
    $entry.append($dotWrap).append($content);
    return $entry;
  }

  function applyFilters($list) {
    var query = utils.normalize($('#cronologia-search').val());
    $list.find('.ga-tl-entry').each(function() {
      var $e = $(this);
      var typeOk  = _activeFilter === 'all' || $e.attr('data-type') === _activeFilter;
      var titleOk = query.length === 0 || utils.normalize($e.attr('data-title')).indexOf(query) !== -1;
      $e.toggleClass('d-none', !(typeOk && titleOk));
    });
    updateYearHeaders($list);
  }

  function updateYearHeaders($list) {
    $list.find('.ga-tl-year-header').each(function() {
      var $h = $(this);
      var $entries = $h.nextUntil('.ga-tl-year-header', '.ga-tl-entry');
      $h.toggleClass('d-none', $entries.not('.d-none').length === 0);
    });
  }

  function initFilterTabs($list) {
    var $section = $('#cronologia-section');
    $(document).off('click.cronologia', '.ga-tl-filter-btn')
      .on('click.cronologia', '.ga-tl-filter-btn', function() {
        _activeFilter = $(this).data('filter');
        $section.find('.ga-tl-filter-btn').removeClass('active');
        $(this).addClass('active');
        applyFilters($list);
      });
    $(document).off('input.cronologia', '#cronologia-search')
      .on('input.cronologia', '#cronologia-search', function() {
        applyFilters($list);
      });
  }

  return { init: init };

})();

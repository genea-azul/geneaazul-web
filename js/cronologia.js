/* ═══════════════════════════════════════════════════════════════════
   Genea Azul — cronologia.js
   Timeline page: renders data/timeline.json into a vertical timeline
   ═══════════════════════════════════════════════════════════════════ */
var GeneaAzul = window.GeneaAzul || {};

GeneaAzul.cronologia = (function() {

  var utils;
  var _data = null;

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

    $.getJSON('data/timeline.json', function(entries) {
      _data = entries;
      renderTimeline(entries);
    }).fail(function() {
      $container.html('<p class="text-muted text-center">No se pudo cargar la cronolog\u00eda.</p>');
    });
  }

  function renderTimeline(entries) {
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
        $list.append(
          $('<div>').addClass('ga-tl-year-header').text(entry.year !== null ? entry.year : 'Y a\u00fan m\u00e1s\u2026')
        );
        lastYear = entry.year;
      }
      $list.append(buildEntry(entry));
    });
    $container.append($list);
    initFilterTabs($list);
  }

  function formatDate(entry) {
    if (!entry.month) return entry.year !== null ? String(entry.year) : '';
    var month = MONTH_NAMES[entry.month - 1] || String(entry.month);
    if (!entry.day) return month + ' ' + entry.year;
    return entry.day + ' ' + month + ' ' + entry.year;
  }

  function buildEntry(entry) {
    var $entry = $('<div>').addClass('ga-tl-entry').attr('data-type', entry.type);

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
          .attr('href', '#historias/' + entry.storySlug)
          .text('\u2192 Leer historia')
      );
    }

    $content.append($card);
    $entry.append($dotWrap).append($content);
    return $entry;
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
        var filter = $(this).data('filter');
        $section.find('.ga-tl-filter-btn').removeClass('active');
        $(this).addClass('active');
        if (filter === 'all') {
          $section.find('.ga-tl-entry').removeClass('d-none');
        } else {
          $section.find('.ga-tl-entry').addClass('d-none');
          $section.find('.ga-tl-entry[data-type="' + filter + '"]').removeClass('d-none');
        }
        updateYearHeaders($list);
      });
  }

  return { init: init };

})();

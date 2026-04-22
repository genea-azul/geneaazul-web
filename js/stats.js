/* ═══════════════════════════════════════════════════════════════════
   Genea Azul — stats.js
   Statistics pages logic: summary, immigration, personalities, surnames
   ═══════════════════════════════════════════════════════════════════ */
var GeneaAzul = window.GeneaAzul || {};

GeneaAzul.stats = (function() {

  var utils, cfg;
  var _immigration = null;
  var _personalities = null;
  var _surnames = null;
  var _activeLabelFilter = 'all';

  var LABEL_TEXT = {
    'intendente-azul':      'Intendente de Azul',
    'presidente-argentina': 'Presidente de Arg.',
    'gobernador':           'Gobernador',
    'militar':              'Militar',
    'politico':             'Político',
    'artista':              'Artista',
    'docente':              'Docente',
    'deportista':           'Deportista',
    'medico':               'Médico',
    'cientifico':           'Científico',
    'ingeniero':            'Ingeniero',
    'religioso':            'Religioso',
    'historiador':          'Historiador',
    'pueblo-originario':    'Pueblo Originario',
    'empresario':           'Empresario',
    'esclavo-liberto':      'Esclavo / Liberto',
    'fundador-azul':        'Fundador de Azul'
  };

  function ready() { utils = GeneaAzul.utils; cfg = GeneaAzul.config; }

  /* ── Immigration data ──────────────────────────────────────────── */
  function loadImmigration(cb) {
    if (_immigration) { cb(_immigration); return; }
    $.getJSON('/data/immigration.json', function(data) {
      _immigration = data;
      cb(data);
    }).fail(function() { cb([]); });
  }

  /* ── Personalities data ─────────────────────────────────────────── */
  function loadPersonalities(cb) {
    if (_personalities) { cb(_personalities); return; }
    $.getJSON('/data/personalities.json', function(data) {
      _personalities = data;
      cb(data);
    }).fail(function() { cb([]); });
  }

  /* ── Surnames data ──────────────────────────────────────────────── */
  function loadSurnames(cb) {
    if (_surnames) { cb(_surnames); return; }
    $.getJSON('/data/surnames.json', function(data) {
      _surnames = data;
      cb(data);
    }).fail(function() { cb([]); });
  }

  /* ── Percentage formatter ───────────────────────────────────────── */
  function formatPct(count, total) {
    if (!total) return '';
    return '(' + ((count / total) * 100).toFixed(1) + '%)';
  }

  /* ═══ SUMMARY PAGE ══════════════════════════════════════════════ */
  function init() {
    ready();

    // Load live stats from API
    utils.apiGetCached(
      cfg.apiBaseUrl + '/api/gedcom-analyzer/metadata',
      function(meta) {
        var persons = meta.personsCount;
        var azulPersons = meta.azulPersonsCount;

        // General
        if (persons)               utils.animateCounter($('#st-persons'),    persons);
        if (meta.familiesCount)    utils.animateCounter($('#st-families'),   meta.familiesCount);

        if (meta.maleCount != null) {
          utils.animateCounter($('#st-hombres'), meta.maleCount);
          $('#st-hombres-pct').text(formatPct(meta.maleCount, persons));
        }
        if (meta.femaleCount != null) {
          utils.animateCounter($('#st-mujeres'), meta.femaleCount);
          $('#st-mujeres-pct').text(formatPct(meta.femaleCount, persons));
        }
        if (meta.deceasedCount != null) {
          utils.animateCounter($('#st-fallecidas'), meta.deceasedCount);
          $('#st-fallecidas-pct').text(formatPct(meta.deceasedCount, persons));
        }
        if (meta.aliveCount != null) {
          utils.animateCounter($('#st-vivas'), meta.aliveCount);
          $('#st-vivas-pct').text(formatPct(meta.aliveCount, persons));
        }
        if (meta.distinguishedCount != null)
          utils.animateCounter($('#st-personalities'), meta.distinguishedCount);

        // Azul-specific
        if (azulPersons != null) {
          utils.animateCounter($('#st-azulenos'), azulPersons);
          $('#st-azulenos-pct').text(formatPct(azulPersons, persons));
        }
        if (meta.azulAliveCount != null) {
          utils.animateCounter($('#st-azulenos-vivos'), meta.azulAliveCount);
          $('#st-azulenos-vivos-pct').text(formatPct(meta.azulAliveCount, azulPersons));
        }
        if (meta.azulMayorsCount != null)
          utils.animateCounter($('#st-jefes'),        meta.azulMayorsCount);
        if (meta.azulDisappearedCount != null)
          utils.animateCounter($('#st-desaparecidos'), meta.azulDisappearedCount);
        if (meta.azulSurnamesCount != null)
          utils.animateCounter($('#st-surnames'), meta.azulSurnamesCount);
      }
    );

    // Load immigration preview (top 5) + immigrants + countries count cards
    loadImmigration(function(data) {
      var total = data.reduce(function(acc, r) { return acc + r.count; }, 0);
      var countries = data.reduce(function(acc, r) { return acc + r.country.split('/').length; }, 0);
      utils.animateCounter($('#st-immigrants'), total);
      utils.animateCounter($('#st-countries'),  countries);
      renderImmigrationPreview(data.slice(0, 5), '#stats-immigration-preview');
    });

    // Personalities preview (7 random) — list still comes from JSON
    loadPersonalities(function(data) {
      var shuffled = data.slice().sort(function() { return Math.random() - 0.5; });
      renderPersonalitiesPreview(shuffled.slice(0, 7), '#stats-personalities-preview');
      initTooltips($('#stats-personalities-preview'));
    });
  }

  function renderImmigrationPreview(data, selector) {
    var $el = $(selector).empty();
    if (!data || data.length === 0) { $el.html('<p class="text-muted small">Sin datos.</p>'); return; }
    data.forEach(function(row) {
      var pct = row.percentage.toFixed(row.percentage < 10 ? 2 : 1);
      $el.append(
        $('<div>').addClass('mb-2')
          .append($('<div>').addClass('d-flex justify-content-between small mb-1')
            .append($('<span>').html(countryHtml(row, false)))
            .append($('<span>').addClass('text-muted').text(utils.formatNumber(row.count) + ' (' + pct + '%)')))
          .append($('<div>').addClass('ga-immigration-bar')
            .append($('<div>').addClass('ga-immigration-bar-fill').css('width', pct + '%')))
      );
    });
    initTooltips($el);
  }

  function renderPersonalitiesPreview(data, selector) {
    var $el = $(selector).empty();
    if (!data || data.length === 0) { $el.html('<p class="text-muted small">Sin datos.</p>'); return; }
    var $list = $('<ul>').addClass('list-unstyled small mb-0');
    data.forEach(function(p) {
      $list.append($('<li>').addClass('py-1 border-bottom').html(
        buildPersonalityNameHtml(p) + buildPersonalityYearsHtml(p) + buildPersonalityLabelsHtml(p)
      ));
    });
    $el.append($list);
  }

  /* ═══ IMMIGRATION PAGE ══════════════════════════════════════════ */
  function initImmigration() {
    ready();
    loadImmigration(function(data) {
      renderImmigrationFull(data);
    });
  }

  function renderImmigrationFull(data) {
    var $el = $('#immigration-list').empty();
    if (!data || data.length === 0) { $el.html('<p class="text-muted">Sin datos.</p>'); return; }

    // Update totals from data
    var total = data.reduce(function(acc, r) { return acc + r.count; }, 0);
    $('#imm-total').text(utils.formatNumber(total));
    var countryCount = data.reduce(function(acc, r) {
      return acc + (r.country.split('/').length);
    }, 0);
    $('#imm-countries').text(countryCount);

    var $tbody = $('<tbody>').attr('id', 'imm-tbody');
    var $table = $('<div>').addClass('table-responsive')
      .append(
        $('<table>').addClass('table table-sm table-hover align-middle ga-table w-100')
          .append($('<colgroup>')
            .append($('<col>').addClass('ga-imm-col-idx'))
            .append($('<col>').addClass('ga-imm-col-country'))
            .append($('<col>').addClass('ga-imm-col-persons'))
            .append($('<col>').addClass('ga-imm-col-pct'))
            .append($('<col>')))
          .append($('<thead>').append(
            $('<tr>')
              .append($('<th>').html('#'))
              .append($('<th>').html('País'))
              .append($('<th>').addClass('text-end').html('Personas'))
              .append($('<th>').addClass('d-none d-md-table-cell').html('Porcentaje'))
              .append($('<th>').addClass('d-none d-md-table-cell').html('Apellidos frecuentes'))
          ))
          .append($tbody)
      );

    $el.append($table);

    data.forEach(function(row, idx) {
      var pct = row.percentage.toFixed(row.percentage < 10 ? 2 : 1);
      var surnamesText = row.topSurnames && row.topSurnames.length > 0
        ? row.topSurnames.join(', ')
        : '';
      var hasExpand = surnamesText.length > 0;

      var $row = $('<tr>').addClass(hasExpand ? 'ga-expandable-row' : '')
        .append($('<td>').addClass('text-muted small').html(idx + 1))
        .append($('<td>').html(
          countryHtml(row, true)
          + (hasExpand ? ' <i class="bi bi-chevron-right ga-expand-icon d-md-none ms-1"></i>' : '')
        ))
        .append($('<td>').addClass('text-end fw-semibold').html(utils.formatNumber(row.count)))
        .append($('<td>').addClass('d-none d-md-table-cell')
          .append($('<div>').addClass('d-flex align-items-center gap-2 w-100')
            .append($('<div>').addClass('ga-immigration-bar flex-grow-1').css('min-width', '80px')
              .append($('<div>').addClass('ga-immigration-bar-fill').css('width', pct + '%')))
            .append($('<span>').addClass('small text-muted ms-auto').html(pct + '%'))))
        .append($('<td>').addClass('d-none d-md-table-cell small text-muted ga-surnames-td')
          .append($('<div>').addClass('ga-surnames-fade').text(surnamesText)));

      var $expandRow = $('<tr>').addClass('ga-expand-row d-none d-md-none')
        .append($('<td>').attr('colspan', '99').addClass('small text-muted py-1 ps-4')
          .html('<i class="bi bi-people-fill me-1"></i>' + surnamesText));

      $tbody.append($row).append($expandRow);
    });

    // Toggle expand on click (mobile only — md+ shows the column directly)
    $el.on('click', '.ga-expandable-row', function() {
      var $next = $(this).next('.ga-expand-row');
      var opening = $next.hasClass('d-none');
      $next.toggleClass('d-none', !opening);
      $(this).find('.ga-expand-icon')
        .toggleClass('bi-chevron-right', !opening)
        .toggleClass('bi-chevron-down', opening);
    });

    initTooltips($el);
  }

  /* ── Immigration country name helper ───────────────────────────── */
  function countryHtml(row, bold) {
    var escaped = escAttr(row.country);
    var name = bold ? '<strong>' + escaped + '</strong>' : escaped;
    if (row.formerly) {
      name = '<span class="ga-tooltip" data-bs-toggle="tooltip" data-bs-title="Nombre anterior: ' + escAttr(row.formerly) + '">' + name + '</span>';
    }
    return (row.flag ? (bold ? '<span class="me-1">' + row.flag + '</span>' : row.flag + ' ') : '') + name;
  }

  /* ── Personality name helpers ───────────────────────────────────── */
  function buildPersonalityNameHtml(p) {
    var parts = [];
    if (p.title) {
      var titleHtml = p.titleFull && p.titleFull !== p.title
        ? '<span class="text-secondary small ga-tooltip" data-bs-toggle="tooltip" data-bs-title="' + escAttr(p.titleFull) + '">' + escAttr(p.title) + '</span>'
        : '<span class="text-secondary small">' + escAttr(p.title) + '</span>';
      parts.push(titleHtml);
    }
    if (p.givenName) parts.push(escAttr(p.givenName));
    if (p.nickname) parts.push('<span class="fst-italic ga-nickname">\u201c' + escAttr(p.nickname) + '\u201d</span>');
    if (p.surname)  parts.push('<span class="fw-semibold">' + escAttr(p.surname) + '</span>');
    return parts.join(' ');
  }

  function buildPersonalityLabelsHtml(p) {
    var html = '';
    if (p.labels && p.labels.length) {
      html += p.labels.map(function(l) {
        return '<span class="badge fw-normal ms-1 ga-pers-label">' + escAttr(LABEL_TEXT[l] || l) + '</span>';
      }).join('');
    }
    return html;
  }

  function buildPersonalityYearsHtml(p) {
    if (!p.birthYear && !p.deathYear) return '';
    var birth = p.birthYear
      ? (p.birthPlace
          ? '<span class="ga-tooltip" data-bs-toggle="tooltip" data-bs-title="' + escAttr(p.birthPlace) + '">' + p.birthYear + '</span>'
          : p.birthYear)
      : '?';
    var death = (p.deathYear != null)
      ? (p.deathPlace
          ? '<span class="ga-tooltip" data-bs-toggle="tooltip" data-bs-title="' + escAttr(p.deathPlace) + '">' + p.deathYear + '</span>'
          : p.deathYear)
      : 'vive';
    return ' <span class="small text-secondary px-1">(' + birth + '&ndash;' + death + ')</span>';
  }

  function initTooltips($container) {
    $container.find('[data-bs-toggle="tooltip"]').each(function() {
      new bootstrap.Tooltip(this, { delay: { show: 0, hide: 80 }, trigger: 'hover focus' });
    });
  }

  /* ── Escape HTML attribute values ──────────────────────────────── */
  function escAttr(s) {
    return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }

  function buildPersonalityDataName(p) {
    return utils.normalize([(p.title || ''), (p.givenName || ''), (p.nickname || ''), (p.surname || '')].join(' '));
  }

  /* ═══ PERSONALITIES PAGE ════════════════════════════════════════ */
  function initPersonalities() {
    ready();
    _activeLabelFilter = 'all';
    $('#personalities-list').html(utils.spinnerHtml('Cargando personalidades\u2026'));
    loadPersonalities(function(data) {
      renderPersonalitiesFull(data);
    });

    $(document).off('input.personalities', '#personalities-filter')
      .on('input.personalities', '#personalities-filter', function() {
        filterPersonalitiesRows($(this).val().toLowerCase());
      });

    $(document).off('click.personalities', '#personalities-filters .ga-tl-filter-btn')
      .on('click.personalities', '#personalities-filters .ga-tl-filter-btn', function() {
        _activeLabelFilter = $(this).data('label');
        $('#personalities-filters .ga-tl-filter-btn').removeClass('active');
        $(this).addClass('active');
        filterPersonalitiesRows($('#personalities-filter').val().toLowerCase());
      });
  }

  function renderPersonalitiesFull(data) {
    var $el = $('#personalities-list').empty();
    if (!data || data.length === 0) { $el.html('<p class="text-muted">Sin datos disponibles.</p>'); return; }
    $('#pers-total').text(data.length);

    var $header = $('<div>').addClass('ga-list-header').text('Personalidad');

    var $ul = $('<ul>').addClass('list-unstyled mb-0');
    data.forEach(function(p) {
      var labelsStr = (p.labels && p.labels.length) ? p.labels.join(' ') : '';
      $ul.append(
        $('<li>').addClass('py-1 ps-1 border-bottom')
          .attr('data-name', buildPersonalityDataName(p))
          .attr('data-labels', labelsStr)
          .html(buildPersonalityNameHtml(p) + buildPersonalityYearsHtml(p) + buildPersonalityLabelsHtml(p))
      );
    });
    $el.append($header).append($ul)
      .append($('<p>').addClass('text-muted mt-3 d-none').attr('id', 'personalities-no-results').text('No hay personalidades con este filtro.'));
    initTooltips($el);
  }

  function filterPersonalitiesRows(q) {
    var nq = utils.normalize(q);
    var visible = 0;
    $('#personalities-list li').each(function() {
      var name = $(this).attr('data-name') || '';
      var labels = $(this).attr('data-labels') || '';
      var matchesText = nq.length === 0 || name.indexOf(nq) !== -1;
      var matchesLabel = _activeLabelFilter === 'all' || (' ' + labels + ' ').indexOf(' ' + _activeLabelFilter + ' ') !== -1;
      var show = matchesText && matchesLabel;
      $(this).toggleClass('d-none', !show);
      if (show) visible++;
    });
    $('#personalities-no-results').toggleClass('d-none', visible > 0);
    $('#pers-total').text(visible);
  }

  /* ═══ SURNAMES PAGE ═════════════════════════════════════════════ */
  function initSurnames() {
    ready();
    $('#surnames-list').html(utils.spinnerHtml('Cargando apellidos\u2026'));
    loadSurnames(function(data) {
      renderSurnamesFull(data);
    });

    $(document).off('input.surnames', '#surnames-filter')
      .on('input.surnames', '#surnames-filter', function() {
        filterSurnameRows($(this).val());
      });
  }

  function renderSurnamesFull(data) {
    var $el = $('#surnames-list').empty();
    if (!data || data.length === 0) { $el.html('<p class="text-muted">Sin datos disponibles.</p>'); return; }
    $('#surn-total').text(data.length);

    var $tbody = $('<tbody>').attr('id', 'surnames-tbody');
    var $table = $('<table>').addClass('table table-sm table-hover ga-table').attr('id', 'surnames-table')
      .append($('<thead>').append(
        $('<tr>')
          .append($('<th>').html('#'))
          .append($('<th>').html('Apellido'))
          .append($('<th>').html('Variantes'))
          .append($('<th>').addClass('text-end').html('Total'))
          .append($('<th>').addClass('text-end').html('Vivos'))
      ))
      .append($tbody);

    data.forEach(function(s, idx) {
      var variantList = s.variants && s.variants.length > 0 ? s.variants : [];
      var variantsHtml = variantList.length > 0 ? variantList.join(', ') : '<span class="text-muted">—</span>';
      var countHtml = s.count != null ? utils.formatNumber(s.count) : '<span class="text-muted">—</span>';
      var aliveHtml = s.aliveCount != null ? utils.formatNumber(s.aliveCount) : '<span class="text-muted">—</span>';
      $tbody.append(
        $('<tr>')
          .attr('data-surname', utils.normalize(s.surname))
          .attr('data-variants', variantList.map(utils.normalize).join(' '))
          .append($('<td>').addClass('text-muted small').html(idx + 1))
          .append($('<td>').html('<span class="fw-semibold">' + escAttr(s.surname) + '</span>'))
          .append($('<td>').addClass('small text-muted').html(variantsHtml))
          .append($('<td>').addClass('text-end').html(countHtml))
          .append($('<td>').addClass('text-end').html(aliveHtml))
      );
    });

    $el.append($('<div>').addClass('table-responsive').append($table));
  }

  function filterSurnameRows(q) {
    var nq = utils.normalize(q);
    $('#surnames-tbody tr').each(function() {
      var s = $(this).attr('data-surname') || '';
      var v = $(this).attr('data-variants') || '';
      $(this).toggleClass('d-none', nq.length > 0 && s.indexOf(nq) === -1 && v.indexOf(nq) === -1);
    });
  }

  return { init: init, initImmigration: initImmigration, initPersonalities: initPersonalities, initSurnames: initSurnames };

})();

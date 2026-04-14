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

  function ready() { utils = GeneaAzul.utils; cfg = GeneaAzul.config; }

  /* ── Immigration data ──────────────────────────────────────────── */
  function loadImmigration(cb) {
    if (_immigration) { cb(_immigration); return; }
    $.getJSON('data/immigration.json', function(data) {
      _immigration = data;
      cb(data);
    }).fail(function() { cb([]); });
  }

  /* ── Personalities data ─────────────────────────────────────────── */
  function loadPersonalities(cb) {
    if (_personalities) { cb(_personalities); return; }
    $.getJSON('data/personalities.json', function(data) {
      _personalities = data;
      cb(data);
    }).fail(function() { cb([]); });
  }

  /* ── Surnames data ──────────────────────────────────────────────── */
  function loadSurnames(cb) {
    if (_surnames) { cb(_surnames); return; }
    $.getJSON('data/surnames.json', function(data) {
      _surnames = data;
      cb(data);
    }).fail(function() { cb([]); });
  }

  /* ═══ SUMMARY PAGE ══════════════════════════════════════════════ */
  function init() {
    ready();

    // Load live stats from API
    utils.apiGet(
      cfg.apiBaseUrl + '/api/gedcom-analyzer/metadata',
      function(meta) {
        if (meta.personsCount) $('#st-persons').text(utils.formatNumber(meta.personsCount));
        if (meta.familiesCount) $('#st-families').text(utils.formatNumber(meta.familiesCount));
      }
    );

    // Load immigration preview (top 5)
    loadImmigration(function(data) {
      renderImmigrationPreview(data.slice(0, 5), '#stats-immigration-preview');
    });

    // Load personalities preview (first 8)
    loadPersonalities(function(data) {
      renderPersonalitiesPreview(data.slice(0, 8), '#stats-personalities-preview');
    });
  }

  function renderImmigrationPreview(data, selector) {
    var $el = $(selector).empty();
    if (!data || data.length === 0) { $el.html('<p class="text-muted small">Sin datos.</p>'); return; }
    data.forEach(function(row) {
      var pct = row.percentage.toFixed(1);
      $el.append(
        $('<div>').addClass('mb-2')
          .append($('<div>').addClass('d-flex justify-content-between small mb-1')
            .append($('<span>').html((row.flag || '') + ' ' + row.country))
            .append($('<span>').addClass('text-muted').text(utils.formatNumber(row.count) + ' (' + pct + '%)')))
          .append($('<div>').addClass('ga-immigration-bar')
            .append($('<div>').addClass('ga-immigration-bar-fill').css('width', pct + '%')))
      );
    });
  }

  function renderPersonalitiesPreview(data, selector) {
    var $el = $(selector).empty();
    if (!data || data.length === 0) { $el.html('<p class="text-muted small">Sin datos.</p>'); return; }
    var $list = $('<ul>').addClass('list-unstyled small mb-0');
    data.forEach(function(p) {
      $list.append($('<li>').addClass('py-1 border-bottom').html(
        buildPersonalityNameHtml(p) + buildPersonalityYearsHtml(p)
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

    // Update total
    var total = data.reduce(function(acc, r) { return acc + r.count; }, 0);
    $('#imm-total').text(utils.formatNumber(total));

    var $table = $('<div>').addClass('table-responsive')
      .append(
        $('<table>').addClass('table table-sm table-hover align-middle')
          .append($('<thead>').append(
            $('<tr>')
              .append($('<th>').html('#'))
              .append($('<th>').html('País'))
              .append($('<th>').addClass('text-end').html('Personas'))
              .append($('<th>').html('Porcentaje'))
              .append($('<th>').addClass('d-none d-md-table-cell').html('Apellidos frecuentes'))
          ))
          .append($('<tbody>').attr('id', 'imm-tbody'))
      );

    $el.append($table);

    data.forEach(function(row, idx) {
      var pct = row.percentage.toFixed(1);
      var $topSurnames = row.topSurnames && row.topSurnames.length > 0
        ? row.topSurnames.slice(0, 6).join(', ')
        : '';

      $('#imm-tbody').append(
        $('<tr>')
          .append($('<td>').addClass('text-muted small').html(idx + 1))
          .append($('<td>').html(
            (row.flag ? '<span class="me-1">' + row.flag + '</span>' : '')
            + '<span class="fw-semibold">' + row.country + '</span>'
            + (row.isoCode ? ' <span class="badge bg-light text-dark fw-normal small">' + row.isoCode + '</span>' : '')
          ))
          .append($('<td>').addClass('text-end fw-semibold').html(utils.formatNumber(row.count)))
          .append($('<td>').attr('style', 'min-width:130px')
            .append($('<div>').addClass('d-flex align-items-center gap-2')
              .append($('<div>').addClass('ga-immigration-bar flex-grow-1').css('min-width', '80px')
                .append($('<div>').addClass('ga-immigration-bar-fill').css('width', pct + '%')))
              .append($('<span>').addClass('small text-muted').html(pct + '%'))))
          .append($('<td>').addClass('d-none d-md-table-cell small text-muted').html($topSurnames))
      );
    });
  }

  /* ── Personality name helpers ───────────────────────────────────── */
  function buildPersonalityNameHtml(p) {
    var parts = [];
    if (p.title) {
      var abbr = p.titleFull && p.titleFull !== p.title
        ? '<abbr title="' + p.titleFull + '" tabindex="0">' + p.title + '</abbr>'
        : p.title;
      parts.push('<span class="text-secondary small">' + abbr + '</span>');
    }
    if (p.givenName) parts.push(p.givenName);
    if (p.nickname) parts.push('<span class="fst-italic">\u201c' + p.nickname + '\u201d</span>');
    if (p.surname)  parts.push('<span class="fw-semibold">' + p.surname + '</span>');
    return parts.join(' ');
  }

  function buildPersonalityYearsHtml(p) {
    if (!p.birthYear && !p.deathYear) return '';
    var birth = p.birthYear
      ? (p.birthPlace ? '<span title="' + p.birthPlace + '">' + p.birthYear + '</span>' : p.birthYear)
      : '?';
    var death = (p.deathYear != null)
      ? (p.deathPlace ? '<span title="' + p.deathPlace + '">' + p.deathYear + '</span>' : p.deathYear)
      : 'vive';
    return ' <span class="small text-secondary ps-1">(' + birth + '&ndash;' + death + ')</span>';
  }

  function buildPersonalityDataName(p) {
    return [(p.title || ''), (p.givenName || ''), (p.nickname || ''), (p.surname || '')].join(' ').toLowerCase();
  }

  /* ═══ PERSONALITIES PAGE ════════════════════════════════════════ */
  function initPersonalities() {
    ready();
    loadPersonalities(function(data) {
      renderPersonalitiesFull(data);
    });

    $(document).on('input', '#personalities-filter', function() {
      filterPersonalitiesRows($(this).val().toLowerCase());
    });
  }

  function renderPersonalitiesFull(data) {
    var $el = $('#personalities-list').empty();
    if (!data || data.length === 0) { $el.html('<p class="text-muted">Sin datos disponibles.</p>'); return; }

    var $ul = $('<ul>').addClass('list-unstyled small mb-0');
    data.forEach(function(p) {
      $ul.append(
        $('<li>').addClass('py-1 border-bottom')
          .attr('data-name', buildPersonalityDataName(p))
          .html(buildPersonalityNameHtml(p) + buildPersonalityYearsHtml(p))
      );
    });
    $el.append($ul);
  }

  function filterPersonalitiesRows(q) {
    $('#personalities-list li').each(function() {
      var name = $(this).attr('data-name') || '';
      $(this).toggleClass('d-none', q.length > 0 && name.indexOf(q) === -1);
    });
  }

  /* ═══ SURNAMES PAGE ═════════════════════════════════════════════ */
  function initSurnames() {
    ready();
    loadSurnames(function(data) {
      renderSurnamesFull(data);
    });

    $(document).on('input', '#surnames-filter', function() {
      var q = $(this).val().toLowerCase();
      filterSurnameRows(q);
    });
  }

  function renderSurnamesFull(data) {
    var $el = $('#surnames-list').empty();
    if (!data || data.length === 0) { $el.html('<p class="text-muted">Sin datos disponibles.</p>'); return; }

    var $tbody = $('<tbody>').attr('id', 'surnames-tbody');
    var $table = $('<table>').addClass('table table-sm table-hover').attr('id', 'surnames-table')
      .append($('<thead>').append(
        $('<tr>')
          .append($('<th>').html('Apellido'))
          .append($('<th>').addClass('d-none d-sm-table-cell').html('Variantes'))
      ))
      .append($tbody);

    data.forEach(function(s) {
      var variants = s.variants && s.variants.length > 0 ? s.variants.join(', ') : '<span class="text-muted">—</span>';
      $tbody.append(
        $('<tr>').attr('data-surname', s.surname.toLowerCase())
          .append($('<td>').html('<span class="fw-semibold">' + s.surname + '</span>'))
          .append($('<td>').addClass('d-none d-sm-table-cell small text-muted').html(variants))
      );
    });

    $el.append($('<div>').addClass('table-responsive').append($table));
  }

  function filterSurnameRows(q) {
    $('#surnames-tbody tr').each(function() {
      var s = $(this).attr('data-surname') || '';
      $(this).toggleClass('d-none', q.length > 0 && s.indexOf(q) === -1);
    });
  }

  return { init, initImmigration, initPersonalities, initSurnames };

})();

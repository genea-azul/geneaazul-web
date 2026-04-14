/* ═══════════════════════════════════════════════════════════════════
   Genea Azul — map.js
   Immigration map page: bubble map on world SVG + table listing
   ═══════════════════════════════════════════════════════════════════ */
var GeneaAzul = window.GeneaAzul || {};

GeneaAzul.map = (function() {

  /* Rough centroid coordinates for bubble placement [lng, lat] → will be
     converted to SVG x/y using a simple Mercator-like projection. These are
     approximate centroids per country ISO code. */
  var CENTROIDS = {
    'IT': [12.5, 41.9], 'ES': [-3.7, 40.4], 'FR': [2.3, 46.2], 'PL': [19.1, 52.0],
    'DE': [10.5, 51.2], 'AT': [14.6, 47.8], 'GB': [-1.5, 52.5], 'RU': [37.6, 55.8],
    'UA': [31.2, 49.0], 'TR': [35.2, 39.0], 'SY': [38.3, 35.0], 'LB': [35.9, 33.9],
    'IL': [34.9, 31.5], 'AR': [-64.0, -34.0], 'UY': [-56.2, -32.5], 'BR': [-47.9, -15.8],
    'CL': [-70.7, -30.0], 'BO': [-65.0, -17.0], 'PY': [-58.4, -23.4], 'PE': [-75.0, -9.2],
    'US': [-95.7, 37.1], 'CA': [-96.8, 56.1], 'CN': [104.2, 35.9], 'JP': [138.3, 36.2],
    'HU': [19.5, 47.2], 'RO': [24.9, 45.9], 'CZ': [15.5, 49.8], 'SK': [19.7, 48.7],
    'YU': [21.0, 44.0], 'HR': [15.2, 45.1], 'GR': [21.8, 38.0], 'PT': [-8.2, 39.4],
    'DK': [10.0, 56.3], 'NO': [10.8, 60.5], 'SE': [18.7, 59.3], 'FI': [25.7, 61.9],
    'CH': [8.2, 46.8], 'BE': [4.5, 50.5], 'NL': [5.3, 52.1], 'PK': [69.3, 30.4],
    'EG': [30.8, 26.8], 'MA': [-7.1, 31.8]
  };

  function init() {
    $.getJSON('data/immigration.json', function(data) {
      renderMap(data);
      renderMapList(data);
    }).fail(function() {
      $('#map-container').html('<p class="text-muted text-center py-4">No se pudieron cargar los datos del mapa.</p>');
    });
  }

  /* ── Bubble map using inline SVG ──────────────────────────────── */
  function renderMap(data) {
    var $container = $('#map-container').empty();
    var W = 800, H = 400;

    // Simple equirectangular projection
    function project(lng, lat) {
      var x = (lng + 180) / 360 * W;
      var y = (90 - lat) / 180 * H;
      return { x: x, y: y };
    }

    // Scale bubble sizes
    var maxCount = Math.max.apply(null, data.map(function(d) { return d.count; }));
    function radius(count) {
      return Math.max(4, Math.sqrt(count / maxCount) * 28);
    }

    var svgNS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('xmlns', svgNS);
    svg.style.background = 'var(--ga-card-bg)';

    // Land background (very simple rectangle for now)
    var bg = document.createElementNS(svgNS, 'rect');
    bg.setAttribute('width', W); bg.setAttribute('height', H);
    bg.setAttribute('fill', 'var(--ga-bg)');
    svg.appendChild(bg);

    // Graticule lines
    for (var lng = -180; lng <= 180; lng += 30) {
      var line = document.createElementNS(svgNS, 'line');
      var p1 = project(lng, 90), p2 = project(lng, -90);
      line.setAttribute('x1', p1.x); line.setAttribute('y1', p1.y);
      line.setAttribute('x2', p2.x); line.setAttribute('y2', p2.y);
      line.setAttribute('stroke', 'var(--ga-border)'); line.setAttribute('stroke-width', '0.5');
      svg.appendChild(line);
    }
    for (var lat = -90; lat <= 90; lat += 30) {
      var line = document.createElementNS(svgNS, 'line');
      var p1 = project(-180, lat), p2 = project(180, lat);
      line.setAttribute('x1', p1.x); line.setAttribute('y1', p1.y);
      line.setAttribute('x2', p2.x); line.setAttribute('y2', p2.y);
      line.setAttribute('stroke', 'var(--ga-border)'); line.setAttribute('stroke-width', '0.5');
      svg.appendChild(line);
    }

    // Bubbles
    data.forEach(function(row) {
      var centroid = CENTROIDS[row.isoCode];
      if (!centroid) return;
      var pos = project(centroid[0], centroid[1]);
      var r = radius(row.count);

      var circle = document.createElementNS(svgNS, 'circle');
      circle.setAttribute('cx', pos.x); circle.setAttribute('cy', pos.y);
      circle.setAttribute('r', r);
      circle.setAttribute('fill', 'var(--ga-accent)');
      circle.setAttribute('fill-opacity', '0.65');
      circle.setAttribute('stroke', 'var(--ga-accent)');
      circle.setAttribute('stroke-width', '1.5');
      circle.setAttribute('stroke-opacity', '0.9');
      circle.style.cursor = 'pointer';

      // Tooltip on hover
      $(circle)
        .on('mouseenter', function(e) {
          var $t = $('#map-tooltip');
          $t.html(
            '<strong>' + (row.flag || '') + ' ' + row.country + '</strong><br>'
            + GeneaAzul.utils.formatNumber(row.count) + ' personas (' + row.percentage.toFixed(1) + '%)'
            + (row.topSurnames && row.topSurnames.length > 0 ? '<br><small>' + row.topSurnames.slice(0, 4).join(', ') + '</small>' : '')
          ).css({ display: 'block', top: (e.pageY - 60) + 'px', left: (e.pageX + 12) + 'px' });
        })
        .on('mousemove', function(e) {
          $('#map-tooltip').css({ top: (e.pageY - 60) + 'px', left: (e.pageX + 12) + 'px' });
        })
        .on('mouseleave', function() { $('#map-tooltip').hide(); });

      svg.appendChild(circle);

      // Country label for large bubbles
      if (r > 12) {
        var text = document.createElementNS(svgNS, 'text');
        text.setAttribute('x', pos.x); text.setAttribute('y', pos.y + r + 10);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('font-size', '9');
        text.setAttribute('fill', 'var(--ga-text-muted)');
        text.setAttribute('pointer-events', 'none');
        text.textContent = row.isoCode || row.country.substring(0, 3).toUpperCase();
        svg.appendChild(text);
      }
    });

    $container.append(svg);
  }

  /* ── Tabular list ─────────────────────────────────────────────── */
  function renderMapList(data) {
    var $el = $('#map-list').empty();
    var $table = $('<table>').addClass('table table-sm table-hover')
      .append($('<thead>').append(
        $('<tr>')
          .append($('<th>').html('#'))
          .append($('<th>').html('País'))
          .append($('<th>').addClass('text-end').html('Personas'))
          .append($('<th>').addClass('d-none d-sm-table-cell').html('%'))
          .append($('<th>').addClass('d-none d-md-table-cell').html('Apellidos frecuentes'))
      ))
      .append($('<tbody>'));

    data.forEach(function(row, idx) {
      $table.find('tbody').append(
        $('<tr>')
          .append($('<td>').addClass('text-muted small').html(idx + 1))
          .append($('<td>').html((row.flag || '') + ' <strong>' + row.country + '</strong>'))
          .append($('<td>').addClass('text-end').html(GeneaAzul.utils.formatNumber(row.count)))
          .append($('<td>').addClass('d-none d-sm-table-cell small text-muted').html(row.percentage.toFixed(1) + '%'))
          .append($('<td>').addClass('d-none d-md-table-cell small text-muted')
            .html(row.topSurnames ? row.topSurnames.slice(0, 5).join(', ') : ''))
      );
    });

    $el.append($('<div>').addClass('table-responsive').append($table));
  }

  return { init };

})();

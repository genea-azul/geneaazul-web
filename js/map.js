/* ═══════════════════════════════════════════════════════════════════
   Genea Azul — map.js
   Immigration map: Leaflet.js interactive map + country table
   ═══════════════════════════════════════════════════════════════════ */
var GeneaAzul = window.GeneaAzul || {};

GeneaAzul.map = (function() {

  var _leafletMap = null;

  /* Approximate centroids [lat, lng] per ISO code */
  var CENTROIDS = {
    'IT':     [41.9,  12.5], 'ES':     [40.4,  -3.7], 'FR':     [46.2,   2.3],
    'DE':     [51.2,  10.5], 'AT':     [47.8,  14.6], 'CH':     [46.8,   8.2],
    'NL':     [52.1,   5.3], 'BE':     [50.5,   4.5], 'PT':     [39.4,  -8.2],
    'GB':     [52.5,  -1.5], 'GB-ENG': [52.5,  -1.5], 'GB-SCT': [57.0,  -4.0],
    'IE':     [53.2,  -8.0], 'DK':     [56.3,  10.0], 'NO':     [60.5,  10.8],
    'SE':     [59.3,  18.7], 'FI':     [61.9,  25.7], 'PL':     [52.0,  19.1],
    'CZ':     [49.8,  15.5], 'SK':     [48.7,  19.7], 'HU':     [47.2,  19.5],
    'RO':     [45.9,  24.9], 'HR':     [45.1,  15.2], 'YU':     [44.0,  21.0],
    'RU':     [55.8,  37.6], 'UA':     [49.0,  31.2], 'GR':     [38.0,  21.8],
    'TR':     [39.0,  35.2], 'SY':     [34.5,  37.0], 'LB':     [33.9,  35.9],
    'IL':     [31.5,  34.9], 'EG':     [26.8,  30.8], 'MA':     [31.8,  -7.1],
    'PK':     [30.4,  69.3], 'CN':     [35.9, 104.2], 'JP':     [36.2, 138.3],
    'US':     [37.1, -95.7], 'CA':     [56.1, -96.8],
    'AR':     [-34.0, -64.0], 'UY':    [-32.5, -56.2], 'BR':    [-15.8, -47.9],
    'CL':     [-30.0, -70.7], 'PY':    [-23.4, -58.4], 'BO':    [-17.0, -65.0],
    'PE':     [-9.2,  -75.0], 'CO':    [ 4.6,  -74.1], 'VE':    [ 8.0,  -66.2],
    'EC':     [-1.8,  -78.2], 'CU':    [21.5,  -79.5], 'JM':    [18.1,  -77.3],
    'DO':     [18.7,  -70.2], 'NI':    [12.9,  -85.2],
    'AU':     [-25.3, 133.8], 'BG':    [42.7,   25.5], 'GB-NIR':[54.6,   -6.5]
  };

  function init() {
    // Destroy previous instance if navigating back
    if (_leafletMap) {
      _leafletMap.remove();
      _leafletMap = null;
    }

    // Initialise Leaflet
    _leafletMap = L.map('map-container', {
      scrollWheelZoom: false,    // don't hijack page scroll
      worldCopyJump: true
    }).setView([30, 15], 2);

    var key = (GeneaAzul.config || {}).mapTilerKey;
    if (key) {
      // MapTiler — Spanish labels (free API key from cloud.maptiler.com)
      L.tileLayer(
        'https://api.maptiler.com/maps/basic-v2/{z}/{x}/{y}.png?key=' + key + '&language=es', {
          attribution: '© <a href="https://www.maptiler.com/copyright/" target="_blank">MapTiler</a> © <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>',
          maxZoom: 19,
          tileSize: 512,
          zoomOffset: -1
        }).addTo(_leafletMap);
    } else {
      // CartoDB Positron — free, no API key, labels in local/English
      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions" target="_blank">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19
      }).addTo(_leafletMap);
    }

    var $overlay = $('<div>').addClass('ga-map-loading')
      .html(GeneaAzul.utils.spinnerHtml('Cargando datos\u2026'));
    $('.ga-leaflet-wrap').append($overlay);

    $.getJSON('/data/immigration.json', function(data) {
      $overlay.remove();
      renderBubbles(data);
    }).fail(function() {
      $overlay.remove();
      $('#map-container').html('<p class="text-muted text-center py-4">No se pudieron cargar los datos.</p>');
    });
  }

  /* ── Bubble markers ──────────────────────────────────────────────── */
  function renderBubbles(data) {
    var maxCount = Math.max.apply(null, data.map(function(d) { return d.count; }));
    var accentColor = getComputedStyle(document.documentElement)
      .getPropertyValue('--ga-accent').trim() || '#c9a227';

    var esc = GeneaAzul.utils.escHtml;

    data.forEach(function(row) {
      var coords = CENTROIDS[row.isoCode];
      if (!coords) return;

      var radius = Math.max(5, Math.sqrt(row.count / maxCount) * 38);

      var marker = L.circleMarker(coords, {
        radius:      radius,
        fillColor:   accentColor,
        color:       accentColor,
        weight:      1.5,
        opacity:     0.9,
        fillOpacity: 0.55
      }).addTo(_leafletMap);

      var surnames = row.topSurnames && row.topSurnames.length > 0
        ? '<div class="mt-1 text-muted" style="font-size:.8rem">' + row.topSurnames.slice(0, 16).map(function(s) { return esc(s); }).join(', ') + '</div>'
        : '';

      var formerlyHtml = row.formerly
        ? '<div style="font-size:.75rem;opacity:.7;margin-top:.1rem">Nombre anterior: ' + esc(row.formerly) + '</div>'
        : '';

      marker.bindPopup(
        '<strong>' + (row.flag || '') + ' ' + esc(row.country) + '</strong>'
        + formerlyHtml
        + '<div>' + GeneaAzul.utils.formatNumber(row.count) + ' personas ('
        + row.percentage.toFixed(row.percentage < 10 ? 2 : 1) + '%)</div>'
        + surnames,
        { maxWidth: 220 }
      );

      marker.bindTooltip((row.flag || '') + ' ' + esc(row.country), {
        direction: 'top', sticky: true
      });
    });
  }

  return { init: init };

})();

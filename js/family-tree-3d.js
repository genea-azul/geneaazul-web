var GeneaAzul = window.GeneaAzul || {};

GeneaAzul.familyTree3d = (function() {

  var _threeLoaded = false;
  var _threeCallbacks = [];
  var _currentUuid = null;
  var _cancelled = false;
  var _ctrlInterval = null;

  function init(uuid) {
    if (_currentUuid) return;
    _currentUuid = uuid;
    _cancelled = false;
    _openModal();
    _fetchGraph(uuid, function(graphData) {
      if (_cancelled) return;
      _ensureSceneLoaded(function() {
        if (_cancelled) return;
        window._ga3dInit(graphData);
      });
    });
  }

  function dispose() {
    _stopCtrl();
    _cancelled = true;
    if (window._ga3dDispose) window._ga3dDispose();
    _closeModal();
    _currentUuid = null;
  }

  function _startCtrl(action) {
    _stopCtrl();
    if (window._ga3dControl) window._ga3dControl(action);
    _ctrlInterval = setInterval(function() {
      if (window._ga3dControl) window._ga3dControl(action);
    }, 80);
  }

  function _stopCtrl() {
    if (_ctrlInterval) { clearInterval(_ctrlInterval); _ctrlInterval = null; }
  }

  function _openModal() {
    var $modal = $('#ga-tree3d-modal');
    $('#ga-tree3d-error').hide();
    $('#ga-tree3d-loader').css('opacity', '1').show();
    $modal.css('display', 'flex');
    document.body.style.overflow = 'hidden';
  }

  function _closeModal() {
    $('#ga-tree3d-modal').hide();
    document.body.style.overflow = '';
  }

  function _showError(msg) {
    var $err = $('#ga-tree3d-error');
    $err.text(msg).show();
    $('#ga-tree3d-loader').hide();
  }

  function _fetchGraph(uuid, cb) {
    GeneaAzul.utils.apiGet(
      GeneaAzul.config.apiBaseUrl + '/api/search/family-tree/' + uuid + '/graphJson',
      function(data) { cb(data); },
      function() {
        if (_cancelled) return;
        _showError('Error al cargar el árbol. Intentá de nuevo.');
        var savedUuid = _currentUuid;
        _cancelled = true;
        _currentUuid = null;
        if (window._ga3dDispose) window._ga3dDispose();
        setTimeout(function() {
          if ($('#ga-tree3d-modal').is(':visible') && !_currentUuid) _closeModal();
        }, 3000);
        void savedUuid;
      }
    );
  }

  function _ensureSceneLoaded(cb) {
    if (_threeLoaded) { cb(); return; }
    _threeCallbacks.push(cb);
    if (_threeCallbacks.length > 1) return;
    var s = document.createElement('script');
    s.type = 'module';
    s.src = '/js/family-tree-3d-scene.js';
    s.onload = function() {
      _threeLoaded = true;
      var pending = _threeCallbacks.slice();
      _threeCallbacks = [];
      for (var i = 0; i < pending.length; i++) {
        try { pending[i](); } catch (e) {
          console.error('[3D tree] scene init error:', e);
          if (!_cancelled) _showError('Error al inicializar la escena 3D.');
        }
      }
    };
    s.onerror = function() {
      _threeCallbacks = [];
      if (!_cancelled) _showError('Error al cargar el visualizador 3D.');
    };
    document.head.appendChild(s);
  }

  $(document).on('click', '#ga-tree3d-close', function() { dispose(); });
  $(document).on('click', '#ga-tree3d-download', function() {
    if (window._ga3dExport) window._ga3dExport();
  });
  $(document).on('click', '#ga-tree3d-person-card-close', function() {
    $('#ga-tree3d-person-card').addClass('d-none');
  });
  $(document).on('keydown', function(e) {
    if (e.key === 'Escape' && _currentUuid) dispose();
  });

  // Desktop: jQuery mousedown delegation works fine
  $(document).on('mousedown', '.ga-tree3d-ctrl-btn', function(e) {
    e.preventDefault();
    var action = $(this).data('ga3d-ctrl');
    if (action) _startCtrl(action);
  });
  // Mobile: touchstart on document is passive by default in Chrome so jQuery's
  // e.preventDefault() is silently ignored. Use a non-passive native listener
  // scoped to the modal so it doesn't affect page scroll elsewhere.
  // Guard: modal only exists on buscar page; without the check the IIFE would
  // throw on every other page and leave GeneaAzul.familyTree3d undefined.
  var _modalEl = document.getElementById('ga-tree3d-modal');
  if (_modalEl) {
    _modalEl.addEventListener('touchstart', function(e) {
      var el = e.target;
      while (el && el !== this) {
        if (el.classList && el.classList.contains('ga-tree3d-ctrl-btn') && el.getAttribute('data-ga3d-ctrl')) {
          e.preventDefault();
          _startCtrl(el.getAttribute('data-ga3d-ctrl'));
          return;
        }
        el = el.parentElement;
      }
    }, { passive: false });
  }
  $(document).on('mouseup touchend touchcancel', function() { _stopCtrl(); });

  // Preload the Three.js ES module during idle time so the first open is instant
  if (_modalEl && window.requestIdleCallback) {
    window.requestIdleCallback(function() { _ensureSceneLoaded(function() {}); });
  }

  return { init: init, dispose: dispose };

})();

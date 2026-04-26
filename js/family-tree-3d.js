var GeneaAzul = window.GeneaAzul || {};

GeneaAzul.familyTree3d = (function() {

  var _threeLoaded = false;
  var _threeCallbacks = [];
  var _currentUuid = null;
  var _cancelled = false;
  var _ctrlInterval = null;
  // Track the dynamically-inserted <script> so a rapid open/close/reopen doesn't
  // inject a second module tag whose top-level side effects would overwrite
  // window._ga3dInit etc.
  var _scriptEl = null;
  // Distinguishes "user clicked 3D" from "idle preload". A preload failure must
  // never poison the flag that blocks user-initiated attempts — the user hasn't
  // even tried yet and shouldn't see an error on their first click.
  var _userInitiated = false;
  // Scene readiness — set true after _ga3dInit completes successfully. Gates
  // the download / cinematic buttons so they don't silently no-op.
  var _sceneReady = false;
  // Focus restoration — stash the element that opened the modal so keyboard/AT
  // users get returned to it on close.
  var _lastFocus = null;
  // History API — true while the modal's pushState entry is current, so back-button
  // closes the modal instead of leaving the page.
  var _historyPushed = false;

  function init(uuid) {
    if (_currentUuid) return;
    _currentUuid = uuid;
    _cancelled = false;
    _userInitiated = true;
    _sceneReady = false;
    _lastFocus = document.activeElement;
    _openModal();
    _fetchGraph(uuid, function(graphData) {
      if (_cancelled) return;
      _ensureSceneLoaded(function() {
        if (_cancelled) return;
        window._ga3dInit(graphData);
        // _ga3dInit may fail silently on malformed data — the scene module hides
        // the loader and shows the error div itself. We still mark ready so the
        // user can close with the X button (whose readiness we don't gate).
        if (window._ga3dRendererReady && window._ga3dRendererReady()) {
          _setReady(true);
        }
      });
    });
  }

  function dispose() {
    _stopCtrl();
    _cancelled = true;
    _userInitiated = false;
    _setReady(false);
    if (window._ga3dDispose) window._ga3dDispose();
    _closeModal();
    _currentUuid = null;
    $('#ga-tree3d-cinematic').removeClass('ga-active');
    $('#ga-tree3d-modal').removeClass('ga-tree3d-modal--cinematic');
    // Return focus to the element that opened the modal
    if (_lastFocus && typeof _lastFocus.focus === 'function') {
      try { _lastFocus.focus(); } catch (e) { /* element may have been removed */ }
    }
    _lastFocus = null;
  }

  function _setReady(ready) {
    _sceneReady = !!ready;
    $('#ga-tree3d-modal').toggleClass('ga-tree3d-modal--ready', _sceneReady);
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

  function _handlePopstate() {
    if (!_currentUuid) return;
    _historyPushed = false;
    $(window).off('popstate.ga3d');
    dispose();
  }

  function _openModal() {
    var $modal = $('#ga-tree3d-modal');
    $('#ga-tree3d-error').hide();
    $('#ga-tree3d-loader').css('opacity', '1').show();
    $modal.css('display', 'flex');
    document.body.style.overflow = 'hidden';
    // Move focus first so no focused element is inside #main-content when aria-hidden is applied
    var closeBtn = document.getElementById('ga-tree3d-close');
    if (closeBtn && typeof closeBtn.focus === 'function') { try { closeBtn.focus(); } catch (e) {} }
    // Hide background from assistive tech while the modal is open
    var $main = $('#main-content');
    if ($main.length) $main.attr('aria-hidden', 'true');
    // Push a history entry so the phone back button closes the modal instead of leaving the page.
    history.pushState({ ga3dModal: true }, '');
    _historyPushed = true;
    $(window).on('popstate.ga3d', _handlePopstate);
  }

  function _closeModal() {
    $(window).off('popstate.ga3d');
    // If we pushed a modal history entry and the user closed via X/Escape/programmatic dispose
    // (not via the back button), replace the current entry with a plain one so the modal state
    // doesn't litter the history stack. Using replaceState (not history.back()) avoids
    // interfering with any router navigation that may have already pushed a new entry.
    if (_historyPushed) {
      _historyPushed = false;
      history.replaceState(null, '', window.location.href);
    }
    $('#ga-tree3d-modal').hide();
    document.body.style.overflow = '';
    var $main = $('#main-content');
    if ($main.length) $main.removeAttr('aria-hidden');
  }

  function _showError(msg, withRetry) {
    var $err = $('#ga-tree3d-error');
    $err.empty().text(msg);
    if (withRetry && _currentUuid) {
      var uuid = _currentUuid;
      $err.append(' ').append(
        $('<a href="#" class="ga-tree3d-retry-link">Reintentar</a>').on('click', function(e) {
          e.preventDefault();
          var saved = uuid;
          // Reset cancellation so the retry's success callback can proceed
          _cancelled = false;
          $err.hide();
          $('#ga-tree3d-loader').css('opacity', '1').show();
          _fetchGraph(saved, function(graphData) {
            if (_cancelled) return;
            _ensureSceneLoaded(function() {
              if (_cancelled) return;
              window._ga3dInit(graphData);
              if (window._ga3dRendererReady && window._ga3dRendererReady()) _setReady(true);
            });
          });
        })
      );
    }
    $err.show();
    $('#ga-tree3d-loader').hide();
  }

  function _fetchGraph(uuid, cb) {
    var obfSuffix = GeneaAzul.config.obfuscateLiving ? '' : '?obfuscateLiving=false';
    GeneaAzul.utils.apiGet(
      GeneaAzul.config.apiBaseUrl + '/api/search/family-tree/' + uuid + '/graphJson' + obfSuffix,
      function(data) { cb(data); },
      function(xhr) {
        if (_cancelled) return;
        var msg = (xhr && xhr.status === 0)
          ? 'No hay conexión. Verificá tu internet.'
          : 'Error al cargar el árbol.';
        _showError(msg, true);
        // Do NOT auto-close after a timeout — the user should see the message
        // and act on it. Previously a 3s setTimeout closed the modal which
        // hid the problem from users who blinked or scrolled.
      }
    );
  }

  function _ensureSceneLoaded(cb) {
    if (_threeLoaded) { cb(); return; }
    _threeCallbacks.push(cb);
    // If the script tag is already being loaded (from a previous call or the
    // idle preload), just wait — don't inject a second one. The module body's
    // top-level side effects would otherwise run twice.
    if (_scriptEl) return;
    _scriptEl = document.createElement('script');
    _scriptEl.type = 'module';
    _scriptEl.src = '/js/family-tree-3d-scene.js';
    _scriptEl.onload = function() {
      _threeLoaded = true;
      var pending = _threeCallbacks.slice();
      _threeCallbacks = [];
      for (var i = 0; i < pending.length; i++) {
        try { pending[i](); } catch (e) {
          if (window.console && console.error) console.error('[3D tree] scene init error:', e);
          if (!_cancelled) _showError('Error al inicializar la escena 3D.', true);
        }
      }
    };
    _scriptEl.onerror = function() {
      var wasUserInitiated = _userInitiated;
      var pending = _threeCallbacks.slice();
      _threeCallbacks = [];
      // Remove the failed tag + clear the reference so the next attempt can
      // actually retry (previously a single failure latched the flag for the
      // rest of the session and there was no way to recover).
      if (_scriptEl && _scriptEl.parentNode) _scriptEl.parentNode.removeChild(_scriptEl);
      _scriptEl = null;
      // Only surface to the user if they actually initiated this load. An idle
      // preload that fails shouldn't block their first real click.
      if (wasUserInitiated && !_cancelled) {
        _showError('Error al cargar el visualizador 3D.', true);
      }
      // Clear pending callbacks without firing — the error branch took over.
      void pending;
    };
    document.head.appendChild(_scriptEl);
  }

  $(document).on('click', '#ga-tree3d-close', function() { dispose(); });
  $(document).on('click', '#ga-tree3d-download', function() {
    if (!_sceneReady) return;
    if (window._ga3dExport) window._ga3dExport();
  });
  $(document).on('click', '#ga-tree3d-cinematic', function() {
    if (!_sceneReady || !window._ga3dCinematic) return;
    var $btn = $(this);
    var nowActive = !$btn.hasClass('ga-active');
    $btn.toggleClass('ga-active', nowActive);
    window._ga3dCinematic(nowActive);
    $('#ga-tree3d-modal').toggleClass('ga-tree3d-modal--cinematic', nowActive);
    if (nowActive) $('#ga-tree3d-person-card').addClass('d-none');
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

  // Preload the Three.js ES module during idle time so the first open is instant.
  // _userInitiated stays false — a preload failure won't block the user's first click.
  if (_modalEl && window.requestIdleCallback) {
    window.requestIdleCallback(function() { _ensureSceneLoaded(function() {}); });
  }

  return { init: init, dispose: dispose };

})();

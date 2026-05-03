/* ═══════════════════════════════════════════════════════════════════
   Genea Azul — tree-builder.js
   /agregar-familia — visual mini-tree builder + auto-search + submit
   ═══════════════════════════════════════════════════════════════════ */
var GeneaAzul = window.GeneaAzul || {};

GeneaAzul.treeBuilder = (function() {

  var cfg, i18n, utils;
  var _activeTimers = [];
  var _modal = null;
  var _leaveModal = null;
  var _searchSeq = 0;
  var _pendingSearchTimer = null;
  var _openerEl = null;
  var _submitted = false;
  var _pendingNavRoute = null;

  var _STORAGE_KEY = 'geneaazul_tree_state';

  /* ── Initial state ──────────────────────────────────────────────── */
  var _state = {};

  function _freshState() {
    return {
      ego:                 null,
      partner:             null,
      father:              null,
      mother:              null,
      paternalGrandfather: null,
      paternalGrandmother: null,
      maternalGrandfather: null,
      maternalGrandmother: null,
      children:            []
    };
  }

  var _roleLabels = {
    ego:                 'Vos',
    partner:             'Pareja',
    father:              'Padre',
    mother:              'Madre',
    paternalGrandfather: 'Abuelo paterno',
    paternalGrandmother: 'Abuela paterna',
    maternalGrandfather: 'Abuelo materno',
    maternalGrandmother: 'Abuela materna'
  };

  var _fixedRoles = [
    'ego', 'partner', 'father', 'mother',
    'paternalGrandfather', 'paternalGrandmother',
    'maternalGrandfather', 'maternalGrandmother'
  ];

  /* ── Init ───────────────────────────────────────────────────────── */
  function init() {
    cfg   = GeneaAzul.config;
    i18n  = GeneaAzul.i18n;
    utils = GeneaAzul.utils;
    _activeTimers = [];

    // Defensively dispose any previous modal instances
    if (_modal) {
      try { _modal.hide(); _modal.dispose(); } catch (e) {}
      _modal = null;
    }
    if (_leaveModal) {
      try { _leaveModal.hide(); _leaveModal.dispose(); } catch (e) {}
      _leaveModal = null;
    }

    // Move modals to <body> so Bootstrap's backdrop (also on body) doesn't render
    // above them — the gaFadeIn animation on #page-content creates a stacking context
    // that would otherwise trap modals behind the backdrop.
    var modalEl = document.getElementById('ga-tree-person-modal');
    if (modalEl && modalEl.parentNode !== document.body) {
      document.body.appendChild(modalEl);
    }
    _modal = new bootstrap.Modal(modalEl);

    var leaveModalEl = document.getElementById('ga-tree-leave-modal');
    if (leaveModalEl && leaveModalEl.parentNode !== document.body) {
      document.body.appendChild(leaveModalEl);
    }
    _leaveModal = new bootstrap.Modal(leaveModalEl, { backdrop: 'static', keyboard: false });

    _submitted = false;
    _pendingNavRoute = null;

    // Navigation guard — capture phase intercepts data-route clicks before the router
    document.removeEventListener('click', _navGuardHandler, true);
    document.addEventListener('click', _navGuardHandler, true);
    window.removeEventListener('beforeunload', _onBeforeUnload);
    window.addEventListener('beforeunload', _onBeforeUnload);

    // Set dynamic year ceiling on birth/death year inputs
    var currentYear = parseInt(new Date().toLocaleDateString('en-CA', {
      timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric'
    }), 10);
    $('#ga-modal-birth-year, #ga-modal-death-year').attr('max', currentYear);

    // Load persisted state — user's tree survives navigation and page refresh
    var saved = _loadFromLocalStorage();
    _state = saved || _freshState();

    var fromSearch = false;
    try {
      fromSearch = sessionStorage.getItem('geneaazul_tree_from_search') === '1';
      if (fromSearch) sessionStorage.removeItem('geneaazul_tree_from_search');
    } catch (e) {}

    $('#ga-tree-prefill-banner, #ga-tree-restored-banner').remove();
    if (fromSearch)     { _showPrefillBanner(); }
    else if (saved)     { _showRestoredBanner(); }

    // Wake backend + read obfuscateLiving before firing first auto-search
    // (same form-gate pattern as search.js — must complete before triggerSearchIfReady
    // so obfuscateLiving is set correctly on the first request from restored state)
    utils.apiGetCached(
      cfg.apiBaseUrl + '/api/gedcom-analyzer',
      function(data) {
        if (data && data.disableObfuscateLiving) {
          cfg.obfuscateLiving = false;
        }
        triggerSearchIfReady();
      },
      function() {
        triggerSearchIfReady(); // update hint + attempt search even when backend is unreachable
      }
    );

    wireEvents();
    renderTree();
    _updateResetVisibility();
  }

  /* ── localStorage ───────────────────────────────────────────────── */
  function _saveToLocalStorage() {
    try { localStorage.setItem(_STORAGE_KEY, JSON.stringify(_state)); } catch (e) {}
  }

  function _loadFromLocalStorage() {
    try {
      var raw = localStorage.getItem(_STORAGE_KEY);
      if (!raw) { return null; }
      var parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && Array.isArray(parsed.children)) {
        return parsed;
      }
    } catch (e) {}
    return null;
  }

  function _showPrefillBanner() {
    var $banner = $(
      '<div class="alert alert-success d-flex align-items-center gap-2 py-2 small mb-3" id="ga-tree-prefill-banner">' +
      '<i class="bi bi-magic flex-shrink-0"></i>' +
      '<span>Completamos el formulario con los datos de tu búsqueda. Revisá y completá lo que falte.</span>' +
      '<button type="button" class="btn-close btn-sm flex-shrink-0 ms-auto" aria-label="Cerrar"></button>' +
      '</div>'
    );
    $('#ga-tree-canvas').before($banner);
    $banner.find('.btn-close').on('click', function() { $banner.remove(); });
    var t = setTimeout(function() { $banner.remove(); }, 8000);
    _activeTimers.push(t);
  }

  function _showRestoredBanner() {
    var $banner = $(
      '<div class="alert alert-info d-flex align-items-center gap-2 py-2 small mb-3" id="ga-tree-restored-banner">' +
      '<i class="bi bi-cloud-check-fill flex-shrink-0"></i>' +
      '<span>Tus datos fueron restaurados de la sesión anterior.</span>' +
      '<button type="button" class="btn-close btn-sm flex-shrink-0 ms-auto" aria-label="Cerrar"></button>' +
      '</div>'
    );
    $('#ga-tree-canvas').before($banner);
    $banner.find('.btn-close').on('click', function() { $banner.remove(); });
    // Auto-dismiss after 6 s
    var t = setTimeout(function() { $banner.remove(); }, 6000);
    _activeTimers.push(t);
  }

  /* ── Event wiring ───────────────────────────────────────────────── */
  function wireEvents() {
    // Node clicks — fixed roles and dynamic children
    $(document)
      .off('click.tree-builder', '[data-role]')
      .on('click.tree-builder', '[data-role]', function() {
        var $el = $(this);
        var role = $el.attr('data-role');
        var childIndexStr = $el.attr('data-child-index');
        var childIndex = (childIndexStr !== undefined && childIndexStr !== '')
          ? parseInt(childIndexStr, 10) : null;
        _openerEl = this;
        openModal(role, childIndex);
      });

    // Add-child button
    $(document)
      .off('click.tree-builder', '#ga-node-add-child')
      .on('click.tree-builder', '#ga-node-add-child', function() {
        _openerEl = this;
        openModal('child', _state.children.length);
      });

    // Keyboard: Enter / Space activate nodes like clicks
    $(document)
      .off('keydown.tree-builder', '[data-role], #ga-node-add-child')
      .on('keydown.tree-builder', '[data-role], #ga-node-add-child', function(e) {
        if (e.which === 13 || e.which === 32) {
          e.preventDefault();
          $(this).trigger('click');
        }
      });

    // Return focus to opener node when modal closes
    $('#ga-tree-person-modal')
      .off('hidden.bs.modal.tree-builder')
      .on('hidden.bs.modal.tree-builder', function() {
        if (_openerEl) {
          try { _openerEl.focus(); } catch (e) {}
          _openerEl = null;
        }
      });

    // Deceased toggle reveals / hides death fields
    $(document)
      .off('change.tree-builder', '#ga-modal-deceased')
      .on('change.tree-builder', '#ga-modal-deceased', function() {
        $('#ga-modal-death-section').toggleClass('d-none', !$(this).prop('checked'));
      });

    // Save / delete / submit
    $(document)
      .off('click.tree-builder', '#ga-modal-save-btn')
      .on('click.tree-builder', '#ga-modal-save-btn', function() {
        saveFromModal();
      });

    $(document)
      .off('click.tree-builder', '#ga-modal-delete-btn')
      .on('click.tree-builder', '#ga-modal-delete-btn', function() {
        deleteFromModal();
      });

    $(document)
      .off('click.tree-builder', '#ga-tree-submit-btn')
      .on('click.tree-builder', '#ga-tree-submit-btn', function() {
        submitTree();
      })
      .off('click.tree-builder', '#ga-tree-reset-btn')
      .on('click.tree-builder', '#ga-tree-reset-btn', function() {
        _resetTree();
      })
      .off('click.tree-builder', '#ga-leave-send-btn')
      .on('click.tree-builder', '#ga-leave-send-btn', function() {
        _doSubmit(function() {
          _removeNavGuard();
          if (_pendingNavRoute) {
            GeneaAzul.router.navigate(_pendingNavRoute);
          }
        });
      })
      .off('click.tree-builder', '#ga-leave-exit-btn')
      .on('click.tree-builder', '#ga-leave-exit-btn', function() {
        _removeNavGuard();
        _leaveModal.hide();
        if (_pendingNavRoute) {
          GeneaAzul.router.navigate(_pendingNavRoute);
        }
      });
  }

  /* ── Render ─────────────────────────────────────────────────────── */
  function renderTree() {
    _fixedRoles.forEach(function(role) { renderNode(role, null); });
    renderChildren();
  }

  function renderNode(role, childIndex) {
    var nodeData = (role === 'child')
      ? _state.children[childIndex]
      : _state[role];

    var $newNode = _isNodeEmpty(nodeData)
      ? _buildEmptyNode(role, childIndex)
      : _buildFilledNode(role, childIndex, nodeData);

    var id = (role === 'child')
      ? '#ga-node-child-' + childIndex
      : '#ga-node-' + role;

    $(id).replaceWith($newNode);
  }

  function renderChildren() {
    var $row = $('#ga-tree-row-children');
    $row.find('[data-role="child"]').closest('.ga-tree-node-wrap').remove();

    _state.children.forEach(function(childData, idx) {
      var $wrap = $('<div>').addClass('ga-tree-node-wrap');
      $wrap.append(_buildFilledNode('child', idx, childData));
      $wrap.append($('<span>').addClass('ga-tree-node-label').text('Hijo/a'));
      $('#ga-node-add-child').closest('.ga-tree-node-wrap').before($wrap);
    });
  }

  function _isNodeEmpty(nodeData) {
    return !nodeData || (!nodeData.givenName && !nodeData.surname && !nodeData.birthYear && !nodeData.birthPlace);
  }

  function _buildEmptyNode(role, childIndex) {
    var id    = (role === 'child') ? 'ga-node-child-' + childIndex : 'ga-node-' + role;
    var isEgo = (role === 'ego');
    var label = _roleLabels[role] || 'Hijo/a';
    var $node = $('<div>')
      .addClass('ga-tree-node ga-tree-node-empty' + (isEgo ? ' ga-tree-node-ego' : ''))
      .attr({ id: id, 'data-role': role, tabindex: '0', role: 'button',
              'aria-label': 'Agregar: ' + label });
    if (childIndex !== null) $node.attr('data-child-index', childIndex);
    $node
      .append($('<div>').addClass('ga-tree-node-plus').text('＋'))
      .append($('<div>').addClass('ga-tree-node-hint').text('Agregar'));
    return $node;
  }

  function _buildFilledNode(role, childIndex, data) {
    var id      = (role === 'child') ? 'ga-node-child-' + childIndex : 'ga-node-' + role;
    var isEgo   = (role === 'ego');
    var isChild = (role === 'child');
    var label   = _roleLabels[role] || 'Hijo/a';
    var displayName = [(data.givenName || ''), (data.surname || '')].join(' ').trim() || '—';

    var $node = $('<div>')
      .addClass('ga-tree-node ga-tree-node-filled'
        + (isEgo   ? ' ga-tree-node-ego'   : '')
        + (isChild ? ' ga-tree-node-child' : ''))
      .attr({ id: id, 'data-role': role, tabindex: '0', role: 'button',
              'aria-label': 'Editar: ' + label + ' — ' + displayName });
    if (childIndex !== null) $node.attr('data-child-index', childIndex);

    $node.append($('<div>').addClass('ga-tree-node-name').text(displayName));

    var birthParts = [];
    if (data.birthYear)  birthParts.push(_formatPartialDate(data.birthDay, data.birthMonth, data.birthYear));
    if (data.birthPlace) birthParts.push(data.birthPlace);
    if (birthParts.length) {
      $node.append($('<div>').addClass('ga-tree-node-birth').text(birthParts.join(' · ')));
    }

    if (data.isDeceased) {
      var deathText = '†' + (data.deathYear ? ' ' + data.deathYear : '');
      $node.append($('<div>').addClass('ga-tree-node-death').text(deathText));
    }

    return $node;
  }

  function _formatPartialDate(day, month, year) {
    if (!year)  return '';
    if (!month) return String(year);
    if (!day)   return month + '/' + year;
    return day + '/' + month + '/' + year;
  }

  /* ── Modal ──────────────────────────────────────────────────────── */
  function openModal(role, childIndex) {
    var isChild = (role === 'child');
    var data    = isChild ? (_state.children[childIndex] || null) : _state[role];
    var label   = isChild ? 'Hijo/a' : (_roleLabels[role] || role);

    $('#ga-tree-modal-title').text((data ? 'Editar' : 'Agregar') + ': ' + label);
    $('#ga-modal-role').val(role);
    $('#ga-modal-child-index').val(childIndex !== null && childIndex !== undefined ? childIndex : '');

    _clearModalForm();

    $('#ga-modal-relationship-section').toggleClass('d-none', role !== 'partner');
    $('#ga-modal-delete-btn').toggleClass('d-none', !data);

    if (data) { _prefillModalForm(data, role); }

    _modal.show();
  }

  function _clearModalForm() {
    $('#ga-modal-given-name, #ga-modal-surname').val('');
    $('input[name="ga-modal-sex"][value=""]').prop('checked', true);
    $('#ga-modal-birth-day, #ga-modal-birth-month, #ga-modal-birth-year, #ga-modal-birth-place').val('');
    $('#ga-modal-deceased').prop('checked', false);
    $('#ga-modal-death-section').addClass('d-none');
    $('#ga-modal-death-day, #ga-modal-death-month, #ga-modal-death-year, #ga-modal-death-place').val('');
    $('input[name="ga-modal-rel-type"][value="CURRENT_PARTNER"]').prop('checked', true);
    $('#ga-modal-validation-msg').addClass('d-none').text('');
  }

  function _prefillModalForm(data, role) {
    $('#ga-modal-given-name').val(data.givenName || '');
    $('#ga-modal-surname').val(data.surname || '');
    if (data.sex) {
      $('input[name="ga-modal-sex"][value="' + data.sex + '"]').prop('checked', true);
    }
    $('#ga-modal-birth-day').val(data.birthDay || '');
    $('#ga-modal-birth-month').val(data.birthMonth || '');
    $('#ga-modal-birth-year').val(data.birthYear || '');
    $('#ga-modal-birth-place').val(data.birthPlace || '');
    if (data.isDeceased) {
      $('#ga-modal-deceased').prop('checked', true);
      $('#ga-modal-death-section').removeClass('d-none');
      $('#ga-modal-death-day').val(data.deathDay || '');
      $('#ga-modal-death-month').val(data.deathMonth || '');
      $('#ga-modal-death-year').val(data.deathYear || '');
      $('#ga-modal-death-place').val(data.deathPlace || '');
    }
    if (role === 'partner' && data.relationshipType) {
      $('input[name="ga-modal-rel-type"][value="' + data.relationshipType + '"]').prop('checked', true);
    }
  }

  function _readModalForm() {
    var deceased = $('#ga-modal-deceased').prop('checked');
    return {
      givenName:  utils.trimToNull($('#ga-modal-given-name').val()),
      surname:    utils.trimToNull($('#ga-modal-surname').val()),
      sex:        $('input[name="ga-modal-sex"]:checked').val() || null,
      birthDay:   utils.toNumber($('#ga-modal-birth-day').val()),
      birthMonth: utils.toNumber($('#ga-modal-birth-month').val()),
      birthYear:  utils.toNumber($('#ga-modal-birth-year').val()),
      birthPlace: utils.trimToNull($('#ga-modal-birth-place').val()),
      isDeceased: deceased,
      deathDay:   deceased ? utils.toNumber($('#ga-modal-death-day').val())     : null,
      deathMonth: deceased ? utils.toNumber($('#ga-modal-death-month').val())   : null,
      deathYear:  deceased ? utils.toNumber($('#ga-modal-death-year').val())    : null,
      deathPlace: deceased ? utils.trimToNull($('#ga-modal-death-place').val()) : null
    };
  }

  function saveFromModal() {
    var role          = $('#ga-modal-role').val();
    var childIndexStr = $('#ga-modal-child-index').val();
    var childIndex    = childIndexStr !== '' ? parseInt(childIndexStr, 10) : null;

    var nodeData = _readModalForm();

    if (role === 'partner') {
      nodeData.relationshipType = $('input[name="ga-modal-rel-type"]:checked').val() || 'CURRENT_PARTNER';
    }

    var isEmpty = _isNodeEmpty(nodeData);

    if (!isEmpty) {
      var missing = [];
      if (!nodeData.givenName) { missing.push('nombre'); }
      if (!nodeData.surname)   { missing.push('apellido'); }
      if (!nodeData.birthYear && !nodeData.deathYear) { missing.push('al menos un año'); }
      if (missing.length) {
        $('#ga-modal-validation-msg').text('Completá: ' + missing.join(', ') + '.').removeClass('d-none');
        return;
      }
    }
    $('#ga-modal-validation-msg').addClass('d-none').text('');

    if (role === 'child') {
      if (isEmpty) {
        if (childIndex !== null && childIndex < _state.children.length) {
          _state.children.splice(childIndex, 1);
        }
      } else {
        if (childIndex !== null && childIndex < _state.children.length) {
          _state.children[childIndex] = nodeData;
        } else {
          _state.children.push(nodeData);
        }
      }
      renderChildren();
    } else {
      _state[role] = isEmpty ? null : nodeData;
      renderNode(role, null);
    }

    _modal.hide();
    _saveToLocalStorage();
    triggerSearchIfReady();
    _updateResetVisibility();
  }

  function deleteFromModal() {
    if (_pendingSearchTimer !== null) {
      clearTimeout(_pendingSearchTimer);
      _pendingSearchTimer = null;
    }

    var role          = $('#ga-modal-role').val();
    var childIndexStr = $('#ga-modal-child-index').val();
    var childIndex    = childIndexStr !== '' ? parseInt(childIndexStr, 10) : null;

    if (role === 'child' && childIndex !== null) {
      _state.children.splice(childIndex, 1);
      renderChildren();
    } else {
      _state[role] = null;
      renderNode(role, null);
    }
    _modal.hide();
    _saveToLocalStorage();
    triggerSearchIfReady();
    _updateResetVisibility();
  }

  /* ── Auto-search ────────────────────────────────────────────────── */
  function updateSearchHint() {
    var ready = _state.ego && _state.ego.givenName && _state.ego.surname;
    $('#ga-tree-search-hint').toggleClass('d-none', !!ready);
    if (!ready) {
      $('#ga-tree-results-card').addClass('d-none');
      $('#ga-tree-results-body').empty();
    }
  }

  function _hasAnyData() {
    if (_state.children.length > 0) { return true; }
    for (var i = 0; i < _fixedRoles.length; i++) {
      if (_state[_fixedRoles[i]]) { return true; }
    }
    return false;
  }

  function _updateResetVisibility() {
    $('#ga-tree-reset-wrap').toggleClass('d-none', !_hasAnyData());
  }

  function _resetTree() {
    if (!window.confirm('¿Querés empezar de nuevo? Se borrarán todos los datos ingresados.')) { return; }
    _state = _freshState();
    _submitted = false;
    try { localStorage.removeItem(_STORAGE_KEY); } catch (e) {}
    renderTree();
    triggerSearchIfReady();
    _updateResetVisibility();
  }

  /* ── Navigation guard ───────────────────────────────────────────────── */
  function _onBeforeUnload(e) {
    if (!_hasAnyData() || _submitted) { return; }
    e.preventDefault();
    e.returnValue = '';
  }

  function _navGuardHandler(e) {
    var target = e.target;
    while (target && target !== document.body) {
      if (target.getAttribute && target.getAttribute('data-route') !== null) { break; }
      target = target.parentNode;
    }
    if (!target || !target.getAttribute || target.getAttribute('data-route') === null) { return; }
    if (!_hasAnyData() || _submitted) { return; }

    e.stopPropagation();
    e.preventDefault();

    _pendingNavRoute = target.getAttribute('data-route');
    _leaveModal.show();
  }

  function _removeNavGuard() {
    document.removeEventListener('click', _navGuardHandler, true);
    window.removeEventListener('beforeunload', _onBeforeUnload);
  }

  function triggerSearchIfReady() {
    updateSearchHint();
    if (!_state.ego || !_state.ego.givenName || !_state.ego.surname) { return; }

    // Debounce: cancel any previous pending call
    if (_pendingSearchTimer !== null) {
      clearTimeout(_pendingSearchTimer);
      _pendingSearchTimer = null;
    }

    var seq = ++_searchSeq;
    _pendingSearchTimer = setTimeout(function() {
      _pendingSearchTimer = null;
      _executeSearch(seq);
    }, 400);
  }

  function _executeSearch(seq) {
    if (seq !== _searchSeq) { return; } // superseded by a newer trigger

    var $card = $('#ga-tree-results-card');
    var $body = $('#ga-tree-results-body');

    $card.removeClass('d-none');
    $body.html(utils.spinnerHtml('Buscando en el árbol de Genea Azul...'));

    utils.apiPost(
      cfg.apiBaseUrl + '/api/search/family',
      _buildSearchRequest(),
      function(data) {
        if (seq !== _searchSeq) { return; } // stale response — a newer search is in flight

        $body.empty();
        var people = (data && Array.isArray(data.people)) ? data.people : [];
        var timeoutMs = 0;

        people.forEach(function(person, idx) {
          var $pc = GeneaAzul.search.buildPersonComponent(person, idx, { compact: true });
          $body.append($pc);
          timeoutMs += GeneaAzul.search.enableFamilyTreeButtons(person.uuid, person.personsCountInTree, timeoutMs);
        });

        if (people.length === 0) {
          if (data.errors && data.errors.length > 0) {
            var errHtml = '';
            data.errors.forEach(function(code) { errHtml += i18n.displayErrorCodeInSpanish(code); });
            $body.html(GeneaAzul.search.feedbackAlert('danger', 'x-circle-fill', errHtml));
          } else if (data.potentialResults) {
            $body.html(GeneaAzul.search.feedbackAlert('warning', 'exclamation-triangle-fill', 'La búsqueda es ambigua. Completá más datos para refinar.'));
          } else {
            $body.html(GeneaAzul.search.feedbackAlert('info', 'search', 'Sin coincidencias todavía. Seguí agregando datos de familia.'));
          }
        }
        _initScrollFade($card);
      },
      function(xhr) {
        if (seq !== _searchSeq) { return; }
        var errCode = xhr && xhr.status === 429 ? 'TOO-MANY-REQUESTS' : 'ERROR';
        $body.html(GeneaAzul.search.feedbackAlert('danger', 'x-circle-fill', i18n.displayErrorCodeInSpanish(errCode)));
        _initScrollFade($card);
      }
    );
  }

  function _buildSearchRequest() {
    function toSearchPerson(node) {
      if (!node || (!node.givenName && !node.surname && !node.birthYear)) { return null; }
      return {
        givenName:    node.givenName,
        surname:      node.surname,
        sex:          node.sex,
        isAlive:      !node.isDeceased,
        yearOfBirth:  node.birthYear,
        yearOfDeath:  node.isDeceased ? node.deathYear : null,
        placeOfBirth: node.birthPlace
      };
    }
    return {
      individual:          toSearchPerson(_state.ego),
      spouse:              toSearchPerson(_state.partner),
      father:              toSearchPerson(_state.father),
      mother:              toSearchPerson(_state.mother),
      paternalGrandfather: toSearchPerson(_state.paternalGrandfather),
      paternalGrandmother: toSearchPerson(_state.paternalGrandmother),
      maternalGrandfather: toSearchPerson(_state.maternalGrandfather),
      maternalGrandmother: toSearchPerson(_state.maternalGrandmother),
      contact:             utils.trimToNull($('#ga-tree-contact').val()),
      obfuscateLiving:     cfg.obfuscateLiving,
      persist:             false
    };
  }

  /* ── Submit ─────────────────────────────────────────────────────── */
  function submitTree() {
    _doSubmit(null);
  }

  function _doSubmit(onSuccessFn) {
    var contact = utils.trimToNull($('#ga-tree-contact').val());
    var $err    = $('#ga-tree-submit-error');
    var $result = $('#ga-tree-submit-result');
    var $btn    = $('#ga-tree-submit-btn');

    $err.addClass('d-none').empty();

    if (!_state.ego || !_state.ego.givenName || !_state.ego.surname) {
      $err.removeClass('d-none').text('Completá tu nombre y apellido antes de enviar.');
      return;
    }
    if (!contact) {
      $err.removeClass('d-none').text('Ingresá tu contacto (email, WhatsApp o @instagram) para enviar.');
      $('#ga-tree-contact').focus();
      return;
    }

    // Hide leave modal now that validation passed — only reaches here if POST will fire
    if (_leaveModal) { try { _leaveModal.hide(); } catch (e) {} }
    $btn.prop('disabled', true);

    utils.apiPost(
      cfg.apiBaseUrl + '/api/tree-builder/submit',
      {
        ego:                 _state.ego,
        partner:             _state.partner,
        father:              _state.father,
        mother:              _state.mother,
        paternalGrandfather: _state.paternalGrandfather,
        paternalGrandmother: _state.paternalGrandmother,
        maternalGrandfather: _state.maternalGrandfather,
        maternalGrandmother: _state.maternalGrandmother,
        children:            _state.children,
        contact:             contact
      },
      function(data) {
        _submitted = true;
        _removeNavGuard();
        var refId = data && data.submissionId ? data.submissionId : '';
        $result.removeClass('d-none').html(
          '<div class="alert alert-success small">' +
          '✅ ¡Gracias! Tu árbol fue enviado a Genea Azul. El equipo lo revisará y se contactará con vos.' +
          (refId ? '<br><small class="text-muted">Referencia: ' + utils.escHtml(refId) + '</small>' : '') +
          '</div>'
        );
        $btn.prop('disabled', false);
        try { localStorage.removeItem(_STORAGE_KEY); } catch (e) {}
        if (onSuccessFn) { onSuccessFn(); }
      },
      function(xhr) {
        if (xhr && xhr.status === 429) {
          $err.removeClass('d-none').html(i18n.displayErrorCodeInSpanish('TOO-MANY-REQUESTS'));
        } else {
          $err.removeClass('d-none').text('No se pudo enviar. Intentá de nuevo o contactános por Instagram @genea.azul');
        }
        $btn.prop('disabled', false);
      }
    );
  }

  /* ── Cleanup ────────────────────────────────────────────────────── */
  function cleanup() {
    _searchSeq++; // stale any in-flight POST so its callback won't register new timers
    _removeNavGuard();

    if (_pendingSearchTimer !== null) {
      clearTimeout(_pendingSearchTimer);
      _pendingSearchTimer = null;
    }

    _activeTimers.forEach(function(id) { clearTimeout(id); clearInterval(id); });
    _activeTimers = [];

    if (GeneaAzul.search && GeneaAzul.search.clearTimers) {
      GeneaAzul.search.clearTimers();
    }

    $(document).off('.tree-builder');
    $('#ga-tree-person-modal').off('hidden.bs.modal.tree-builder');

    if (_modal) {
      try { _modal.hide(); _modal.dispose(); } catch (e) {}
      _modal = null;
    }
    if (_leaveModal) {
      try { _leaveModal.dispose(); } catch (e) {}
      _leaveModal = null;
    }

    // Remove teleported modals from body so the next fragment load starts clean
    var modalEl = document.getElementById('ga-tree-person-modal');
    if (modalEl && modalEl.parentNode === document.body) {
      document.body.removeChild(modalEl);
    }
    var leaveModalEl = document.getElementById('ga-tree-leave-modal');
    if (leaveModalEl && leaveModalEl.parentNode === document.body) {
      document.body.removeChild(leaveModalEl);
    }

    // Bootstrap 5 modal.hide() is async (CSS transition) — dispose() may run before
    // the backdrop is removed, orphaning it. Force-clean any stranded backdrops.
    var backdrops = document.querySelectorAll('.modal-backdrop');
    for (var i = 0; i < backdrops.length; i++) {
      if (backdrops[i].parentNode) { backdrops[i].parentNode.removeChild(backdrops[i]); }
    }
    document.body.classList.remove('modal-open');
    document.body.style.removeProperty('overflow');
    document.body.style.removeProperty('padding-right');

    _openerEl = null;
  }

  function _initScrollFade($card) {
    var el = $card.find('.card-body')[0];
    if (!el) return;
    function check() {
      var hasScroll = el.scrollHeight > el.clientHeight + 2;
      var atBottom  = el.scrollTop + el.clientHeight >= el.scrollHeight - 8;
      $card.toggleClass('ga-scroll-fade', hasScroll);
      $card.toggleClass('ga-scroll-at-bottom', !hasScroll || atBottom);
    }
    $card.find('.card-body').off('scroll.scrollfade').on('scroll.scrollfade', check);
    check();
  }

  function prefillFromSearch(state) {
    try {
      localStorage.setItem(_STORAGE_KEY, JSON.stringify(state));
      sessionStorage.setItem('geneaazul_tree_from_search', '1');
    } catch (e) {}
  }

  return { init: init, cleanup: cleanup, prefillFromSearch: prefillFromSearch };

})();

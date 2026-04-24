/* ═══════════════════════════════════════════════════════════════════
   Genea Azul — search.js
   Family search page logic — ported and refactored from index.ftlh
   ═══════════════════════════════════════════════════════════════════ */
var GeneaAzul = window.GeneaAzul || {};

GeneaAzul.search = (function() {

  var cfg = null;
  var i18n = null;
  var utils = null;

  var _activeTimers = [];

  var personsInRequest = [
    'individual', 'spouse', 'father', 'mother',
    'paternalGrandfather', 'paternalGrandmother',
    'maternalGrandfather', 'maternalGrandmother'
  ];

  /* ── Init ───────────────────────────────────────────────────────── */
  function init() {
    cfg   = GeneaAzul.config;
    i18n  = GeneaAzul.i18n;
    utils = GeneaAzul.utils;

    wireAdvancedToggle();
    wireFormInteractions();
    wireSearchButton();
    prefillFromQuery();
    initBackend();
  }

  /* ── Pre-fill form from ?q= URL parameter ───────────────────────── */
  function prefillFromQuery() {
    var params = utils.getQueryParams();
    // getQueryParams uses decodeURIComponent which leaves '+' as-is; fix it
    var q = (params.q || '').replace(/\+/g, ' ').trim();
    if (!q) return;

    var tokens   = q.split(/\s+/);
    var surname   = tokens[tokens.length - 1];
    var givenName = tokens.length > 1 ? tokens.slice(0, tokens.length - 1).join(' ') : '';

    $('#individualSurname').val(surname);
    if (givenName) $('#individualGivenName').val(givenName);
  }

  /* ── Advanced toggle ────────────────────────────────────────────── */
  function wireAdvancedToggle() {
    $('#advancedSearchToggle').off('click').on('click', function() {
      var $adv = $('#search-advanced');
      var open = $adv.hasClass('d-none');
      $adv.toggleClass('d-none', !open);
      $('#advancedToggleIcon')
        .toggleClass('bi-chevron-down', !open)
        .toggleClass('bi-chevron-up', open);
    });
  }

  /* ── Form interactions (sex colors, alive toggles, etc.) ─────────── */
  function wireFormInteractions() {
    toggleYearOfDeath('#paternalGrandfatherIsAlive', '#paternalGrandfatherYearOfDeath');
    toggleYearOfDeath('#paternalGrandmotherIsAlive', '#paternalGrandmotherYearOfDeath');
    toggleYearOfDeath('#maternalGrandfatherIsAlive', '#maternalGrandfatherYearOfDeath');
    toggleYearOfDeath('#maternalGrandmotherIsAlive', '#maternalGrandmotherYearOfDeath');
    toggleYearOfDeath('#fatherIsAlive', '#fatherYearOfDeath');
    toggleYearOfDeath('#motherIsAlive', '#motherYearOfDeath');
    toggleYearOfDeath('#individualIsAlive', '#individualYearOfDeath');
    toggleYearOfDeath('#spouseIsAlive', '#spouseYearOfDeath');

    toggleCardColorBySex('#individualCard', 'individualSex', '#spouseCard', 'spouseSex');
    toggleCardColorBySex('#spouseCard', 'spouseSex');

    // Grandparents toggle
    $('#grandparentsContainerShowBtn').off('change').on('change', function() {
      var show = $(this).prop('checked');
      $('#grandparentsContainer').toggleClass('d-none', !show);
    });
    $('#grandparentsContainer').addClass('d-none'); // hidden by default

    // Spouse toggle
    $('#spouseContainerShowBtn').off('change').on('change', function() {
      var show = $(this).prop('checked');
      $('#spouseContainer').toggleClass('d-none', !show);
    });
    $('#spouseContainer').addClass('d-none');

    // Number maxlength guard
    $('#buscar-section input[type=number]').off('input').on('input', function() {
      utils.maxLengthCheck(this);
    });

    // Allow Enter key to submit
    $('#buscar-section').off('keydown').on('keydown', 'input', function(e) {
      if (e.key === 'Enter') { e.preventDefault(); $('#searchBtn').trigger('click'); }
    });
  }

  function toggleYearOfDeath(isAliveSelector, yearOfDeathSelector) {
    $(document).off('change.search-form', isAliveSelector)
      .on('change.search-form', isAliveSelector, function() {
        var isAlive = $(isAliveSelector).prop('checked');
        $(yearOfDeathSelector).val('').prop('disabled', isAlive);
      });
  }

  function toggleCardColorBySex(cardSelector, radioName, relatedCardSelector, relatedRadioName) {
    $(document).off('change.search-form', 'input[type=radio][name=' + radioName + ']')
      .on('change.search-form', 'input[type=radio][name=' + radioName + ']', function() {
      var isMale = $(this).val() === 'M';
      applyCardSexColor(cardSelector, isMale);

      if (relatedCardSelector && relatedRadioName) {
        var $relRadio = $('input[type=radio][name=' + relatedRadioName + ']');
        $relRadio.filter('[value=M]').prop('checked', !isMale);
        $relRadio.filter('[value=F]').prop('checked', isMale);
        applyCardSexColor(relatedCardSelector, !isMale);
      }
    });
  }

  function applyCardSexColor(cardSelector, isMale) {
    var $card = $(cardSelector);
    $card.toggleClass('ga-sex-male', isMale).toggleClass('ga-sex-female', !isMale);
    $card.find('i.card-header-icon').toggleClass('bi-gender-male', isMale).toggleClass('bi-gender-female', !isMale);
  }

  /* ── Backend initialisation (health check) ──────────────────────── */
  function initBackend() {
    // Obfuscation from URL
    if (/[?&]f=0/.test(window.location.search)) {
      cfg.obfuscateLiving = false;
    }

    // Delayed spinner reveal
    setTimeout(function() {
      if ($('#search-form-container').hasClass('d-none')) {
        $('#search-spinner').css('visibility', 'visible');
      }
    }, 1500);

    utils.apiGetCached(
      cfg.apiBaseUrl + '/api/gedcom-analyzer',
      function(data) {
        $('#search-loading-container').addClass('d-none');
        $('#search-form-container').removeClass('d-none');
        if (data.disableObfuscateLiving) {
          cfg.obfuscateLiving = false;
        }
      },
      function() {
        $('#search-loading-container').addClass('d-none');
        $('#search-spinner-msg').html(utils.backendErrorHtml()).parent().removeClass('d-none');
      }
    );
  }

  /* ── Search button ──────────────────────────────────────────────── */
  function wireSearchButton() {
    $(document).off('click.search', '#searchBtn')
      .on('click.search', '#searchBtn', function(e) {
        e.preventDefault();
        doSearch();
      });
    $(document).off('click.search', '#clearFormBtn')
      .on('click.search', '#clearFormBtn', function(e) {
        e.preventDefault();
        clearForm();
      });
  }

  function clearForm() {
    var $section = $('#buscar-section');
    // Clear text and number inputs (preserve contact)
    $section.find('input[type=text]:not(#individualContact), input[type=number]').val('');
    // Uncheck checkboxes and re-enable year-of-death fields
    $section.find('input[type=checkbox]').prop('checked', false);
    $section.find('input[type=number][id$="YearOfDeath"]').prop('disabled', false);
    // Deselect radio buttons (sex toggles)
    $section.find('input[type=radio]').prop('checked', false);
    // Reset card sex colors
    $('#individualCard, #spouseCard').removeClass('ga-sex-male ga-sex-female');
    $section.find('i.card-header-icon')
      .removeClass('bi-gender-male bi-gender-female').addClass('bi-person');
    // Collapse spouse / grandparents panels
    $('#spouseContainerShowBtn, #grandparentsContainerShowBtn').prop('checked', false);
    $('#spouseContainer, #grandparentsContainer').addClass('d-none');
    // Collapse advanced section
    $('#search-advanced').addClass('d-none');
    $('#advancedToggleIcon').removeClass('bi-chevron-up').addClass('bi-chevron-down');
    // Hide result card
    $('#searchResultCard').addClass('d-none').find('div.card-body').empty();
  }

  function doSearch() {
    _activeTimers.forEach(function(id) { clearTimeout(id); clearInterval(id); });
    _activeTimers = [];

    var $btn = $('#searchBtn');
    var $resultCard = $('#searchResultCard');
    var $resultBody = $resultCard.find('div.card-body');

    $btn.prop('disabled', true);
    $resultCard.removeClass('d-none');
    $resultBody.html(utils.spinnerHtml('Buscando...'));

    var rq = buildRequest();
    postProcessRequest(rq);

    if (isRequestEmpty(rq)) {
      $resultBody.html('<p><b>Error:</b> Llen&aacute; por lo menos un dato.</p>');
      finalizeSearch($btn, $resultCard);
      return;
    }

    if (!rq.contact) {
      $resultBody.html('<p><b>Error:</b> Ingres&aacute; tu contacto (email, WhatsApp o @instagram) para poder avisarte si encontramos familia.</p>');
      $btn.prop('disabled', false);
      var $contact = $('#individualContact');
      $contact.get(0).scrollIntoView({ behavior: 'smooth', block: 'center' });
      $contact.trigger('focus');
      return;
    }

    utils.apiPost(
      cfg.apiBaseUrl + '/api/search/family',
      rq,
      function(data) {
        $resultBody.empty();
        var timeoutMs = 0;

        data.people.forEach(function(person, idx) {
          var $card = buildPersonComponent(person, idx);
          $resultBody.append($card);
          timeoutMs += enableFamilyTreeButtons(person.uuid, person.personsCountInTree, timeoutMs);
        });

        if (data.people.length === 0) {
          if (data.errors && data.errors.length > 0) {
            $resultBody.html('<p>&#9888;&#65039; Se produjo un error en la b&uacute;squeda. &#9888;&#65039;</p>');
            data.errors.forEach(function(code) { $resultBody.append(i18n.displayErrorCodeInSpanish(code)); });
          } else if (!data.potentialResults) {
            if (getSurnamesInRequest(rq).length === 0) {
              $resultBody.html('<p>&#9888;&#65039; No se encontraron resultados. Por favor ingres&aacute; un apellido. &#9888;&#65039;</p>');
            } else {
              $resultBody
                .html('<p>&#128270; No se encontraron resultados. &#128269;</p>')
                .append('<p>Edit&aacute; la b&uacute;squeda agregando <span class="fw-semibold">fechas</span> o completando nombres de <span class="fw-semibold">padres</span> y <span class="fw-semibold">parejas</span>.</p>')
                .append($('<p>').addClass('text-center')
                  .html('&iexcl;Solicit&aacute; acceso al &aacute;rbol y carg&aacute; info!')
                  .append($('<a>').addClass('link-secondary text-decoration-none ms-2')
                    .attr('href', 'https://instagram.com/_u/genea.azul').attr('target', '_blank')
                    .append($('<i>').addClass('bi bi-instagram'))));
              if (rq.individual && rq.individual.sex) {
                $resultBody.append('<p>Verific&aacute; que el <span class="text-danger fw-semibold">sexo</span> de la persona est&eacute; bien seleccionado.</p>');
              }
            }
          } else {
            $resultBody
              .html('<p>&#9888;&#65039; La b&uacute;squeda es ambigua. &#9888;&#65039;</p>')
              .append('<p>Refin&aacute; la b&uacute;squeda agregando <span class="fw-semibold">fechas</span> o completando nombres de <span class="fw-semibold">padres</span> y <span class="fw-semibold">parejas</span>.</p>')
              .append('<p><b>Potenciales resultados:</b> ' + utils.escHtml(data.potentialResults) + '</p>');
          }
        }

        var surnamesInRq = getSurnamesInRequest(rq);
        if (surnamesInRq.length > 0) {
          $resultBody.append(
            $('<div>').addClass('card border-dark mt-4')
              .attr('id', 'searchSurnamesResultCard')
              .append($('<div>').addClass('card-header text-bg-dark').html('Informaci&oacute;n de apellidos'))
              .append($('<div>').addClass('card-body overflow-auto')
                .html($('<span>').addClass('spinner-border spinner-border-sm').attr('role', 'status')))
          );
          finalizeSearch($btn, $resultCard, function() {
            setTimeout(function() { searchSurnames(surnamesInRq); }, 1500);
          });
        } else {
          finalizeSearch($btn, $resultCard);
        }
      },
      function(xhr) {
        handleAjaxError(xhr, $resultBody);
        finalizeSearch($btn, $resultCard);
      }
    );
  }

  /* ── Request building ───────────────────────────────────────────── */
  function buildRequest() {
    return {
      individual: {
        givenName:   utils.trimToNull($('#individualGivenName').val()),
        surname:     utils.trimToNull($('#individualSurname').val()),
        sex:         utils.trimToNull($('input[type=radio][name=individualSex]:checked').val()),
        isAlive:     $('#individualIsAlive').prop('checked'),
        yearOfBirth: utils.toNumber($('#individualYearOfBirth').val()),
        yearOfDeath: utils.toNumber($('#individualYearOfDeath:enabled').val()),
        placeOfBirth:utils.trimToNull($('#individualPlaceOfBirth').val())
      },
      spouse: {
        givenName:   utils.trimToNull($('#spouseGivenName').val()),
        surname:     utils.trimToNull($('#spouseSurname').val()),
        sex:         utils.trimToNull($('input[type=radio][name=spouseSex]:checked').val()),
        isAlive:     $('#spouseIsAlive').prop('checked'),
        yearOfBirth: utils.toNumber($('#spouseYearOfBirth').val()),
        yearOfDeath: utils.toNumber($('#spouseYearOfDeath:enabled').val()),
        placeOfBirth:utils.trimToNull($('#spousePlaceOfBirth').val())
      },
      father: {
        givenName:   utils.trimToNull($('#fatherGivenName').val()),
        surname:     utils.trimToNull($('#fatherSurname').val()),
        sex: 'M',
        isAlive:     $('#fatherIsAlive').prop('checked'),
        yearOfBirth: utils.toNumber($('#fatherYearOfBirth').val()),
        yearOfDeath: utils.toNumber($('#fatherYearOfDeath:enabled').val()),
        placeOfBirth:utils.trimToNull($('#fatherPlaceOfBirth').val())
      },
      mother: {
        givenName:   utils.trimToNull($('#motherGivenName').val()),
        surname:     utils.trimToNull($('#motherSurname').val()),
        sex: 'F',
        isAlive:     $('#motherIsAlive').prop('checked'),
        yearOfBirth: utils.toNumber($('#motherYearOfBirth').val()),
        yearOfDeath: utils.toNumber($('#motherYearOfDeath:enabled').val()),
        placeOfBirth:utils.trimToNull($('#motherPlaceOfBirth').val())
      },
      paternalGrandfather: {
        givenName:   utils.trimToNull($('#paternalGrandfatherGivenName').val()),
        surname:     utils.trimToNull($('#paternalGrandfatherSurname').val()),
        sex: 'M',
        isAlive:     $('#paternalGrandfatherIsAlive').prop('checked'),
        yearOfBirth: utils.toNumber($('#paternalGrandfatherYearOfBirth').val()),
        yearOfDeath: utils.toNumber($('#paternalGrandfatherYearOfDeath:enabled').val()),
        placeOfBirth:utils.trimToNull($('#paternalGrandfatherPlaceOfBirth').val())
      },
      paternalGrandmother: {
        givenName:   utils.trimToNull($('#paternalGrandmotherGivenName').val()),
        surname:     utils.trimToNull($('#paternalGrandmotherSurname').val()),
        sex: 'F',
        isAlive:     $('#paternalGrandmotherIsAlive').prop('checked'),
        yearOfBirth: utils.toNumber($('#paternalGrandmotherYearOfBirth').val()),
        yearOfDeath: utils.toNumber($('#paternalGrandmotherYearOfDeath:enabled').val()),
        placeOfBirth:utils.trimToNull($('#paternalGrandmotherPlaceOfBirth').val())
      },
      maternalGrandfather: {
        givenName:   utils.trimToNull($('#maternalGrandfatherGivenName').val()),
        surname:     utils.trimToNull($('#maternalGrandfatherSurname').val()),
        sex: 'M',
        isAlive:     $('#maternalGrandfatherIsAlive').prop('checked'),
        yearOfBirth: utils.toNumber($('#maternalGrandfatherYearOfBirth').val()),
        yearOfDeath: utils.toNumber($('#maternalGrandfatherYearOfDeath:enabled').val()),
        placeOfBirth:utils.trimToNull($('#maternalGrandfatherPlaceOfBirth').val())
      },
      maternalGrandmother: {
        givenName:   utils.trimToNull($('#maternalGrandmotherGivenName').val()),
        surname:     utils.trimToNull($('#maternalGrandmotherSurname').val()),
        sex: 'F',
        isAlive:     $('#maternalGrandmotherIsAlive').prop('checked'),
        yearOfBirth: utils.toNumber($('#maternalGrandmotherYearOfBirth').val()),
        yearOfDeath: utils.toNumber($('#maternalGrandmotherYearOfDeath:enabled').val()),
        placeOfBirth:utils.trimToNull($('#maternalGrandmotherPlaceOfBirth').val())
      },
      contact: utils.trimToNull($('#individualContact').val())
    };
  }

  function postProcessRequest(rq) {
    personsInRequest.forEach(function(p) {
      if (rq[p] && isPersonEmpty(rq[p])) rq[p] = null;
    });
  }

  function isPersonEmpty(person) {
    if (!person) return true;
    return !person.givenName && !person.surname && !person.yearOfBirth &&
           !person.yearOfDeath && !person.placeOfBirth;
  }

  function isRequestEmpty(rq) {
    for (var i = 0; i < personsInRequest.length; i++) {
      if (rq[personsInRequest[i]]) return false;
    }
    return true;
  }

  function getSurnamesInRequest(rq) {
    var surnames = [];
    personsInRequest.forEach(function(p) {
      if (rq[p] && rq[p].surname) {
        if (surnames.indexOf(rq[p].surname) === -1) surnames.push(rq[p].surname);
      }
    });
    return surnames;
  }

  /* ── Person result card builder ─────────────────────────────────── */
  function buildPersonComponent(person, idx) {
    var $card = $('<div>').addClass('card ga-result-card');
    if (idx > 0) $card.addClass('mt-2');

    if (person.sex === 'M')      $card.addClass('ga-result-card-male');
    else if (person.sex === 'F') $card.addClass('ga-result-card-female');

    var $header = $('<div>').addClass('card-header d-flex align-items-center gap-2');
    if (person.sex === 'M')      $header.addClass('ga-card-header-male');
    else if (person.sex === 'F') $header.addClass('ga-card-header-female');
    else                         $header.addClass('ga-card-header-primary');

    var genderIcon = person.sex === 'M' ? 'bi-gender-male' : (person.sex === 'F' ? 'bi-gender-female' : 'bi-person');
    $header.append($('<i>').addClass('bi ' + genderIcon)).append(i18n.displayNameInSpanish(person.name));
    $card.append($header);

    var $body = $('<div>').addClass('card-body small');

    // AKA
    if (person.aka) {
      $body.append($('<div>').addClass('text-muted fst-italic mb-1').html(i18n.displayNameInSpanish(person.aka)));
    }

    // Birth / death
    var $bd = $('<div>').addClass('mt-1');
    if (person.dateOfBirth) {
      $bd.html('n. ' + i18n.displayDateInSpanish(person.dateOfBirth));
    } else if (person.dateOfDeath) {
      $bd.html('?');
    }
    if (person.dateOfDeath) {
      $bd.append(' &ndash; f. ' + i18n.displayDateInSpanish(person.dateOfDeath));
    } else {
      if (person.dateOfBirth) $bd.append(' &ndash; ');
      $bd.append(person.isAlive ? 'Vive' : (person.sex === 'F' ? 'Fallecida' : 'Fallecido'));
    }
    $body.append($bd);

    // Place of birth
    if (person.placeOfBirth) {
      $body.append($('<div>').addClass('mt-1').html('Pa&iacute;s de nacimiento: ' + utils.escHtml(person.placeOfBirth)));
    }

    // Parents
    if (person.parents && person.parents.length > 0) {
      var $ul = $('<ul>').addClass('mb-0');
      person.parents.forEach(function(parent) {
        var refLabel = parent.referenceType ? ' (' + i18n.displayReferenceTypeInSpanish(parent.referenceType, parent.sex) + ')' : '';
        $ul.append($('<li>').html($('<b>').html(i18n.displayNameInSpanish(parent.name))).append(refLabel));
      });
      $body.append($('<div>').addClass('mt-1').html('Padres: ').append($ul));
    }

    // Spouses + children
    if (person.spouses && person.spouses.length > 0) {
      var $spouseUl = $('<ul>').addClass('mb-0');
      person.spouses.forEach(function(sw) {
        $spouseUl.append($('<li>').html($('<b>').html(i18n.displayNameInSpanish(sw.name))));
        if (sw.children && sw.children.length > 0) {
          var $childUl = $('<ul>').addClass('mb-0');
          sw.children.forEach(function(child) {
            var refLabel = child.referenceType ? ' (' + i18n.displayReferenceTypeInSpanish(child.referenceType, child.sex) + ')' : '';
            $childUl.append($('<li>').html(i18n.displayNameInSpanish(child.name)).append(refLabel));
          });
          $spouseUl.append($childUl);
        }
      });
      $body.append($('<div>').addClass('mt-1').html('Parejas: ').append($spouseUl));
    }

    // Tree info
    var hasPC  = person.personsCountInTree != null;
    var hasSC  = person.surnamesCountInTree != null;
    var hasAG  = person.ancestryGenerations && (person.ancestryGenerations.ascending > 0 || person.ancestryGenerations.directDescending > 0);
    var hasMD  = person.maxDistantRelationship != null;
    var hasDPT = person.distinguishedPersonsInTree && person.distinguishedPersonsInTree.length > 0;

    if (hasPC || hasSC || hasAG || hasMD || hasDPT) {
      var $tul = $('<ul>').addClass('mb-0');
      if (hasAG) {
        $tul.append($('<li>').html('Ascendencia: ' + i18n.getCardinal(person.ancestryGenerations.ascending, 'generaci&oacute;n', 'generaciones')));
        $tul.append($('<li>').html('Descendencia: ' + i18n.getCardinal(person.ancestryGenerations.directDescending, 'generaci&oacute;n', 'generaciones')));
      }
      if (hasPC) $tul.append($('<li>').html('Cantidad de familiares: <b>' + utils.escHtml(String(person.personsCountInTree)) + '</b>'));
      if (hasSC) $tul.append($('<li>').html('Cantidad de apellidos: <b>' + utils.escHtml(String(person.surnamesCountInTree)) + '</b>'));
      if (hasMD) {
        $tul.append($('<li>').html('Relaci&oacute;n m&aacute;s distante:'));
        $tul.append($('<ul>').addClass('mb-0')
          .append($('<li>').html(i18n.displayRelationshipInSpanish(person.maxDistantRelationship)))
          .append($('<li>').html(i18n.displayNameInSpanish(person.maxDistantRelationship.personName))));
      }
      if (hasDPT) {
        var $dpDiv = $('<div>').addClass('mb-0');
        person.distinguishedPersonsInTree.forEach(function(np) {
          var $img = (np.file && np.file.indexOf('http') === 0)
            ? $('<img>').attr('src', np.file).attr('alt', np.name + ' (foto)').addClass('profile-picture-small')
            : $('<i>').attr('style', 'font-size:32px').addClass('bi bi-person');
          $dpDiv.append(
            $('<div>').addClass('mb-1').append(
              $('<div>').addClass('row gx-1')
                .append($('<div>').addClass('col-3 col-sm-2 d-flex align-items-center justify-content-center').attr('style', 'height:50px').html($img))
                .append($('<div>').addClass('col-9 col-sm-10 d-flex align-items-center').text(np.name))
            )
          );
        });
        $tul.append($('<li>').html('Personas destacadas relacionadas:')).append($dpDiv);
      }
      $body.append($('<div>').addClass('mt-1').html('Informaci&oacute;n en el &aacute;rbol: ').append($tul));
    }

    // Ancestry countries
    if (person.ancestryCountries && person.ancestryCountries.length > 0) {
      var $cul = $('<ul>').addClass('mb-0');
      person.ancestryCountries.forEach(function(c) { $cul.append($('<li>').text(c)); });
      $body.append($('<div>').addClass('mt-1').html('Pa&iacute;ses en su ascendencia: ').append($cul));
    }

    // Action buttons
    var uid = person.uuid;
    $body
      .append($('<div>').addClass('mt-2 text-center').attr('id', 'search-family-tree-wait-sign-' + uid)
        .append($('<span>').addClass('spinner-border spinner-border-sm me-1').attr('role', 'status'))
        .append('Generando datos de familiares,<br>esper&aacute; unos segundos...'))
      .append($('<div>').addClass('mt-2 text-center')
        .append($('<a>').addClass('btn btn-sm btn-dark search-family-tree-btn disabled')
          .attr('id', 'search-family-tree-btn-' + uid)
          .attr('role', 'button').attr('href', '#').attr('tabindex', '-1')
          .on('click', { personUuid: uid, btnLocator: '#search-family-tree-btn-' + uid, errorLocator: '#search-family-tree-error-' + uid }, downloadFamilyTreePdf)
          .html('<i class="bi bi-download me-1"></i>Descargar listado de familiares')))
      .append($('<div>').addClass('mt-1 text-center')
        .append($('<a>').addClass('btn btn-sm btn-dark view-family-tree-btn disabled')
          .attr('id', 'view-family-tree-btn-' + uid)
          .attr('role', 'button')
          .attr('href', cfg.apiBaseUrl + '/family-tree/' + uid + (cfg.obfuscateLiving ? '' : '?f=0'))
          .attr('target', '_blank')
          .html('<i class="bi bi-diagram-3-fill me-1"></i>Ver &aacute;rbol geneal&oacute;gico 2D')))
      .append($('<div>').addClass('mt-1 text-center d-flex align-items-center justify-content-center gap-2')
        .append($('<button>').addClass('btn btn-sm btn-dark view-family-tree-3d-btn disabled')
          .attr('id', 'view-family-tree-3d-btn-' + uid)
          .attr('type', 'button')
          .on('click', { personUuid: uid }, function(e) {
            GeneaAzul.familyTree3d.init(e.data.personUuid);
          })
          .html('<i class="bi bi-box-fill me-1"></i>Ver &aacute;rbol geneal&oacute;gico 3D'))
        .append($('<span>').addClass('ga-tree3d-beta-badge').text('Versión de prueba')))
      .append($('<div>').addClass('d-none text-center mt-2').attr('id', 'search-family-tree-error-' + uid));

    return $card.append($body);
  }

  /* ── Family tree button enable logic ────────────────────────────── */
  function enableFamilyTreeButtons(uuid, personsCount, currentTimeoutMs) {
    var delayMs;
    if (!personsCount) {
      delayMs = 0;
    } else {
      delayMs = Math.round(personsCount / cfg.familyTreeProcessPersonsBySec * 1000)
        + cfg.familyTreeProcessFixedDelayMillis;
    }
    var totalMs = currentTimeoutMs + delayMs;

    if (totalMs < cfg.minMillisToDisplayWaitCountDown) {
      _activeTimers.push(setTimeout(function() { activateFamilyTreeButtons(uuid); }, totalMs));
    } else {
      var remaining = Math.ceil(totalMs / 1000);
      $('#search-family-tree-wait-sign-' + uuid).append(
        ' (<span id="search-family-tree-countdown-' + uuid + '">' + remaining + '</span>s)'
      );
      var interval = setInterval(function() {
        remaining--;
        $('#search-family-tree-countdown-' + uuid).text(remaining);
        if (remaining <= 0) clearInterval(interval);
      }, 1000);
      _activeTimers.push(interval);
      _activeTimers.push(setTimeout(function() { activateFamilyTreeButtons(uuid); }, totalMs));
    }

    return delayMs;
  }

  function activateFamilyTreeButtons(uuid) {
    $('#search-family-tree-wait-sign-' + uuid).addClass('d-none');
    $('#search-family-tree-btn-' + uuid).removeClass('disabled');
    $('#view-family-tree-btn-' + uuid).removeClass('disabled');
    $('#view-family-tree-3d-btn-' + uuid).removeClass('disabled');
  }

  function downloadFamilyTreePdf(e) {
    e.preventDefault();
    var data = e.data;
    var $btn = $(data.btnLocator);
    var $err = $(data.errorLocator);
    $btn.prop('disabled', true).addClass('disabled');
    $err.addClass('d-none').empty();

    utils.apiGet(
      cfg.apiBaseUrl + '/api/search/family-tree/' + data.personUuid + '/plainPdf',
      function(pdfData) {
        var b64 = pdfData.pdf.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
        var binary = atob(b64);
        var bytes = new Uint8Array(binary.length);
        for (var i = 0; i < binary.length; i++) { bytes[i] = binary.charCodeAt(i); }
        var blob = new Blob([bytes], { type: 'application/pdf' });
        var url = URL.createObjectURL(blob);
        var link = document.createElement('a');
        link.href = url;
        link.download = 'familiares-' + data.personUuid + '.pdf';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(function() { URL.revokeObjectURL(url); }, 10000);
        $btn.prop('disabled', false).removeClass('disabled');
      },
      function(xhr) {
        $err.removeClass('d-none').html(i18n.displayErrorCodeInSpanish(
          (xhr.responseJSON && xhr.responseJSON.errorCode) ? xhr.responseJSON.errorCode : 'ERROR'
        ));
        $btn.prop('disabled', false).removeClass('disabled');
      }
    );
  }

  /* ── Surname search (appended to results) ────────────────────────── */
  function searchSurnames(surnames) {
    utils.apiPost(
      cfg.apiBaseUrl + '/api/search/surnames',
      { surnames: surnames },
      function(data) {
        var $container = $('#searchSurnamesResultCard div.card-body').empty();
        var results = data.surnames || data.results || [];
        if (results.length === 0) {
          $container.html('<p class="text-muted small mb-0">No se encontró información de apellidos.</p>');
          return;
        }
        results.forEach(function(r, idx) {
          $container.append(buildSurnameComponent(r, idx));
        });
      },
      function() {
        $('#searchSurnamesResultCard div.card-body').html('<p class="text-muted small mb-0">No se pudo obtener información de apellidos.</p>');
      }
    );
  }

  function buildSurnameComponent(r, idx) {
    var $card = $('<div>').addClass('card border-default text-bg-light');
    if (idx > 0) $card.addClass('mt-2');
    $card.append($('<div>').addClass('card-header').text(r.surname));
    var $body = $('<div>').addClass('card-body small');
    if (r.variants && r.variants.length > 0) {
      var $vul = $('<ul>').addClass('mb-0');
      r.variants.forEach(function(v) { $vul.append($('<li>').text(v)); });
      $body.append($('<div>').addClass('mt-1').text('Variantes: ').append($vul));
    }
    $body.append($('<div>').addClass('mt-1').text('Cantidad de personas: ' + r.frequency));
    if (r.countries && r.countries.length > 0) {
      var $cul = $('<ul>').addClass('mb-0');
      r.countries.forEach(function(c) { $cul.append($('<li>').text(c)); });
      $body.append($('<div>').addClass('mt-1').html('Pa&iacute;ses: ').append($cul));
    }
    if (r.firstSeenYear != null && r.lastSeenYear != null) {
      $body.append($('<div>').addClass('mt-1').html('Rango de a&ntilde;os: ' + utils.escHtml(String(r.firstSeenYear)) + '&ndash;' + utils.escHtml(String(r.lastSeenYear))));
    }
    return $card.append($body);
  }

  /* ── Error handler ──────────────────────────────────────────────── */
  function handleAjaxError(xhr, $container) {
    var code = xhr.responseJSON && xhr.responseJSON.errorCode ? xhr.responseJSON.errorCode : null;
    if (code) {
      $container.html(i18n.displayErrorCodeInSpanish(code));
    } else if (xhr.status === 429) {
      $container.html(i18n.displayErrorCodeInSpanish('TOO-MANY-REQUESTS'));
    } else {
      $container.html('<p>Ocurri&oacute; un error inesperado. Por favor intent&aacute; de nuevo.</p>');
    }
  }

  function finalizeSearch($btn, $resultCard, callback) {
    $btn.prop('disabled', false);
    $resultCard.get(0) && $resultCard.get(0).scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    if (callback) callback();
  }

  function cleanup() {
    _activeTimers.forEach(function(id) { clearTimeout(id); clearInterval(id); });
    _activeTimers = [];
    $(document).off('.search-form').off('.search');
  }

  return { init: init, cleanup: cleanup };

})();

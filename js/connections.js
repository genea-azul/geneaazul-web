/* ═══════════════════════════════════════════════════════════════════
   Genea Azul — connections.js
   Connection search page logic
   ═══════════════════════════════════════════════════════════════════ */
var GeneaAzul = window.GeneaAzul || {};

GeneaAzul.connections = (function() {

  var cfg, i18n, utils;

  function init() {
    cfg   = GeneaAzul.config;
    i18n  = GeneaAzul.i18n;
    utils = GeneaAzul.utils;

    initBackend();
    wireButton();
    wireEnter();
  }

  function initBackend() {
    if (cfg.onVacations) {
      $('#conn-loading-container').addClass('d-none');
      $('#conn-vacations-container').removeClass('d-none');
      return;
    }

    setTimeout(function() {
      if ($('#conn-form-container').hasClass('d-none')) {
        $('#conn-spinner').css('visibility', 'visible');
      }
    }, 1500);

    utils.apiGet(
      cfg.apiBaseUrl + '/api/gedcom-analyzer',
      function() {
        $('#conn-loading-container').addClass('d-none');
        $('#conn-form-container').removeClass('d-none');
      },
      function() {
        $('#conn-loading-container').addClass('d-none');
        $('#conn-spinner-msg').html(
          '<p class="text-danger mt-2">No se pudo conectar con el servidor. Por favor intent&aacute; de nuevo m&aacute;s tarde.</p>'
        ).parent().removeClass('d-none');
      }
    );
  }

  function wireButton() {
    $(document).on('click', '#searchConnectionsBtn', function(e) {
      e.preventDefault();
      doSearch();
    });
  }

  function wireEnter() {
    $(document).on('keydown', '#conexiones-section input', function(e) {
      if (e.key === 'Enter') { e.preventDefault(); $('#searchConnectionsBtn').trigger('click'); }
    });
  }

  function doSearch() {
    var $btn = $('#searchConnectionsBtn');
    var $resultCard = $('#searchConnectionsResultCard');
    var $resultBody = $resultCard.find('div.card-body');

    $btn.prop('disabled', true);
    $resultCard.removeClass('d-none');
    $resultBody.html(utils.spinnerHtml('Buscando conexi&oacute;n...'));

    var rq = {
      person1: {
        givenName:   utils.trimToNull($('#person1GivenName').val()),
        surname:     utils.trimToNull($('#person1Surname').val()),
        yearOfBirth: utils.toNumber($('#person1YearOfBirth').val())
      },
      person2: {
        givenName:   utils.trimToNull($('#person2GivenName').val()),
        surname:     utils.trimToNull($('#person2Surname').val()),
        yearOfBirth: utils.toNumber($('#person2YearOfBirth').val())
      }
    };

    if (isRequestEmpty(rq)) {
      $resultBody.html('<p><b>Error:</b> Ten&eacute;s que llenar todos los datos.</p>');
      $btn.prop('disabled', false);
      return;
    }

    utils.apiPost(
      cfg.apiBaseUrl + '/api/search/connection',
      rq,
      function(data) {
        $resultBody.empty();

        if (data.errors && data.errors.length > 0) {
          $resultBody.html('<p>&#9888;&#65039; Se produjo un error en la b&uacute;squeda. &#9888;&#65039;</p>');
          data.errors.forEach(function(code) {
            $resultBody.append(i18n.displayErrorCodeInSpanish(code));
          });
        } else if (!data.connections || data.connections.length === 0) {
          $resultBody.html(
            '<p>&#128270; No se encontr&oacute; conexi&oacute;n entre estas personas. &#128269;</p>'
            + '<p>Puede que no est&eacute;n en el &aacute;rbol, o no haya un camino conocido que las una. '
            + 'Contact&aacute;nos para que carguemos la info 😊</p>'
          );
        } else {
          data.connections.forEach(function(connection, idx) {
            $resultBody.append(buildConnectionComponent(connection, idx));
          });
        }

        $btn.prop('disabled', false);
        $resultCard.get(0).scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      },
      function(xhr) {
        var code = xhr.responseJSON && xhr.responseJSON.errorCode ? xhr.responseJSON.errorCode : null;
        if (code) {
          $resultBody.html(i18n.displayErrorCodeInSpanish(code));
        } else if (xhr.status === 429) {
          $resultBody.html(i18n.displayErrorCodeInSpanish('TOO-MANY-REQUESTS'));
        } else {
          $resultBody.html('<p>Ocurri&oacute; un error inesperado. Por favor intent&aacute; de nuevo.</p>');
        }
        $btn.prop('disabled', false);
      }
    );
  }

  function isRequestEmpty(rq) {
    return !rq.person1 || !rq.person1.givenName || !rq.person1.surname || !rq.person1.yearOfBirth ||
           !rq.person2 || !rq.person2.givenName || !rq.person2.surname || !rq.person2.yearOfBirth;
  }

  function buildConnectionComponent(connection, idx) {
    var $wrap = $('<div>').addClass('card mb-3');
    if (idx > 0) $wrap.addClass('mt-2');

    var $header = $('<div>').addClass('card-header text-bg-dark d-flex align-items-center gap-2');
    $header.append($('<i>').addClass('bi bi-diagram-3')).append('Camino de conexi&oacute;n');
    if (connection.relationship) {
      $header.append($('<span>').addClass('ms-auto badge bg-secondary small').html(i18n.displayRelationshipInSpanish(connection.relationship)));
    }
    $wrap.append($header);

    var $body = $('<div>').addClass('card-body small p-2');

    if (!connection.persons || connection.persons.length === 0) {
      $body.html('<p class="text-muted mb-0">Sin datos de conexi&oacute;n.</p>');
      return $wrap.append($body);
    }

    connection.persons.forEach(function(person, pIdx) {
      var isFirst = pIdx === 0;
      var isLast  = pIdx === connection.persons.length - 1;

      var sexClass = person.sex === 'M' ? 'border-secondary' : (person.sex === 'F' ? 'border-danger' : 'border-light');
      var bgClass  = person.sex === 'M' ? 'text-bg-secondary' : (person.sex === 'F' ? 'text-bg-danger' : 'text-bg-light');

      var $step = $('<div>').addClass('ga-connection-step ' + (isFirst || isLast ? 'fw-semibold' : ''));

      // Arrow
      if (pIdx > 0) {
        $body.append($('<div>').addClass('ga-connection-arrow').html('<i class="bi bi-arrow-down"></i>'));
      }

      // Relationship label
      if (person.relationship) {
        $step.append($('<span>').addClass('ga-connection-label').html(i18n.displayRelationshipInSpanish(person.relationship)));
      }

      var $info = $('<div>').addClass('flex-grow-1');
      $info.append($('<div>').addClass('ga-connection-name').html(i18n.displayNameInSpanish(person.name)));
      var dateStr = '';
      if (person.dateOfBirth) dateStr += 'n. ' + i18n.displayDateInSpanish(person.dateOfBirth);
      if (person.dateOfDeath) dateStr += (dateStr ? ' — ' : '') + 'f. ' + i18n.displayDateInSpanish(person.dateOfDeath);
      if (dateStr) $info.append($('<div>').addClass('ga-connection-data').html(dateStr));

      $step.append($info);
      $body.append($step);
    });

    $wrap.append($body);
    return $wrap;
  }

  return { init };

})();

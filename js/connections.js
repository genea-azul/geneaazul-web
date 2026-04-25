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

    var currentYear = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric' }); // en-CA → guaranteed ASCII year
    $('#person1YearOfBirth, #person2YearOfBirth').attr('max', currentYear);

    initBackend();
    wireButton();
    wireEnter();
  }

  function initBackend() {
    setTimeout(function() {
      if ($('#conn-form-container').hasClass('d-none')) {
        $('#conn-spinner').css('visibility', 'visible');
      }
    }, 1500);

    utils.apiGetCached(
      cfg.apiBaseUrl + '/api/gedcom-analyzer',
      function() {
        $('#conn-loading-container').addClass('d-none');
        $('#conn-form-container').removeClass('d-none');
      },
      function() {
        $('#conn-loading-container').addClass('d-none');
        $('#conn-spinner-msg').html(utils.backendErrorHtml()).parent().removeClass('d-none');
      }
    );
  }

  function wireButton() {
    $(document).off('click.connections', '#searchConnectionsBtn')
      .on('click.connections', '#searchConnectionsBtn', function(e) {
        e.preventDefault();
        doSearch();
      });
  }

  function wireEnter() {
    $(document).off('keydown.connections', '#conexiones-section input')
      .on('keydown.connections', '#conexiones-section input', function(e) {
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
      $resultCard.get(0).scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      return;
    }

    utils.apiPost(
      cfg.apiBaseUrl + '/api/search/connection',
      rq,
      function(data) {
        $resultBody.empty();

        if (data.errors && data.errors.length > 0) {
          var errHtml = '<p>&#9888;&#65039; Se produjo un error en la b&uacute;squeda. &#9888;&#65039;</p>';
          data.errors.forEach(function(code) { errHtml += i18n.displayErrorCodeInSpanish(code); });
          $resultBody.html(errHtml);
        } else if (!data.connections || data.connections.length === 0) {
          $resultBody.html(
            '<p>&#128270; No se encontr&oacute; conexi&oacute;n entre estas personas. &#128269;</p>'
            + '<p>Puede que no est&eacute;n en el &aacute;rbol, o no haya un camino conocido que las une. '
            + 'Contactanos para que carguemos la info 😊</p>'
          );
        } else {
          var distance = data.connections.length - 1;
          $resultBody.append(
            $('<p>').addClass('mb-3 fw-semibold')
              .text('Distancia entre personas: ' + distance + ' paso' + (distance !== 1 ? 's' : ''))
          );
          $resultBody.append(buildConnectionChain(data.connections));
        }

        $btn.prop('disabled', false);
        $resultCard.get(0).scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      },
      function(xhr) {
        var code = xhr.responseJSON && xhr.responseJSON.errorCode ? xhr.responseJSON.errorCode : null;
        if (code) {
          $resultBody.html(i18n.displayErrorCodeInSpanish(code));
        } else if (xhr.status === 0) {
          $resultBody.html(i18n.displayErrorCodeInSpanish('NETWORK'));
        } else if (xhr.status === 429) {
          $resultBody.html(i18n.displayErrorCodeInSpanish('TOO-MANY-REQUESTS'));
        } else {
          $resultBody.html(i18n.displayErrorCodeInSpanish('ERROR'));
        }
        $btn.prop('disabled', false);
        $resultCard.get(0).scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    );
  }

  function isRequestEmpty(rq) {
    return !rq.person1 || !rq.person1.givenName || !rq.person1.surname || !rq.person1.yearOfBirth ||
           !rq.person2 || !rq.person2.givenName || !rq.person2.surname || !rq.person2.yearOfBirth;
  }

  /* Build a single chain card from the flat connections array.
     Each step: { relationship (string, already in Spanish), personName, personData } */
  function buildConnectionChain(connections) {
    var $wrap = $('<div>').addClass('card mb-3');

    var $header = $('<div>').addClass('card-header ga-card-header-primary d-flex align-items-center gap-2');
    $header.html('<i class="bi bi-diagram-3"></i> Camino de conexi&oacute;n');
    $wrap.append($header);

    var $body = $('<div>').addClass('card-body p-2');

    connections.forEach(function(step, idx) {
      if (idx > 0) {
        var relText = step.relationship ? (step.relationship + ' de') : '';
        $body.append(
          $('<div>').addClass('ga-connection-arrow')
            .append($('<i>').addClass('bi bi-arrow-down-short'))
            .append(' ')
            .append($('<span>').addClass('fst-italic').text(relText))
        );
      }

      var $step = $('<div>').addClass('ga-connection-step');
      var $right = $('<div>');
      $right.append($('<span>').addClass('ga-connection-name').text(step.personName));
      if (step.personData) {
        $right.append($('<div>').addClass('ga-connection-data').text('(' + step.personData + ')'));
      }
      $step.append($right);
      $body.append($step);
    });

    $wrap.append($body);
    return $wrap;
  }

  return { init: init };

})();

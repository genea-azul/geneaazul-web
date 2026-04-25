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

  function finalizeConn($btn, $resultCard) {
    $btn.prop('disabled', false);
    $resultCard.get(0).scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function validateYears(rq) {
    var currentYear = parseInt(new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric' }), 10);
    var years = [rq.person1.yearOfBirth, rq.person2.yearOfBirth];
    for (var i = 0; i < years.length; i++) {
      if (years[i] !== null && (years[i] < 1600 || years[i] > currentYear)) return true;
    }
    return false;
  }

  function doSearch() {
    var $btn = $('#searchConnectionsBtn');
    var $resultCard = $('#searchConnectionsResultCard');
    var $resultBody = $resultCard.find('div.card-body');

    $btn.prop('disabled', true);
    $resultCard.removeClass('d-none');
    $resultBody.html(utils.spinnerHtml('Buscando conexión...'));

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

    var fieldChecks = [
      { val: rq.person1.givenName,   id: '#person1GivenName',   msg: 'Ingresá el nombre de la Persona 1.' },
      { val: rq.person1.surname,     id: '#person1Surname',     msg: 'Ingresá el apellido de la Persona 1.' },
      { val: rq.person1.yearOfBirth, id: '#person1YearOfBirth', msg: 'Ingresá el año de nacimiento de la Persona 1.' },
      { val: rq.person2.givenName,   id: '#person2GivenName',   msg: 'Ingresá el nombre de la Persona 2.' },
      { val: rq.person2.surname,     id: '#person2Surname',     msg: 'Ingresá el apellido de la Persona 2.' },
      { val: rq.person2.yearOfBirth, id: '#person2YearOfBirth', msg: 'Ingresá el año de nacimiento de la Persona 2.' }
    ];

    for (var i = 0; i < fieldChecks.length; i++) {
      if (!fieldChecks[i].val) {
        $resultBody.html('<p><b>Error:</b> ' + fieldChecks[i].msg + '</p>');
        finalizeConn($btn, $resultCard);
        var $field = $(fieldChecks[i].id);
        $field.get(0).scrollIntoView({ behavior: 'smooth', block: 'center' });
        $field.trigger('focus');
        return;
      }
    }

    if (validateYears(rq)) {
      $resultBody.html('<p><b>Error:</b> Verificá los años ingresados: tienen que estar entre 1600 y el año actual.</p>');
      finalizeConn($btn, $resultCard);
      return;
    }

    utils.apiPost(
      cfg.apiBaseUrl + '/api/search/connection',
      rq,
      function(data) {
        $resultBody.empty();

        if (data.errors && data.errors.length > 0) {
          var errHtml = '<p>⚠ Se produjo un error en la búsqueda. ⚠</p>';
          data.errors.forEach(function(code) { errHtml += i18n.displayErrorCodeInSpanish(code); });
          $resultBody.html(errHtml);
        } else if (!data.connections || data.connections.length === 0) {
          $resultBody.html(
            '<p>🔍 No se encontró conexión entre estas personas. 🔎</p>'
            + '<p>Puede que no estén en el árbol, o no haya un camino conocido que las une. '
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

        finalizeConn($btn, $resultCard);
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
        finalizeConn($btn, $resultCard);
      }
    );
  }

  /* Build a single chain card from the flat connections array.
     Each step: { relationship (string, already in Spanish), personName, personData } */
  function buildConnectionChain(connections) {
    var $wrap = $('<div>').addClass('card mb-3');

    var $header = $('<div>').addClass('card-header ga-card-header-primary d-flex align-items-center gap-2');
    $header.html('<i class="bi bi-diagram-3"></i> Camino de conexión');
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

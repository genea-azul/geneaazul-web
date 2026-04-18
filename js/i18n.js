/* ═══════════════════════════════════════════════════════════════════
   Genea Azul — i18n.js
   Spanish localization helpers — ported from index.ftlh
   ═══════════════════════════════════════════════════════════════════ */
var GeneaAzul = window.GeneaAzul || {};

GeneaAzul.i18n = (function() {

  /* HTML-escaper shared by this module */
  var escHtml = (GeneaAzul.utils && GeneaAzul.utils.escHtml) || function(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  };

  /* Replaces obfuscated tokens with Spanish equivalents and HTML-escapes the rest */
  function displayNameInSpanish(name) {
    if (!name) return '';
    // Extract known tokens before escaping so their angle brackets aren't clobbered
    name = name.replace('<private>',  '\x00A\x00');
    name = name.replace('<no name>',  '\x00B\x00');
    name = name.replace('<no spouse>', '\x00C\x00');
    name = escHtml(name);
    name = name.replace('\x00A\x00', '&lt;nombre privado&gt;');
    name = name.replace('\x00B\x00', '&lt;nombre desconocido&gt;');
    name = name.replace('\x00C\x00', '&lt;sin pareja&gt;');
    return name;
  }

  /* Converts GEDCOM date format to human-readable Spanish */
  function displayDateInSpanish(date) {
    if (!date) return '';
    if (date === '<private>') return '&lt;fecha de nac. privada&gt;';
    date = escHtml(date);

    date = date.replace(/BET/g, 'entre');
    date = date.replace(/AND/g, 'y');
    date = date.replace(/ABT/g, 'aprox.');
    date = date.replace(/EST/g, 'se estima');
    date = date.replace(/BEF/g, 'antes de');
    date = date.replace(/AFT/g, 'despu&eacute;s de');

    date = date.replace(/(\d+) JAN/g, '$1 de ene de');
    date = date.replace(/(\d+) FEB/g, '$1 de feb de');
    date = date.replace(/(\d+) MAR/g, '$1 de mar de');
    date = date.replace(/(\d+) APR/g, '$1 de abr de');
    date = date.replace(/(\d+) MAY/g, '$1 de may de');
    date = date.replace(/(\d+) JUN/g, '$1 de jun de');
    date = date.replace(/(\d+) JUL/g, '$1 de jul de');
    date = date.replace(/(\d+) AUG/g, '$1 de ago de');
    date = date.replace(/(\d+) SEP/g, '$1 de sep de');
    date = date.replace(/(\d+) OCT/g, '$1 de oct de');
    date = date.replace(/(\d+) NOV/g, '$1 de nov de');
    date = date.replace(/(\d+) DEC/g, '$1 de dic de');

    date = date.replace(/JAN/g, 'ene de');
    date = date.replace(/FEB/g, 'feb de');
    date = date.replace(/MAR/g, 'mar de');
    date = date.replace(/APR/g, 'abr de');
    date = date.replace(/MAY/g, 'may de');
    date = date.replace(/JUN/g, 'jun de');
    date = date.replace(/JUL/g, 'jul de');
    date = date.replace(/AUG/g, 'ago de');
    date = date.replace(/SEP/g, 'sep de');
    date = date.replace(/OCT/g, 'oct de');
    date = date.replace(/NOV/g, 'nov de');
    date = date.replace(/DEC/g, 'dic de');

    return date;
  }

  /* Converts ReferenceType enum + sex to a Spanish label
     Used for parent/child labels in search results */
  function displayReferenceTypeInSpanish(referenceType, sex) {
    if (referenceType === 'ADOPTED_CHILD')   return sex === 'F' ? 'adoptiva' : 'adoptivo';
    if (referenceType === 'FOSTER_CHILD')    return 'de crianza';
    if (referenceType === 'ADOPTIVE_PARENT') return sex === 'F' ? 'adoptiva' : 'adoptivo';
    if (referenceType === 'FOSTER_PARENT')   return 'de crianza';
    return '';
  }

  /* ─── Relationship helpers ──────────────────────────────────────── */
  function getTreeSideInSpanish(treeSides, defaultValue) {
    if (!treeSides) return defaultValue;
    if (['FATHER', 'MOTHER'].every(function(s) { return treeSides.indexOf(s) !== -1; })) return 'padre/madre';
    if (treeSides.indexOf('FATHER') !== -1) return 'padre';
    if (treeSides.indexOf('MOTHER') !== -1) return 'madre';
    return defaultValue;
  }

  function getSexSuffixInSpanish(rel) {
    if (rel.isInLaw) return (rel.spouseSex === 'M' ? 'o' : 'a');
    return (rel.personSex === 'M' ? 'o' : 'a');
  }

  function getGradeSuffixInSpanish(grade, sexSuffix) {
    if (grade <= 1) return '';
    if (grade === 2) return ' segund' + sexSuffix;
    if (grade === 3) return ' tercer' + sexSuffix;
    if (grade === 4) return ' cuart' + sexSuffix;
    if (grade === 5) return ' quint' + sexSuffix;
    if (grade === 6) return ' sext' + sexSuffix;
    if (grade === 7) return ' s&eacute;ptim' + sexSuffix;
    if (grade === 8) return ' octav' + sexSuffix;
    if (grade === 9) return ' noven' + sexSuffix;
    return ' de ' + grade + '&deg; grado';
  }

  function getAdoptionSuffixInSpanish(adoptionType, sexSuffix) {
    if (!adoptionType) return '';
    if (adoptionType === 'ADOPTIVE') return ' adoptiv' + sexSuffix;
    if (adoptionType === 'FOSTER')   return ' de crianza';
    return '';
  }

  function getCardinal(num, singular, plural) {
    return '<b>' + num + '</b> ' + (num === 1 ? singular : plural);
  }

  /* Full relationship name (for maxDistantRelationship) */
  function displayRelationshipInSpanish(rel) {
    if (rel.referenceType === 'SELF') return '<b>esta persona</b>';

    var separated = (rel.isSeparated ? 'ex-' : '');

    if (rel.referenceType === 'SPOUSE') return '<b>' + separated + 'pareja</b>';

    var spousePrefix = (rel.isInLaw ? separated + 'pareja de ' : '');

    if (rel.referenceType === 'PARENT') {
      if (rel.generation === 1) {
        var sx = getSexSuffixInSpanish(rel);
        var name = sx === 'o' ? 'padre' : 'madre';
        return '<b>' + spousePrefix + name + getAdoptionSuffixInSpanish(rel.adoptionType, sx) + '</b>';
      }
      var sx = getSexSuffixInSpanish(rel);
      var gradeSuffix = getGradeSuffixInSpanish(rel.generation - 4, sx);
      var rName;
      if (rel.generation === 2) rName = 'abuel' + sx;
      else if (rel.generation === 3) rName = 'bisabuel' + sx;
      else if (rel.generation === 4) rName = 'tatarabuel' + sx;
      else rName = 'trastatarabuel' + sx;
      var or = '';
      if (rel.generation >= 6) or = '<br>&nbsp; (' + spousePrefix + 'ancestro directo de ' + rel.generation + ' generaciones)';
      return '<b>' + spousePrefix + rName + gradeSuffix + '</b>' + or;
    }

    if (rel.referenceType === 'CHILD') {
      if (rel.generation === 1) {
        if (rel.isInLaw && rel.adoptionType == null) {
          return '<b>' + (rel.personSex === 'M' ? separated + 'yerno' : separated + 'nuera') + '</b>';
        }
        var sx = getSexSuffixInSpanish(rel);
        return '<b>' + spousePrefix + 'hij' + sx + getAdoptionSuffixInSpanish(rel.adoptionType, sx) + '</b>';
      }
      var sx = getSexSuffixInSpanish(rel);
      var gradeSuffix = getGradeSuffixInSpanish(rel.generation - 4, sx);
      var rName;
      if (rel.generation === 2) rName = 'niet' + sx;
      else if (rel.generation === 3) rName = 'bisniet' + sx;
      else if (rel.generation === 4) rName = 'tataraniet' + sx;
      else rName = 'trastataraniet' + sx;
      var or = '';
      if (rel.generation >= 6) or = '<br>&nbsp; (' + spousePrefix + 'descendiente directo de ' + rel.generation + ' generaciones)';
      return '<b>' + spousePrefix + rName + gradeSuffix + '</b>' + or;
    }

    if (rel.referenceType === 'SIBLING') {
      if (rel.isInLaw && !rel.isHalf) {
        return rel.personSex === 'M' ? separated + 'cu&ntilde;ado' : separated + 'cu&ntilde;ada';
      }
      var half = rel.isHalf ? 'medio-' : '';
      var sx = getSexSuffixInSpanish(rel);
      return '<b>' + spousePrefix + half + 'herman' + sx + '</b>';
    }

    if (rel.referenceType === 'COUSIN') {
      var half = rel.isHalf ? 'medio-' : '';
      var sx = getSexSuffixInSpanish(rel);
      return '<b>' + spousePrefix + half + 'prim' + sx + getGradeSuffixInSpanish(rel.grade, sx) + '</b>';
    }

    if (rel.referenceType === 'PIBLING') {
      var half = rel.isHalf ? 'medio-' : '';
      var sx = getSexSuffixInSpanish(rel);
      var gradeSuffix = getGradeSuffixInSpanish(rel.grade, sx);
      var rName1 = 't&iacute;' + sx + (rel.generation > 1 ? '-' : '');
      var rName2;
      if (rel.generation === 1) rName2 = '';
      else if (rel.generation === 2) rName2 = 'abuel' + sx;
      else if (rel.generation === 3) rName2 = 'bisabuel' + sx;
      else if (rel.generation === 4) rName2 = 'tatarabuel' + sx;
      else rName2 = 'trastatarabuel' + sx;
      var or = '';
      if ((rel.generation === 1 && rel.grade >= 2) || rel.generation >= 2) {
        var n1 = (rName2 === '') ? getTreeSideInSpanish(rel.treeSides, 'padre/madre') : rName2.substring(0, rName2.length - 1) + 'o/a';
        var n2 = rel.grade === 1 ? 'herman' + sx : 'prim' + sx;
        var gradeSuffixOr = getGradeSuffixInSpanish(rel.grade - 1, sx);
        or = '<br>&nbsp; (' + spousePrefix + half + n2 + gradeSuffixOr + ' de ' + n1 + ')';
      }
      return '<b>' + spousePrefix + half + rName1 + rName2 + gradeSuffix + '</b>' + or;
    }

    if (rel.referenceType === 'NIBLING') {
      var half = rel.isHalf ? 'medio-' : '';
      var sx = getSexSuffixInSpanish(rel);
      var gradeSuffix = getGradeSuffixInSpanish(rel.grade, sx);
      var rName1 = 'sobrin' + sx + (rel.generation > 1 ? '-' : '');
      var rName2;
      if (rel.generation === 1) rName2 = '';
      else if (rel.generation === 2) rName2 = 'niet' + sx;
      else if (rel.generation === 3) rName2 = 'bisniet' + sx;
      else if (rel.generation === 4) rName2 = 'tataraniet' + sx;
      else rName2 = 'trastataraniet' + sx;
      var or = '';
      if ((rel.generation === 1 && rel.grade >= 2) || rel.generation >= 2) {
        var n1 = (rName2 === '') ? 'hij' + sx : rName2;
        var n2 = rel.grade === 1 ? 'hermano/a' : 'primo/a';
        var gradeSuffixOr = getGradeSuffixInSpanish(rel.grade - 1, 'o/a');
        or = '<br>&nbsp; (' + spousePrefix + n1 + ' de ' + half + n2 + gradeSuffixOr + ')';
      }
      return '<b>' + spousePrefix + half + rName1 + rName2 + gradeSuffix + '</b>' + or;
    }

    return '<b>familiar</b>';
  }

  /* User-friendly error messages */
  function displayErrorCodeInSpanish(errorCode) {
    if (errorCode === 'TOO-MANY-REQUESTS') {
      return '<p>Realizaste demasiadas consultas en la &uacute;ltima hora, por favor esper&aacute; unos minutos o contactanos en redes sociales: <b>@genea.azul</b></p>'
        + '<p>Este es un proyecto de investigaci&oacute;n sin fines de lucro, no hay costo de servicio. 😊</p>';
    }
    if (errorCode === 'CONNECTIONS-PERSON-1-NOT-FOUND') {
      return '<p class="fw-semibold">La persona 1 no fue encontrada</p>'
        + '<p>La persona no se encuentra en el sistema, o quiz&aacute;s falta completar alg&uacute;n dato en el &aacute;rbol. Ponete en contacto con nosotros para que carguemos la info 😊</p>';
    }
    if (errorCode === 'CONNECTIONS-PERSON-1-AMBIGUOUS') {
      return '<p class="fw-semibold">M&aacute;s de un resultado para la persona 1</p>'
        + '<p>Hay m&aacute;s de una persona con esos datos. Complet&aacute; el segundo nombre si corresponde.</p>';
    }
    if (errorCode === 'CONNECTIONS-PERSON-2-NOT-FOUND') {
      return '<p class="fw-semibold">La persona 2 no fue encontrada</p>'
        + '<p>La persona no se encuentra en el sistema. Ponete en contacto con nosotros para que carguemos la info 😊</p>';
    }
    if (errorCode === 'CONNECTIONS-PERSON-2-AMBIGUOUS') {
      return '<p class="fw-semibold">M&aacute;s de un resultado para la persona 2</p>'
        + '<p>Hay m&aacute;s de una persona con esos datos. Complet&aacute; el segundo nombre si corresponde.</p>';
    }
    if (errorCode === 'CONNECTIONS-SAME-PERSON') {
      return '<p class="fw-semibold">Las personas 1 y 2 son las mismas</p>'
        + '<p>No se puede calcular la conexi&oacute;n entre mismas personas.</p>';
    }
    return '<p>' + errorCode + '</p>';
  }

  return {
    displayNameInSpanish:          displayNameInSpanish,
    displayDateInSpanish:          displayDateInSpanish,
    displayReferenceTypeInSpanish: displayReferenceTypeInSpanish,
    displayRelationshipInSpanish:  displayRelationshipInSpanish,
    getTreeSideInSpanish:          getTreeSideInSpanish,
    getSexSuffixInSpanish:         getSexSuffixInSpanish,
    getGradeSuffixInSpanish:       getGradeSuffixInSpanish,
    getAdoptionSuffixInSpanish:    getAdoptionSuffixInSpanish,
    getCardinal:                   getCardinal,
    displayErrorCodeInSpanish:     displayErrorCodeInSpanish
  };

})();

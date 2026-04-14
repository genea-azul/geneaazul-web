/**
 * Genea Azul — Configuration
 * See docs/SPEC.md Section 8.1
 */
var GeneaAzul = window.GeneaAzul || {};

GeneaAzul.config = {
    apiBaseUrl: (window.location.hostname === 'localhost')
        ? window.location.origin
        : 'https://gedcom-analyzer-app.fly.dev',
    onVacations: false,
    obfuscateLiving: true,
    familyTreeProcessPersonsBySec: 225,
    familyTreeProcessFixedDelayMillis: 3250,
    minMillisToDisplayWaitCountDown: 7500
};

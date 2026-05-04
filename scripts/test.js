#!/usr/bin/env node
/**
 * Frontend unit tests — no npm, no build step.
 * Uses only Node.js built-ins (vm, fs, assert, path).
 *
 * Run: node scripts/test.js
 */

'use strict';

var assert = require('assert');
var fs     = require('fs');
var path   = require('path');
var vm     = require('vm');

var ROOT = path.join(__dirname, '..');

// ─── Test runner ─────────────────────────────────────────────────────────────

var passed = 0;
var failed = 0;

function suite(name) {
    console.log('\n' + name);
}

function test(name, fn) {
    try {
        fn();
        console.log('  ✓ ' + name);
        passed++;
    } catch (e) {
        console.log('  ✗ ' + name + '\n    ' + e.message);
        failed++;
    }
}

// ─── Minimal browser-environment sandbox ─────────────────────────────────────
// Enough to load and call the IIFEs without a real DOM.

function makeSandbox(domOverrides) {
    var jqChain = {
        on:          function() { return jqChain; },
        off:         function() { return jqChain; },
        addClass:    function() { return jqChain; },
        removeClass: function() { return jqChain; },
        toggleClass: function() { return jqChain; },
        hide:        function() { return jqChain; },
        show:        function() { return jqChain; },
        css:         function() { return jqChain; },
        attr:        function() { return jqChain; },
        removeAttr:  function() { return jqChain; },
        empty:       function() { return jqChain; },
        text:        function() { return jqChain; },
        append:      function() { return jqChain; },
        val:         function() { return jqChain; },
        focus:       function() { return jqChain; },
        length: 0
    };

    var sandbox = {
        GeneaAzul: {},
        $: function() { return jqChain; },
        document: Object.assign({
            getElementById: function() { return null; },
            createElement:  function() { return { type: '', src: '', onload: null, onerror: null, parentNode: null }; },
            head:           { appendChild: function() {} },
            activeElement:  null,
            body:           { style: {} }
        }, domOverrides || {}),
        history:       { pushState: function() {}, replaceState: function() {} },
        console:       console,
        clearInterval: clearInterval,
        setInterval:   setInterval,
        clearTimeout:  clearTimeout,
        setTimeout:    setTimeout
    };

    // window === the sandbox itself (mirrors browser environment)
    sandbox.window = sandbox;
    sandbox.$.fn = {};

    return sandbox;
}

function loadScript(filePath, sandbox) {
    var code = fs.readFileSync(filePath, 'utf8');
    vm.runInNewContext(code, sandbox);
}

// ─── family-tree-3d.js — null guard ──────────────────────────────────────────

suite('family-tree-3d.js — init() null guard when modal is absent');

var ft3dSandbox = makeSandbox();
loadScript(path.join(ROOT, 'js', 'family-tree-3d.js'), ft3dSandbox);

test('module is exposed on GeneaAzul namespace', function() {
    assert.ok(ft3dSandbox.GeneaAzul.familyTree3d, 'GeneaAzul.familyTree3d should be defined');
    assert.strictEqual(typeof ft3dSandbox.GeneaAzul.familyTree3d.init,    'function');
    assert.strictEqual(typeof ft3dSandbox.GeneaAzul.familyTree3d.dispose, 'function');
});

test('init() does not throw when modal element is absent', function() {
    assert.doesNotThrow(function() {
        ft3dSandbox.GeneaAzul.familyTree3d.init('00000000-0000-0000-0000-000000000001');
    });
});

test('dispose() does not throw when nothing was ever initialised', function() {
    assert.doesNotThrow(function() {
        ft3dSandbox.GeneaAzul.familyTree3d.dispose();
    });
});

test('repeated init() calls do not throw', function() {
    assert.doesNotThrow(function() {
        ft3dSandbox.GeneaAzul.familyTree3d.init('uuid-1');
        ft3dSandbox.GeneaAzul.familyTree3d.init('uuid-2');
    });
});

// ─── _prefillContact serialisation (from search.js) ──────────────────────────
// The private logic is: _prefillContact: rq.contact || undefined
// undefined is omitted by JSON.stringify, so no phantom key survives
// a localStorage round-trip when contact is blank.

suite('_prefillContact — contact || undefined serialisation');

function prefillContact(rq) {
    return rq.contact || undefined;
}

test('carries the contact string when non-empty', function() {
    assert.strictEqual(prefillContact({ contact: 'maria@example.com' }), 'maria@example.com');
});

test('is undefined when contact is an empty string', function() {
    assert.strictEqual(prefillContact({ contact: '' }), undefined);
});

test('is undefined when contact is null', function() {
    assert.strictEqual(prefillContact({ contact: null }), undefined);
});

test('is undefined when contact field is absent', function() {
    assert.strictEqual(prefillContact({}), undefined);
});

test('undefined is omitted by JSON.stringify (no phantom key in stored state)', function() {
    var state = { ego: null, _prefillContact: prefillContact({ contact: '' }) };
    assert.ok(JSON.stringify(state).indexOf('_prefillContact') === -1,
              '_prefillContact key must not appear when contact is blank');
});

test('non-empty contact survives a JSON round-trip', function() {
    var state = { ego: null, _prefillContact: prefillContact({ contact: 'test@test.com' }) };
    var restored = JSON.parse(JSON.stringify(state));
    assert.strictEqual(restored._prefillContact, 'test@test.com');
});

// ─── removeEmpty — used in admin latest.js pages ─────────────────────────────
// The function strips null/undefined from objects (recursively) before
// passing API responses to jsonViewer.

suite('removeEmpty — strips nulls for jsonViewer display');

// Inline copy mirroring the implementation in tree-builder/latest.js.
// If the implementation ever changes, update both this copy and the source.
var removeEmpty = function(obj) {
    return Object.entries(obj)
        .filter(function(kv) { return kv[1] != null; })
        .reduce(function(acc, kv) {
            var k = kv[0], v = kv[1];
            acc[k] = (v === Object(v)) ? removeEmpty(v) : v;
            return acc;
        }, {});
};

test('removes null values', function() {
    assert.deepStrictEqual(removeEmpty({ a: 1, b: null }), { a: 1 });
});

test('removes undefined values', function() {
    assert.deepStrictEqual(removeEmpty({ a: 1, b: undefined }), { a: 1 });
});

test('keeps falsy-but-defined values (0, false, empty string)', function() {
    assert.deepStrictEqual(removeEmpty({ a: 0, b: false, c: '' }), { a: 0, b: false, c: '' });
});

test('recursively cleans nested objects', function() {
    assert.deepStrictEqual(
        removeEmpty({ outer: { keep: 1, drop: null } }),
        { outer: { keep: 1 } }
    );
});

test('payload JSON round-trip: parse then clean', function() {
    var raw = JSON.stringify({ ego: { givenName: 'Ana', sex: null }, contact: 'x@y.com' });
    var cleaned = removeEmpty(JSON.parse(raw));
    assert.deepStrictEqual(cleaned, { ego: { givenName: 'Ana' }, contact: 'x@y.com' });
});

// ─── Results ──────────────────────────────────────────────────────────────────

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
if (failed > 0) process.exit(1);

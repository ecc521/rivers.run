const { stringQuery } = require('./search.js');
const test = require('node:test');
const assert = require('node:assert');

test('stringQuery - matches type', (t) => {
    assert.strictEqual(stringQuery({
        content: 'hello',
        query: 'hello',
        type: 'matches',
        matchCase: true
    }), true);

    assert.strictEqual(stringQuery({
        content: 'hello',
        query: 'HELLO',
        type: 'matches',
        matchCase: false
    }), true);

    assert.strictEqual(stringQuery({
        content: 'hello',
        query: 'world',
        type: 'matches',
        matchCase: true
    }), false);
});

test('stringQuery - contains type', (t) => {
    assert.strictEqual(stringQuery({
        content: 'hello world',
        query: 'hello',
        type: 'contains',
        matchCase: true
    }), true);

    assert.strictEqual(stringQuery({
        content: 'hello world',
        query: 'HELLO',
        type: 'contains',
        matchCase: false
    }), true);

    assert.strictEqual(stringQuery({
        content: 'hello world',
        query: 'foo',
        type: 'contains',
        matchCase: true
    }), false);
});

test('stringQuery - null/undefined content (matchCase: false)', (t) => {
    assert.strictEqual(stringQuery({
        content: null,
        query: 'abc',
        type: 'contains',
        matchCase: false
    }), false);

    assert.strictEqual(stringQuery({
        content: undefined,
        query: 'abc',
        type: 'contains',
        matchCase: false
    }), false);

    assert.strictEqual(stringQuery({
        content: null,
        query: '',
        type: 'matches',
        matchCase: false
    }), true);
});

test('stringQuery - null/undefined content (matchCase: true)', (t) => {
    assert.strictEqual(stringQuery({
        content: null,
        query: 'abc',
        type: 'contains',
        matchCase: true
    }), false);

    assert.strictEqual(stringQuery({
        content: undefined,
        query: 'abc',
        type: 'contains',
        matchCase: true
    }), false);
});

test('stringQuery - null/undefined query', (t) => {
    // query: null/undefined is treated as "", and "abc".includes("") is true.
    assert.strictEqual(stringQuery({
        content: 'abc',
        query: null,
        type: 'contains',
        matchCase: true
    }), true);

    assert.strictEqual(stringQuery({
        content: 'abc',
        query: undefined,
        type: 'contains',
        matchCase: true
    }), true);

    assert.strictEqual(stringQuery({
        content: 'abc',
        query: null,
        type: 'matches',
        matchCase: true
    }), false);
});

test('stringQuery - unknown type', (t) => {
    assert.throws(() => {
        stringQuery({
            content: 'abc',
            query: 'abc',
            type: 'invalid'
        });
    }, /Unknown Search Type invalid/);
});

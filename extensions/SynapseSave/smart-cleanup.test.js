const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const popupSource = fs.readFileSync(path.join(__dirname, 'popup.js'), 'utf8');

function chromeEvent() {
    return { addListener() {} };
}

async function getSuggestions(tabs, stored = {}) {
    const context = vm.createContext({
        URL,
        Date,
        Intl,
        console,
        setTimeout,
        clearTimeout,
        setInterval,
        clearInterval,
        window: { addEventListener() {} },
        document: {
            addEventListener() {},
            getElementById() { return null; },
            querySelector() { return null; },
            querySelectorAll() { return []; }
        },
        chrome: {
            tabs: {
                query: async () => tabs,
                onCreated: chromeEvent(),
                onRemoved: chromeEvent(),
                onUpdated: chromeEvent(),
                onMoved: chromeEvent(),
                onActivated: chromeEvent()
            },
            tabGroups: {
                onCreated: chromeEvent(),
                onRemoved: chromeEvent(),
                onUpdated: chromeEvent(),
                onMoved: chromeEvent()
            },
            storage: {
                local: { get: async () => stored },
                onChanged: chromeEvent()
            },
            runtime: { getURL: value => value }
        }
    });

    vm.runInContext(popupSource, context);
    return vm.runInContext('buildCleanupSuggestions()', context);
}

function tab(id, url, overrides = {}) {
    return {
        id,
        url,
        title: `Tab ${id}`,
        active: false,
        pinned: false,
        audible: false,
        lastAccessed: Date.now(),
        ...overrides
    };
}

test('suggests only the extra copy of a recent duplicate', async () => {
    const url = 'https://example.com/article';
    const result = await getSuggestions([
        tab(1, url, { active: true }),
        tab(2, url)
    ]);

    assert.deepEqual(result.suggestions.map(item => item.tab.id), [2]);
    assert.equal(result.suggestions[0].category, 'duplicates');
});

test('never suggests pinned or audible tabs', async () => {
    const old = Date.now() - (20 * 24 * 60 * 60 * 1000);
    const result = await getSuggestions([
        tab(1, 'https://example.com/pinned', { pinned: true, lastAccessed: old }),
        tab(2, 'https://example.com/audio', { audible: true, lastAccessed: old })
    ]);

    assert.equal(result.suggestions.length, 0);
});

test('suggests an inactive low-use tab using browser lastAccessed data', async () => {
    const old = Date.now() - (8 * 24 * 60 * 60 * 1000);
    const result = await getSuggestions([
        tab(1, 'https://example.com/old', { lastAccessed: old })
    ]);

    assert.deepEqual(result.suggestions.map(item => item.tab.id), [1]);
});

test('does not classify lookalike domains as search results', async () => {
    const result = await getSuggestions([
        tab(1, 'https://notgoogle.example/?q=test')
    ]);

    assert.equal(result.suggestions.length, 0);
});

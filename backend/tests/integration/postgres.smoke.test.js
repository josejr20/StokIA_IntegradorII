const test = require('node:test');
const assert = require('node:assert');
const { assertIsolated, buildTestSequelize } = require('../helpers/testDb');

test('postgres integration smoke (skips if unavailable)', async (t) => {
  try { assertIsolated(); } catch { t.skip('no isolated DB env'); return; }
  const seq = buildTestSequelize();
  try {
    await seq.authenticate();
    t.diagnostic('postgres connected');
  } catch (e) {
    t.skip('postgres unavailable: ' + e.message);
  } finally {
    await seq.close();
  }
});

'use strict';
const assert = require('node:assert/strict');
const { performance } = require('node:perf_hooks');
const { scan, parseName, LIMITS } = require('./core.js');
const enc = new TextEncoder();
const name = (base, n = 1) => base.replace(/(\.[^.]*)?$/, `.sync-conflict-20261007-03000${n}-ABCDEFG$1`);
function file(n, data = '', extras = {}) {
  const bytes = typeof data === 'string' ? enc.encode(data) : data;
  return { name: n, size: bytes.byteLength, lastModified: 1, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), ...extras };
}
async function run() {
  const checks = [];
  async function check(label, test) { const start = performance.now(); await test(); checks.push({ label, pass: true, elapsed_ms: performance.now() - start }); }
  const pair = (a, b) => [file('notes.txt', a), file(name('notes.txt'), b)];
  await check('identical', async () => assert.equal((await scan(pair('one', 'one'))).groups[0].status, 'identical_bytes'));
  await check('different UTF8', async () => assert.equal((await scan(pair('hello', 'ahoj'))).groups[0].status, 'different_bytes'));
  await check('empty is readable', async () => { const g = (await scan(pair('', ''))).groups[0]; assert.equal(g.status, 'identical_bytes'); assert.equal(g.members[0].lines, 0); });
  await check('missing base', async () => assert.equal((await scan([file(name('notes.txt'), 'one')])).groups[0].status, 'missing_base'));
  await check('binary/NUL', async () => { const g = (await scan(pair(new Uint8Array([0, 1]), ''))).groups[0]; assert.equal(g.status, 'needs_review'); assert.equal(g.members[0].status, 'opaque_content'); });
  await check('invalid UTF8', async () => assert.equal((await scan(pair(new Uint8Array([255]), ''))).groups[0].members[0].status, 'invalid_utf8'));
  await check('read error injection', async () => { const inputs = pair('', ''); inputs[0].arrayBuffer = async () => { throw new Error('fixture failure'); }; const g = (await scan(inputs)).groups[0]; assert.equal(g.status, 'needs_review'); assert.equal(g.members[0].status, 'read_error'); assert.equal(g.members[0].sha256, undefined); });
  await check('oversized', async () => { let read = false; const inputs = pair('', ''); inputs[0].size = LIMITS.fileBytes + 1; inputs[0].arrayBuffer = async () => { read = true; }; assert.equal((await scan(inputs)).groups[0].members[0].status, 'too_large'); assert.equal(read, false); });
  await check('duplicate names', async () => await assert.rejects(scan([file('a'), file('a')]), { code: 'duplicate_name' }));
  await check('malformed suffix', async () => { assert.equal(parseName('x.sync-conflict-20260230-120000-ABCDEFG.txt'), null); const r = await scan([file('x.sync-conflict-bad.txt')]); assert.equal(r.groups.length, 0); assert.equal(r.unrecognized.length, 1); });
  await check('case collision', async () => await assert.rejects(scan([file('a.txt'), file('A.txt')]), { code: 'case_collision' }));
  await check('multi-dot/no-extension', async () => { assert.equal(parseName(name('backup.tar.gz')).base, 'backup.tar.gz'); assert.equal(parseName(name('LICENSE')).base, 'LICENSE'); });
  await check('limit exceeded', async () => { await assert.rejects(scan(Array.from({ length: 201 }, (_, i) => file('x' + i))), { code: 'file_count_limit' }); await assert.rejects(scan([file('x', '', { size: LIMITS.totalBytes + 1 })]), { code: 'total_bytes_limit' }); });
  await check('cancel/retry', async () => { const controller = new AbortController(); const inputs = pair('a', 'b'); inputs[0].arrayBuffer = async () => { controller.abort(); return enc.encode('a').buffer; }; await assert.rejects(scan(inputs, { signal: controller.signal }), { code: 'cancelled' }); assert.equal((await scan(pair('a', 'b'))).groups[0].status, 'different_bytes'); });
  await check('source-change injection', async () => { const inputs = pair('a', 'a'); inputs[0].arrayBuffer = async () => { inputs[0].lastModified++; return enc.encode('a').buffer; }; assert.equal((await scan(inputs)).groups[0].members[0].status, 'changed_input'); });
  await check('repeat deterministic output', async () => { const inputs = pair('a', 'b'); Object.freeze(inputs); inputs.forEach(Object.freeze); assert.deepEqual(await scan(inputs), await scan(inputs.slice().reverse())); assert.equal((await scan(inputs)).sourceWrites, 0); });
  const bulk = Array.from({ length: 100 }, (_, i) => [file(`sample${i}.txt`, 'same'), file(name(`sample${i}.txt`), 'same')]).flat();
  const start = performance.now(); const report = await scan(bulk); const elapsed = performance.now() - start;
  assert.equal(report.groups.length, 100); assert.ok(elapsed < 2000, 'Registered latency ceiling exceeded');
  process.stdout.write(JSON.stringify({ status: 'pass', cases: checks, benchmark: { fictional_files: 200, groups: 100, elapsed_ms: elapsed, ceiling_ms: 2000 }, cash_eur: 0, source: 'own_fictional_in_memory_inputs', real_io_failures_tested: false, financial_validation: false }, null, 2) + '\n');
}
run().catch(error => { process.stderr.write(error.stack + '\n'); process.exitCode = 1; });

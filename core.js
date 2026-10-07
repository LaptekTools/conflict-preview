/* Independent local research implementation. No network or filesystem writes. */
(function (scope) {
  'use strict';
  const LIMITS = Object.freeze({ files: 200, fileBytes: 4 * 1024 * 1024, totalBytes: 24 * 1024 * 1024 });
  class ScanError extends Error {
    constructor(code) { super(code); this.code = code; }
  }
  function cancelled(signal) { if (signal && signal.aborted) throw new ScanError('cancelled'); }
  function parseName(name) {
    const match = /^(.*)\.sync-conflict-(\d{8})-(\d{6})-([A-Z2-7]{7})(\.[^.]*)?$/.exec(name);
    if (!match || !match[1] || match[1].includes('.sync-conflict-')) return null;
    const d = match[2], t = match[3];
    const parts = [+d.slice(0, 4), +d.slice(4, 6), +d.slice(6, 8), +t.slice(0, 2), +t.slice(2, 4), +t.slice(4, 6)];
    const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], parts[3], parts[4], parts[5]));
    if (date.getUTCFullYear() !== parts[0] || date.getUTCMonth() + 1 !== parts[1] || date.getUTCDate() !== parts[2] || date.getUTCHours() !== parts[3] || date.getUTCMinutes() !== parts[4] || date.getUTCSeconds() !== parts[5]) return null;
    return { base: match[1] + (match[5] || ''), deviceHint: match[4], nameDateHint: d + '-' + t };
  }
  async function readMember(file, signal) {
    cancelled(signal);
    const item = { name: file.name, size: file.size, status: 'pending' };
    if (file.size > LIMITS.fileBytes) return { ...item, status: 'too_large' };
    const before = [file.size, file.lastModified];
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      cancelled(signal);
      if (bytes.byteLength !== before[0] || file.size !== before[0] || file.lastModified !== before[1]) return { ...item, status: 'changed_input' };
      const hash = new Uint8Array(await scope.crypto.subtle.digest('SHA-256', bytes));
      cancelled(signal);
      item.sha256 = Array.from(hash, b => b.toString(16).padStart(2, '0')).join('');
      if (bytes.includes(0)) return { ...item, status: 'opaque_content' };
      let text;
      try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
      catch (_) { return { ...item, status: 'invalid_utf8' }; }
      return { ...item, status: 'readable_utf8', lines: text ? text.split(/\r\n|\r|\n/).length : 0 };
    } catch (error) {
      if (error instanceof ScanError) throw error;
      return { ...item, status: 'read_error' }; // Never substitute empty content.
    }
  }
  async function scan(selection, options = {}) {
    const files = Array.from(selection);
    cancelled(options.signal);
    if (files.length > LIMITS.files) throw new ScanError('file_count_limit');
    if (files.some(f => !f || typeof f.name !== 'string' || /[\\/]/.test(f.name) || !Number.isSafeInteger(f.size) || f.size < 0 || typeof f.arrayBuffer !== 'function')) throw new ScanError('invalid_input');
    if (files.reduce((sum, f) => sum + f.size, 0) > LIMITS.totalBytes) throw new ScanError('total_bytes_limit');
    const seen = new Map();
    for (const file of files) {
      const lower = file.name.toLowerCase();
      if (seen.has(lower)) throw new ScanError(seen.get(lower) === file.name ? 'duplicate_name' : 'case_collision');
      seen.set(lower, file.name);
    }
    const byName = new Map(files.map(f => [f.name, f]));
    const groups = new Map(), unrecognized = [];
    for (const file of files) {
      const parsed = parseName(file.name);
      if (parsed) {
        if (!groups.has(parsed.base)) groups.set(parsed.base, []);
        groups.get(parsed.base).push(file);
      } else if (file.name.includes('.sync-conflict-')) unrecognized.push(file.name);
    }
    const results = [];
    let reads = 0;
    for (const base of Array.from(groups.keys()).sort()) {
      cancelled(options.signal);
      const original = byName.get(base);
      const list = groups.get(base).slice().sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
      const members = [];
      if (original) list.unshift(original);
      for (const file of list) {
        members.push(await readMember(file, options.signal));
        reads++;
        if (options.onProgress) options.onProgress(reads);
      }
      let status;
      if (!original) status = 'missing_base';
      else if (members.some(m => m.status !== 'readable_utf8')) status = 'needs_review';
      else status = members.every(m => m.sha256 === members[0].sha256) ? 'identical_bytes' : 'different_bytes';
      results.push({ base, status, members });
    }
    cancelled(options.signal);
    return { format: 'conflict-preview-v1', inputKind: 'explicit_selected_snapshots', supported: 'strict_syncthing_name_subset_utf8', selectedFiles: files.length, readAttempts: reads, unrecognized: unrecognized.sort(), groups: results, resolution: 'unknown_user_decision_required', sourceWrites: 0 };
  }
  scope.ConflictPreview = Object.freeze({ scan, parseName, LIMITS, ScanError });
  if (typeof module !== 'undefined') module.exports = scope.ConflictPreview;
})(globalThis);

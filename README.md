# Conflict Preview

A small local preview for **Syncthing conflict copies**. Group selected copies, identify identical UTF-8 bytes and keep unreadable, opaque or missing-original inputs visible. It never picks a winning version, merges, renames or deletes your files.

This is an early mechanism preview. Free diff tools already exist; the narrow purpose here is quick, nonmutating triage without treating failed reads as empty files. No proven customer demand or commercial support offer.

## Try it

Download `conflict-preview.html`. It contains all scripts and styles, no dependencies or analytics. Open it in a modern browser and choose **Try a fictional example** first. The browser harness used for our tests blocks `file:` navigation, so direct-file mode is not independently verified here.

The verified local-server route, if Python is already installed:

```powershell
python -m http.server 8768 --bind 127.0.0.1
```

Open `http://127.0.0.1:8768/conflict-preview.html`. Stop the server with Ctrl+C. No administrator access or sync installation is needed.

Choose the original and its conflict copies **from a single copied, stable folder**. The preview reads only selected snapshots. Limits: 200 files, 4 MiB per file, 24 MiB per selection. Stop cancels the scan between bounded reads; a read already underway may finish before cancellation is noticed. A new selection starts a fresh scan.

Supported naming subset: `notes.sync-conflict-20261007-030001-ABCDEFG.txt`, with a valid date/time and seven uppercase Syncthing device characters. Multiple dots and extensionless names are supported. Nested conflict markers, other providers and unknown names are not silently grouped. Files with duplicate or case-colliding names stop the report.

Binary/NUL and invalid UTF-8 content require manual review. Identical bytes refers to your **selected snapshots**, not the current live folder. Filenames and dates cannot establish lineage or the correct version. Use your normal comparison tool to inspect differences; this preview does not show a semantic diff.

**Save report** downloads JSON containing filenames, sizes, hashes and statuses, not raw contents. Keep names private if sensitive. There are no payment links. A remote host may receive normal page requests and log IP addresses; selected file contents are processed by this page locally.

## Reproduce the mechanism checks

With Node.js already installed:

```powershell
node test_core.cjs
node build.cjs
```

Sixteen registered scenario families cover identity, differences, empty inputs, missing original, binary, invalid UTF-8, injected read errors, size limits, duplicate/case ambiguity, malformed names, multi-dot/extensionless names, cancellation/retry, injected changing descriptors and deterministic repeat processing. A 200-file small fictional benchmark also runs. These are controlled inputs; injected failures are not real OS I/O failures, and do not establish robustness for live synchronization.

Actual browser checks used nine fictional disk files: five groups, one identical, one differing and three requiring review. The generated JSON was found and verified on disk after the browser download-event API timed out. Narrow-screen layout was inspected at 390×844. No customer files or folders were tested.

## Optional feedback

If you already encounter this problem and try the preview, an issue can describe the **number of groups, statuses, time spent and whether you used it again**. Please do not post file contents, private filenames, logs, account details or credentials. Reports are public. Usage and repeated benefit are currently unknown; stars or views alone do not prove usefulness or willingness to pay.

MIT licensed. Independent implementation; the existing Syncthing Deconflicter was examined as a baseline, no code copied. Not affiliated with Syncthing or Dropbox.

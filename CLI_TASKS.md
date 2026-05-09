# AdvantageScope CLI — Task Tracker

## Goal
Add a headless CLI mode to AdvantageScope that can convert/export FRC log files
without launching the Electron GUI. Target use cases: CI pipelines, scripting, batch processing.

## Current State (branch: add-cli)
- 628 commits behind `upstream/main` (Mechanical-Advantage)
- 16 local commits ahead, including both import-perf work and CLI scaffolding
- `CommandLineHandler.ts` exists with a working `convert` subcommand (argparse-based)
- Only `.wpilog` input is wired up; other formats are stubs/TODOs

## Files Touched by Our Branch (since upstream divergence)
| File | Status |
|------|--------|
| `src/main/CommandLineHandler.ts` | **New** — core CLI entry point |
| `src/main/main.ts` | Modified — calls `cliHandler.parseArgs()` at startup |
| `src/hub/LogExporter.ts` | Modified — refactored to be callable from CLI |
| `src/hub/exportWorker.ts` | Modified |
| `src/hub/dataSources/wpilog/WPILOGFileLoader.ts` | Modified |
| `src/hub/dataSources/wpilog/wpilogWorker.ts` | Modified |
| `src/hub/dataSources/dslog/DSEventsLoader.ts` | Modified |
| `src/hub/dataSources/dslog/DSLogLoader.ts` | Modified |
| `src/hub/dataSources/dslog/dsLogWorker.ts` | Modified |
| `src/shared/log/Log.ts` | Modified |
| `src/shared/log/LogField.ts` | Modified |
| `src/main/test.ts` | New — basic CLI smoke test |
| `package.json` / `package-lock.json` | Modified (added `argparse`) |

---

## Phase 0 — Sync with Upstream ✅ DONE (commit af33a65)
- [x] Merge `upstream/main` into `add-cli`
- [x] Resolved conflicts: Log.ts, LogField.ts, dsLogWorker.ts, wpilogWorker.ts, package.json, .gitignore, tsconfig.json
- [x] main.ts kept (our CLI entry point); needs migration to new electron/main.ts structure
- [x] Removed stale `enableLiveSorting` code; Log() now takes one optional arg
- [ ] Verify build still passes (`npm run compile`)

---

## Phase 1 — Fix CLI Initialization ✅ DONE (commit af14bf1)
- [x] Import `CommandLineHandler` into `src/main/electron/main.ts`
- [x] `CLI_MODE` flag: `process.argv.some(x => x === "convert")` before `app.whenReady()`
- [x] Guard at top of `app.whenReady()` callback: runs CLI then `process.exit(0)`
- [x] Deleted old `src/main/main.ts` and `src/main/test.ts`
- [x] Fixed all Log API breakage from upstream merge (mergeLogs→mergeWith, toSerialized signature, constructor args)
- [x] Fixed DSLogLoader field rename and installed @types/argparse

---

## Phase 2 — Input Format Support ✅ DONE (commit e435c1c)
- [x] `.rlog` — RLOGDecoder (isFile=true)
- [x] `.dslog` — DSLogLoader + auto-loads `.dsevents` sidecar if present
- [x] `.dsevents` — DSEventsLoader
- [x] `.hoot` — `convertHoot()` via owlet (auto-downloaded); checks/persists CTRE license; `--accept-ctre-license` flag
- [x] Unknown extension — descriptive error listing supported types

---

## Phase 3 — Output / Export Polish ✅ DONE (commit 1021593)
- [x] validateOutputPath: parent dir must exist; warn to stderr on overwrite
- [x] validateInputPath: existence check (replaces open-for-write side effect during arg parse)
- [x] Progress to stderr with ANSI erase-line (`\r\x1b[K`) for load + export steps
- [x] "Done: <output>" confirmation to stderr on success

---

## Phase 4 — Build / Distribution ✅ DONE (commit 42f6a91)
- [x] Full compile passes: `npm run compile` — exit 0, only pre-existing `minimatch` warning
- [x] End-to-end test (.dslog → csv-table): `out_dslog.csv` 6.99 MB — PASSED
- [x] End-to-end test (.wpilog → wpilog): `out_wpilog.wpilog` 30 MB from 17 MB input — PASSED
  - Note: .wpilog → csv-table is very slow (pre-existing O(fields×timestamps²) issue in LogExporter); not our bug
- [x] `bin` entry / invocation story: dev invocation is `npm start -- convert ...`
  - Electron app; `npx` won't work out-of-the-box
  - Packaged install: `AdvantageScope convert ...` once on PATH

---

## Phase 5 — Nice-to-Haves ✅ DONE (commit c3ded98)
- [x] `info` subcommand: prints duration, field count, timestamp range
- [x] `--fields` flag: lists all fields with type, WPILib type, and unit
- [x] Directory input: `--input <dir>` expands to all log files in that directory
  - Shell glob expansion (`*.wpilog`) works natively on Linux/Mac; use quotes on Windows
- [x] JSON output format: `--format json` → `{field: {type, values: [{timestamp, value}]}}`

---

## Known Issues / Notes
- `xgcd` imported from `mathjs` in `CommandLineHandler.ts` — appears unused, remove
- `fileTypeCheck` passes `this.parser` but argparse errors from a sub-parser still work; fine for now
- `Log.mergeLogs` is used even for single-file input — no regression, just slightly wasteful

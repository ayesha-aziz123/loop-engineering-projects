# Project 07: Observability / Break It On Purpose

## What this project demonstrates

This project wraps Project 03's scheduled loop (`03-the-morning-brief-with-a-memory/morning_brief.js`) with an **observability layer** — without changing a single line of Project 03's core logic. The wrapper's job is simple: record enough about every run that a failure can be diagnosed later from evidence alone, without re-running the failed operation.

```
07-observability-break-it-on-purpose/
├── run_with_observability.js   # the wrapper — spawns morning_brief.js, records everything
├── run.log                     # append-only JSONL record of every run (evidence)
└── README.md
```

## The normal beat

One "beat" = one invocation of the wrapper:

```
node run_with_observability.js
```

run from inside `07-observability-break-it-on-purpose/`. Each beat:

1. Records a start timestamp.
2. Spawns `node morning_brief.js` as a child process (Project 03's script, untouched, cwd set to Project 03's directory) via `spawnSync`, capturing stdout, stderr, and the exit code.
3. Records an end timestamp and computes duration.
4. Appends one JSON line to `run.log` with: `startedAt`, `finishedAt`, `durationMs`, `forcedFailure`, `exitCode`, `succeeded`, `errorMessage`, `stdout`, `stderr`, and a rough `approxTokens` estimate.
5. On failure only, appends a `## NEEDS HUMAN` note directly into Project 03's `progress.md` (see below).

Nothing here changes what Project 03 writes to `progress.md` on a normal, successful run — the Morning Brief entries look exactly as they would without this wrapper.

## Approximate token/cost measurement method

`morning_brief.js` makes no LLM calls itself — it's a deterministic Node script — so there's no API usage to meter directly. The proxy used here estimates the **byte cost of what a scheduling agent turn would read and write for one beat**:

- `progressMdReadBefore` — size of `progress.md` before the run (what an agent would need to read to know current state).
- `progressMdWrittenAfter` — size of `progress.md` after the run (what got persisted).
- `stdoutTokens` — size of the brief the run produced.

Each byte count is converted to an approximate token count using the standard rough heuristic of **~4 bytes per token**. This is a coarse proxy, not a real usage measurement — its purpose is to give a stable, cheap, reproducible number to compare beat-to-beat (e.g. "this beat's brief was 3x larger than usual") without hooking into any real billing API.

**Cadence used for the calculation:** one measurement per beat (per wrapper invocation), matching Project 03's own model — a one-shot job fired once per invocation, not a continuously polled loop. There is no active recurring schedule yet (see below), so all measurements to date come from the two manual beats run for this project (one normal, one forced-failure).

## Cost estimate (ESTIMATE — see caveats)

All numbers below are derived only from the actual `run.log` entry for the one verified normal beat (`startedAt: 2026-08-15T07:13:01.376Z`, `succeeded: true`, `forcedFailure: false`) and from Project 03's own README. Nothing here is invented; where a number can't be defensibly derived, that is stated explicitly instead of guessing.

**1. Approximate tokens per normal beat (ESTIMATE):**

From that `run.log` entry's `approxTokens` object:

```
progressMdReadBefore   1,027 tokens
progressMdWrittenAfter 2,216 tokens
stdoutTokens              909 tokens
-----------------------------------
Total                  4,152 tokens
```

Formula: `tokens_per_beat = progressMdReadBefore + progressMdWrittenAfter + stdoutTokens`, each already computed as `ceil(byteCount / 4)` per the ~4-bytes/token heuristic described above. **≈ 4,152 tokens per normal beat.**

**2. Current cadence used for this calculation (ESTIMATE, not a configured schedule):**

Project 03's README never declares an explicit interval or cron expression — no recurring schedule has been created (Project 07 was explicitly told not to create one). The only cadence signal available is Project 03's own framing: it's named the "morning brief" and its verification steps describe firing it once as "day 1" and again as "day 2." Absent an actual configured schedule, **once per day** is the only cadence implied by Project 03's own documentation, so that is the assumption used below — flagged as an assumption, not a measured fact.

**3. Estimated runs per month (ESTIMATE):**

```
runs_per_month = cadence (1 run/day) × ~30 days/month = 30 runs/month
```

**4. Estimated monthly cost:**

```
monthly_tokens = tokens_per_beat × runs_per_month
               = 4,152 × 30
               = 124,560 tokens/month (≈ 124.6K tokens/month)
```

Converting this to a dollar figure requires a price-per-token, which this project does not have and will not invent:

- `morning_brief.js` makes **zero LLM API calls** — it is a deterministic Node script (git log + filesystem scan). Its own direct execution cost is **$0/month**, regardless of cadence.
- The `4,152`-token figure is a proxy for what a *scheduling agent turn* (e.g. a Claude Code cron job that reads `progress.md` and invokes this job) would read/write per beat — not a metered API call this project made. No model has been chosen for that hypothetical scheduling turn, and no current published per-token rate for it is recorded anywhere in this project.
- **Missing to compute an actual dollar figure:** (a) which model/rate would run the scheduling turn, and (b) that model's current published price per token (e.g. $/1M input and output tokens). Once both are supplied, monthly cost = `monthly_tokens × price_per_token`.

**Estimated monthly cost: not computable from current evidence — token volume is estimated (≈124.6K tokens/month), but no defensible price-per-token is available, so no dollar figure is stated.**

## The intentional failure (`FORCE_FAIL=1`)

```
FORCE_FAIL=1 node run_with_observability.js
```

Rather than adding a fake failure branch to `morning_brief.js` (which would violate "don't change Project 03's core logic"), the wrapper trips a **real, pre-existing error path** in `morning_brief.js`:

1. Before spawning the child process, the wrapper renames `progress.md` to `progress.md.forcefail-backup`.
2. `morning_brief.js` runs, calls its own `readProgress()`, finds no file, and throws its own real error: `progress.md not found at ... Run must read memory first.` — this is existing code (`morning_brief.js:31`), not something Project 07 injects.
3. The wrapper restores `progress.md` from the backup immediately afterward, in a `finally` block, regardless of outcome.
4. Because the run failed, the wrapper appends a `## NEEDS HUMAN` note to the (now-restored) `progress.md`, and records the full failure in `run.log`.

Normal runs (`FORCE_FAIL` unset) never touch `progress.md` outside of what `morning_brief.js` itself writes.

## How to diagnose the failure from log + progress.md alone (no replay)

Given only `run.log` and `progress.md` as evidence:

1. Open `progress.md` and look for the `## NEEDS HUMAN` heading — this immediately flags that the last run failed, with a timestamp, exit code, one-line error message, and a pointer to `run.log` for detail.
2. Open `run.log` (JSON Lines — one object per run) and find the entry whose `startedAt` matches the timestamp in the `NEEDS HUMAN` note. That entry has:
   - `succeeded: false` and `exitCode` — confirms and quantifies the failure.
   - `errorMessage` — the actual `Error: ...` line extracted from stderr (not just the last line of output, which on a Node crash is usually just the version banner — the wrapper specifically looks for a line starting with `Error:`).
   - `stderr` — the full stack trace, enough to identify exactly which line of `morning_brief.js` threw (`readProgress` at line 31, called from `main` at line 132).
   - `forcedFailure: true` — tells you this was Project 07's own controlled fault injection, not an organic Project 03 failure.
   - `durationMs` — confirms the run failed fast (a few hundred ms), consistent with an immediate startup error rather than a hang mid-run.
3. No need to re-run `morning_brief.js` or `FORCE_FAIL=1` again — the stack trace plus the "progress.md not found" message fully explain the failure: Project 07's wrapper had removed `progress.md` at the moment `morning_brief.js` tried to read it.

This was verified in practice: one normal beat was run first (`run.log` entry with `succeeded: true`, `forcedFailure: false`, producing `## Morning Brief #2` in `progress.md`), then one forced-failure beat was run (`run.log` entry with `succeeded: false`, `forcedFailure: true`, producing the `## NEEDS HUMAN` note). Both runs' evidence is preserved in `run.log` and `progress.md` as committed.

## Status / what's intentionally not done yet

- **No recurring schedule exists.** This project has not called `/schedule` or created any cron job — `run_with_observability.js` is invoked manually. Wiring it to Claude Code's scheduler is a follow-up step, not part of this project.
- **Project 03's `morning_brief.js` is unmodified.** All observability is external, added via a wrapper process and reversible file operations.
- **Projects 1, 2, 4, 5, and 6 are untouched.**

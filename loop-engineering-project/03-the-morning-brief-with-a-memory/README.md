# Project 03: The Morning Brief With a Memory

## What this project demonstrates

This project demonstrates **unattended scheduling combined with persistent
memory**. A scheduled run gathers a quick status snapshot of the repo,
writes a short "morning brief," and — critically — remembers what it
already reported. A second run doesn't repeat itself; it reports only what
changed since the first run, using `progress.md` as its memory (the
"spine").

This is a different loop shape from the earlier projects:

- Project 01's `/loop` watches for a file on a timer.
- Project 02's maker-checker loop repeats until a deterministic checker
  passes.
- Project 03's loop **runs once per invocation** (a scheduled, one-shot
  job), and carries state forward between invocations via a file — the
  loop's "memory" lives outside the process, in `progress.md`.

## Project layout

```
03-the-morning-brief-with-a-memory/
├── morning_brief.js   # the scheduled task: gather → compare → brief → remember
├── progress.md        # the spine — persistent memory, read first every run
└── README.md
```

No external dependencies — `morning_brief.js` uses only Node.js built-ins
(`fs`, `path`, `child_process`).

## Architecture

### `progress.md` — the spine

`progress.md` has two parts:

1. A **machine-readable state block** (a fenced ` ```json state ` block)
   holding:
   - `runCount` — how many times the brief has run.
   - `lastRunAt` — timestamp of the last run.
   - `knownCommitHashes` — commit hashes already reported.
   - `knownTodoIds` — `file:line` ids of TODO/FIXME comments already
     reported.
2. A **human-readable Brief Log** — one dated `## Morning Brief #N` section
   per run, appended in order, that a person can read top-to-bottom like a
   diary.

This file is never wiped between runs. It is read at the very start of
every run and rewritten at the very end — that persistence is what turns a
one-shot script into a loop with memory.

### `morning_brief.js` — the scheduled task

Each run does exactly this:

1. **Read `progress.md` first** and parse its state block.
2. **Gather** two simple signals from the repo:
   - Recent commits (`git log`, last 20).
   - TODO/FIXME comments (a recursive scan of text/code files, skipping
     `.git`).
3. **Diff against memory**: compare what was gathered against
   `knownCommitHashes` / `knownTodoIds` from the state block to find what's
   *new* (and what TODOs have since been resolved).
4. **Write the brief**: a short section listing new commits, new TODOs,
   and any resolved TODOs — or explicitly saying "No new commits/TODOs
   since the last brief" when nothing changed.
5. **Update the spine**: rewrite the state block with the current
   snapshot (`runCount + 1`, current commit hashes, current TODO ids) so
   the *next* run knows what this run already covered.

Because step 3 diffs against memory instead of re-gathering blindly, the
second run naturally builds on the first instead of repeating it — even if
the repo hasn't changed at all, the brief will say so explicitly ("No new
commits since the last brief") rather than re-listing everything again.

## How the scheduled loop works

`morning_brief.js` is designed to be triggered by Claude Code's scheduling
mechanism as a **one-shot job that runs once per firing** — not a
continuously repeating loop. Each firing is one independent "morning":

```
node morning_brief.js
```

run from inside `03-the-morning-brief-with-a-memory/`. To demonstrate the
memory behavior, this command is scheduled and fired twice (e.g. via a
Claude Code one-shot cron job for "day 1," then another one-shot job for
"day 2"). Because state lives in `progress.md` and not in the process, it
doesn't matter that each firing is a fresh, independent process — the
memory survives between them.

## How to verify the second run builds on the first

1. Run `node morning_brief.js` once. Check `progress.md`:
   - `runCount` is now `1`.
   - "Morning Brief #1" lists the full baseline (all commits, all TODOs
     found), since nothing was known before.
2. Run `node morning_brief.js` again (a second, separate firing). Check
   `progress.md`:
   - `runCount` is now `2`.
   - "Morning Brief #2" appears **below** brief #1 (append-only log — brief
     #1's text is untouched).
   - Brief #2's "New commits" and "New TODO/FIXME comments" sections say
     "No new … since the last brief" if nothing changed in the repo
     between runs, or list only the genuinely new items if something did
     change (e.g. a new commit was made in between).
   - Brief #2 does **not** re-list the commits/TODOs already reported in
     brief #1 — that's the concrete evidence memory is working.

## Current status

The project structure has been created and verified (files exist, script
syntax checked), but `morning_brief.js` has **not** been run yet. `runCount`
in `progress.md` is still `0` and the Brief Log is still empty.

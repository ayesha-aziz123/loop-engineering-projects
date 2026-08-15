# Project 08: Your Own Daily Loop — Git-Workspace Janitor

## The chore

This repo's own history left real clutter behind: Project 4/5's fix-loop
runs create a fresh `git worktree` and branch per attempt, and not all of
them get cleaned up. At the time this project was scaffolded, the repo
actually had 2 worktrees whose directories had been deleted without
`git worktree remove` (git itself flags these `prunable`), and 14 branches
never merged into `main` (`demo/bad-fix-overfit`, `fix/pricing-rounding-good`,
and 12 `p5/{average,clamp,dedupe}/<runId>` branches from Project 5).

The chore: **once a day, detect and safely tidy up stale git worktrees and
stale branches** — boring, recurring, low-risk, and genuinely useful for
keeping this practice repo navigable.

## Architecture — all 7 required components

```
08-your-own-daily-loop/
├── git_janitor.js              # maker + checker + guard + cleanup + spine update
├── run_with_observability.js   # wrapper: heartbeat's actual entry point
├── progress.md                 # the spine — persistent memory, read first every beat
├── run.log                     # observability log — JSONL, one line per beat
└── README.md
```

1. **Heartbeat** — `run_with_observability.js` is the once-daily entry
   point (see "Scheduling status" below for why it isn't scheduled yet).
2. **Isolated worktree** — the janitor never edits files inside `main`'s
   working tree; its only writes are to its own `progress.md`/`run.log`.
   Its *subject matter* (other worktrees/branches) is touched only via
   git plumbing commands with hard safety rules, never by checking out or
   editing their contents.
3. **Skill/instructions** — `.claude/skills/git-janitor/SKILL.md`.
4. **Maker-checker** — `git_janitor.js`'s `makerPropose()` proposes
   candidates; `checkerApprove()` is a separate, deterministic function
   (not agent judgment) that decides what's actually safe.
5. **Connector** — local only. This repo has no GitHub remote and no `gh`
   CLI configured (verified during the read-only inspection), so the
   "connector" is the structured beat report appended to `progress.md`,
   the same pattern Project 03/07 use, rather than a GitHub PR/issue.
6. **Persistent spine/state** — `progress.md`'s JSON state block
   (`knownStaleWorktreePaths`, `knownUnmergedBranches`, `lastBreaker`,
   `lastCleanup`), read first and rewritten last every beat.
7. **Budget guards** — see below.

## Safety rules (checker + guards)

- A worktree is only pruned because **git itself** already flagged it
  `prunable` — the janitor adds no judgment of its own here.
- A branch is only deleted if `git merge-base --is-ancestor <branch> main`
  succeeds — i.e. it has **zero commits not already on `main`**. Every
  other branch is left as "needs human review," which is the expected,
  normal outcome for most branches, not a failure state.
- `main`/`master` are excluded from candidates before the maker step even
  runs — they can never reach the checker or cleanup step.
- Branch deletion always uses `git branch -d` (safe delete), never `-D`,
  as defense in depth on top of the merge-base check.
- **Hard budget guards:** max 3 worktree prunes and max 5 branch deletions
  per beat. If the approved count in either category exceeds its cap, a
  circuit breaker trips for that category: **nothing** is deleted in that
  category this beat (not even a partial batch up to the cap) — the full
  list is reported as needing human review instead.
- **`APPLY=1` gate:** without this environment variable set, every beat is
  a dry run — candidates and checker decisions are computed and reported,
  nothing is deleted or pruned. This scaffolding was verified exclusively
  with `APPLY` unset against the real repo (see Verification below); the
  one `APPLY=1` test that actually deleted anything ran only inside a
  disposable scratch repo, never against this repository.

## Observability

`run_with_observability.js` spawns `git_janitor.js` as a child process and
records, per beat, to `run.log` (JSONL): `startedAt`, `finishedAt`,
`durationMs`, `apply`, `exitCode`, `succeeded`, `errorMessage`, `stdout`,
`stderr`. On failure, it also appends a `## NEEDS HUMAN — beat failed at
...` note directly to `progress.md`, so a crashed beat is diagnosable from
the spine and the log alone, without re-running anything.

## Scheduling status

**No recurring schedule has been created.** Per explicit instruction, this
turn is scaffolding and verification only. Wiring an actual daily
`CronCreate` job, and then letting it run unattended for a real 7 calendar
days, is a deliberate future step — not simulated, not backfilled, and not
claimed here.

## Concept 15 (answered after a real week of data, not now)

Whether my understanding of the project kept up with what the loop
actually changed will be answered here once the janitor has run
unattended for a real week and there is real `progress.md`/`run.log`
evidence to compare against expectations. Not answered yet — there is no
week of data yet.

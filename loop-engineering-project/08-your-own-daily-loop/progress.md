# Progress Log (Memory / Spine) — Project 08

This file is the persistent memory ("the spine") for the git-workspace
janitor loop. Every beat of `git_janitor.js`:

1. Reads the machine-readable state block below.
2. Proposes cleanup candidates (maker): worktrees git flags as prunable,
   and branches not merged into `main`.
3. Deterministically approves only what's provably safe (checker): prunable
   worktrees, and branches that ARE fully merged into `main`.
4. Applies hard budget guards (max 3 worktree prunes, max 5 branch
   deletions per beat) with a circuit breaker that defers everything if the
   candidate count exceeds the cap.
5. Only mutates the repo if `APPLY=1` is set — otherwise it's a dry run.
6. Appends a human-readable beat report below, and rewrites the state block
   so the next beat only reports what's newly stale.

`main`/`master` are never candidates. Branches are only ever deleted via
`git branch -d` (safe delete — git itself refuses if not fully merged),
never `-D`. Anything not provably safe is left as "needs human review."

## Machine-readable state (read/written by git_janitor.js — do not hand-edit)

```json state
{
  "runCount": 3,
  "lastRunAt": "2026-08-15T07:32:11.907Z",
  "apply": true,
  "knownStaleWorktreePaths": [
    "C:/Windows/Temp/claude/C--Users-HP-Desktop-agent-factory-practice-project-loop-engineering-project/1820c1fa-5b73-4da1-ae4c-4c5eab61c7dd/scratchpad/janitor-test-wt"
  ],
  "knownUnmergedBranches": [
    "unmerged-branch"
  ],
  "lastBreaker": {
    "worktreesTripped": false,
    "branchesTripped": false
  },
  "lastCleanup": {
    "prunedWorktrees": [
      "C:/Windows/Temp/claude/C--Users-HP-Desktop-agent-factory-practice-project-loop-engineering-project/1820c1fa-5b73-4da1-ae4c-4c5eab61c7dd/scratchpad/janitor-test-wt"
    ],
    "deletedBranches": [
      "merged-branch",
      "to-be-orphaned-wt"
    ],
    "errors": [],
    "applied": true
  }
}
```

## Beat Log

## Beat #1 — 2026-08-15

Mode: DRY RUN (report only, nothing deleted)

**Stale worktrees found (git-flagged prunable):**
- `C:/Users/HP/Desktop/agent-factory-practice-project/wt-fix-bad-demo` (branch: refs/heads/demo/bad-fix-overfit)
- `C:/Users/HP/Desktop/agent-factory-practice-project/wt-fix-good` (branch: refs/heads/fix/pricing-rounding-good)

**Branches not merged into main (needs human review, never auto-deleted):**
- `demo/bad-fix-overfit`
- `fix/pricing-rounding-good`
- `p5/average/1786742587`
- `p5/average/1786742834`
- `p5/average/1786743285`
- `p5/average/no-run-id`
- `p5/clamp/1786742587`
- `p5/clamp/1786742834`
- `p5/clamp/1786743285`
- `p5/clamp/no-run-id`
- `p5/dedupe/1786742587`
- `p5/dedupe/1786742834`
- `p5/dedupe/1786743285`
- `p5/dedupe/no-run-id`

**Checker-approved for deletion (fully merged into main):**
- None.

**Cleanup result (dry run — not applied):**
- Worktrees pruned: none
- Branches deleted: none

_Totals as of this beat: 2 stale worktree(s), 14 branch(es) awaiting human review, 0 branch(es) checker-approved._

## Beat #2 — 2026-08-15

Mode: DRY RUN (report only, nothing deleted)

**Stale worktrees found (git-flagged prunable):**
- `C:/Users/HP/Desktop/agent-factory-practice-project/wt-fix-bad-demo` (branch: refs/heads/demo/bad-fix-overfit)
- `C:/Users/HP/Desktop/agent-factory-practice-project/wt-fix-good` (branch: refs/heads/fix/pricing-rounding-good)

**Branches not merged into main (needs human review, never auto-deleted):**
- `demo/bad-fix-overfit`
- `fix/pricing-rounding-good`
- `p5/average/1786742587`
- `p5/average/1786742834`
- `p5/average/1786743285`
- `p5/average/no-run-id`
- `p5/clamp/1786742587`
- `p5/clamp/1786742834`
- `p5/clamp/1786743285`
- `p5/clamp/no-run-id`
- `p5/dedupe/1786742587`
- `p5/dedupe/1786742834`
- `p5/dedupe/1786743285`
- `p5/dedupe/no-run-id`

**Checker-approved for deletion (fully merged into main):**
- None.

**CIRCUIT BREAKER TRIPPED — no destructive action taken this beat:**
- Worktree prune candidates (2) exceed the cap of 1. Deferred entirely — needs human review.

**Cleanup result (dry run — not applied):**
- Worktrees pruned: none
- Branches deleted: none

_Totals as of this beat: 2 stale worktree(s), 14 branch(es) awaiting human review, 0 branch(es) checker-approved._

## Beat #3 — 2026-08-15

Mode: APPLY (destructive actions enabled)

**Stale worktrees found (git-flagged prunable):**
- `C:/Windows/Temp/claude/C--Users-HP-Desktop-agent-factory-practice-project-loop-engineering-project/1820c1fa-5b73-4da1-ae4c-4c5eab61c7dd/scratchpad/janitor-test-wt` (branch: refs/heads/to-be-orphaned-wt)

**Branches not merged into main (needs human review, never auto-deleted):**
- `unmerged-branch`

**Checker-approved for deletion (fully merged into main):**
- `merged-branch`
- `to-be-orphaned-wt`

**Cleanup result (applied):**
- Worktrees pruned: C:/Windows/Temp/claude/C--Users-HP-Desktop-agent-factory-practice-project-loop-engineering-project/1820c1fa-5b73-4da1-ae4c-4c5eab61c7dd/scratchpad/janitor-test-wt
- Branches deleted: merged-branch, to-be-orphaned-wt

_Totals as of this beat: 1 stale worktree(s), 1 branch(es) awaiting human review, 2 branch(es) checker-approved._
## NEEDS HUMAN — beat failed at 2026-08-15T07:33:05.691Z
- exit code: 1
- error: <ref *1> Error: spawnSync git ENOENT
- stderr (last lines): `  stdout: undefined, |   stderr: undefined | } |  | Node.js v24.18.0`
- see `08-your-own-daily-loop/run.log` for the full record of this run.
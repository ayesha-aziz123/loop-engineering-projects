# Project 05: Codify the Body

## What this project demonstrates

Project 04 proved that a fix-loop body works: isolate a bug in its own
worktree, fix the root cause, verify with a real checker, get an
independent reviewer's PASS/FAIL, and only then stage a PR. That process
worked, but it lived entirely in one agent's ad hoc reasoning during a
single conversation — nobody could re-run *exactly* that process again
without re-explaining every step by hand.

Project 05 **codifies** that body: the same Fix → Review → Decide sequence
is written down once, as a saved dynamic workflow script plus a slash
command that invokes it, so it can be re-run identically, on demand, for
any number of candidate bugs, without re-deriving the process each time.
This project is about turning a *demonstrated* process into a *repeatable*
one — not about writing new bug-fixing logic.

## Project layout

```
05-codify-the-body/
├── target-app/                    # shared app with 3 candidate bugs
│   ├── package.json                # "test" script: node --test test/*.test.js
│   ├── src/
│   │   ├── clamp.js                 # bug: return branches swapped
│   │   ├── average.js               # bug: divides by (length - 1)
│   │   └── dedupeSorted.js          # bug: loop starts at index 1
│   └── test/
│       ├── clamp.test.js
│       ├── average.test.js
│       └── dedupeSorted.test.js
├── FRESH_SESSION_EVIDENCE.md      # evidence a memoryless session ran the
│                                    # engine correctly with no dependence
│                                    # on prior runs
└── README.md

.claude/
├── workflows/
│   └── project5-fix-loop-engine.js  # the codified Fix → Review → Decide body
├── commands/
│   └── project5-fix-loop.md         # slash command that invokes the workflow
└── agents/
    └── fix-reviewer.md              # independent reviewer (reused from Project 04)
```

`target-app/` intentionally stays broken on `main`. Just like Projects 02
and 04, the bugs are not fixed in place — the fix only happens inside the
isolated worktrees the workflow creates when it runs. Baseline check
(`npm test` in `target-app/`) currently reports **13 tests, 3 pass, 10
fail**, matching the three broken functions below.

## The 3 candidates

| id | file | bug |
|---|---|---|
| `clamp` | `src/clamp.js` | `clampToRange` has its return branches swapped: in-range values fall through and return `max` instead of `value`, and above-max values are returned unclamped instead of being pulled down to `max`. |
| `average` | `src/average.js` | `average(nums)` divides the sum by `nums.length - 1` instead of `nums.length`, so every result is wrong and a single-element array divides by zero. |
| `dedupe` | `src/dedupeSorted.js` | `dedupeSorted(arr)` starts its comparison loop at index 1, so the first element of the array is always dropped. |

## The codified Fix → Review → Decide workflow

`.claude/workflows/project5-fix-loop-engine.js` is a saved, dynamic
workflow script (not a one-off conversation) with three phases, run once
per candidate, all three candidates driven through the same pipeline:

1. **Fix** (the "maker" step) — for each candidate, in its own isolated
   git worktree:
   1. Isolate: `git worktree add <worktreePath> -b p5/<candidateId>/<runId>`
      from the main repo. The main repo working tree is never edited
      directly.
   2. Reproduce: run the candidate's test file and confirm it fails for
      the expected reason before touching any code.
   3. Fix: edit only the candidate's source file, fixing the root cause
      generally — not special-cased to the literal values in the test
      file.
   4. Re-check: re-run the test file until it exits 0.
   5. Commit the fix in that worktree, scoped only to the one source file.
   The maker reports back a structured result (candidate id, whether the
   checker passed, worktree path, branch name, commit sha, diff summary).

2. **Review** — a separate `fix-reviewer` agent (the same one used in
   Project 04, reused as-is) is given only the diff and the checker
   output — never the maker's reasoning — and independently:
   - re-runs the checker itself rather than trusting the maker's claim,
   - checks whether the fix generalizes or overfits to the test's literal
     values,
   - checks the diff is scoped to the bug, addresses the root cause, and
     doesn't introduce regressions,
   - returns a structured verdict: `PASS` or `FAIL`, with concrete
     reasons tied to specific lines/values.

3. **Decide** — for each candidate:
   - **PASS** → a follow-up agent writes and commits a `PR_DESCRIPTION.md`
     inside that candidate's worktree (title, bug/fix summary, test plan)
     and stops. Nothing is merged or pushed anywhere.
   - **FAIL** → nothing is staged; the FAIL verdict and reasons are the
     final output for that candidate.

All three candidates run through this pipeline independently and in
parallel — one candidate's fix, review, or verdict never references
another candidate's worktree, branch, or state.

## Isolated worktrees and branches

Every run uses a `runId` (e.g. a Unix timestamp) to build unique, ordinary
git worktrees and branches per candidate:

```
worktree: <parent>/p5-<candidateId>-<runId>/
branch:   p5/<candidateId>/<runId>
```

This means concurrent or repeated runs never collide with each other or
with the main repo: each run gets its own three worktrees and three
branches, and the main repo's working tree is never touched by the maker,
reviewer, or PR-staging steps.

## How the reviewer verdict works

The reviewer is a distinct agent identity (`fix-reviewer`) from the maker,
given the diff and told explicitly not to trust the maker's claim that the
checker passed — it re-runs the checker itself. Its job is specifically to
catch what a passing checker alone cannot: whether the fix is a general
solution or overfits to the exact inputs the tests happen to cover. It
must end with exactly one of `VERDICT: PASS` or `VERDICT: FAIL`, plus
concrete reasons referencing specific lines/values — never a bare opinion.
The verdict is what gates the Decide phase: only a `PASS` verdict causes a
PR description to be staged.

## How to run the codified command/workflow

```
/project5-fix-loop
```

This slash command (`.claude/commands/project5-fix-loop.md`):

1. Generates a fresh run id (e.g. `date +%s`), never reused from any prior
   invocation.
2. Calls the saved workflow at
   `.claude/workflows/project5-fix-loop-engine.js` with that run id.
3. Waits for all three candidates to complete Fix → Review → Decide, then
   reports each candidate's branch, verdict, and whether a PR description
   was staged.

Each invocation is fully autonomous once started — no clarifying questions
are asked mid-run.

## Fresh-session statelessness result

`FRESH_SESSION_EVIDENCE.md` documents a run performed by a session with
**zero memory of any prior conversation** — a genuinely fresh session,
verifying the workflow does not implicitly depend on any run that came
before it. That session:

- observed several pre-existing `p5/*` branches from earlier runs already
  on disk (proving nothing was wiped, so the test is meaningful),
- generated a brand-new run id it had never seen,
- ran the Fix → Review → Decide pipeline for all three candidates from
  scratch, starting from the unfixed baseline in `target-app/` on `main`,
- produced three new branches/worktrees/verdicts (all three: PASS),
- confirmed afterward that every pre-existing branch was still present
  with an **identical commit SHA** (proof its run never read, checked out,
  or altered them),
- confirmed no maker/reviewer/PR-staging prompt or result in its run ever
  mentioned another run's branch, worktree, or verdict.

This is the concrete evidence that the workflow's behavior is fully
determined by its `runId` argument and the current state of `main` — never
by conversation history or prior runs.

## Why this is an engine, not yet a loop

`project5-fix-loop-engine.js` is accurately named an **engine**: given a
run id, it deterministically executes Fix → Review → Decide to completion
and then stops. It has no concept of "run again," no sense of time
passing, and no memory of its own prior executions — every run is a
complete, independent, one-shot invocation that must be triggered from
the outside (a person typing `/project5-fix-loop`, or another agent
calling the Workflow tool directly).

That's meaningfully different from Project 01's `/loop` (which watches a
condition on a timer) or Project 03's scheduled morning brief (which
carries state forward between firings via `progress.md`). Project 05 has
the *body* of a loop — a well-defined unit of work with a clear
start/stop and a real check gating its own completion — but nothing that
makes it recur or remember on its own. It's a function, not yet a loop.

## The two things needed to turn it into a real loop

1. **A heartbeat/trigger** — something that calls the engine repeatedly
   without a person invoking `/project5-fix-loop` by hand each time: a
   scheduled cron-style firing (as in Project 03), a file/event watcher
   (as in Project 01's `/loop`), or a webhook — anything that decides
   *when* the next run happens instead of a human deciding it every time.

2. **Persistent progress/state** — a spine file (like Project 03's
   `progress.md`) that survives between firings and lets each new run know
   what earlier runs already did: which candidates already have a PASS'd
   fix staged as a PR, which are still FAILing and need a different
   approach, and which are brand-new. Without this, every firing would
   blindly re-run all three candidates from scratch forever, re-deriving
   the same PASS verdicts (or worse, silently duplicating branches) rather
   than making forward progress across firings the way Project 03's brief
   does.

Both pieces are deliberately absent from this project — Project 05's scope
is the engine itself, proven correct and stateless per run. Adding a
trigger and a memory spine is the natural next step, but is out of scope
here.

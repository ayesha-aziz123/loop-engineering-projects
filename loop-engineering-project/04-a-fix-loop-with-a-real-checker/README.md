# Project 04: A Fix Loop With a Real Checker

## What this project demonstrates

This project demonstrates a **maker-checker-reviewer loop** for fixing a
real bug: an agent (the "maker") fixes a failing implementation, a
deterministic **checker** (a test command) proves the fix works on the
cases it covers, and a separate **independent reviewer agent** judges
whether the fix is a genuine, general solution or an overfit that merely
satisfies those specific test cases. A PR is only eligible once *both* the
checker and the reviewer agree — a passing checker alone is never enough.

This is a stricter loop shape than Project 02's maker-checker pattern: 02
stops as soon as the checker passes, but a checker can be fooled by a fix
that special-cases the exact inputs in the test file. Project 04 adds a
reviewer step specifically to catch that failure mode.

## Project layout

```
04-a-fix-loop-with-a-real-checker/
├── package.json          # defines the "test" (checker) command
├── src/
│   └── pricing.js         # calculateOrderTotal — intentionally buggy baseline
├── test/
│   └── pricing.test.js    # 4 tests covering the rounding bug
└── README.md
```

The bug: `calculateOrderTotal` summed `price * quantity` and added tax
using raw floating-point arithmetic, so it returned values like
`21.639174999999998` instead of `21.64`. Binary floating point can't
represent most decimal fractions exactly, so money totals need explicit
rounding.

This directory holds the **unfixed baseline** (bug + failing tests),
intentionally left uncommitted on `main` — the fix-loop workflow itself
runs in isolated git worktrees/branches, described below.

## The fix-loop workflow

Defined in `.claude/skills/fix-loop/SKILL.md`:

1. **Isolate** — create a dedicated git worktree/branch for the fix. Never
   edit the main working tree directly.
2. **Reproduce** — run the checker (`npm test`) and confirm it fails for
   the expected reason, before touching any code.
3. **Fix** — make the smallest change that addresses the *root cause*, not
   the smallest change that makes the specific test inputs pass.
4. **Re-check** — run the checker again; iterate until it exits 0.
5. **Review** — hand the diff to the independent `fix-reviewer` agent. It
   has not seen the maker's reasoning — only the bug description, the
   diff, and the checker's output.
6. **Decide** — `PASS` → the fix is eligible for a PR; stage a
   `PR_DESCRIPTION.md` on the branch (no auto-merge/push). `FAIL` → no PR;
   go back to step 3.
7. **Bad-fix check** — if a genuinely bad fix ever gets `PASS`, that's a
   bug in the checker or reviewer, not a success, and both must be
   tightened until the bad fix is correctly rejected.

## The checker

```bash
npm test
```

Runs `node --test test/*.test.js` (Node's built-in test runner, no external
dependencies). Deterministic: exit code `0` means every test passed, any
other exit code means the fix isn't done yet. The checker is the single
source of truth for "does it work" — never the maker's own narration.

## The independent reviewer

`.claude/agents/fix-reviewer.md` — a separate agent that re-runs the
checker itself (never trusts a claim that it passes) and then specifically
looks for the failure mode a checker cannot catch: a fix that special-cases
the literal values in the test file instead of fixing the general
calculation. It ends every review with an explicit `VERDICT: PASS` or
`VERDICT: FAIL` plus concrete, input-level reasons.

## Good-fix demonstration

- **Branch:** `fix/pricing-rounding-good`
- **Worktree:** `../wt-fix-good/04-a-fix-loop-with-a-real-checker/`
- **Fix:** adds a `roundToCent` helper
  (`Math.round((value + Number.EPSILON) * 100) / 100`) applied to the
  final computed total — a root-cause fix, not a per-input patch.
- **Checker:** 4/4 tests pass.
- **Reviewer verdict:** `PASS` — independently verified the fix
  generalizes to inputs outside the test suite (e.g. `1.005 → 1.01`).
  Full reasoning saved in that worktree's `REVIEW.md`.
- **Outcome:** `PR_DESCRIPTION.md` staged on the branch. Nothing merged or
  pushed.

## Bad-fix demonstration

- **Branch:** `demo/bad-fix-overfit`
- **Worktree:** `../wt-fix-bad-demo/04-a-fix-loop-with-a-real-checker/`
- **Fix:** leaves the unrounded calculation untouched and instead adds
  `if` branches that hardcode the exact `price`/`quantity`/`taxRate`
  combinations from `test/pricing.test.js` to their expected outputs,
  falling through to the still-buggy raw total for anything else.
- **Checker:** 4/4 tests pass — proving a checker alone cannot distinguish
  this overfit from a real fix.
- **Reviewer verdict:** `FAIL` — identified the hardcoded lookup-table
  anti-pattern and named a concrete input it breaks on (e.g.
  `{price: 0.1, quantity: 3}` with 5% tax still returns an unrounded
  float). Full reasoning saved in that worktree's `REVIEW.md`.
- **Outcome:** no PR staged, as required whenever the verdict is `FAIL`.

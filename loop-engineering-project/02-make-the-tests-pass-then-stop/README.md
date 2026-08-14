# Project 02: Make the Tests Pass, Then Stop

## What this project demonstrates

This project demonstrates a **conditional maker-checker loop**: an agent
(the "maker") repeatedly edits code to satisfy an objective, and a separate,
deterministic **checker** (a test command) decides whether the work is
actually finished. The agent never declares success on its own opinion —
only the checker's exit code counts.

This is a different loop shape from Project 01's `/loop`, which watches for
a *file* on a timer. Here, the loop condition is "does the check command
exit 0?", and the number of iterations is bounded by an attempt cap rather
than time.

## Project layout

```
02-make-the-tests-pass-then-stop/
├── package.json          # defines the "test" (checker) command
├── src/
│   └── stringUtils.js     # implementation — intentionally broken
├── test/
│   └── stringUtils.test.js  # 3 tests, all intentionally failing
└── README.md
```

No external dependencies are used — tests run with Node's built-in
`node:test` module (`node --test`), and assertions use `node:assert/strict`.

## The maker-checker pattern

- **Maker**: whoever edits `src/stringUtils.js` to fix the implementation
  (in this project, that's the agent, working from the checker's failure
  output).
- **Checker**: the test command below. It is the single, deterministic
  source of truth for "is the task done?" The agent must never claim
  completion based on its own reasoning alone — only a passing checker run
  counts.

This separation matters because it prevents the common failure mode where
an agent talks itself into believing a task is finished. The checker can't
be argued with: it either exits 0 or it doesn't.

## The test / check command

```bash
npm test
```

This runs `node --test test/*.test.js` and is deterministic:

- **Exit code `0`** → all tests pass → the task is done.
- **Exit code non-zero** → at least one test is still failing → more work
  is needed.

Currently, `src/stringUtils.js` contains 3 intentionally broken functions
(`reverseString`, `isPalindrome`, `titleCase`), so `npm test` currently
exits non-zero. This state has been verified but **not yet fixed** — the
fix loop has not been run.

## How the loop works

1. Run `npm test`.
2. If the exit code is `0`, stop — the task is done.
3. Otherwise, read the failure output to see which test(s) failed and why.
4. Edit `src/stringUtils.js` to address the failure(s).
5. Go back to step 1.

## The 6-attempt cap

The loop is capped at **6 attempts**. Each attempt is one full
"run checker → inspect failures → fix implementation" cycle. The cap exists
so that a stuck or looping agent can't run forever — if 6 attempts pass
without the checker exiting 0, the loop must stop and report the remaining
failures rather than continuing indefinitely.

Importantly, the cap is a *ceiling*, not a *target*: the loop is expected to
stop earlier, as soon as `npm test` exits 0. It only stops because of the
attempt cap if the implementation genuinely can't be fixed within 6 tries —
the loop must never stop merely because 6 attempts were used up while tests
were still passing already; it stops as soon as they pass, whichever
attempt that happens on.

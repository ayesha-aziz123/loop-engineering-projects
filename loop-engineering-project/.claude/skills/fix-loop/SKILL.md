---
name: fix-loop
description: Fix a real bug in isolation, verify with the real checker, get an independent reviewer's PASS/FAIL, and only then stage a PR. Use for Project 04-style fix-loop tasks.
---

# Fix loop with a real checker

A maker-checker-reviewer loop for fixing one real bug. The checker's exit
code and the reviewer's verdict are both required before any PR is staged —
neither the maker's own opinion nor a passing checker alone is sufficient.

## Steps

1. **Isolate.** Create a dedicated `git worktree` (or branch) for the fix.
   Never edit the main working tree directly. Name the branch after the bug,
   e.g. `fix/<short-bug-description>`.

2. **Reproduce.** Run the real checker (`npm test` in the project directory)
   and confirm it fails for the reason you expect, before touching any code.

3. **Fix.** Make the smallest change that addresses the root cause of the
   bug — not the smallest change that makes the specific test inputs pass.
   A fix that special-cases the exact values in the test suite is not a fix;
   it is an overfit that the reviewer step exists to catch.

4. **Re-check.** Run the checker again. Iterate steps 3–4 until it exits 0.
   If it doesn't pass within a reasonable number of attempts, stop and
   report the remaining failures rather than continuing indefinitely.

5. **Review.** Once the checker passes, hand the diff to the separate
   `fix-reviewer` agent. It has not seen your reasoning — only the bug
   description, the diff, and the checker's output. It returns `PASS` or
   `FAIL` with concrete reasons.

6. **Decide.**
   - **PASS** → the fix is eligible for a PR. Write a `PR_DESCRIPTION.md`
     (title, summary, test plan) on the branch. Do not merge or push
     anywhere automatically — staging the description is the final step.
   - **FAIL** → do not stage a PR. Read the reviewer's reasons, go back to
     step 3, and fix the actual issue it identified (not just the surface
     symptom). Re-run steps 4–5.

7. **If a genuinely bad fix gets PASS**, that's a bug in the checker or the
   reviewer, not a success. Tighten the checker (add the edge case the bad
   fix missed) and/or sharpen the reviewer's review criteria, then re-run
   the loop from step 4 until the bad fix is correctly rejected.

## Non-negotiables

- The checker is the single source of truth for "does it work" — its exit
  code, not the maker's narration.
- The reviewer is the single source of truth for "is it a real fix" — it
  must independently justify PASS/FAIL, not just echo the checker result.
- A PR is never created on a FAIL verdict, regardless of checker status.

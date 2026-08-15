---
name: git-janitor
description: Daily maker-checker loop that detects stale git worktrees and stale branches in this repo, deterministically approves only what's provably safe to clean up, and leaves everything else as NEEDS HUMAN. Use for Project 08-style daily chore loops.
---

# Git-workspace janitor

A maker-checker loop for repo hygiene. The maker proposes; a deterministic
checker — not the maker's own opinion — decides what's safe; hard budget
guards cap the blast radius; everything not provably safe is left alone and
flagged for a human.

## Steps

1. **Propose (maker).** Gather two candidate sets from the real repo state,
   never from memory or assumption:
   - Worktrees `git worktree list --porcelain` itself flags `prunable`
     (i.e. their directory no longer exists — git's own logic, not a
     guess).
   - Branches, excluding `main`/`master`, that exist in
     `refs/heads/`.

2. **Approve (checker) — deterministic, not agent judgment.** For each
   candidate, apply a fixed rule with no discretion:
   - A worktree is approved for pruning only because git already flagged
     it `prunable`.
   - A branch is approved for deletion only if
     `git merge-base --is-ancestor <branch> main` succeeds — i.e. it has
     **zero commits that aren't already on `main`**. If that check fails
     for any reason (including the branch simply not being merged yet),
     the branch is NOT approved.
   - Anything not approved becomes a "needs human review" item — this is
     the normal, expected outcome for most branches, not an error.

3. **Guard (budget).** Hard caps: max 3 worktree prunes and max 5 branch
   deletions per beat. If the approved count for either exceeds its cap,
   trip a circuit breaker for that category: do **nothing** destructive in
   that category this beat (not even a partial batch up to the cap) and
   report the full candidate list as needing human review instead.

4. **Clean up (guarded execution).** Only mutates the repo when the
   environment variable `APPLY=1` is set. Without it, every beat is a dry
   run: candidates and the checker's decisions are computed and reported,
   nothing is deleted or pruned. Branch deletion always uses
   `git branch -d` (never `-D`) as defense in depth — git itself refuses
   the delete a second time if a branch somehow isn't actually fully
   merged. `main`/`master` are excluded from candidates before the maker
   step even runs, so they can never reach the checker or cleanup step.

5. **Record (spine).** `progress.md` is read first and rewritten last
   every beat: its JSON state block tracks what staleness has already been
   reported, so the next beat's human-readable report only surfaces what's
   newly stale, not a repeat of everything already known. The beat report
   itself is appended, never overwritten.

6. **Observe.** Run the beat through `run_with_observability.js`, not
   `git_janitor.js` directly, so start/end timestamps, duration, exit
   status, stdout/stderr, and any crash are captured to `run.log` and (on
   failure) a `NEEDS HUMAN` note is appended to `progress.md` — sufficient
   to diagnose a failed beat without re-running it.

## Non-negotiables

- The checker's rule is the single source of truth for "safe to delete" —
  never the maker's or an agent's narrative judgment about a branch.
- A branch or worktree is only ever touched if it is provably safe by the
  checker's fixed rule; ambiguity always resolves to NEEDS HUMAN, never to
  deletion.
- `main`/`master` are never candidates, under any condition.
- Budget guards are hard caps, not suggestions — a circuit breaker defers
  the entire category rather than applying a partial batch.
- Without `APPLY=1`, no beat is ever destructive, regardless of what the
  checker approves.

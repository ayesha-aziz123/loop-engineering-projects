# Project 06: The Doorbell Loop

## What this project demonstrates

Every earlier loop in this course was triggered by something inside our own
control: a timer (`/loop`), a deterministic checker's exit code (Project 02),
a scheduled one-shot firing (Project 03), or a person typing a slash command
(Project 05). Project 06 demonstrates a different trigger entirely: a
**real external event on a real GitHub repository** — a pull request being
opened, or a pull request being updated — automatically ringing a doorbell
that runs an automated code review. No person invokes the review by hand;
GitHub's `pull_request` webhook does.

This repository (`loop-engineering-project-6`) is a **dedicated, throwaway
repo for Project 06 only** — a separate GitHub repository and a separate
local git history from the `loop-engineering-project` repo that holds
Projects 02–05. Nothing here touches those projects.

## The doorbell: `.github/workflows/claude-review.yml`

```yaml
on:
  pull_request:
    types: [opened, synchronize]
```

- **`opened`** — fires the first time a PR is created against this repo.
- **`synchronize`** — fires again every time a new commit is pushed to an
  already-open PR's branch.

Each firing checks out the PR, runs an automated Claude Code review over
the diff, and posts the findings as a PR comment. The review step never
modifies any file — it is read-only, comment-only.

## Review mechanism

This workflow uses the official **`anthropics/claude-code-action`** GitHub
Action, authenticated with an `ANTHROPIC_API_KEY` repository secret. This
was chosen as the safest mechanism available in the environment this
project was set up from: that environment had no `gh` CLI, no cached
GitHub API token, and no way to programmatically install/verify the Claude
GitHub App on this account. The Action approach only requires a repo
secret that the repository owner adds themselves through the GitHub web
UI — nothing here has or needs write access to install a GitHub App.

**Setup step required once, by the repo owner, before the first PR:**
add a repository secret named `ANTHROPIC_API_KEY` (Settings → Secrets and
variables → Actions → New repository secret) with a valid Anthropic API
key.

## Project layout

```
loop-engineering-project-6/
├── .github/workflows/claude-review.yml   # the doorbell + the reviewer
├── src/
│   └── inventory.js                       # minimal app under review
├── test/
│   └── inventory.test.js                  # 9 tests, all passing on main
├── package.json                           # "test": node --test test/*.test.js
└── README.md
```

## The minimal application

`src/inventory.js` is intentionally small: three functions operating on a
list of `{ id, name, qty }` items —

- `getItemAt(items, index)` — bounds-checked index lookup.
- `findItemById(items, id)` — null-safe lookup by id.
- `totalQuantity(items)` — null-safe sum of `qty` across all items.

Its only purpose is to give a pull request something real to change. The
implementation on `main` is correct and all 9 tests in
`test/inventory.test.js` pass. Nothing on `main` is ever broken on
purpose — the bug only exists on a demo PR branch, exactly as in
Projects 02/04/05.

## The planted-bug demo (the practical proof)

To prove the doorbell actually works, this project runs a real end-to-end
demo against the real GitHub repo — no simulated or fabricated review:

1. Open a real pull request against `main` that plants **one** realistic,
   obvious bug (an off-by-one bounds check or a missing null check) into
   one of the three functions above.
2. The `opened` event fires the workflow. Claude Code reviews the diff and
   posts a PR comment. **Expected: the comment identifies and flags the
   planted bug**, naming the file/line and the input that breaks.
3. Push one small follow-up commit to the same PR branch.
4. The `synchronize` event fires the workflow again — proving the loop
   re-fires on every update to the PR, not just once at creation.

### Evidence

*(Filled in after the demo PR is opened and reviewed — see the PR link and
review comment below once available.)*

- Demo PR: _pending_
- `opened`-event review comment: _pending_
- Follow-up commit: _pending_
- `synchronize`-event review comment: _pending_

## Why this is a genuinely different loop shape

The loop's trigger lives entirely outside this repo's own process — it's a
webhook fired by GitHub's own infrastructure in response to a real human
(or script) action on a real pull request. Unlike Project 03's scheduled
firing (which fires on a clock this project controls), Project 06's
firing is event-driven by an external system we don't control the timing
of at all: it fires exactly when, and only when, a `pull_request` event of
the right type actually happens.

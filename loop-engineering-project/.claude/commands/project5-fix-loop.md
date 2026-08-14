---
description: Run the Project 5 codified fix-loop engine (project5-fix-loop-engine workflow) end to end with no further prompting.
---

Run the saved dynamic workflow script at
`.claude/workflows/project5-fix-loop-engine.js` to completion, fully
autonomously — do not ask the user any clarifying questions once this
command starts.

Steps:

1. Generate a fresh run id for this invocation only, e.g. by running
   `date +%s` via the Bash tool. Do not reuse a run id from any earlier
   invocation — this run must not know about, look up, or depend on any
   previous run.
2. Call the Workflow tool with
   `scriptPath: "<absolute path to>/.claude/workflows/project5-fix-loop-engine.js"`
   and `args: { runId: "<the id you just generated>" }`.
3. Wait for the workflow to complete, then report a concise summary to the
   user: for each candidate (clamp, average, dedupe), its branch name, its
   independent reviewer verdict (PASS/FAIL), and whether a PR description
   was staged.

This command carries no memory of prior runs — it does not read any
history, state, or progress file, and the workflow script itself has no
filesystem access outside the agent() calls it spawns. Each invocation
starts a brand-new set of git worktrees/branches from scratch.

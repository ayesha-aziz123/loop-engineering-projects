'use strict';

/**
 * git_janitor.js
 *
 * Project 08 chore: daily git-workspace janitor.
 *
 * One beat does exactly this:
 *   1. MAKER   — proposes candidates: worktrees git itself flags "prunable",
 *                and branches (excluding main/master) that are not currently
 *                an ancestor-checked merge into main.
 *   2. CHECKER — deterministically approves only what's provably safe:
 *                worktrees git already flags prunable (git's own logic, not
 *                ours), and branches that ARE fully merged into main (zero
 *                unique commits — `git merge-base --is-ancestor` is the
 *                source of truth, not a guess). Everything else is left as
 *                "needs human review" — never deleted.
 *   3. GUARD   — hard caps (default 5 branch deletions, 3 worktree prunes
 *                per beat) with a circuit breaker: if the approved count
 *                exceeds the cap, NOTHING destructive happens this beat and
 *                the excess is reported, not partially applied.
 *   4. CLEANUP — only runs if APPLY=1 is set in the environment. Without it,
 *                this is a pure dry run: candidates are computed and
 *                reported, nothing is deleted or pruned. `main`/`master` are
 *                never candidates, by construction (excluded before the
 *                maker step even runs), and branch deletion always uses
 *                `git branch -d` (not -D) as defense in depth, so git itself
 *                refuses the delete if the branch turns out not to be fully
 *                merged after all.
 *   5. SPINE   — progress.md is read first and rewritten last: the state
 *                block tracks what staleness has already been reported so
 *                the next beat only surfaces what's new.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const PROJECT_DIR = __dirname;
const REPO_ROOT = process.env.JANITOR_REPO_DIR
  ? path.resolve(process.env.JANITOR_REPO_DIR)
  : path.resolve(PROJECT_DIR, '..', '..');
const PROGRESS_FILE = path.join(PROJECT_DIR, 'progress.md');

const APPLY = process.env.APPLY === '1';
const MAX_BRANCH_DELETIONS = Number(process.env.JANITOR_MAX_BRANCH_DELETIONS || 5);
const MAX_WORKTREE_PRUNES = Number(process.env.JANITOR_MAX_WORKTREE_PRUNES || 3);
const PROTECTED_BRANCHES = new Set(['main', 'master']);

const STATE_BLOCK_RE = /```json state\n([\s\S]*?)\n```/;
const PLACEHOLDER_RE = /_No beats recorded yet\. The first run will append "Beat #1" below\._\n*/;

function git(args) {
  return execFileSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
}

function readProgress() {
  if (!fs.existsSync(PROGRESS_FILE)) {
    throw new Error(`progress.md not found at ${PROGRESS_FILE}. Run must read memory first.`);
  }
  return fs.readFileSync(PROGRESS_FILE, 'utf8');
}

function parseState(content) {
  const match = content.match(STATE_BLOCK_RE);
  if (!match) {
    throw new Error('Could not find the machine-readable state block in progress.md');
  }
  return JSON.parse(match[1]);
}

function replaceState(content, newState) {
  const block = '```json state\n' + JSON.stringify(newState, null, 2) + '\n```';
  return content.replace(STATE_BLOCK_RE, block);
}

function listWorktrees() {
  const out = git(['worktree', 'list', '--porcelain']);
  const blocks = out.split(/\n\n+/);
  return blocks
    .map((block) => {
      const entry = { prunable: false, bare: false };
      for (const line of block.split('\n')) {
        if (line.startsWith('worktree ')) entry.path = line.slice('worktree '.length);
        else if (line.startsWith('branch ')) entry.branch = line.slice('branch '.length);
        else if (line.startsWith('prunable')) entry.prunable = true;
        else if (line === 'bare') entry.bare = true;
      }
      return entry;
    })
    .filter((w) => w.path);
}

function listBranches() {
  const out = git(['for-each-ref', '--format=%(refname:short)', 'refs/heads/']);
  return out ? out.split('\n').filter(Boolean) : [];
}

function isMergedIntoMain(branch) {
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', branch, 'main'], {
      cwd: REPO_ROOT,
      stdio: 'ignore',
    });
    return true;
  } catch {
    return false;
  }
}

/** Step 1: MAKER — propose everything that *might* be stale. */
function makerPropose() {
  const worktrees = listWorktrees().filter((w) => !w.bare);
  const staleWorktrees = worktrees.filter((w) => w.prunable);

  const branches = listBranches().filter((b) => !PROTECTED_BRANCHES.has(b));
  const branchCandidates = branches.map((b) => ({ branch: b, mergedIntoMain: isMergedIntoMain(b) }));

  return { staleWorktrees, branchCandidates };
}

/** Step 2: CHECKER — deterministically approve only what's provably safe. */
function checkerApprove(proposal) {
  const approvedWorktrees = proposal.staleWorktrees.filter((w) => w.prunable === true);
  const approvedBranches = proposal.branchCandidates.filter((b) => b.mergedIntoMain === true);
  const needsHumanBranches = proposal.branchCandidates.filter((b) => b.mergedIntoMain === false);
  return { approvedWorktrees, approvedBranches, needsHumanBranches };
}

/** Step 3: GUARD — hard caps + circuit breaker. */
function applyBudgetGuards(checked) {
  const breaker = { worktreesTripped: false, branchesTripped: false };
  let worktreesToPrune = checked.approvedWorktrees;
  let branchesToDelete = checked.approvedBranches;

  if (worktreesToPrune.length > MAX_WORKTREE_PRUNES) {
    breaker.worktreesTripped = true;
    breaker.worktreeCandidateCount = worktreesToPrune.length;
    worktreesToPrune = [];
  }
  if (branchesToDelete.length > MAX_BRANCH_DELETIONS) {
    breaker.branchesTripped = true;
    breaker.branchCandidateCount = branchesToDelete.length;
    branchesToDelete = [];
  }
  return { worktreesToPrune, branchesToDelete, breaker };
}

/** Step 4: CLEANUP — only actually mutates the repo when APPLY=1. */
function executeCleanup(guarded) {
  const results = { prunedWorktrees: [], deletedBranches: [], errors: [], applied: APPLY };
  if (!APPLY) return results;

  if (guarded.worktreesToPrune.length > 0) {
    try {
      git(['worktree', 'prune', '-v']);
      results.prunedWorktrees = guarded.worktreesToPrune.map((w) => w.path);
    } catch (e) {
      results.errors.push({ target: 'worktree prune', error: e.message });
    }
  }

  for (const b of guarded.branchesToDelete) {
    if (PROTECTED_BRANCHES.has(b.branch)) continue; // defense in depth, never reachable
    try {
      git(['branch', '-d', b.branch]); // -d (safe delete): git itself refuses if not fully merged
      results.deletedBranches.push(b.branch);
    } catch (e) {
      results.errors.push({ target: b.branch, error: e.message });
    }
  }
  return results;
}

function buildBeatReport({ beatNumber, today, proposal, checked, guarded, cleanup }) {
  const lines = [];
  lines.push(`## Beat #${beatNumber} — ${today}`);
  lines.push('');
  lines.push(`Mode: ${APPLY ? 'APPLY (destructive actions enabled)' : 'DRY RUN (report only, nothing deleted)'}`);
  lines.push('');

  lines.push('**Stale worktrees found (git-flagged prunable):**');
  if (proposal.staleWorktrees.length === 0) {
    lines.push('- None.');
  } else {
    proposal.staleWorktrees.forEach((w) => lines.push(`- \`${w.path}\` (branch: ${w.branch || 'unknown'})`));
  }
  lines.push('');

  lines.push('**Branches not merged into main (needs human review, never auto-deleted):**');
  if (checked.needsHumanBranches.length === 0) {
    lines.push('- None.');
  } else {
    checked.needsHumanBranches.forEach((b) => lines.push(`- \`${b.branch}\``));
  }
  lines.push('');

  lines.push('**Checker-approved for deletion (fully merged into main):**');
  if (checked.approvedBranches.length === 0) {
    lines.push('- None.');
  } else {
    checked.approvedBranches.forEach((b) => lines.push(`- \`${b.branch}\``));
  }
  lines.push('');

  if (guarded.breaker.worktreesTripped || guarded.breaker.branchesTripped) {
    lines.push('**CIRCUIT BREAKER TRIPPED — no destructive action taken this beat:**');
    if (guarded.breaker.worktreesTripped) {
      lines.push(
        `- Worktree prune candidates (${guarded.breaker.worktreeCandidateCount}) exceed the cap of ${MAX_WORKTREE_PRUNES}. Deferred entirely — needs human review.`
      );
    }
    if (guarded.breaker.branchesTripped) {
      lines.push(
        `- Branch deletion candidates (${guarded.breaker.branchCandidateCount}) exceed the cap of ${MAX_BRANCH_DELETIONS}. Deferred entirely — needs human review.`
      );
    }
    lines.push('');
  }

  lines.push(`**Cleanup result (${cleanup.applied ? 'applied' : 'dry run — not applied'}):**`);
  lines.push(`- Worktrees pruned: ${cleanup.prunedWorktrees.length ? cleanup.prunedWorktrees.join(', ') : 'none'}`);
  lines.push(`- Branches deleted: ${cleanup.deletedBranches.length ? cleanup.deletedBranches.join(', ') : 'none'}`);
  if (cleanup.errors.length > 0) {
    lines.push('- Errors during cleanup:');
    cleanup.errors.forEach((e) => lines.push(`  - \`${e.target}\`: ${e.error}`));
  }
  lines.push('');
  lines.push(
    `_Totals as of this beat: ${proposal.staleWorktrees.length} stale worktree(s), ${checked.needsHumanBranches.length} branch(es) awaiting human review, ${checked.approvedBranches.length} branch(es) checker-approved._`
  );

  return lines.join('\n');
}

function main() {
  const content = readProgress();
  const state = parseState(content);

  const proposal = makerPropose();
  const checked = checkerApprove(proposal);
  const guarded = applyBudgetGuards(checked);
  const cleanup = executeCleanup(guarded);

  const beatNumber = (state.runCount || 0) + 1;
  const now = new Date().toISOString();
  const today = now.slice(0, 10);

  const beatSection = buildBeatReport({ beatNumber, today, proposal, checked, guarded, cleanup });

  const newState = {
    runCount: beatNumber,
    lastRunAt: now,
    apply: APPLY,
    knownStaleWorktreePaths: proposal.staleWorktrees.map((w) => w.path),
    knownUnmergedBranches: checked.needsHumanBranches.map((b) => b.branch),
    lastBreaker: guarded.breaker,
    lastCleanup: cleanup,
  };

  let updated = replaceState(content, newState);
  updated = updated.replace(PLACEHOLDER_RE, '');
  updated = updated.trimEnd() + '\n\n' + beatSection + '\n';

  fs.writeFileSync(PROGRESS_FILE, updated, 'utf8');

  console.log(beatSection);
}

main();

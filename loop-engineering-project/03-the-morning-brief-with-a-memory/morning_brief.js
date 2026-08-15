'use strict';

/**
 * morning_brief.js
 *
 * Reads progress.md (the "spine" / persistent memory), gathers recent git
 * commits and TODO/FIXME comments from the repo, figures out what is new
 * since the last run, appends a dated brief to progress.md, and rewrites
 * the machine-readable state block for the next run.
 *
 * No external dependencies — Node built-ins only.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PROJECT_DIR = __dirname;
const REPO_ROOT = path.resolve(PROJECT_DIR, '..');
const PROGRESS_FILE = path.join(PROJECT_DIR, 'progress.md');

const STATE_BLOCK_RE = /```json state\n([\s\S]*?)\n```/;
const PLACEHOLDER_RE =
  /_No briefs recorded yet\. The first run will append "Morning Brief #1" below\._\n*/;

const SCAN_EXTENSIONS = new Set(['.js', '.md', '.sh', '.txt', '.json', '.yml', '.yaml']);
const SKIP_DIRS = new Set(['.git', 'node_modules']);

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

function getRecentCommits(limit = 20) {
  // Use %x1f (unit separator) instead of a literal character like "|" as the
  // field delimiter — "|" is a shell pipe on Windows and breaks the command.
  const out = execSync(`git log -n ${limit} --pretty=format:%H%x1f%ad%x1f%s --date=short`, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  }).trim();
  if (!out) return [];
  return out.split('\n').map((line) => {
    const [hash, date, ...rest] = line.split('\x1f');
    return { hash, date, subject: rest.join('\x1f') };
  });
}

function walk(dir, files) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, files);
    } else if (SCAN_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(full);
    }
  }
  return files;
}

function findTodos() {
  const files = walk(REPO_ROOT, []);
  const todos = [];
  for (const file of files) {
    const rel = path.relative(REPO_ROOT, file).replace(/\\/g, '/');
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, idx) => {
      if (/TODO|FIXME/.test(line)) {
        todos.push({ id: `${rel}:${idx + 1}`, file: rel, line: idx + 1, text: line.trim() });
      }
    });
  }
  return todos;
}

function buildBrief({ runNumber, today, commits, todos, newCommits, newTodos, resolvedTodoIds }) {
  const lines = [];
  lines.push(`## Morning Brief #${runNumber} — ${today}`);
  lines.push('');
  lines.push(
    runNumber === 1
      ? 'Baseline run. Recording the current state of the repo for future briefs to compare against.'
      : `Run #${runNumber}, comparing against the state recorded in run #${runNumber - 1}.`
  );
  lines.push('');

  lines.push('**New commits since last brief:**');
  if (newCommits.length === 0) {
    lines.push('- No new commits since the last brief.');
  } else {
    newCommits.forEach((c) => lines.push(`- \`${c.hash.slice(0, 7)}\` (${c.date}) ${c.subject}`));
  }
  lines.push('');

  lines.push('**New TODO/FIXME comments since last brief:**');
  if (newTodos.length === 0) {
    lines.push('- No new TODO/FIXME comments since the last brief.');
  } else {
    newTodos.forEach((t) => lines.push(`- \`${t.file}:${t.line}\` — ${t.text}`));
  }
  lines.push('');

  if (resolvedTodoIds.length > 0) {
    lines.push('**TODOs resolved since last brief:**');
    resolvedTodoIds.forEach((id) => lines.push(`- \`${id}\``));
    lines.push('');
  }

  lines.push(
    `_Totals as of this run: ${commits.length} commit(s) tracked, ${todos.length} open TODO/FIXME comment(s)._`
  );

  return lines.join('\n');
}

function main() {
  const content = readProgress();
  const state = parseState(content);

  const commits = getRecentCommits();
  const todos = findTodos();

  const knownCommitHashes = new Set(state.knownCommitHashes || []);
  const knownTodoIds = new Set(state.knownTodoIds || []);

  const newCommits = commits.filter((c) => !knownCommitHashes.has(c.hash));
  const newTodos = todos.filter((t) => !knownTodoIds.has(t.id));
  const resolvedTodoIds = (state.knownTodoIds || []).filter(
    (id) => !todos.some((t) => t.id === id)
  );

  const runNumber = (state.runCount || 0) + 1;
  const today = new Date().toISOString().slice(0, 10);
  const now = new Date().toISOString();

  const briefSection = buildBrief({
    runNumber,
    today,
    commits,
    todos,
    newCommits,
    newTodos,
    resolvedTodoIds,
  });

  const newState = {
    runCount: runNumber,
    lastRunAt: now,
    knownCommitHashes: commits.map((c) => c.hash),
    knownTodoIds: todos.map((t) => t.id),
  };

  let updated = replaceState(content, newState);
  updated = updated.replace(PLACEHOLDER_RE, '');
  updated = updated.trimEnd() + '\n\n' + briefSection + '\n';

  fs.writeFileSync(PROGRESS_FILE, updated, 'utf8');

  console.log(briefSection);
}

main();

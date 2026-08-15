'use strict';

/**
 * run_with_observability.js
 *
 * Observability wrapper around Project 03's morning_brief.js. Does not
 * change morning_brief.js in any way — it spawns it as a child process and
 * records everything needed to diagnose a failed run without replaying it:
 * start/end timestamps, duration, exit status, stdout, stderr, and (on
 * failure) an error message. Every run appends one JSON line to run.log.
 *
 * Controlled failure injection: set FORCE_FAIL=1 to make this run fail.
 * Rather than editing morning_brief.js's logic, this wrapper temporarily
 * renames progress.md aside before invoking it, which trips
 * morning_brief.js's own existing "progress.md not found" error path — a
 * real crash through real code, not a simulated one. progress.md is
 * restored immediately after the child process exits.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const OBS_DIR = __dirname;
const PROJECT03_DIR = path.resolve(OBS_DIR, '..', '03-the-morning-brief-with-a-memory');
const PROGRESS_FILE = path.join(PROJECT03_DIR, 'progress.md');
const PROGRESS_BACKUP = path.join(PROJECT03_DIR, 'progress.md.forcefail-backup');
const LOG_FILE = path.join(OBS_DIR, 'run.log');

const FORCE_FAIL = process.env.FORCE_FAIL === '1';

// Rough, deterministic token estimate — no LLM call happens in this script,
// so this approximates the byte cost of what a scheduling agent turn would
// read (progress.md going in) and write (stdout + updated progress.md
// coming out) for one beat. ~4 bytes/token is a standard rough heuristic.
function estimateTokens(byteCount) {
  return Math.ceil(byteCount / 4);
}

function appendNeedsHumanNote({ timestamp, exitCode, errorMessage, stderrExcerpt }) {
  if (!fs.existsSync(PROGRESS_FILE)) return;
  const content = fs.readFileSync(PROGRESS_FILE, 'utf8');
  const note = [
    '',
    `## NEEDS HUMAN — run failed at ${timestamp}`,
    '',
    `- exit code: ${exitCode}`,
    `- error: ${errorMessage}`,
    stderrExcerpt ? `- stderr (last lines): \`${stderrExcerpt}\`` : null,
    `- see \`07-observability-break-it-on-purpose/run.log\` for the full record of this run.`,
    '',
  ]
    .filter(Boolean)
    .join('\n');
  fs.writeFileSync(PROGRESS_FILE, content.trimEnd() + '\n' + note, 'utf8');
}

function main() {
  const startedAt = new Date().toISOString();
  const startMs = Date.parse(startedAt);

  const progressBytesBefore = fs.existsSync(PROGRESS_FILE)
    ? fs.statSync(PROGRESS_FILE).size
    : 0;

  let forcedFailureSetup = false;
  if (FORCE_FAIL) {
    if (fs.existsSync(PROGRESS_FILE)) {
      fs.renameSync(PROGRESS_FILE, PROGRESS_BACKUP);
      forcedFailureSetup = true;
    }
  }

  let result;
  try {
    result = spawnSync(process.execPath, ['morning_brief.js'], {
      cwd: PROJECT03_DIR,
      encoding: 'utf8',
    });
  } finally {
    if (forcedFailureSetup) {
      fs.renameSync(PROGRESS_BACKUP, PROGRESS_FILE);
    }
  }

  const finishedAt = new Date().toISOString();
  const endMs = Date.parse(finishedAt);
  const durationMs = endMs - startMs;

  const stdout = result.stdout || '';
  const stderr = result.stderr || '';
  const exitCode = result.status === null ? -1 : result.status;
  const spawnError = result.error ? result.error.message : null;
  const succeeded = exitCode === 0 && !spawnError;

  const progressBytesAfter = fs.existsSync(PROGRESS_FILE)
    ? fs.statSync(PROGRESS_FILE).size
    : 0;

  function extractErrorMessage() {
    if (spawnError) return spawnError;
    const errorLine = stderr.split('\n').find((line) => /^\s*Error:/.test(line));
    if (errorLine) return errorLine.trim();
    const lastNonEmpty = stderr
      .trim()
      .split('\n')
      .reverse()
      .find((line) => line.trim().length > 0);
    return lastNonEmpty || `process exited with code ${exitCode}`;
  }

  const errorMessage = succeeded ? null : extractErrorMessage();

  const logEntry = {
    startedAt,
    finishedAt,
    durationMs,
    forcedFailure: FORCE_FAIL,
    exitCode,
    succeeded,
    errorMessage,
    stdout,
    stderr,
    approxTokens: {
      progressMdReadBefore: estimateTokens(progressBytesBefore),
      progressMdWrittenAfter: estimateTokens(progressBytesAfter),
      stdoutTokens: estimateTokens(Buffer.byteLength(stdout, 'utf8')),
    },
  };

  fs.appendFileSync(LOG_FILE, JSON.stringify(logEntry) + '\n', 'utf8');

  if (!succeeded) {
    const stderrExcerpt = stderr
      .replace(/\r/g, '')
      .trim()
      .split('\n')
      .slice(-5)
      .join(' | ');
    appendNeedsHumanNote({
      timestamp: finishedAt,
      exitCode,
      errorMessage,
      stderrExcerpt,
    });
  }

  console.log(
    `[observability] ${succeeded ? 'OK' : 'FAILED'} exit=${exitCode} duration=${durationMs}ms forcedFailure=${FORCE_FAIL}`
  );
  if (stdout) console.log(stdout);
  if (stderr) console.error(stderr);

  process.exitCode = succeeded ? 0 : exitCode === 0 ? 1 : exitCode;
}

main();

'use strict';

/**
 * run_with_observability.js
 *
 * Observability wrapper around git_janitor.js (Project 08's chore). Spawns
 * it as a child process and records everything needed to diagnose a failed
 * beat without replaying it: start/end timestamps, duration, exit status,
 * stdout, stderr, and (on failure) an extracted error message. Every beat
 * appends one JSON line to run.log. On failure, a NEEDS HUMAN note is
 * appended to progress.md so the spine itself flags the problem even if
 * nobody is watching run.log.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const PROJECT_DIR = __dirname;
const PROGRESS_FILE = path.join(PROJECT_DIR, 'progress.md');
const LOG_FILE = path.join(PROJECT_DIR, 'run.log');

function appendNeedsHumanNote({ timestamp, exitCode, errorMessage, stderrExcerpt }) {
  if (!fs.existsSync(PROGRESS_FILE)) return;
  const content = fs.readFileSync(PROGRESS_FILE, 'utf8');
  const note = [
    '',
    `## NEEDS HUMAN — beat failed at ${timestamp}`,
    '',
    `- exit code: ${exitCode}`,
    `- error: ${errorMessage}`,
    stderrExcerpt ? `- stderr (last lines): \`${stderrExcerpt}\`` : null,
    `- see \`08-your-own-daily-loop/run.log\` for the full record of this run.`,
    '',
  ]
    .filter(Boolean)
    .join('\n');
  fs.writeFileSync(PROGRESS_FILE, content.trimEnd() + '\n' + note, 'utf8');
}

function extractErrorMessage(spawnError, stderr, exitCode) {
  if (spawnError) return spawnError;
  const errorLine = stderr.split('\n').find((line) => /Error:/.test(line));
  if (errorLine) return errorLine.trim();
  const lastNonEmpty = stderr
    .replace(/\r/g, '')
    .trim()
    .split('\n')
    .reverse()
    .find((line) => line.trim().length > 0);
  return lastNonEmpty || `process exited with code ${exitCode}`;
}

function main() {
  const startedAt = new Date().toISOString();
  const startMs = Date.parse(startedAt);

  const result = spawnSync(process.execPath, ['git_janitor.js'], {
    cwd: PROJECT_DIR,
    encoding: 'utf8',
    env: process.env,
  });

  const finishedAt = new Date().toISOString();
  const durationMs = Date.parse(finishedAt) - startMs;

  const stdout = result.stdout || '';
  const stderr = result.stderr || '';
  const exitCode = result.status === null ? -1 : result.status;
  const spawnError = result.error ? result.error.message : null;
  const succeeded = exitCode === 0 && !spawnError;
  const errorMessage = succeeded ? null : extractErrorMessage(spawnError, stderr, exitCode);

  const logEntry = {
    startedAt,
    finishedAt,
    durationMs,
    apply: process.env.APPLY === '1',
    exitCode,
    succeeded,
    errorMessage,
    stdout,
    stderr,
  };

  fs.appendFileSync(LOG_FILE, JSON.stringify(logEntry) + '\n', 'utf8');

  if (!succeeded) {
    const stderrExcerpt = stderr
      .replace(/\r/g, '')
      .trim()
      .split('\n')
      .slice(-5)
      .join(' | ');
    appendNeedsHumanNote({ timestamp: finishedAt, exitCode, errorMessage, stderrExcerpt });
  }

  console.log(
    `[observability] ${succeeded ? 'OK' : 'FAILED'} exit=${exitCode} duration=${durationMs}ms apply=${process.env.APPLY === '1'}`
  );
  if (stdout) console.log(stdout);
  if (stderr) console.error(stderr);

  process.exitCode = succeeded ? 0 : exitCode === 0 ? 1 : exitCode;
}

main();

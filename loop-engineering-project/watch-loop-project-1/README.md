# Project 01: A Watch Loop

## What this project demonstrates

This project is a minimal example of using Claude Code's `/loop` command to
watch for the completion of a long-running background task. It shows the
basic pattern of:

1. Kicking off a task that takes a while to finish, in the background.
2. Having Claude Code poll for a signal file on an interval instead of
   blocking on the task itself.
3. Stopping the loop automatically once that signal appears.

## What `long_task.sh` does

`long_task.sh` is a simple, dependency-free Bash script that simulates a
long-running job:

1. It sleeps for 3 minutes (180 seconds).
2. Once the sleep finishes, it writes a completion message with a timestamp
   to `task-status.txt` in the same directory.

No Python or external tools are required — only standard `bash` builtins.

## How to run the long task in the background

From this directory:

```bash
chmod +x long_task.sh
./long_task.sh &
```

The trailing `&` runs the script in the background so your terminal (and
Claude Code) stays free to do other work while it sleeps. You can confirm it
is running with `jobs` or `ps`.

## How Claude Code's `/loop` will watch for `task-status.txt`

After starting `long_task.sh` in the background, use `/loop` with a short
interval to have Claude Code periodically check whether `task-status.txt`
exists yet, for example:

```
/loop 30s check if task-status.txt exists in watch-loop-project-1; if so, read it and report the completion message, then stop the loop
```

Each time the loop fires, Claude Code looks for the file. While it's
missing, the loop simply reports that the task is still running and
schedules the next check. Once `task-status.txt` appears, Claude Code reads
its contents and reports the completion message back to you.

## Stopping condition

The loop stops as soon as `task-status.txt` is found and its completion
message has been reported. This file's existence is the signal that the
simulated long-running task has finished, so there is nothing left to watch
for after that point.

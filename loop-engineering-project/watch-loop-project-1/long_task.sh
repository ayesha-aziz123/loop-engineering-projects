#!/usr/bin/env bash
#
# long_task.sh
# Simulates a long-running task by sleeping for 3 minutes, then writes
# a completion status file with a timestamp.

set -euo pipefail

STATUS_FILE="task-status.txt"
SLEEP_SECONDS=180

sleep "$SLEEP_SECONDS"

echo "Task completed successfully at $(date '+%Y-%m-%d %H:%M:%S')" > "$STATUS_FILE"

#!/bin/bash
# Ralph Loop for Autonomous AI Coding execution
# This loop executes an agent against a target task. It persists until success or max iterations.

TASK=$1
MAX_ITERATIONS=${2:-5}

if [ -z "$TASK" ]; then
  echo "Usage: ./ralph.sh \"Your task description here\" [max_iterations]"
  exit 1
fi

ITERATION=1

echo "============================================="
echo "Starting Ralph Loop for: '$TASK'"
echo "Max Iterations: $MAX_ITERATIONS"
echo "============================================="

while [ $ITERATION -le $MAX_ITERATIONS ]; do
  echo ">>> [Iteration $ITERATION/$MAX_ITERATIONS]"
  
  # Replace 'claude-code' with your specific agent CLI (e.g., 'cline', 'coder', etc.)
  claude-code --task "$TASK. Run testing scripts. Return exit code 0 if fully completed and verified, or non-zero if it needs to iterate again or tests failed."

  EXIT_CODE=$?

  if [ $EXIT_CODE -eq 0 ]; then
    echo "🎉 Task reported as successfully completed by the AI!"
    break
  else
    echo "⚠️ Agent exited with code $EXIT_CODE. Attempting to self-correct in next iteration..."
  fi

  ((ITERATION++))
  
  if [ $ITERATION -gt $MAX_ITERATIONS ]; then
    echo "❌ Ralph Loop hit maximum iterations ($MAX_ITERATIONS). Human intervention required."
  fi
done

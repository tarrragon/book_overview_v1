#!/usr/bin/env python3
import sys
import json
import os

def main():
    try:
        # Read stdin
        input_data = sys.stdin.read()
        hook_input = json.loads(input_data)
        transcript_path = hook_input.get('transcript_path')

        if not transcript_path or not os.path.exists(transcript_path):
            sys.exit(0)

        # Read transcript
        with open(transcript_path, 'r') as f:
            lines = f.readlines()

        todos_pending = []
        todos_in_progress = []
        all_historical_todos = set()
        latest_todo_count = 0

        # First pass: collect ALL todos ever created (for comparison)
        for line in lines:
            if not line.strip():
                continue
            try:
                entry = json.loads(line)
                message = entry.get('message', {})
                content = message.get('content', [])

                for item in content:
                    if item.get('type') == 'tool_use' and item.get('name') == 'TodoWrite':
                        todos = item.get('input', {}).get('todos', [])
                        for todo in todos:
                            # Track all unique todos we've ever seen
                            all_historical_todos.add(todo.get('content', ''))
            except:
                continue

        # Second pass: find the most recent TodoWrite (from newest to oldest)
        for line in reversed(lines):
            if not line.strip():
                continue
            try:
                entry = json.loads(line)

                # Navigate to the nested structure
                message = entry.get('message', {})
                content = message.get('content', [])

                # Check each content item for TodoWrite
                for item in content:
                    if item.get('type') == 'tool_use' and item.get('name') == 'TodoWrite':
                        todos = item.get('input', {}).get('todos', [])
                        latest_todo_count = len(todos)

                        current_todo_contents = set()
                        for todo in todos:
                            status = todo.get('status')
                            content_text = todo.get('content', 'Unknown task')
                            current_todo_contents.add(content_text)

                            if status == 'pending':
                                todos_pending.append(content_text)
                            elif status == 'in_progress':
                                todos_in_progress.append(content_text)

                        # Check for missing todos
                        missing_todos = all_historical_todos - current_todo_contents

                        # Found most recent todo list, stop searching
                        if todos:
                            break

                # If we found todos, stop looking through more lines
                if todos_pending or todos_in_progress:
                    break

            except (json.JSONDecodeError, KeyError):
                continue

        # Build response if there are incomplete todos
        if todos_pending or todos_in_progress:
            total = len(todos_pending) + len(todos_in_progress)

            message_parts = [
                f"STOP! You cannot stop now. You have {total} uncompleted todos.",
                "",
                "IMMEDIATE ACTIONS REQUIRED:",
            ]

            # Check if todos might have been removed
            if len(all_historical_todos) > latest_todo_count:
                missing_count = len(all_historical_todos) - latest_todo_count
                message_parts.append(f"1. First, recreate the {missing_count} missing todos that disappeared from your list")
                message_parts.append("2. Then continue with the next pending todo")
            else:
                message_parts.append("1. Continue immediately with the next pending todo")

            message_parts.append("")
            
            if todos_in_progress:
                message_parts.append(f"Current todo in progress: {todos_in_progress[0]}")
                message_parts.append("Complete this first, then move to pending todos.")
            elif todos_pending:
                message_parts.append(f"Next todo to work on: {todos_pending[0]}")
                message_parts.append("Start working on this NOW.")
            
            message_parts.append("")
            message_parts.append("DO NOT provide explanations or summaries.")
            message_parts.append("DO NOT wait for user input.")
            message_parts.append("CONTINUE WORKING IMMEDIATELY.")

            output = {
                "decision": "block",
                "reason": "\n".join(message_parts)
            }

            print(json.dumps(output))

    except Exception:
        pass  # Silently fail to not interfere with Claude

    sys.exit(0)

if __name__ == "__main__":
    main()
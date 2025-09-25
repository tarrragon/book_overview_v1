#!/usr/bin/env python3
import sys
import json
import os
from datetime import datetime, timedelta

def main():
    try:
        # 檢查是否存在 5W1H 阻止狀態
        if check_5w1h_block_status():
            sys.exit(0)

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

        # Build response based on todo status
        if todos_pending or todos_in_progress:
            # There are incomplete todos - block and provide guidance
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
            message_parts.append("If todo list contains only completed todos,  echo  'I have completed all todos.'")

            output = {
                "decision": "block",
                "reason": "\n".join(message_parts)
            }

            print(json.dumps(output))
        else:
            # All todos are completed - allow continuation
            output = {
                "decision": "allow",
                "message": "All todos completed successfully."
            }
            print(json.dumps(output))

    except Exception:
        pass  # Silently fail to not interfere with Claude

    sys.exit(0)

def check_5w1h_block_status():
    """檢查是否存在5W1H阻止狀態"""
    try:
        script_dir = os.path.dirname(os.path.abspath(__file__))
        project_root = os.path.abspath(os.path.join(script_dir, '../..'))

        # 檢查5W1H阻止記錄檔案
        log_dir = os.path.join(project_root, '.claude/hook-logs')
        blocked_log_file = os.path.join(log_dir, 'blocked-5w1h-attempts.log')

        if not os.path.exists(blocked_log_file):
            return False

        # 檢查最近5分鐘內是否有5W1H阻止記錄
        five_minutes_ago = datetime.now() - timedelta(minutes=5)

        with open(blocked_log_file, 'r', encoding='utf-8') as f:
            lines = f.readlines()

        # 檢查最後10行記錄
        recent_lines = lines[-10:] if len(lines) > 10 else lines

        for line in recent_lines:
            try:
                log_entry = json.loads(line.strip())
                log_time_str = log_entry.get('timestamp', '')

                # 解析時間
                log_time = datetime.strptime(log_time_str, '%Y-%m-%d %H:%M:%S')

                # 如果是最近5分鐘內的5W1H阻止記錄
                if log_time > five_minutes_ago:
                    print_5w1h_status_message()
                    return True

            except (json.JSONDecodeError, ValueError, KeyError):
                continue

        return False

    except Exception:
        # 檢查失敗不影響主要功能
        return False

def print_5w1h_status_message():
    """輸出5W1H狀態訊息"""

    message = """
🎯 5W1H 自覺決策進行中 🎯

📋 當前狀態: 等待 5W1H 分析完成

💡 系統檢測到最近有 todo 因缺乏 5W1H 分析被阻止。
check-todos.py 暫停檢查，優先完成 5W1H 決策框架。

🔧 需要完成的步驟:

1. 為每個 todo 提供完整的 5W1H 分析:
   - Who (誰): 責任歸屬，避免重複實作
   - What (什麼): 功能定義，確保單一職責
   - When (何時): 觸發時機，識別副作用
   - Where (何地): 執行位置，符合架構原則
   - Why (為什麼): 需求依據，非逃避動機
   - How (如何): 實作策略，遵循TDD原則

2. 移除所有逃避性語言

3. 重新提交 todo

📚 參考文件: .claude/5w1h-self-awareness-methodology.md

⏰ 完成 5W1H 分析後，check-todos.py 將自動恢復正常檢查
"""

    print(message)

if __name__ == "__main__":
    main()
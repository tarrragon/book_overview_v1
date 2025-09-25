#!/usr/bin/env python3
"""
5W1H Compliance Check Hook
檢查TodoWrite操作是否包含完整的5W1H分析

本腳本在PreToolUse階段攔截TodoWrite操作，
驗證每個todo是否經過完整的5W1H思考過程。
"""

import sys
import json
import re
import os
from datetime import datetime

def main():
    try:
        # 讀取Hook輸入
        input_data = sys.stdin.read()
        hook_input = json.loads(input_data)

        # 獲取工具使用資訊
        tool_use = hook_input.get('tool_use', {})
        tool_name = tool_use.get('name')
        tool_input = tool_use.get('input', {})

        # 只檢查TodoWrite工具
        if tool_name != 'TodoWrite':
            exit_allow()
            return

        # 獲取todos內容
        todos = tool_input.get('todos', [])

        # 檢查每個todo的5W1H完整性
        for i, todo in enumerate(todos):
            content = todo.get('content', '')
            status = todo.get('status', 'pending')

            # 只檢查新建立的todo(pending或in_progress)
            if status in ['pending', 'in_progress']:
                compliance_result = check_5w1h_compliance(content, i+1)
                if not compliance_result['compliant']:
                    block_with_guidance(compliance_result)
                    return

        # 所有todo都通過檢查
        exit_allow()

    except Exception as e:
        # 靜默失敗，不干擾操作
        log_error(f"5W1H檢查腳本錯誤: {str(e)}")
        exit_allow()

def check_5w1h_compliance(todo_content, todo_index):
    """檢查單個todo的5W1H完整性"""

    # 檢查是否包含5W1H分析標記
    has_5w1h_analysis = has_5w1h_markers(todo_content)

    if not has_5w1h_analysis:
        return {
            'compliant': False,
            'todo_index': todo_index,
            'missing_type': 'no_5w1h_analysis',
            'content': todo_content
        }

    # 檢查每個W/H是否有回答
    missing_sections = find_missing_5w1h_sections(todo_content)

    if missing_sections:
        return {
            'compliant': False,
            'todo_index': todo_index,
            'missing_type': 'incomplete_5w1h',
            'missing_sections': missing_sections,
            'content': todo_content
        }

    # 檢查是否包含逃避性語言
    avoidance_issues = detect_avoidance_language(todo_content)

    if avoidance_issues:
        return {
            'compliant': False,
            'todo_index': todo_index,
            'missing_type': 'avoidance_detected',
            'avoidance_issues': avoidance_issues,
            'content': todo_content
        }

    return {'compliant': True}

def has_5w1h_markers(content):
    """檢查是否包含5W1H分析標記"""

    # 檢查是否包含5W1H的關鍵標記
    markers = [
        r'##?\s*Who[：:]',
        r'##?\s*What[：:]',
        r'##?\s*When[：:]',
        r'##?\s*Where[：:]',
        r'##?\s*Why[：:]',
        r'##?\s*How[：:]'
    ]

    # 至少要有3個以上的5W1H標記才算有進行分析
    marker_count = 0
    for marker in markers:
        if re.search(marker, content, re.IGNORECASE):
            marker_count += 1

    return marker_count >= 3

def find_missing_5w1h_sections(content):
    """找出缺失的5W1H章節"""

    required_sections = {
        'Who': [r'##?\s*Who[：:]', r'責任歸屬', r'負責'],
        'What': [r'##?\s*What[：:]', r'功能定義', r'做什麼'],
        'When': [r'##?\s*When[：:]', r'觸發時機', r'何時'],
        'Where': [r'##?\s*Where[：:]', r'執行位置', r'何地'],
        'Why': [r'##?\s*Why[：:]', r'需求依據', r'為什麼'],
        'How': [r'##?\s*How[：:]', r'實作策略', r'如何實作']
    }

    missing = []

    for section_name, patterns in required_sections.items():
        section_found = False
        for pattern in patterns:
            if re.search(pattern, content, re.IGNORECASE):
                section_found = True
                break

        if not section_found:
            missing.append(section_name)

    return missing

def detect_avoidance_language(content):
    """檢測逃避性語言 - 基於Claude自檢與逃避預防方法論"""

    avoidance_patterns = {
        '品質妥協和逃避責任類': [
            r'太複雜', r'先將就', r'暫時性修正', r'症狀緩解',
            r'先這樣處理', r'臨時解決方案', r'回避', r'不想處理',
            r'too complex', r'too complicated', r'workaround', r'hack',
            r'temporary fix', r'quick fix', r'bypass', r'ignore for now',
            r'will fix later', r'avoid dealing with', r'skip for now'
        ],
        '簡化妥協類': [
            r'更簡單的方法', r'採用更簡單的方法', r'用更簡單的方法',
            r'選擇更簡單的方法', r'簡單的處理方式', r'簡化處理',
            r'simpler approach', r'simpler way', r'take the simpler approach',
            r'use a simpler method', r'easier approach', r'simpler method', r'simplify'
        ],
        '發現問題但不解決類': [
            r'發現問題但不處理', r'架構問題先不管', r'程式異味先忽略',
            r'只加個.*TODO', r'問題太多先跳過', r'技術債務之後處理',
            r'ignore the issue', r'architecture debt later', r'code smell ignore',
            r'just add todo', r'too many issues skip', r'technical debt later'
        ],
        '測試品質妥協類': [
            r'簡化測試', r'降低測試標準', r'測試要求太嚴格', r'放寬測試條件',
            r'測試太複雜', r'簡單測試就好', r'基本測試即可', r'簡化測試環境',
            r'simplify test', r'simplified test', r'lower test standard', r'test too strict',
            r'relax test requirement', r'test too complex', r'basic test only',
            r'simple test case', r'minimal test', r'reduce test complexity'
        ],
        '程式碼修改逃避類': [
            r'註解掉', r'停用功能', r'暫時關閉', r'先用比較簡單',
            r'comment out', r'disable', r'temporarily disable', r'use simpler first'
        ],
        '模糊不精確詞彙類': [
            r'智能', r'自動(?!\w)', r'優化(?!\w)',
            r'smart', r'intelligent', r'auto(?!\w)', r'optimize(?!\w)'
        ]
    }

    detected_issues = []

    for category, patterns in avoidance_patterns.items():
        for pattern in patterns:
            matches = re.finditer(pattern, content, re.IGNORECASE)
            for match in matches:
                detected_issues.append({
                    'category': category,
                    'pattern': pattern,
                    'matched_text': match.group(),
                    'position': match.start()
                })

    return detected_issues

def block_with_guidance(compliance_result):
    """阻止操作並提供修正指引"""

    todo_index = compliance_result.get('todo_index', 1)
    missing_type = compliance_result['missing_type']

    if missing_type == 'no_5w1h_analysis':
        reason = generate_no_analysis_guidance(todo_index)
    elif missing_type == 'incomplete_5w1h':
        reason = generate_incomplete_guidance(compliance_result)
    elif missing_type == 'avoidance_detected':
        reason = generate_avoidance_guidance(compliance_result)
    else:
        reason = generate_generic_guidance()

    # 記錄阻止事件
    log_blocked_attempt(compliance_result)

    # 回傳阻止決策
    output = {
        "decision": "block",
        "reason": reason
    }

    print(json.dumps(output))
    sys.exit(0)

def generate_no_analysis_guidance(todo_index):
    """生成缺乏5W1H分析的指引"""

    return f"""
🚨 5W1H 自覺決策檢查失敗 🚨

❌ Todo #{todo_index} 缺乏 5W1H 分析

根據「5W1H 自覺決策方法論」，每個 todo 必須經過完整的 5W1H 思考。

🔧 修正步驟：

在建立 todo 之前，請完整回答以下問題：

## Who (誰)
- 這個功能的責任歸屬是誰？
- 現有的 Domain/Service 是否已有相同功能？
- 如何避免重複實作？

## What (什麼)
- 這個功能的具體行為是什麼？
- 輸入輸出是什麼？
- 是否符合單一職責原則？

## When (何時)
- 這個功能在什麼時候被觸發？
- 有哪些副作用需要處理？
- 與 Event-Driven 架構如何整合？

## Where (何地)
- 功能應該在哪一層執行？
- 對應的 UseCase 是什麼？
- 是否符合 Clean Architecture？

## Why (為什麼)
- 對應的需求編號是什麼？
- 這個功能的業務價值是什麼？
- 是否為逃避其他問題？

## How (如何)
- 採用什麼實作策略？
- 是否遵循 TDD 原則？
- 會產生技術債務嗎？

📚 參考文件：.claude/5w1h-self-awareness-methodology.md

⚠️  完成 5W1H 分析後，請重新建立 todo
"""

def generate_incomplete_guidance(compliance_result):
    """生成不完整5W1H的指引"""

    todo_index = compliance_result.get('todo_index', 1)
    missing_sections = compliance_result.get('missing_sections', [])

    section_guidance = {
        'Who': '- 檢查現有功能避免重複\n- 明確責任歸屬',
        'What': '- 定義清晰的功能邊界\n- 確保單一職責',
        'When': '- 識別觸發事件\n- 分析副作用',
        'Where': '- 確定架構位置\n- 找出對應 UseCase',
        'Why': '- 提供需求編號\n- 說明業務價值',
        'How': '- 制定實作策略\n- 確保 TDD 原則'
    }

    guidance_details = []
    for section in missing_sections:
        guidance_details.append(f"## {section} (缺失)")
        guidance_details.append(section_guidance.get(section, '- 請補充相關分析'))
        guidance_details.append("")

    return f"""
🚨 5W1H 自覺決策檢查失敗 🚨

❌ Todo #{todo_index} 的 5W1H 分析不完整

缺失的章節：{', '.join(missing_sections)}

🔧 需要補充的分析：

{''.join(guidance_details)}

📚 完整指引請參考：.claude/5w1h-self-awareness-methodology.md

⚠️  補充所有缺失的 5W1H 分析後，請重新建立 todo
"""

def generate_avoidance_guidance(compliance_result):
    """生成逃避行為的指引"""

    todo_index = compliance_result.get('todo_index', 1)
    avoidance_issues = compliance_result.get('avoidance_issues', [])

    issue_details = []
    for issue in avoidance_issues[:3]:  # 只顯示前3個問題
        category = issue['category']
        matched_text = issue['matched_text']
        issue_details.append(f"- {category}: 「{matched_text}」")

    return f"""
🚨 5W1H 自覺決策檢查失敗 🚨

❌ Todo #{todo_index} 發現逃避性語言

檢測到的逃避行為：
{''.join(issue_details)}

🔧 修正原則：

根據「永不放棄鐵律」和「零容忍架構債務」原則：

✅ 將「先將就」改為「完整解決」
✅ 將「之後處理」改為「立即處理」
✅ 將「臨時方案」改為「正確實作」
✅ 將「簡化處理」改為「完整處理」

🎯 正確的 5W1H 思維：

- Who: 找到正確的責任歸屬，避免重複
- What: 定義完整功能，不妥協品質
- When: 明確觸發時機，處理所有副作用
- Where: 正確的架構位置，符合設計原則
- Why: 真實的業務需求，非逃避動機
- How: TDD 驅動實作，零技術債務

📚 詳細原則：.claude/5w1h-self-awareness-methodology.md

⚠️  移除所有逃避性語言，建立正確的解決方案後重新提交
"""

def generate_generic_guidance():
    """生成通用指引"""

    return """
🚨 5W1H 自覺決策檢查失敗 🚨

請按照「5W1H 自覺決策方法論」重新分析此 todo。

📚 參考文件：.claude/5w1h-self-awareness-methodology.md

⚠️  完成正確的 5W1H 分析後重新提交
"""

def log_blocked_attempt(compliance_result):
    """記錄被阻止的嘗試"""

    try:
        script_dir = os.path.dirname(os.path.abspath(__file__))
        project_root = os.path.abspath(os.path.join(script_dir, '../..'))
        log_dir = os.path.join(project_root, '.claude/hook-logs')

        os.makedirs(log_dir, exist_ok=True)

        log_file = os.path.join(log_dir, 'blocked-5w1h-attempts.log')

        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        log_entry = {
            'timestamp': timestamp,
            'type': '5w1h_compliance_block',
            'details': compliance_result
        }

        with open(log_file, 'a', encoding='utf-8') as f:
            f.write(json.dumps(log_entry, ensure_ascii=False) + '\\n')

    except Exception as e:
        # 記錄失敗不影響主要功能
        pass

def log_error(message):
    """記錄錯誤"""

    try:
        script_dir = os.path.dirname(os.path.abspath(__file__))
        project_root = os.path.abspath(os.path.join(script_dir, '../..'))
        log_dir = os.path.join(project_root, '.claude/hook-logs')

        os.makedirs(log_dir, exist_ok=True)

        log_file = os.path.join(log_dir, 'hook-errors.log')
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

        with open(log_file, 'a', encoding='utf-8') as f:
            f.write(f"[{timestamp}] 5W1H Hook Error: {message}\\n")

    except Exception:
        pass

def exit_allow():
    """允許操作繼續"""
    sys.exit(0)

if __name__ == "__main__":
    main()
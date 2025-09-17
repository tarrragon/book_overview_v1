#!/usr/bin/env python3

"""
StandardErrorWrapper 批量修復腳本 - Python 版本
使用精確的正則表達式和多行處理來修復所有 StandardErrorWrapper 引用
"""

import os
import re
import subprocess
from datetime import datetime
from pathlib import Path

# 錯誤代碼映射表
ERROR_CODE_MAPPING = {
    'EVENTBUS_ERROR': 'VALIDATION_ERROR',
    'UI_OPERATION_FAILED': 'OPERATION_ERROR',
    'VALIDATION_FAILED': 'VALIDATION_ERROR',
    'NETWORK_TIMEOUT': 'TIMEOUT_ERROR',
    'STORAGE_FAILED': 'STORAGE_ERROR',
    'CHROME_API_ERROR': 'CHROME_ERROR',
    'DOM_MANIPULATION_ERROR': 'DOM_ERROR',
    'FILE_OPERATION_ERROR': 'FILE_ERROR',
    'PERMISSION_DENIED': 'PERMISSION_ERROR',
    'PARSE_FAILED': 'PARSE_ERROR',
    'CONNECTION_FAILED': 'CONNECTION_ERROR',
    'CONFIG_INVALID': 'CONFIG_ERROR',
    'RENDER_FAILED': 'RENDER_ERROR',
    'PERFORMANCE_ISSUE': 'PERFORMANCE_ERROR',
    'UNKNOWN_ERROR': 'UNKNOWN_ERROR',
    'READMOO_API_ERROR': 'READMOO_ERROR',
    'BOOK_PROCESSING_ERROR': 'BOOK_ERROR',
    'INVALID_DATA_FORMAT': 'VALIDATION_ERROR'
}

def get_files_to_fix():
    """獲取需要修復的檔案清單"""
    try:
        result = subprocess.run(
            ['find', 'src', '-name', '*.js', '-type', 'f', '-exec', 'grep', '-l', 'StandardErrorWrapper', '{}', ';'],
            capture_output=True, text=True, check=True
        )
        return [f.strip() for f in result.stdout.split('\n') if f.strip()]
    except subprocess.CalledProcessError:
        return []

def create_backup(file_path, backup_dir):
    """建立檔案備份"""
    import shutil
    timestamp = int(datetime.now().timestamp())
    backup_name = f"{Path(file_path).name}.backup.{timestamp}"
    backup_path = backup_dir / backup_name
    shutil.copy2(file_path, backup_path)
    return backup_path

def add_errorcode_import(content):
    """添加 ErrorCodes 引用（如果還沒有）"""
    if "require('src/core/errors/StandardError')" in content and "require('src/core/errors/ErrorCodes')" not in content:
        content = content.replace(
            "const { StandardError } = require('src/core/errors/StandardError')",
            "const { StandardError } = require('src/core/errors/StandardError')\\nconst { ErrorCodes } = require('src/core/errors/ErrorCodes')"
        )
    return content

def fix_standarderrorwrapper_calls(content):
    """修復 StandardErrorWrapper 調用"""

    # 多行模式的正則表達式
    pattern = r'''throw\s+new\s+StandardErrorWrapper\(\s*['"`]([^'"`]+)['"`]\s*,\s*['"`]([^'"`]*?)['"`]\s*,\s*\{([^}]*?)\}\s*\)'''

    def replace_error(match):
        error_code = match.group(1).strip()
        message = match.group(2).strip()
        details = match.group(3).strip()

        # 映射錯誤代碼
        mapped_error_code = ERROR_CODE_MAPPING.get(error_code, 'UNKNOWN_ERROR')

        # 生成新的錯誤格式
        new_error = f"""const error = new Error('{message}')
      error.code = ErrorCodes.{mapped_error_code}
      error.details = {{ {details} }}
      throw error"""

        return new_error

    # 使用 DOTALL 標誌來匹配換行符
    content = re.sub(pattern, replace_error, content, flags=re.DOTALL | re.MULTILINE)

    return content

def fix_file(file_path, backup_dir):
    """修復單一檔案"""
    try:
        print(f"正在修復: {file_path}")

        if not os.path.exists(file_path):
            return {'success': False, 'error': 'File not found'}

        # 讀取檔案內容
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        original_content = content

        # 建立備份
        create_backup(file_path, backup_dir)

        # 1. 添加 ErrorCodes 引用
        content = add_errorcode_import(content)

        # 2. 修復 StandardErrorWrapper 調用
        content = fix_standarderrorwrapper_calls(content)

        # 檢查是否有修改
        if content != original_content:
            # 寫回檔案
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)

            # 檢查是否還有 StandardErrorWrapper 引用
            if 'StandardErrorWrapper' not in content:
                print(f"✅ 完全修復: {file_path}")
                return {'success': True, 'complete': True}
            else:
                print(f"⚠️  部分修復: {file_path}")
                return {'success': True, 'complete': False}
        else:
            print(f"⚠️  無需修復: {file_path}")
            return {'success': True, 'complete': False, 'skipped': True}

    except Exception as e:
        print(f"❌ 修復失敗: {file_path} - {str(e)}")
        return {'success': False, 'error': str(e)}

def main():
    """主要執行函數"""
    print("開始 Python 精確批量修復 StandardErrorWrapper 引用...\\n")

    # 建立備份目錄
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_dir = Path(f"docs/migration-reports/backups-{timestamp}")
    backup_dir.mkdir(parents=True, exist_ok=True)

    # 獲取需要修復的檔案
    files_to_fix = get_files_to_fix()
    print(f"找到 {len(files_to_fix)} 個需要修復的檔案\\n")

    if not files_to_fix:
        print("沒有找到需要修復的檔案")
        return

    # 統計結果
    results = {
        'total': len(files_to_fix),
        'complete': 0,
        'partial': 0,
        'failed': 0,
        'skipped': 0,
        'errors': []
    }

    # 修復每個檔案
    for file_path in files_to_fix:
        result = fix_file(file_path, backup_dir)

        if not result['success']:
            results['failed'] += 1
            results['errors'].append({'file': file_path, 'error': result['error']})
        elif result.get('skipped'):
            results['skipped'] += 1
        elif result.get('complete'):
            results['complete'] += 1
        else:
            results['partial'] += 1

    # 輸出總結
    print("\\n=== Python 精確修復總結 ===")
    print(f"總檔案數: {results['total']}")
    print(f"完全修復: {results['complete']}")
    print(f"部分修復: {results['partial']}")
    print(f"跳過檔案: {results['skipped']}")
    print(f"修復失敗: {results['failed']}")

    if results['errors']:
        print("\\n失敗檔案詳情:")
        for error in results['errors']:
            print(f"  - {error['file']}: {error['error']}")

    # 檢查剩餘的 StandardErrorWrapper 引用
    print("\\n檢查剩餘的 StandardErrorWrapper 引用...")
    try:
        result = subprocess.run(
            ['find', 'src', '-name', '*.js', '-type', 'f', '-exec', 'grep', '-l', 'StandardErrorWrapper', '{}', ';'],
            capture_output=True, text=True
        )
        remaining_files = [f.strip() for f in result.stdout.split('\\n') if f.strip()]

        if remaining_files:
            print(f"仍需手動處理的檔案 ({len(remaining_files)} 個):")
            for file in remaining_files[:10]:  # 只顯示前10個
                print(f"  - {file}")
            if len(remaining_files) > 10:
                print(f"  ... 還有 {len(remaining_files) - 10} 個檔案")
        else:
            print("✅ 所有 StandardErrorWrapper 引用已修復！")
    except subprocess.CalledProcessError:
        print("✅ 沒有剩餘的 StandardErrorWrapper 引用")

    print(f"\\n修復完成！備份檔案存放在: {backup_dir}")

if __name__ == "__main__":
    main()
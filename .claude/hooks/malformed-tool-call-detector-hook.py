#!/usr/bin/env -S uv run
# /// script
# requires-python = ">=3.10"
# dependencies = []
# ///
"""malformed-tool-call-detector-hook (Stop event)

Why:
  本 session 反覆出現一種失敗模式：模型輸出工具呼叫標記時寫壞（漏 `antml:`
  命名空間前綴，或在 `<invoke>` 前混入游離 token 如 `count`），導致 harness
  無法解析成 tool call，而是把整段當「純文字」渲染。後果是工具靜默未執行，
  使用者只看到一段 XML 文字，需手動喊「重送」。

  PreToolUse hook 無法攔截此狀況：壞掉的呼叫從未成為 tool 事件，PreToolUse 的
  觸發點（已解析 tool call 即將執行）在時序上接不到。可行機制是 Stop hook——
  在每個回合結束時檢查「剛輸出的 assistant 訊息」是否含未解析的工具標記字面，
  命中則 exit 2 阻擋 Stop 並要求模型立即用正確格式重發。

Consequence（不處理的代價）:
  malformed 工具呼叫靜默變成文字 → 工作流卡住、使用者需反覆人工介入、
  自動化流程（commit / 派發 / 驗證）中斷且難以察覺根因。

Action:
  讀 transcript 最後一則 assistant 訊息，剝除 fenced code block 與 inline code
  後，掃描殘餘文字是否出現未解析工具標記簽章。命中 → exit 2 + stderr 指引重發；
  否則 exit 0 放行。雙通道可觀測性（stderr + 檔案日誌）遵循 quality-baseline 規則 4。
"""

import json
import re
import sys
from datetime import datetime
from pathlib import Path

LOG_DIR = Path(__file__).resolve().parent / "hook-logs"
LOG_FILE = LOG_DIR / "malformed-tool-call-detector.log"

# 未解析工具標記簽章（剝除 code 區塊後比對）。
# 真正被解析的 tool call 不會在 assistant 文字裡留下這些字面；
# 只有「寫壞而被當文字渲染」時才會殘留，故為高特異性、低誤判簽章。
SIGNATURE_PATTERNS = [
    # 行首裸 <invoke name= / <parameter name= / </invoke>（最強訊號）
    re.compile(r"(?m)^[ \t]*<\s*invoke\b", re.IGNORECASE),
    re.compile(r"(?m)^[ \t]*<\s*parameter\b", re.IGNORECASE),
    re.compile(r"(?m)^[ \t]*</\s*invoke\s*>", re.IGNORECASE),
    # 游離 token（如 count）單獨一行後緊接 <invoke（本 session 實際反覆出現的形態）
    re.compile(r"(?m)^[ \t]*[A-Za-z]{1,12}[ \t]*\n[ \t]*<\s*invoke\b", re.IGNORECASE),
]


def log(message: str) -> None:
    """雙通道可觀測性：寫檔案日誌（stderr 留給 deny 訊息本身）。"""
    try:
        LOG_DIR.mkdir(parents=True, exist_ok=True)
        stamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        with LOG_FILE.open("a", encoding="utf-8") as fh:
            fh.write(f"[{stamp}] {message}\n")
    except Exception as exc:  # noqa: BLE001 - 日誌失敗不可反過來阻斷主流程
        sys.stderr.write(f"[malformed-tool-call-detector] log 失敗: {exc}\n")


def strip_code_regions(text: str) -> str:
    """剝除 fenced code block 與 inline code，避免「在程式碼/反引號內合法引用
    <invoke 字面」造成誤判（例如說明本問題時）。"""
    # 先移除 ``` ... ``` fenced block（含語言標註）
    text = re.sub(r"```.*?```", " ", text, flags=re.DOTALL)
    # 再移除 `...` inline code
    text = re.sub(r"`[^`\n]*`", " ", text)
    return text


def last_assistant_text(transcript_path: str) -> str:
    """從 transcript JSONL 取最後一則 assistant 訊息的純文字內容。"""
    path = Path(transcript_path)
    if not path.is_file():
        return ""

    last_text = ""
    try:
        with path.open(encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if not line:
                    continue
                try:
                    entry = json.loads(line)
                except json.JSONDecodeError:
                    continue
                message = entry.get("message") or entry
                if message.get("role") != "assistant":
                    continue
                content = message.get("content")
                texts = []
                if isinstance(content, str):
                    texts.append(content)
                elif isinstance(content, list):
                    for block in content:
                        if isinstance(block, dict) and block.get("type") == "text":
                            texts.append(block.get("text", ""))
                if texts:
                    last_text = "\n".join(texts)
    except Exception as exc:  # noqa: BLE001
        log(f"讀 transcript 失敗: {exc}")
        return ""
    return last_text


def detect(text: str) -> str:
    """回傳命中的簽章描述（空字串=未命中）。"""
    cleaned = strip_code_regions(text)
    for pattern in SIGNATURE_PATTERNS:
        if pattern.search(cleaned):
            return pattern.pattern
    return ""


def main() -> int:
    try:
        raw = sys.stdin.read()
        payload = json.loads(raw) if raw.strip() else {}
    except json.JSONDecodeError:
        payload = {}

    transcript_path = payload.get("transcript_path", "")
    if not transcript_path:
        return 0

    text = last_assistant_text(transcript_path)
    if not text:
        return 0

    hit = detect(text)
    if not hit:
        return 0

    log(f"偵測到 malformed tool-call 標記，簽章={hit!r}")
    sys.stderr.write(
        "[malformed-tool-call-detector] 偵測到未被解析的工具呼叫標記（被當純文字渲染）。\n"
        "最近一則訊息含裸 <invoke>/<parameter> 字面或游離 token 接 <invoke>，"
        "代表工具呼叫寫壞而未執行。\n"
        "請立刻用正確格式重發該工具呼叫：使用帶 antml: 前綴的 invoke/parameter 標記，"
        "且 <invoke> 前不得有任何游離字（如 count）。\n"
    )
    return 2


if __name__ == "__main__":
    sys.exit(main())

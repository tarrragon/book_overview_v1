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
    """剝除 fenced code block、backtick 引述與縮排 code block，避免「在程式碼／
    反引號內合法引用 <invoke 字面」造成誤判（例如說明本問題時）。

    剝除順序（W2-011.1 false-positive 修復）：
      1. fenced block（``` ... ```）—— 須最先，避免後續 backtick 規則誤切三引號內部。
      2. backtick 引述—— 改用 `[^`]*` 允許跨行（根因 B：多行反引號引述漏剝）。
      3. 4-space／tab 縮排 code block—— 整行剝為空白（根因 A：縮排引述標記命中 signature）。
    """
    # 1. 先移除 ``` ... ``` fenced block（含語言標註）
    text = re.sub(r"```.*?```", " ", text, flags=re.DOTALL)
    # 2. 再移除 `...` backtick 引述；不排除換行以支援跨行引述（根因 B）
    text = re.sub(r"`[^`]*`", " ", text, flags=re.DOTALL)
    # 3. 最後將 4-space／tab 縮排行整行清空（Markdown 縮排 code block，根因 A）
    text = re.sub(r"(?m)^(?: {4}|\t).*$", "", text)
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


# ---------------------------------------------------------------------------
# 內嵌 self-test fixtures（W2-011.2 / W2-011 acceptance 3）
#
# 標記字面以字串拼接（"<in" "voke"）組裝，避免本 hook 或其他 lint hook
# 掃描本檔原始碼時把 fixture 字面誤判為「未解析工具標記」造成連鎖誤觸。
# 這些常數同時供外部 pytest（test_malformed_tool_call_detector_hook.py）
# 引用，是真陽/真陰 fixture 的單一事實來源（DRY，避免重複維護）。
# ---------------------------------------------------------------------------

_OPEN = "<in" "voke"  # "<invoke"
_PARAM = "<para" "meter"  # "<parameter"
_CLOSE = "</in" "voke>"  # "</invoke>"

# 真陰：被引述的標記字面不應命中（strip_code_regions 應剝除後不留簽章）
SELF_TEST_TRUE_NEGATIVES = {
    # 根因 A：4-space 縮排 code block 內含標記字面
    "four_space_indent": (
        "以下是壞掉的標記範例（4-space 縮排引述）：\n\n"
        f"    {_OPEN} name=\"Foo\">\n"
        f"    {_PARAM} name=\"x\">1</parameter>\n"
        f"    {_CLOSE}\n\n"
        "說明完畢，這些只是被引述的程式碼字面。"
    ),
    # 根因 B：跨行 backtick 引述內含標記字面
    "cross_line_backtick": (
        "這段 `多行\n"
        f"{_OPEN} name=\"Bar\">\n"
        "內容` 只是用反引號引述的多行字面。"
    ),
    # fenced code block 內的標記字面
    "fenced_block": (
        "範例如下：\n\n```xml\n"
        f"{_OPEN} name=\"Baz\">\n{_CLOSE}\n```\n\n以上為說明。"
    ),
    # 單行 inline backtick 內的標記字面
    "inline_backtick": (
        f"請用帶前綴的 `{_OPEN}>` 標記，不要寫成裸的。"
    ),
}

# 真陽：真實寫壞而被當文字渲染的標記必須命中（禁削弱）
SELF_TEST_TRUE_POSITIVES = {
    # 行首裸 <invoke>（signature 1）
    "bare_invoke": (
        f"這是真的寫壞了：\n{_OPEN} name=\"Real\">\n{_CLOSE}"
    ),
    # 行首裸 </invoke>（signature 3）
    "bare_close_invoke": (
        f"前面有內容\n{_CLOSE}\n後面有內容"
    ),
    # 游離 token 接 <invoke>（signature 4，禁削弱）
    "stray_token_invoke": (
        f"count\n{_OPEN} name=\"Real\">"
    ),
}


def _self_test() -> list:
    """執行內嵌 self-test，回傳失敗描述清單（空清單=全通過）。

    透過 --self-test 分支由 CI（npm run test:hooks 等效路徑）執行，
    非 per-Stop-event 觸發——避免每回合結束時的額外開銷。
    """
    failures = []
    for name, text in SELF_TEST_TRUE_NEGATIVES.items():
        hit = detect(text)
        if hit:
            failures.append(
                f"真陰 fixture '{name}' 誤命中簽章 {hit!r}（應回傳空字串）"
            )
    for name, text in SELF_TEST_TRUE_POSITIVES.items():
        hit = detect(text)
        if not hit:
            failures.append(
                f"真陽 fixture '{name}' 未命中任何簽章（應被攔截）"
            )
    return failures


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
    if "--self-test" in sys.argv[1:]:
        problems = _self_test()
        if problems:
            sys.stderr.write("[malformed-tool-call-detector] self-test 失敗:\n")
            for item in problems:
                sys.stderr.write(f"  - {item}\n")
            sys.exit(1)
        sys.stdout.write(
            "[malformed-tool-call-detector] self-test 通過："
            f"真陰 {len(SELF_TEST_TRUE_NEGATIVES)} + 真陽 {len(SELF_TEST_TRUE_POSITIVES)}\n"
        )
        sys.exit(0)
    sys.exit(main())

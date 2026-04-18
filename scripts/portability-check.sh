#!/usr/bin/env bash
# portability-check.sh — Marketplace 可攜性掃描
#
# 掃描指定 Skill 目錄中所有檔案，偵測違反 marketplace 可攜性的禁用模式。
# 回傳 0 = 通過，非 0 = 發現違規（並輸出檔案:行號:模式:匹配內容）。
#
# 來源：父 ticket 可攜性檢查表定義的 7 類禁用模式
# 用途：每次修改 Skill 內容後執行，防止引入框架耦合

set -u

# ---- 參數 -----------------------------------------------------------------
TARGET_DIR="${1:-.claude/skills/compositional-writing}"

if [[ ! -d "$TARGET_DIR" ]]; then
    printf 'ERROR: 目標目錄不存在：%s\n' "$TARGET_DIR" >&2
    exit 2
fi

# ---- 禁用模式定義（8 類） --------------------------------------------------
# 每個模式：名稱|正則（ERE）
# 注意：正則需同時避開合法白名單（例如 Zettelkasten、Anthropic URL、本腳本自身）
# 教學用例若含 Wave ID，在對應行末加 <!-- portability-allow: reason --> 豁免掃描
PATTERNS=(
    'framework-rules-path|\.claude/rules/'
    'framework-methodologies-path|\.claude/methodologies/'
    'framework-hooks-path|\.claude/hooks/'
    'project-ticket-id|\b(0\.(17|18|19|20)\.[0-9]+-W[0-9]+(\.[0-9]+)*|PROP-[0-9]+|ANA-[0-9]+|IMP-[0-9]+|PC-[0-9]+|ARCH-[0-9]+)\b'
    'bare-wave-id|\bW[0-9]+-[0-9]+(\.[0-9]+)*\b'
    'project-commit-hash|\b[0-9a-f]{7,40}\b'
    'project-worklog-path|docs/work-logs/'
    'framework-hook-name|\b(skill-description-length-check|doc-sync-check|branch-verify-hook|pre-tool-use-hook|post-tool-use-hook)\b'
)

# ---- 排除規則 -------------------------------------------------------------
# 允許項白名單（commit hash 最易誤判，需排除明顯非 hash 的 hex 片段）
# - 本腳本自身不參與掃描（位於 scripts/，不在 TARGET_DIR 下）
# - Markdown code fence 語言標記不算 hash

is_excluded_line() {
    local line="$1"
    # 排除：程式碼區塊語法 ``` 行
    [[ "$line" =~ ^[[:space:]]*\`\`\` ]] && return 0
    # 排除：行內明示豁免標記（portability-allow）
    # 用途：skill 作者標記「此處為設計內的框架橋接引用」
    [[ "$line" =~ portability-allow ]] && return 0
    return 1
}

# ---- 掃描 -----------------------------------------------------------------
violations=0
report=""

while IFS= read -r -d '' file; do
    while IFS= read -r pattern_entry; do
        name="${pattern_entry%%|*}"
        regex="${pattern_entry#*|}"

        # grep -n -E：顯示行號 + ERE
        # 用 awk 過濾排除規則
        matches=$(grep -nE "$regex" "$file" 2>/dev/null || true)
        [[ -z "$matches" ]] && continue

        while IFS= read -r match_line; do
            [[ -z "$match_line" ]] && continue
            lineno="${match_line%%:*}"
            content="${match_line#*:}"

            is_excluded_line "$content" && continue

            # commit-hash 二次過濾：避開 YAML frontmatter 日期、Unicode codepoint、version 號
            if [[ "$name" == "project-commit-hash" ]]; then
                # 跳過：明顯是 U+XXXX 形式
                [[ "$content" =~ U\+[0-9A-Fa-f]+ ]] && continue
                # 跳過：顯為版本號（vX.Y.Z / X.Y.Z）上下文
                [[ "$content" =~ v?[0-9]+\.[0-9]+\.[0-9]+ ]] && continue
            fi

            report+="${file}:${lineno}:${name}: ${content}"$'\n'
            ((violations++))
        done <<< "$matches"
    done < <(printf '%s\n' "${PATTERNS[@]}")
done < <(find "$TARGET_DIR" -type f \( -name '*.md' -o -name '*.yaml' -o -name '*.yml' -o -name '*.json' -o -name '*.txt' \) -print0)

# ---- 報告 -----------------------------------------------------------------
if (( violations > 0 )); then
    printf '可攜性檢查：發現 %d 處違規\n' "$violations" >&2
    printf '%s' "$report" >&2
    printf '\n掃描目錄：%s\n' "$TARGET_DIR" >&2
    exit 1
fi

printf '可攜性檢查通過：%s（0 違規）\n' "$TARGET_DIR"
exit 0

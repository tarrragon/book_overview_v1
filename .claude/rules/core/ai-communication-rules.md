# AI 對話品質規則

本文件定義所有 AI 對話（用戶↔Claude、PM↔代理人、代理人↔代理人、prompt 撰寫）的通用品質基線。

> **核心理念**：每次對話都是一次 AI 推理資源的投放。意圖越清晰、結構越明確、冗餘越少，AI 越能在 token 預算內輸出對的結果。
> **詳細範例、情境應用、完整 Agent Prompt / Context Bundle 骨架**：`.claude/skills/compositional-writing/references/writing-prompts.md`

---

## 適用範圍

| 對話類型 | 範例 |
|---------|------|
| 用戶↔Claude | 用戶 prompt 與回應 |
| PM↔代理人 | `Agent(prompt=...)` 派發 |
| 代理人↔代理人 | teammate SendMessage、Agent Team 協作 |
| 任何 prompt 撰寫 | Ticket Context Bundle、Hook 提示訊息、系統指令 |

---

## 五大通用原則

| 原則 | 核心要求 |
|------|---------|
| 1. 原子化 | 一個對話一個可驗收任務，禁止多目標混合 |
| 2. 意圖顯性 | 第一句即表達目標；不直觀的約束必附理由 |
| 3. 結構化標記 | 使用章節/表格/列表讓對方快速定位，禁純散文堆疊 |
| 4. 可查詢性 | 穩定關鍵字前置；變數佔位符 snake_case 自說明 |
| 5. 欄位分離 | 動作/約束/理由/驗收各佔一欄，禁擠一行 |

---

## 強制規則

### 規則 1：意圖前置

| 場景 | 禁止 | 正確 |
|------|------|------|
| prompt 開頭 | 前段鋪背景，尾段才說任務 | 第一句即動詞 + 受詞 |
| 下約束 | 「不要用 X」單句 | 「不要用 X（因為 Y）」 |
| 期望輸出 | 「分析一下」 | 指定結構（表格/列表/JSON） |

### 規則 2：結構化標記

長度 > 5 行的 prompt 或對話訊息必須至少使用一項：Markdown 章節標題、表格、有序/無序列表、XML 標籤。**禁止**純散文段落堆疊超過 5 行。

### 規則 3：欄位不混合

| 欄位 | 角度 | 禁止混入 |
|------|------|---------|
| 任務 / Task | 動詞 + 受詞 | 約束、理由、驗收 |
| 約束 / Constraints | 邊界（禁止 / 必要） | 動作、驗收 |
| 驗收 / Acceptance | 終點判定（可勾選） | 動作、理由 |
| 背景 / Context | 理由（可選） | 動作、驗收 |

### 規則 4：Token 節省（不傷害意圖清晰度為前提）

| 策略 | 前 | 後 |
|------|-----|-----|
| 符號取代連接詞 | 「如果 A 並且 B，那麼 C」 | 「A AND B → C」 |
| 表格取代重複句型 | 「當 X 時 Y；當 X2 時 Y2；...」 | Markdown 表格 |
| 路徑引用取代貼入 | 貼入 500 行規則全文 | 「規則：path.md」 |
| 刪除客套鋪陳 | 「您好，希望您能幫我...」 | 「任務：...」 |
| 通用約定不枚舉 | 列出 Markdown 所有語法 | 「輸出格式：Markdown」 |

---

## 對話品質檢查清單

發送 prompt 或對話訊息前，確認：

- [ ] 第一句即表達任務目標？
- [ ] 不直觀的約束有附理由？
- [ ] 結構化標記（章節 / 表格 / 列表）存在？
- [ ] 每個欄位只寫該角度內容，無動作 + 約束 + 驗收混合？
- [ ] 無多餘客套與背景鋪陳？
- [ ] 重複句型已改為表格？
- [ ] 長文件以路徑引用取代全文貼入？
- [ ] 變數佔位符為 snake_case 自說明名（`{ticket_id}`，非 `{x}`）？

---

## 反模式速查

| 反模式 | 症狀 | 正確 |
|-------|------|------|
| 多任務混合 | 「做 A 和 B 和 C」 | 拆為獨立對話 |
| 意圖埋在後段 | 前三段背景，最後才說任務 | 第一句即任務 |
| 無輸出格式 | 「分析一下」 | 指定結構 |
| 無理由禁令 | 「不要用 X」 | 「不要用 X（因為 Y）」 |
| 模糊佔位符 | `{x}`、`{var}` | `{ticket_id}`、`{file_path}` |
| 純散文堆疊 | 長段落無結構 | 章節 / 列表 / 表格 |
| 全文貼入規則 | 貼入長文件全文 | 引用路徑 |

---

## 相關文件

- `.claude/skills/compositional-writing/SKILL.md` — Zettelkasten 寫作方法論入口（三大支柱、五大原則 + 六情境路由）
- `.claude/skills/compositional-writing/references/writing-prompts.md` — 本規則詳細版 + skill 產出品質規範（完整 Agent Prompt / Context Bundle 骨架、Token 節省深度策略、情境範例）
- `.claude/rules/core/language-constraints.md` — 語言與禁用詞彙規範
- `.claude/rules/core/document-format-rules.md` — 文件格式規範

---

**Last Updated**: 2026-04-17
**Version**: 1.0.0 — 從 compositional-writing/writing-prompts.md 提煉通用對話規範，升級為框架級 auto-load 規則

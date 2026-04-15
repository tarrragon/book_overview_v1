# 主線程決策路由

本文件是規則系統的核心路由索引，指向各決策路徑的專屬檔案。

> **架構**：入口用二元過濾（快速縮小範圍），子路由用多路表格（直接對照選項）。
>
> **管理哲學**：主管的價值不在於解決問題的速度，而在於讓團隊的人力發揮到極致。
> 詳見：.claude/rules/core/pm-role.md
>
> **適用對象**：本文件的行為限制僅適用於 rosemary-project-manager（主線程）。被派發的 subagent 依據自身職責定義執行，不受主線程行為限制。

---

## 決策流程總覽

```
接收訊息
    |
    v
[Skill 匹配層] 已註冊 Skill 觸發條件匹配?
    +── 是 → 使用 Skill tool 執行（結束）
    +── 否 ↓
    v
[Context 重度檢查層] 偵測決策品質風險訊號?（PC-066 防護）
    +── 連續失敗 ≥ 2 次（同 ticket）→ 強制 /wrap-decision 快速模式
    +── PM 將輸出「做不到/無法/禁止/不可能」→ 強制 /wrap-decision 快速模式
    +── ANA Ticket claim → 強制 /wrap-decision 快速模式
    +── 重大決策關鍵字（升級/重構/改架構/新建規則）→ 提示（非強制）
    +── 否 ↓
    v
[派發閘門] → dispatch-gate.md
    複雜度關卡（指數 > 10 必須拆分）
    Context Bundle 關卡（三步驟檢查）
    並行化判斷
    |
    v（通過閘門）
[第零層：明確性檢查] 包含明確錯誤關鍵字?
    +── 是 → incident-routing.md
    +── 否 ↓
    v
[第一層：類型判斷] 問題 / 命令 / 其他?
    +── 問題 → question-routing.md
    |   （"怎麼樣"、"進度"、"為什麼"、"如何"、"是什麼"、"?"）
    +── 命令 → command-routing.md
    |   （"實作"、"建立"、"修復"、"處理"、"執行"、"開始"、"測試"）
    +── 其他 → PM 向用戶確認意圖（AskUserQuestion）

--- 以下按條件觸發，非線性序列 ---

[執行中發現]   → execution-discovery-rules.md（觸發：發現技術債/問題）
[完成後發現]   → execution-discovery-rules.md 3.5-B 層（觸發：completed Ticket 需修正）
[任務完成]     → completion-checkpoint-rules.md（觸發：Ticket complete 後）
```

> 視覺化 Mermaid 圖表：.claude/references/decision-tree-diagrams.md

---

## Skill 匹配層（最高優先）

Skill 是預建的專用工具，優先於代理人派發。

| 優先級 | 匹配方式 | 範例 |
|--------|---------|------|
| 1 | 明確指令 (`/skill-name`) | `/ticket track summary` |
| 2 | Skill description 中的觸發關鍵字 | 「確認待辦的 ticket」→ ticket Skill |
| 3 | Hook `[SKILL 提示]` 輸出 | Hook 建議使用某 Skill |

無 Skill 匹配 → 進入 Context 重度檢查層。

---

## Context 重度檢查層（PC-066 入口，條件權威來源見 SKILL）

> **核心理念**：派發閘門前的決策品質風險入口。PM 在此節點主動檢視當前 session 是否觸發 WRAP 條件；強制觸發路由至 /wrap-decision 快速模式。

**入口判斷**：

進入派發閘門前自問——當前是否符合 wrap-decision SKILL「觸發條件」章節的任一情境？

- 是 → 執行 /wrap-decision 快速模式（5 分鐘）→ 完成後繼續派發閘門
- 否 → 直接進入派發閘門

> **觸發條件權威來源**：`.claude/skills/wrap-decision/SKILL.md`「觸發條件」表格（連續失敗 / 被困住 / 偏離核心 / 重大決策 / 救火排擠 / ANA / Debug / 提案）。本章節不複述條件以避免清單漂移（DRY 違反 → PC-066 教訓）。

**自動偵測**：`decision-quality-guard-hook.py`（W10-009 追蹤）為唯一強制觸發節點，本章節為人工 fallback。

---

## 路由表

| 分支條件 | 路由檔案 | 適用場景 |
|---------|---------|---------|
| 所有派發前（強制） | 本檔案「Context 重度檢查層」 + dispatch-gate.md | 決策品質風險偵測 + 複雜度關卡 + Context Bundle + 並行化 |
| 動作摩擦力評估（哲學層） | friction-management-methodology.md | 判斷動作應降低/保留/增加摩擦力（30 秒準則）。流程階段摩擦力曲線見同文件「開發流程階段的摩擦力曲線」章節 |
| ANA/Debug/提案（強制 WRAP） | /wrap-decision | 分析、除錯、提案評估必須先 WRAP |
| Proposal 建立 / 狀態變更 | proposal-evaluation-gate.md | docs/proposals/ 新建或修改 confirmed/approved 狀態時的強制分級與評估 |
| Hook 設計 / 盤點 / 降級 | hook-stage-balance-methodology.md | 新增 Hook、既有 Hook 盤點、降級評估時的階段平衡設計原則 |
| 問題類型訊息 | question-routing.md | 查詢、諮詢、進度 |
| 命令類型訊息 | command-routing.md | 開發、修改、TDD 階段 |
| 錯誤/失敗 | incident-routing.md | 事件回應（含 WRAP 強制） |
| 代理人派發後快速完成通知（< 2 分鐘） | pm-role.md 失敗判斷前置步驟 Step 0.5 / 0.5-A | 強制 TaskOutput status 查詢；禁止用 Hook 訊號推論失敗（PC-050 模式 E / PC-070） |
| 執行中發現 | execution-discovery-rules.md | 技術債、超範圍需求 |
| 完成後發現 | execution-discovery-rules.md 3.5-B | completed Ticket 交付物需修正 |
| 任務完成 | completion-checkpoint-rules.md | Checkpoint 循環（0/0.5/1/1.5/1.8/1.9/2/3/4/R） |
| TDD 完成路由 | tdd-completion-routing.md | Checkpoint 2 情境 D（TDD Phase 完成） |
| 代理人管理 | agent-dispatch-enforcement.md | 觸發優先級、強制命令、違規 |
| Ticket 進度更新（強制） | completion-checkpoint-rules.md | Checkpoint 轉換時更新 Ticket |
| 代理人權限查詢 | agent-path-registry.md | 路徑表 Source of Truth |

---

## 相關文件

### 路由子檔案（決策路由分支）

- .claude/pm-rules/dispatch-gate.md - 派發閘門（複雜度 + Context Bundle + 並行化）
- .claude/pm-rules/question-routing.md - 問題路由（查詢、諮詢）
- .claude/pm-rules/command-routing.md - 命令路由（開發、TDD）
- .claude/pm-rules/incident-routing.md - 事件回應路由

### Domain 拆分檔案（DDD 邊界）

- .claude/pm-rules/execution-discovery-rules.md - 執行 Domain（第三層半 + 第四層）
- .claude/pm-rules/completion-checkpoint-rules.md - 完成 Domain（第七層 + 第八層）
- .claude/pm-rules/agent-dispatch-enforcement.md - 代理人管理 Domain

### 共用參考

- .claude/pm-rules/agent-path-registry.md - 代理人路徑權限表（Source of Truth）
- .claude/pm-rules/context-bundle-spec.md - Context Bundle 規範
- .claude/references/pm-agent-observability.md - 背景代理人觀察指南（dispatch-active.json / TaskOutput / Hook / notification 四工具分工）

### 支撐規則

- .claude/pm-rules/parallel-dispatch.md - 並行派發指南
- .claude/pm-rules/tdd-flow.md - TDD 流程
- .claude/pm-rules/incident-response.md - 事件回應詳細流程
- .claude/pm-rules/ticket-lifecycle.md - Ticket 生命週期
- .claude/pm-rules/skip-gate.md - Skip-gate 防護
- .claude/pm-rules/askuserquestion-rules.md - AskUserQuestion 規則
- .claude/methodologies/friction-management-methodology.md - 摩擦力管理（PM 決策哲學層）
- .claude/references/decision-tree-checkpoint-details.md - Checkpoint 詳細流程

---

**Last Updated**: 2026-04-15
**Version**: 9.3.0 — 新增路由：代理人派發後快速完成通知 → pm-role.md Step 0.5 / 0.5-A 強制 TaskOutput 查詢（PC-050 模式 E / PC-070 防護）

**Version**: 9.2.0 — 新增 Context 重度檢查層（PC-066 入口）：條件權威來源指向 wrap-decision SKILL（避免 DRY 違反），本層僅為人工 fallback；自動強制由 W10-009 Hook 處理

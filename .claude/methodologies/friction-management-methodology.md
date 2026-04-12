# 摩擦力管理方法論

> 來源：Robert I. Sutton & Huggy Rao, *The Friction Project*（2024）
> 建立 Ticket：0.18.0-W3-009

---

## 核心理念

摩擦力是**中性工具**，不是該被消除的障礙。PM 的價值不在於追求「零摩擦的流暢」，而在於：

- **降低**應降低的摩擦力（高頻、低風險、有 SOP 的動作）→ 讓優秀工作輕鬆發生
- **增加**應增加的摩擦力（低頻、高風險、不可逆的動作）→ 讓糟糕工作難以發生
- **保留**中等摩擦力（需要判斷、影響他人的動作）→ 維持必要的決策深度

> **判斷準則**：錯了會怎樣？可逆嗎？影響多大？

---

## 摩擦力四象限

```
                    高風險/不可逆
                          |
        [保留現狀]         |         [增加摩擦]
        (中頻中風險)       |         (低頻高風險)
        維持既有 SOP       |         強制多視角/WRAP/阻擋
                          |
    低頻 ─────────────────┼───────────────── 高頻
                          |
        [觀察實況]         |         [降低摩擦]
        (低頻低風險)       |         (高頻低風險)
        紀錄不強制         |         直接執行不詢問
                          |
                    低風險/可逆
```

---

## PM 決策點分類（14 項）

### 象限 A：降低摩擦（高頻低風險，直接執行不詢問）

| 決策點 | 行為準則 | 來源規範 |
|--------|----------|---------|
| 驗證類子任務派發（跑測試/lint/覆蓋率） | 直接建子 Ticket + 背景派發，不詢問用戶 | parallel-dispatch.md 規則 5（W3-008） |
| `ticket track query/list/summary` 純查詢 | 直接執行，不記錄日誌 | ticket CLI 設計原則 |
| `ticket track append-log` 進度紀錄 | 階段轉換時強制執行 | completion-checkpoint-rules Checkpoint 0.5 |
| Worktree 合併（代理人完成後） | 立即 merge，不等 ticket complete | feedback_worktree_merge_after_agent |
| Context Bundle 準備（下一個 Ticket） | 派發後立即切換執行，不等代理人回來 | parallel-dispatch async-mindset |
| 執行期間發現技術債建立 Ticket | `/ticket create` 直接建立，不詢問確認 | quality-baseline 規則 5 |

### 象限 B：保留現狀（中頻中風險，維持既有 SOP）

| 決策點 | 行為準則 | 來源規範 |
|--------|----------|---------|
| Commit 訊息確認（#16 錯誤學習） | commit 後由 Hook 觸發 AskUserQuestion | askuserquestion-rules #16 |
| Handoff 方向選擇（多兄弟任務可選） | AskUserQuestion #9 確認方向 | askuserquestion-rules #9 |
| 驗收方式確認（P0 優先級 complete 前） | AskUserQuestion #1（非 P0 自動） | askuserquestion-rules #1 |
| Ticket 認領後範圍確認 | 讀取 5W1H + 驗證 where.files 存在 | pm-role.md 切換 SOP |

### 象限 C：增加摩擦（低頻高風險，強制多視角/WRAP/阻擋）

| 決策點 | 行為準則 | 來源規範 |
|--------|----------|---------|
| ANA/Debug/提案評估 | **強制**套用 WRAP 框架 | feedback_wrap_mandatory_for_analysis |
| Wave 收尾版本發布 | **強制**先做 `/parallel-evaluation` Wave 審查（含 linux 委員）再進入 #3 | completion-checkpoint Checkpoint 2-C |
| 破壞性 git 操作（reset --hard / force push） | 必須向用戶確認（本準則無自動化豁免） | pm-role 執行操作與謹慎 |
| 規則/方法論/代理人檔案修改 | **強制**先建 Ticket 追蹤（無「太小」例外） | feedback_all_rule_changes_need_ticket / PC-053 |

### 象限 D：觀察實況（低頻低風險，紀錄但不強制）

| 決策點 | 行為準則 | 備註 |
|--------|----------|------|
| 臨時使用者閒聊/狀態詢問 | 直接回答，不建 Ticket | 但若觸及決策則升級到象限 A 或 C |

---

## 摩擦力調整機制

摩擦力分類**不是永久不變**。以下訊號表示某決策點需要從當前象限**升級（增加摩擦）**或**降級（減少摩擦）**：

### 升級訊號（降低摩擦 → 增加摩擦）

| 訊號 | 範例 | 升級動作 |
|------|------|----------|
| 該動作連續 2 次出錯 | 自動派發的驗證類代理人誤判失敗 2 次 | 加入前置檢查步驟（如 hook-logs 掃描） |
| 單次錯誤影響跨版本/跨專案 | 規則修改破壞既有 Ticket 流程 | 升級為「必須多視角審查」 |
| 動作頻率下降且風險上升 | 從日常任務變成版本發布關卡 | 加入 `/parallel-evaluation` 強制步驟 |

### 降級訊號（增加摩擦 → 降低摩擦）

| 訊號 | 範例 | 降級動作 |
|------|------|----------|
| 該動作已有完整 SOP 且連續 5 次無錯 | 驗證類任務原本需詢問，現已自動化穩定 | 改為直接執行不詢問（如 W3-008） |
| 動作可完全逆向恢復 | Ticket 建立後可 `/ticket migrate` 遷移 | 不需前置確認 |
| Hook 已能代替人工判斷 | `acceptance-gate-hook` 自動檢查 AC | 移除 PM 手動檢查要求 |

### 觀察期要求

任何象限調整必須有**觀察期**（至少 2 個 Wave）驗證，防止過度反應個案。W3-008 就是從「詢問用戶」降級為「自動派發」的成功案例（先在 memory 累積經驗，再升格為規則）。

---

## PM 自檢清單

遇到新動作或既有動作感到困惑時，依序問：

1. **這個動作每週/每月做幾次？** → 高頻進 A/B 象限，低頻進 C/D 象限
2. **錯了能逆轉嗎？** → 可逆進 A/D，不可逆進 C
3. **錯了影響誰？** → 只影響當前任務進 A/D，影響他人/跨專案進 B/C
4. **既有 SOP 是否涵蓋？** → 有完整 SOP 進 A（降低摩擦），沒有進 B/C（保留或增加）
5. **過去連續 N 次是否都成功？** → 成功 5+ 次考慮降級，出錯 2+ 次考慮升級

---

## 與既有方法論的關係

| 方法論 | 本方法論補充視角 |
|--------|----------------|
| decision-tree.md | 提供「何時直接執行 vs 何時詢問」的分類依據 |
| parallel-dispatch.md 驗證類派發 | 本方法論的象限 A 首個落地案例 |
| quality-baseline.md 規則 5「所有發現必須追蹤」 | 對應象限 A「建 Ticket 不詢問」 |
| quality-baseline.md 規則 6「框架修改優先」 | 對應象限 C「規則修改必須建 Ticket」 |
| WRAP 決策框架 | 對應象限 C「高風險動作強制多視角」 |

---

## 相關文件

- .claude/pm-rules/decision-tree.md - 主線程決策路由（第二層引用本方法論）
- .claude/pm-rules/parallel-dispatch.md - 並行派發（驗證類自動派發為象限 A 案例）
- .claude/pm-rules/askuserquestion-rules.md - AskUserQuestion 規則（象限 B 的具體場景）
- .claude/pm-rules/skip-gate.md - Skip-gate 防護（象限 C 的強制措施）
- .claude/skills/wrap-decision/SKILL.md - WRAP 決策框架（象限 C 強制步驟）
- .claude/rules/core/pm-role.md - PM 角色行為準則
- .claude/rules/core/quality-baseline.md - 品質基線規則 5/6

---

**Last Updated**: 2026-04-12
**Version**: 1.0.0 - 初版建立（0.18.0-W3-009）
**Source**: Sutton & Rao, *The Friction Project*（2024）的組織摩擦力分類法 + 本專案累積的 PM 決策案例

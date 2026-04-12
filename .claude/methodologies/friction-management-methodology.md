# 摩擦力管理方法論

> 來源：Robert I. Sutton & Huggy Rao, *The Friction Project*（2024）
> 核心理念：**摩擦力是中性工具，不是該被消除的障礙**

---

## 30 秒判斷準則

遇到不確定是否要詢問用戶或強制流程的動作時，問三題：

1. **頻率**：每週/每月做幾次？
2. **可逆性**：錯了能逆轉嗎？
3. **影響範圍**：錯了影響誰？

依三題結果對應象限：

| 頻率 × 風險 | 行動 | 對應規範 |
|-----------|------|---------|
| 高頻 + 可逆 + 只影響當前任務 | **降低摩擦**：直接執行不詢問 | 象限 A — 驗證類派發、純查詢、建 Ticket 追蹤 |
| 中頻 + 中風險 + 影響他人但可恢復 | **保留既有 SOP**：依規則詢問 | 象限 B — Handoff 方向、AC 勾選、錯誤學習 |
| 低頻 + 不可逆 + 影響跨版本/專案 | **增加摩擦**：強制 WRAP/多視角/確認 | 象限 C — ANA/Debug、規則修改、破壞性 git |

> 19 個 PM 決策點的完整分類：`.claude/references/friction-management-decision-points.md`

---

## 演進機制（升級/降級訊號）

象限分類**不是永久不變**。發現以下訊號時調整：

| 訊號方向 | 觸發條件 | 動作 |
|---------|---------|------|
| **升級**（降摩擦→加摩擦） | 某動作連續 2 次出錯；或影響範圍擴大 | 加入前置檢查、強制多視角審查 |
| **降級**（加摩擦→降摩擦） | 某動作連續 5 次無錯且有完整 SOP；或 Hook 已能代替人工判斷 | 改為直接執行、移除詢問步驟 |

**觀察期要求**：任何象限調整必須至少 2 個 Wave 驗證，防止過度反應個案。典型降級案例：W3-008 把驗證類任務從「詢問用戶」降級為「背景自動派發」。

---

## 與既有規則的關係

本方法論**不取代**既有規則，提供哲學層**統一判斷框架**：

| 關係 | 對應 |
|------|------|
| 象限 A 的具體規則 | parallel-dispatch.md 規則 5（驗證類派發）、quality-baseline 規則 5（建 Ticket） |
| 象限 B 的具體規則 | askuserquestion-rules.md 18 個場景 |
| 象限 C 的具體規則 | skip-gate.md Level 1-3、WRAP Skill、quality-baseline 規則 6 |
| 升降級訊號的實作 | 由具體規則文件按需修改（觀察累積後）|

---

## 相關文件

- `.claude/references/friction-management-decision-points.md` - 19 個 PM 決策點完整分類表
- `.claude/pm-rules/decision-tree.md` - 主線程決策路由（含本方法論引用）
- `.claude/pm-rules/askuserquestion-rules.md` - 18 個 AskUserQuestion 場景（每項標註所屬象限）
- `.claude/skills/wrap-decision/SKILL.md` - WRAP 決策框架（象限 C 強制步驟）
- `.claude/error-patterns/process-compliance/PC-056-authority-bias-in-parallel-evaluation-results.md` - 本方法論建立過程產生的錯誤模式

---

**Last Updated**: 2026-04-12
**Version**: 2.0.0 - 分層拆分 + 修復（W5-007 執行 WRAP 推薦選項 3）
**v1.0.0 → v2.0.0 變更**: 主檔從 160 行濃縮至約 50 行；14 點決策點分類表移至 references/；刪除象限 D（硬湊）；修正 3 個映射錯誤；補齊 4 個遺漏；雙通道記錄 PC-056

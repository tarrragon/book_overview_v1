# PC-160: PM 跳過升級評估閘門直接寫 memory 處理 session 浮現洞察

> **錯誤類別**：流程合規（quality-baseline 規則 5「所有發現必須追蹤」解讀偏差）
> **嚴重度**：中（洞察可能停留 memory 不升級為 framework 資產，跨 session 復用受限；且本 session 可能重複違反 quality-baseline 規則 5 而不自知）
> **發現案例**：0.19.0-W3-028.2 完成時 PM 將「實驗工具自指涉觀察」設計洞察直接寫 memory feedback，被用戶糾正「應該新增一個 ticket，評估是否應該補充相關處理的方法或者規則」

---

## 症狀

PM 在 ticket 執行或收尾過程中發現 session 內浮現的有用洞察（設計原則、工具使用模式、跨領域類比、流程觀察），直接執行以下動作組合而非走評估閘門：

| 動作 | 評估 |
|------|------|
| 1. 寫入當前 ticket md 對應章節 | OK（屬 ticket 內容固化） |
| 2. 寫入 memory feedback file | OK 但前提缺失：未走評估閘門 |
| 3. 更新 MEMORY.md 索引 | OK 但前提缺失 |
| 4. 跳過建 ANA ticket 評估升級路徑 | **違反**（規則 5「追蹤 = ticket 評估」） |
| 5. 跳過評估該洞察應屬 rule / methodology / skill / memory 何者 | **違反**（framework asset 歸屬決策） |

訊號：
- PM 在同一回應內宣告「補入 ticket md + 寫 memory + 更新索引」並將此視為已完成「規則 5 追蹤」
- 用戶提問「這部份有記錄下來嗎？」或明示「應該建 ticket 評估」時，PM 才意識到跳過了評估閘門
- session 收尾的 commit 訊息含「補 memory feedback」但無對應 ANA ticket 連結

## 根因

quality-baseline 規則 5「所有發現必須追蹤」的精確語義是「追蹤 = ticket 評估」，memory 應是評估後的歸屬產物之一，並非評估前的直接寫入目的地。PM 容易將「我覺得這值得記就直接寫 memory」當成已追蹤，原因：

1. **memory 寫入成本低**：相對於建 ANA ticket（需 5W1H + when + how-strategy + acceptance + decision-tree），memory 寫入只需 1-2 個 file write。低成本誘惑導致跳過評估閘門
2. **「memory 是個人筆記」誤解**：PM 將 memory 視為「自己的筆記」而非「framework 決策後的歸屬」，忽略 memory 應有評估前提
3. **時間壓力 / context 壓力**：session 收尾時 PM 想快速 /clear，傾向避免額外建 ticket 流程；估時驅動決策（規則 6 反模式）
4. **缺乏明示閘門**：framework 沒有「memory 寫入前必經評估」的明示閘門（rule 條款 / hook 攔截），全靠 PM 自律
5. **continuous-learning skill 的升級評估被繞過**：memory 升級評估在 skill 內被動態觸發，PM 直接 Write memory 檔案不觸發 skill，繞過評估邏輯
6. **memory 結構過分友善**：feedback / project / user / reference 四類型設計鼓勵 PM 隨手寫入，但缺乏「該屬哪類」的前置判斷流程

## 案例：W3-028.2 → W3-058

| 階段 | 動作 | 評估 |
|------|------|------|
| W3-028.2 實機驗證完成 | PM 發現「實驗工具觀察自身執行循環」設計洞察（diagnostic hook 被 PM session /clear 觸發產生非實驗目的紀錄） | OK |
| PM 第一輪處理 | (a) 補入 ticket md Test Results 章節「實驗工具自指涉觀察」小節 (b) Write memory feedback_experiment_tool_self_observation.md (c) 更新 MEMORY.md (d) commit `a266807a` | (a) OK，(b/c/d) 違反：跳過升級評估 |
| 用戶糾正 | 「這應該新增一個 ticket，評估是否應該補充相關處理的方法或者規則」 | 用戶識別出 PM 跳過閘門 |
| 補救 | 建 W3-058 ANA ticket，acceptance #4 「評估方法論補強：檢視 PM 將 session 內浮現的洞察直接寫入 memory 是否跳過升級評估閘門，若是則建議補強流程」 | 補建閘門 |

> 完整時間軸見 W3-028.2、W3-058 ticket md 與 commits `a266807a`（直接寫 memory）、`7d09c3bd`（補建 ANA）。

## 防護要點

### 規則層

quality-baseline 規則 5 補強建議（待 W3-058 評估後決定是否升級）：

- 明示「追蹤 = ticket 評估」，memory 應為評估後歸屬而非評估前直接寫入
- 新增條款：跨 session 適用的洞察（feedback / project 類）寫入 memory 前必須建 ANA ticket 評估升級路徑

### Skill 層

continuous-learning skill 補強：

- 被動觸發改主動評估「該洞察是否值得建 ANA ticket 評估升級」
- 主動詢問「此洞察是否已走過升級評估？」三選一：(a) 已評估 / (b) 建 ANA 評估 / (c) 確認僅個人 session 觀察

### Hook 層（可選）

- PostToolUse:Write hook 偵測 path matches memory dir 時 advisory 提示「此 memory 寫入是否走過升級評估？參考 PC-160」（非阻擋）

### PM 自律

session 內浮現洞察的正確處理流程：

1. 寫 ticket md 章節（OK，屬 ticket 內容）
2. 評估跨 session 適用性（自問：「下一個 session 接手任何 ticket 時，這個洞察會有用嗎？」）
3. 跨 session 適用 → 建 ANA ticket 評估升級路徑（含「該屬 rule / methodology / skill / memory 何者」評估）
4. ANA 評估結論：
   - 「memory 即可」→ 寫 memory feedback
   - 「升級為 rule / methodology / skill」→ spawn IMP/DOC ticket
   - 「不需追蹤」→ 文件化評估理由後結案
5. **禁止「跳過步驟 3-4 直接寫 memory」**

### 識別觸發條件

PM 在以下情境準備寫 memory 時應停下檢查：

| 觸發 | 動作 |
|------|------|
| 想 Write 到 `.claude/projects/.../memory/feedback_*.md` | 先問「已建 ANA 評估？」若無則停止 |
| 想 Write 到 `.claude/projects/.../memory/project_*.md` | 同上 |
| commit 訊息含「補 memory feedback」或「update MEMORY.md」 | 確認是否有對應 ANA ticket 連結 |
| 用戶提問「這部份記錄了嗎？」 | 警惕：可能正觸發 PC-160 |

## 相關條目

- **W3-058**：ANA 評估「實驗工具自指涉觀察」升級路徑 + 補升級閘門流程（PC-160 的 source ticket）
- **W3-028.2**：source 洞察的 ticket（自指涉觀察小節）
- **quality-baseline 規則 5/6**：所有發現必須追蹤 + 失敗案例學習原則
- **continuous-learning skill**：memory 升級評估的動態觸發機制（被本 PC 識別為可繞過）
- **memory feedback `feedback_skip_upgrade_gate_directly_writing_memory.md`**：本 PC 對應的 memory 條目

## Last Updated

2026-05-26 / PC-160 v1.0

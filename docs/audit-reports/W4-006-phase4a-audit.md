# W4-006 Phase 4a 品質審計報告

**審計對象**: commit 86d17db0 — `tests/integration/chrome-extension/popup-interface.test.js` (+475/-10 LOC)
**審計日期**: 2026-05-31
**審計人**: bay-quality-auditor
**審計類型**: 情境 B 重構評估（三視角）

---

## 執行摘要

整體品質評分：**B+**

新增 describe 區段「W4-006: extractBtn UI 觸發路徑覆蓋」含三 case，補強 popup UI button 觸發層覆蓋缺口。設計意圖清晰、與既有測試職責邊界明確、mock 配置合理。識別 3 項技術債務（1 P2、2 P3），無阻擋性問題。

---

## 視角 1：Redundancy（與既有 TDD Cycle #14 冗餘度）

**結論：補強而非取代，冗餘度低。**

| 比較維度 | TDD Cycle #14（line 539-585） | W4-006（line 777-920） |
|---------|-------------------------------|------------------------|
| checkCurrentTab 覆蓋 | 未覆蓋（既有 Content Script 通訊測試 line 283-350 只驗 query 被呼叫，不驗 extractBtn.disabled 終態） | Case A 驗證完整鏈：query → PING → extractBtn.disabled=false |
| extractBtn click 覆蓋 | line 402-422 僅 `not.toThrow()` 防崩斷言 | Case B 驗證 sendMessage 被以 START_EXTRACTION + 正確 tab.id 呼叫 |
| UI 狀態流轉覆蓋 | line 557-573 透過 `updateButtonState(true, ...)` 直接呼叫驗狀態 | Case C 透過真實 click → startExtraction → DOM 副作用驗終態 |

sage 的「補強而非取代」聲明成立。三 case 各自覆蓋既有測試未觸及的邏輯路徑深度，無語義重疊。

---

## 視角 2：Coupling（fixture/mock 與 popup.js 內部實作耦合度）

**結論：耦合度中等，可接受但有改善空間。**

**合理耦合（必要 mock）**：
- `chrome.tabs.query`、`chrome.tabs.sendMessage`、`chrome.storage.onChanged` 屬 Chrome API 邊界 mock，不隨 popup.js 內部重構變動，耦合合理。
- `READMOO_TAB_FIXTURE` 結構簡潔（id/url/title），與 popup.js 對 tab 物件的取用欄位一致。

**潛在脆弱點**：
- Case B/C 的 `mock.calls.some(call => call[1].type === 'START_EXTRACTION')` 依賴 message type 字串常數。若 popup.js 改用 enum 或常數匯入，此斷言需同步修改。但這是訊息契約層級的耦合，屬合理。
- Case C 的寬鬆 OR 斷言（見視角 3）在「容納時序」與「遮蔽真實問題」之間取得平衡，目前可接受。

**寬鬆斷言是否遮蔽脆弱性**：Case B 的 `mock.calls.some` 確實比 `toHaveBeenNthCalledWith` 寬鬆，但這是刻意設計——避免 PING 與 START_EXTRACTION 的呼叫順序變動導致 flaky。commit message 已明確記錄此設計決策，屬合理的穩健度取捨。

---

## 視角 3：Complexity（三 case 邏輯複雜度 + beforeEach 配置）

**結論：複雜度可控，Case C 有一項技術債。**

**beforeEach 配置**：
- 新增區段的 beforeEach 僅補 `chrome.storage` mock + `eval(popupScript)` + `setupEventListeners()`，共 12 行有效程式碼。與外層 beforeEach（loadPopupInterface）職責不重疊，配置清晰。

**Case A/B 複雜度**：低。線性 arrange-act-assert，認知負擔指數約 4-5（變數 3 + 分支 0 + 巢狀 1 + 依賴 1）。

**Case C 複雜度**：中。三維 DOM 副作用 × 三選一 OR 斷言 = 認知負擔指數約 8。

### 技術債項目

| ID | 項目 | 優先級 | Status | 說明 |
|----|------|--------|--------|------|
| TD-1 | Case C 三選一 OR 斷言 | **P2** | resolved (commit 9c439fe5) | `statusTextContent.includes('提取') \|\| .includes('完成') \|\| .includes('資料')` 等三組 OR 斷言過於寬鬆，任何含「提取」「完成」「資料」的文字都會通過。若 popup.js 的 updateStatus 邏輯回歸（例如誤傳錯誤訊息含「資料」二字），此斷言無法偵測。**已解決**：W4-006.3 將斷言收斂為精確終態 `statusText='資料提取完成'` / `extensionStatus='完成'` / `statusDot.className='status-dot ready'`，依賴 deterministic mock + flushMicrotasks 保證終態必達。 |
| TD-2 | `setTimeout(resolve, 0)` 硬編三次 | **P3** | resolved (commit 9c439fe5) | 三次 `await new Promise(resolve => setTimeout(resolve, 0))` 作為 microtask flush 是 Jest jsdom 環境的常見 workaround，但硬編三次無語義說明「為何是三次」。**已解決**：W4-006.3 抽 `flushMicrotasks(n=3)` local helper，JSDoc 說明 `n=3` 對應 query+PING+START_EXTRACTION 三層 chained await 深度。 |
| TD-3 | popup.js 行號註解 | **P3** | resolved (commit 9c439fe5) | Case C 註解 `(line 845)`、`(line 852)`、`(line 855)` 引用 popup.js 行號。行號隨任何修改即失效。**已解決**：W4-006.3 移除 `(line N)` 註解，改寫為邏輯步驟描述（過渡 updateStatus / sendMessage 等待回應 / 終態 updateStatus）；W4-006.2 bundle 重排後原行號已實際失效，本次修復根因。 |

---

## 特別驗證：W1-008 根因描述不準確

**結論：不在本 ticket 修正範圍，且不需要在此修正。**

W4-006 Phase 1 spike 揭露 W1-008 原始根因描述為「Puppeteer 無法開啟 popup overlay」，實際根因是「popup 在 Puppeteer 環境下作為獨立分頁載入，checkCurrentTab 因 `chrome.tabs.query({active:true, currentWindow:true})` 回傳的是 popup 自己的 tab 而非 Readmoo tab，導致 extractBtn 保持 disabled」。

此根因描述差異屬 W1-008 ticket body 的歷史記錄修正，非 W4-006 的 AC 範圍。W4-006 的測試設計已正確反映真實根因（Case A 精確 mock readmoo tab 繞過此問題），測試本身不受影響。若需修正 W1-008 body 描述，應建獨立 DOC ticket。

---

## 風險評估矩陣

| 風險 | 機率 | 影響 | 等級 | 處置 |
|------|------|------|------|------|
| Case C OR 斷言未偵測到 UI 回歸 | 中 | 中 | P2 | TD-1：W4-006.2 完成後收窄 |
| setTimeout flush 次數不足導致 flaky | 低 | 低 | P3 | 目前三次已涵蓋 query+PING+START_EXTRACTION 三層 await，實測穩定 |
| popup.js 行號變動導致註解誤導 | 低 | 低 | P3 | TD-3：可讀性改善 |

---

## 決策建議

**建議：繼續推進，不阻擋。**

- TD-1（P2）建議在 W4-006.2（真實 click E2E）完成後一併處理，屆時可確認 popup.js 終態精確值。
- TD-2、TD-3（P3）可排入技術債清理 Wave，非緊急。
- 整體實作品質符合 regression 防護型 IMP 定位，mock 設計合理，與既有測試無冗餘。

---

## 審計方法

- Phase 1：git show diff 全文閱讀 + ticket full 讀取
- Phase 2：既有 popup-interface.test.js 全檔結構比對（1054 行，含 TDD Cycle #14 line 539-585、事件處理器 line 391-422）
- Phase 3：`npm run test:integration` 全套件執行驗證（40 suites / 617 passed / 12 skipped）
- Phase 4：三視角分析（Redundancy / Coupling / Complexity）
- Phase 5：本報告

---

**Last Updated**: 2026-05-31

# tests/e2e 目錄職責說明

本目錄包含 電子書庫總覽管理器 Chrome Extension 的端對端（E2E）測試，依功能層次分為 10 個子目錄。閱讀本文件可快速掌握各層職責與對應執行指令，無需逐一翻閱原始碼。

---

## 目錄結構總覽

| 子目錄 | 職責定位 | 測試性質 |
|--------|---------|---------|
| `browser/` | 真實 Chrome 瀏覽器 + Extension 載入的端對端 pipeline 驗證 | 需要 Chromium 環境 |
| `deployment/` | Chrome Web Store 上架前的合規性與政策驗證 | 靜態檢查為主 |
| `fixtures/` | E2E 測試共用的 HTML mock 頁面與測試資料 | 測試資源（非測試本身）|
| `integration/` | 跨元件（Background / Content / Popup）整合流程驗證 | mock 環境 |
| `performance/` | 資料量效能基準與回歸防護 | 效能量測 |
| `screenshots/` | 測試執行時產生的截圖存放目錄 | 產出物（非測試本身）|
| `scripts/` | E2E 測試執行協調腳本（含建置前置流程） | 執行工具 |
| `setup/` | Puppeteer + Chrome Extension 測試環境初始化工具 | 基礎設施 |
| `validation/` | 不依賴 Puppeteer 的建置完整性與環境快速驗證 | 快速健康檢查 |
| `workflows/` | 以使用者視角串接多元件的完整操作流程驗證 | mock 環境 |

---

## 各子目錄職責說明

### browser/

**職責**：在真實 Chrome 瀏覽器載入已建置 Extension 的情況下，驗證提取 - 儲存 - 顯示完整 pipeline。

此目錄的測試需要 Puppeteer 啟動 Chromium 實例並實際載入 Extension，是最接近使用者真實環境的 E2E 層。測試同時承擔 regression 鎖定功能，防止 model 轉換層退化（如 `readingStatus` 狀態枚舉遺失、`tagIds` 陣列格式錯誤）。

`helpers/` 子目錄存放 browser 測試專用輔助模組（`extraction-flow.js`、`storage-reader.js`），不含測試案例。

**對應 npm script**：
```bash
npm run test:e2e:browser
# => jest --config jest.e2e.config.js tests/e2e/browser
```

> 注意：`npm run test:e2e`（預設）透過 `--testPathIgnorePatterns` 排除 `tests/e2e/browser/`，需單獨執行或透過 `test:e2e:full` 執行。

---

### deployment/

**職責**：驗證 Extension 符合 Chrome Web Store 上架政策，涵蓋 Manifest V3 合規性、權限正當性、資料安全性及使用者介面品質。

此目錄針對發布前的靜態合規檢查，確保提交 Chrome Web Store 審查前已滿足平台要求。測試不驗證業務功能，而是驗證 Extension 的「可發布性」。

**對應 npm script**：此目錄測試包含在下列指令中：
```bash
npm run test:e2e
# => jest --config jest.e2e.config.js tests/e2e（排除 browser/）

npm run test:e2e:full
# => node tests/e2e/scripts/run-e2e-tests.js（含建置步驟）
```

---

### fixtures/

**職責**：存放 E2E 測試共用的 HTML mock 頁面（`readmoo-mock-page.html`），模擬 Readmoo 書庫頁面的 DOM 結構，供 browser 與 integration 測試注入使用。

此目錄是測試資源目錄，不含可執行測試案例。修改此目錄內容會影響所有依賴這些 fixture 的測試。

**使用方式**：由 `browser/` 與 `integration/` 測試在執行時引用，不需單獨執行指令。

---

### integration/

**職責**：驗證 Background Script、Content Script、Popup 三個 Extension 元件之間的跨元件整合流程，含資料流動、事件通訊與錯誤處理。

此目錄的測試使用 mock 環境（E2ETestSuite）而非真實瀏覽器，可在 Jest jsdom 環境下執行，不需 Puppeteer。測試涵蓋 UC-01（完整資料提取）及 UI 互動流程的整合驗證。

**對應 npm script**：
```bash
npm run test:e2e:integration
# => jest --config jest.e2e.config.js tests/e2e/integration

npm run test:e2e
# => 亦涵蓋本目錄（排除 browser/）
```

---

### performance/

**職責**：建立 Chrome Extension 在不同資料量下的效能基準，並透過基準測試防護大幅效能退化。

測試模擬大量書籍資料的提取、搜尋、篩選與 UI 渲染，監控記憶體與 CPU 使用合理性。此目錄定位為「大幅退化防護」而非效能 SLA，計時門檻設定寬鬆，不作為精確效能承諾。

**對應 npm script**：
```bash
npm run test:e2e:performance
# => jest --config jest.e2e.config.js tests/e2e/performance
```

---

### screenshots/

**職責**：存放測試執行期間由 Puppeteer 自動截圖的產出物，作為除錯與驗證的視覺輔助。

此目錄為測試執行的產出物目錄，不含測試程式碼。截圖通常在 `browser/` 測試失敗時自動觸發，供人工診斷使用。此目錄內容不應提交至版本控制（已列入 `.gitignore`）。

**使用方式**：由 browser 測試自動寫入，無對應執行指令。

---

### scripts/

**職責**：提供 E2E 測試的完整執行協調腳本（`run-e2e-tests.js`），在執行測試前自動建置 Extension，並統一管理測試環境的設定與清理。

`extension-setup.js` 放置於此目錄，作為測試執行的共用設定輔助，而非環境初始化（環境初始化由 `setup/` 負責）。

**對應 npm script**：
```bash
npm run test:e2e:full
# => node tests/e2e/scripts/run-e2e-tests.js
# 含建置步驟（npm run build:dev），適用於 CI 或完整驗收
```

---

### setup/

**職責**：提供 Puppeteer + Chrome Extension 整合測試環境的初始化工具（`extension-setup.js`），含 Chromium 實例建立、Extension 載入、測試頁面配置與測試生命週期管理。

此目錄是 browser 層測試的基礎設施，為 `browser/` 目錄的測試提供共用的環境初始化能力。修改此目錄會影響所有需要真實瀏覽器環境的測試。

**使用方式**：由 `browser/` 測試引用，不需單獨執行指令。

---

### validation/

**職責**：提供不依賴 Puppeteer 的快速環境健康檢查，驗證建置檔案完整性、Manifest V3 設定正確性及測試資料可用性。

此目錄的測試設計為「準備就緒確認」工具，在完整 E2E 測試前快速確認環境狀態，避免因環境問題導致耗時的 browser 測試失敗。執行速度快，無需瀏覽器環境。

**對應 npm script**：包含在下列指令中：
```bash
npm run test:e2e
# => jest --config jest.e2e.config.js tests/e2e（排除 browser/）
```

---

### workflows/

**職責**：以使用者操作視角驗證跨元件的完整使用場景，包含完整書籍資料提取流程（UC-01）與跨設備同步流程（UC-05）。

此目錄的測試模擬真實使用者從觸發 Extension 到完成書庫操作的完整路徑，著重「使用者意圖完整性」而非「元件內部正確性」。使用 mock 環境執行，不需瀏覽器。

**對應 npm script**：
```bash
npm run test:e2e:workflow
# => jest --config jest.e2e.config.js tests/e2e/workflows
```

---

## npm Script 對照表

| 指令 | 覆蓋範圍 | 需要瀏覽器 | 適用場景 |
|------|---------|-----------|---------|
| `npm run test:e2e` | browser 以外的所有子目錄 | 否 | 日常開發驗收 |
| `npm run test:e2e:force` | 同 `test:e2e`（強制執行） | 否 | CI 強制執行 |
| `npm run test:e2e:full` | 全部子目錄（含 browser） + 建置 | 是 | 發布前完整驗收 |
| `npm run test:e2e:workflow` | `workflows/` | 否 | 工作流程單獨驗收 |
| `npm run test:e2e:integration` | `integration/` | 否 | 整合層單獨驗收 |
| `npm run test:e2e:performance` | `performance/` | 否 | 效能基準驗收 |
| `npm run test:e2e:browser` | `browser/` | 是 | 真實瀏覽器單獨驗收 |
| `npm run test:comprehensive` | unit + integration + e2e | 否 | 完整套件（非 browser） |

---

## 與其他測試層的邊界

| 測試層 | 目錄 | 定位 |
|--------|------|------|
| 單元測試 | `tests/unit/` | 單一函式 / 類別的隔離驗證 |
| 整合測試 | `tests/integration/` | 多模組協作（非 Extension 跨元件） |
| 效能測試 | `tests/perf/` | jsdom 環境下的計時基準（獨立套件） |
| E2E 測試 | `tests/e2e/`（本目錄） | Extension 元件整合 + 使用者流程 + 真實瀏覽器 |

---

**Last Updated**: 2026-05-22
**Version**: 1.0.0 - 初始建立（Source: 0.19.0-W5-004）

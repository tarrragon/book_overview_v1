# 專案重啟環境恢復指南

本文件為 Readmoo 書庫管理器 Chrome Extension 專案的**環境恢復 SOP**，適用於專案長期暫停（> 2 個月）後重新啟動開發、或 clone 全新 repo 後初始化的情境。

> **背景**：2026-05-12 在 ticket `0.18.0-W6-012.1` 診斷期暴露四層巢狀環境問題（build 過期 → 缺 esbuild → peer dep 衝突 → 19 vulnerability），耗時排查。本指南將該次經驗固化為可重複執行的流程，避免下次重啟再次踩雷。
>
> **權威來源**：本文件由 `0.18.0-W6-013` 建立，源自 `0.18.0-W6-012.1` 診斷實況。

---

## 適用觸發場景

| 場景 | 是否適用 |
|------|---------|
| 專案暫停 > 2 個月後重啟 | 是 |
| 新 clone repo 首次初始化 | 是 |
| 切換大版本後（如 v0.17 → v0.18）首次 build | 是 |
| 日常開發（< 1 週未操作） | 否（直接 `npm run build:dev` 即可） |
| CI 環境 | 否（CI 走獨立 lockfile 流程） |

---

## 標準恢復流程（Happy Path）

依序執行以下指令；任一步驟失敗請對照下方「四層環境問題對照表」排查。

```bash
# 1. 安裝依賴（必須帶 --legacy-peer-deps，原因見 L3）
npm install --legacy-peer-deps

# 2. 重建開發版（覆蓋過期 build artifact）
npm run build:dev

# 3. 檢視 vulnerability 警告（不修復，僅評估）
npm audit

# 4. 驗證 build 產物存在且時間戳當下
ls -la build/development/
```

完成後在 Chrome 開啟 `chrome://extensions/`，點 **重新載入** 按鈕讓 Extension 載入新版 SW / Content Script / Popup。

---

## 四層環境問題對照表

| 層 | 觸發訊號（你會看到什麼） | 根因 | 排查方法 | 修復動作 |
|----|----------------------|------|---------|---------|
| **L1** 行為異常 | Overview 開啟顯示 0 本書 / popup 行為與 src 預期不符 / Content Script log 內容對應不上最新程式碼 | Extension 載入的是過期 `build/` 產物 | `ls -la build/development/` 看時間戳；比對 `git log --since="<build 時間>" -- src/` | 執行 `npm run build:dev` 後重新載入 Extension |
| **L2** Build 失敗 | `npm run build:dev` 報 `Cannot find module 'esbuild'` | `node_modules/` 缺套件（package-lock.json 與實際安裝不一致；可能因為 `npm install` 從未執行或被中斷） | `ls node_modules/esbuild` 確認套件目錄是否存在；`npm ls esbuild` 看依賴樹 | `npm install --legacy-peer-deps` |
| **L3** Install 失敗 | `npm install` 報 `ERESOLVE could not resolve` 並指向 `eslint-plugin-n` 或 `eslint-config-standard` | `eslint-config-standard@17.x` 要求 `eslint-plugin-n@^15\|\|^16`，但本專案 package.json 列 `eslint-plugin-n@^17.x`（追蹤中：`0.18.0-W6-014`） | 看 npm error log 中 `Found:` 與 `Could not resolve dependency:` 兩段 | 暫用 `npm install --legacy-peer-deps`；根治方案待 `0.18.0-W6-014` 完成 |
| **L4** 安全警告 | `npm audit` 輸出 19+ vulnerability（含 high severity） | 套件鏈中存在已知 CVE | `npm audit` 看詳情；`npm audit --json` 取結構化資料 | **不要直接執行 `npm audit fix`**（會破壞 lockfile）；評估邏輯見 `0.18.0-W6-015` ANA 結論 |

---

## Vulnerability 處理流程

**核心原則**：本專案是 Chrome Extension（不對外提供 HTTP API、不執行用戶內容、運行於 Chrome sandbox），多數 vulnerability 影響面有限。但仍應**評估後再決定是否修復**，禁止無腦 `npm audit fix --force`。

### 處理步驟

1. **取得詳情**：

   ```bash
   npm audit
   ```

2. **對照評估結論**：詳細優先級與修復路徑見 [`0.18.0-W6-015.md`](work-logs/v0/v0.18/v0.18.0/tickets/0.18.0-W6-015.md)（ANA Ticket）

3. **判斷修復策略**：

   | Severity | 預設策略 |
   |---------|---------|
   | high | 評估是否影響 Chrome Extension runtime；若僅影響開發工具（如 ESLint plugin）可記入技術債延後 |
   | moderate | 評估是否進入 production bundle；非 production 路徑可延後 |
   | low | 記入技術債，下次依賴升級時順帶處理 |

4. **禁止行為**：

   - 禁止執行 `npm audit fix --force`（會強制升級到 major version，可能破壞既有 API 相容性）
   - 禁止逐套件手動 `npm install <pkg>@latest`（容易引發 peer dep 連鎖衝突，見 L3）
   - 禁止在未讀 W6-015 ANA 結論前批量修復

---

## Build Warning 處理流程

`npm run build:dev` 過程可能出現 esbuild warning（非阻塞，build 仍會產出 artifact），常見來源：

- `src/core/messaging/MessageDictionary.js:372` / `:379`
- `src/core/logger/Logger.js:414` / `:424`

**處理流程**：

| 步驟 | 動作 |
|------|------|
| 1 | 觀察 warning 內容（通常為 dead code / unused import / unreachable case） |
| 2 | 對照 [`0.18.0-W6-016.md`](work-logs/v0/v0.18/v0.18.0/tickets/0.18.0-W6-016.md)（ANA Ticket）確認是否為已知 warning |
| 3 | 若為新 warning：在該 ANA Ticket 補充紀錄；若為已知 warning：依 ANA 結論處理 |

**判斷原則**：build warning 非阻塞，但反映程式碼結構問題（如永遠不會 reach 的 case branch）。日常開發可忽略，正式發布前（`npm run build:prod`）應全部清零。

---

## 為何使用 `--legacy-peer-deps`

`--legacy-peer-deps` 是 npm v7+ 引入的相容性 flag，作用為**忽略 peer dependency 衝突**（npm v6 行為）。本專案目前需要此 flag 是因為 `eslint-config-standard@17.1.0` 與 `eslint-plugin-n@17.x` 的 peer dep 版本範圍不相容（追蹤於 `0.18.0-W6-014`）。

**為什麼不直接降版 `eslint-plugin-n` 到 16？**

降版需評估是否影響既有 ESLint 規則行為，屬獨立決策，由 `0.18.0-W6-014` ticket 統一處理。在 W6-014 完成前，使用 `--legacy-peer-deps` 是**已驗證可工作**的權宜方案。

**風險評估**：`--legacy-peer-deps` 僅影響開發階段的 lint 工具鏈，不進入 Chrome Extension production bundle，runtime 風險為零。

---

## E2E 環境恢復

E2E 測試使用 Puppeteer 操控真實 Chrome 瀏覽器並載入 Extension，與單元/整合測試的 jsdom mock 環境完全不同。長期暫停後重啟時，E2E 環境有獨立的恢復步驟。

### 前提：標準恢復流程須已完成

E2E 測試依賴 `build/development/` 中的 Extension 產物。執行 E2E 前，**必須先完成本文件「標準恢復流程（Happy Path）」的三步驟**（`npm install --legacy-peer-deps` → `npm run build:dev` → `npm audit`）。

### E2E 環境組成

| 元件 | 說明 |
|------|------|
| `jest.e2e.config.js` | E2E 專用 Jest 配置（`testEnvironment: 'node'`，`testTimeout: 30000`，不載入 jsdom mock） |
| `puppeteer`（devDep `^22.15.0`） | 操控真實 Chromium 瀏覽器；透過 `--load-extension` flag 載入 Extension |
| `tests/e2e/setup/extension-setup.js` | E2E 測試環境初始化：Chrome 路徑偵測、Extension 載入、Extension ID 取得 |
| `build/development/` | E2E 測試載入的 Extension 產物（必須存在且為最新 build） |

### Chrome 路徑偵測邏輯

E2E 環境使用雙層 fallback 策略尋找 Chrome：

1. 優先使用 Puppeteer 管理的 Chrome（`puppeteer.executablePath()` 成功即使用）
2. 若 Puppeteer 管理的 Chrome 不存在，依序嘗試以下系統路徑：
   - `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`
   - `/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary`
   - `/Applications/Chromium.app/Contents/MacOS/Chromium`

若兩層皆無法找到 Chrome，Puppeteer 啟動會失敗。解法：重新安裝 Puppeteer（`npm install puppeteer --legacy-peer-deps`）或安裝系統 Chrome。

### E2E 恢復步驟

```bash
# 1. 確認 build/development/ 存在且為最新（已由標準恢復流程完成）
ls -la build/development/

# 2. 確認 Puppeteer 可找到 Chrome
node -e "const puppeteer = require('puppeteer'); console.log(puppeteer.executablePath())"

# 3. 執行 E2E 測試（不含 browser 子目錄，因 browser 測試需要 headed 模式）
npm run test:e2e

# 4. 若只想執行特定子套件
npm run test:e2e:workflow      # tests/e2e/workflows/
npm run test:e2e:integration   # tests/e2e/integration/
npm run test:e2e:performance   # tests/e2e/performance/
npm run test:e2e:full          # 完整流程（含 build + 所有子套件）
```

**注意**：E2E 測試以 headed 模式（`headless: false`）執行，Chrome 視窗會短暫可見。這是 Manifest V3 的限制——Chrome 目前不支援在 headless 模式下載入 Extension。

### E2E 環境常見問題對照

| 症狀 | 根因 | 修復動作 |
|------|------|---------|
| `Error: Could not find Chrome` | Puppeteer 管理的 Chrome 未下載，系統也無 Chrome | `npm install puppeteer --legacy-peer-deps`（觸發 Chrome 下載）|
| `Error: 取得 Extension ID 失敗` | `build/development/` 不存在或 Extension 載入失敗 | 執行 `npm run build:dev` 後重試 |
| E2E 測試 timeout（30 秒超限） | Chrome 啟動慢或 Extension Service Worker 未及時啟動 | 確認系統資源充足；低效能機器可在 `jest.e2e.config.js` 調高 `testTimeout` |
| 測試跑到一半 Chrome 閃退 | `build/development/manifest.json` 有語法錯誤 | `npm run build:dev` 並確認 build 無錯誤 |
| `Cannot find module 'src/core/...'` | E2E config 的 `moduleNameMapper` 未正確對應 | 確認使用 `jest.e2e.config.js`（非預設 `jest.config.js`） |

---

## 恢復後驗證清單

完成恢復流程後依序確認：

- [ ] `ls -la build/development/` 顯示當下時間戳的 manifest.json
- [ ] Chrome 載入 unpacked extension 後 popup 可正常開啟
- [ ] Content Script 注入 readmoo.com 頁面（DevTools Console 應見啟動 log）
- [ ] Service Worker 在 `chrome://extensions/` 頁面狀態為「active」
- [ ] `npm test` 至少能跑起來（測試是否通過為獨立議題）
- [ ] `npm run test:e2e` 至少能啟動（E2E 環境已就緒）

---

## Claude Code Hook 系統隔離除錯（--safe-mode）

本專案 `.claude/hooks/` 有 90 個 hook 腳本。當 Claude Code session 出現異常（啟動卡住、工具呼叫被不明原因阻擋、輸出被不明訊息污染）且懷疑是 hook 系統造成時，可用 Claude Code 2.1.169 引入的 **safe mode** 一鍵停用所有客製化，二分定位問題來源。

### 使用時機

| 場景 | 是否適用 safe mode |
|------|------------------|
| Session 啟動卡住或大量錯誤訊息，懷疑 hook 異常 | 是（先隔離確認問題是否來自客製化層） |
| 工具呼叫被反覆 deny，但找不到對應規則或 hook | 是 |
| 升級 Claude Code 版本後行為異常，需區分「CC 本體問題」vs「hook 相容性問題」 | 是 |
| 已知是特定 hook 的 bug，要修復該 hook | 否（直接修 hook；safe mode 只用於定位，不用於修復） |
| 日常開發 | 否（見下方注意事項） |

**二分定位邏輯**：safe mode 下問題消失 → 問題來自客製化層（hooks / settings / CLAUDE.md 注入），逐步恢復客製化縮小範圍；safe mode 下問題仍在 → 問題來自 Claude Code 本體或專案環境，回到上方四層環境問題對照表或向官方回報。

### 兩種啟用方式

```bash
# 方式 1：CLI flag（單次 session）
claude --safe-mode

# 方式 2：環境變數（適合腳本或反覆啟動）
CLAUDE_CODE_SAFE_MODE=1 claude
```

兩者等效，皆停用所有客製化（hooks、自訂 settings、CLAUDE.md / rules 注入等）。

### 與 hook-health-monitor 的互補關係

| 機制 | 角色 | 涵蓋範圍 | 局限 |
|------|------|---------|------|
| `hook-health-monitor.py`（SessionStart 自動觸發） | 常態健康監測：依 settings.json 動態解析 SessionStart hooks，檢查各 hook 日誌目錄是否正常更新 | SessionStart hooks 的「靜默失敗」偵測 | 只能告訴你「哪個 hook 沒在運作」，無法隔離「哪個 hook 在搞破壞」；非 SessionStart hooks 不在監測範圍 |
| `--safe-mode` | 異常時的隔離手段：全量停用後二分定位 | 所有 hook 與全部客製化層 | 粒度粗（全有或全無），定位到客製化層後仍需逐一恢復縮小範圍 |

兩者互補：hook-health-monitor 負責「平時發現失效」，safe mode 負責「出事時隔離元兇」。除錯順序建議先看 hook-health-monitor 的 session 啟動報告（零成本），再決定是否動用 safe mode。

### 注意事項

**Safe mode 下框架規則與防護全部失效，僅供診斷，不供日常開發。**

| 失效項目 | 後果 |
|---------|------|
| 全部 90 個 hook（branch-verify、acceptance-gate、charset-guard 等） | 品質防護消失：可直接 commit 到 main、空殼 ticket 可 complete、簡體字不被攔截 |
| CLAUDE.md / rules 注入 | PM 行為準則、品質基線、語言約束全部不載入 |
| 自訂 settings（allow list 等） | 權限行為回到 Claude Code 預設 |

**Action**：診斷完成後立即以正常模式重啟 session；在 safe mode session 中只做觀察與定位，不做 commit、ticket complete 等會留下持久副作用的操作（這些操作繞過了所有防護層，產物不可信任）。

---

## 相關 Ticket 與文件

| 文件 | 內容 |
|------|------|
| `0.18.0-W6-012.1.md` | 四層環境問題原始診斷紀錄（含時間戳證據） |
| `0.18.0-W6-014.md` | eslint peer dep 根治方案（追蹤中） |
| `0.18.0-W6-015.md` | npm audit 19 個 vulnerability 優先級評估 |
| `0.18.0-W6-016.md` | esbuild build warning 評估 |
| `docs/chrome-extension-dev-guide.md §11` | E2E 測試本地執行與除錯指南（含 Chrome 路徑、常見失敗排查） |
| `docs/chrome-extension-dev-guide.md` | Chrome Extension 環境限制與最佳實踐 |
| `CLAUDE.md §4.1` | 專案重啟狀態（含本指南指引） |
| `1.0.0-W1-056.2.md` | --safe-mode hook 隔離除錯指引（CC 2.1.169 引入，源自 `1.0.0-W1-056` release 影響評估） |
| `.claude/hooks/hook-health-monitor.py` | SessionStart hook 健康監測（與 safe mode 互補，見上方章節） |

---

**Last Updated**: 2026-06-11 | **Version**: 1.2.0 — 新增「Claude Code Hook 系統隔離除錯（--safe-mode）」章節：使用時機、兩種啟用方式、與 hook-health-monitor 互補關係、safe mode 防護全失效注意事項（Source: `1.0.0-W1-056.2`，CC 2.1.169 引入）
**Version**: 1.1.0 — 新增 E2E 環境恢復章節（Source: `0.19.0-W5-005`）
**Version**: 1.0.0 — 建立（Source: `0.18.0-W6-013`，源自 `0.18.0-W6-012.1` 診斷實況，2026-05-17）

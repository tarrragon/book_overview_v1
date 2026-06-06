# Readmoo 書庫管理器 - 安裝指南

> **適用版本**: v1.0.0 內測版
> **適用對象**: 內測使用者（依 [use-cases.md](use-cases.md) Primary Actor，一般電腦使用者）
> **平台需求**: Chrome 瀏覽器（Manifest V3）

本文件分五章節說明 Extension 安裝流程與驗證方法。「安裝後驗證」章節為手動 checklist，可獨立作為內測使用者完成安裝後的驗證依據；建議搭配自動化驗證腳本（W1-066 `npm run validate:manifest:prod`）使用。

---

## 1. 下載

**版本說明**：本版本為 v1.0.0 內測版。公開分發策略（Chrome Web Store / GitHub Release）待正式版確定後再行公告。

### 1.1 主要取得管道：聯繫內測負責人

本版本採封閉內測，請聯繫內測負責人取得安裝 ZIP 檔案：

- 檔名範例：`readmoo-book-extractor-v1.0.0.zip`
- 檔案大小：約 1.3 MB（最終值以 v1.0.0 發佈 ZIP 為準，發佈時校驗）
- 取得方式：透過內測負責人指定的傳輸通道（Email / 雲端共享連結）

### 1.2 Fallback：本地建置（具開發環境者）

若使用者已具備 Node.js 開發環境，可從原始碼自行建置安裝包：

```bash
# 1. 取得專案原始碼後，進入專案根目錄
cd /path/to/book_overview_v1

# 2. 安裝相依套件（首次或環境恢復後）
npm install --legacy-peer-deps

# 3. 執行生產版本建置
npm run build:prod

# 4. 打包成 ZIP
npm run package
```

建置完成後，產物位於：

```
dist/readmoo-book-extractor-v1.0.0.zip
```

### 1.3 校驗

取得 ZIP 後，解壓前後可確認以下兩點：

- ZIP 檔案大小約 1.3 MB（最終值以 v1.0.0 發佈 ZIP 為準；顯著偏離代表檔案可能損毀或版本不符）
- 解壓後根目錄含 `manifest.json`，其中 `"version": "1.0.0"` 對應本版本

---

## 2. 解壓

### 2.1 選擇解壓目錄

將下載的 ZIP 解壓至任一目錄。建議放在容易記憶且不會被誤刪的位置，例如：

| 平台 | 建議路徑 |
|------|---------|
| macOS | `~/Desktop/readmoo-extractor/` 或 `~/Documents/readmoo-extractor/` |
| Windows | `C:\Users\<username>\Desktop\readmoo-extractor\` |
| Linux | `~/readmoo-extractor/` |

**注意**：Extension 載入後，Chrome 會持續從此目錄讀取檔案。若日後移動或刪除此目錄，Extension 會載入失敗。

### 2.2 解壓工具

| 平台 | 推薦工具 |
|------|---------|
| macOS | 內建 Archive Utility（雙擊 ZIP 即可解壓） |
| Windows | 檔案總管右鍵「解壓縮全部」 |
| CLI | `unzip readmoo-book-extractor-v1.0.0.zip -d ~/readmoo-extractor/` |

### 2.3 解壓後目錄結構驗證

解壓完成後，目錄根目錄應包含以下項目：

```
readmoo-extractor/
├── manifest.json     # Manifest V3 設定檔
├── src/              # 程式碼目錄（background / content / popup）
└── assets/           # 圖示與靜態資源
```

若解壓後根目錄不含 `manifest.json`，可能是 ZIP 損毀或解壓出多層巢狀目錄；請重新下載或檢查解壓工具設定。

---

## 3. 開啟 Chrome 開發者模式

本步驟在 Chrome 內開啟 Extension 開發者模式，這是載入未封裝 Extension 的前置條件。

### 3.1 進入 Extension 管理頁

在 Chrome 網址列輸入：

```
chrome://extensions/
```

按 Enter 進入 Extension 管理頁。

### 3.2 開啟「開發者模式」toggle

頁面右上角有「開發者模式」（Developer mode）開關：

- 將 toggle 切換至**開啟**（藍色 / 啟用狀態）
- 開啟後，頁面左上角會出現三個新按鈕：
  - **載入未封裝項目**（Load unpacked）
  - **封裝擴充功能**（Pack extension）
  - **更新**（Update）

### 3.3 確認開發者模式已啟用

若以上三個按鈕順利出現，代表開發者模式已成功啟用，可進入下一步。

若 toggle 切換無效或灰色不可點，請參考下方 FAQ Q1。

---

## 4. Load Unpacked 載入 Extension

### 4.1 點選「載入未封裝項目」

在 `chrome://extensions/` 頁面左上角，點擊「**載入未封裝項目**」（Load unpacked）按鈕。

### 4.2 選擇解壓後的根目錄

在彈出的目錄選擇器中：

- 導航至章節 2 解壓後的目錄（例如 `~/Desktop/readmoo-extractor/`）
- **選擇含 `manifest.json` 那一層目錄**（不是它的父目錄，也不是 `src/` 子目錄）
- 點「選擇」（macOS）或「選擇資料夾」（Windows）確認

### 4.3 確認 Extension 載入成功

Extension 載入成功後，`chrome://extensions/` 頁面上會出現一張新的 Extension 卡片，預期觀察到：

- **名稱**：「Readmoo 書庫數據提取器」
- **版本號**：與 `manifest.json` 中的 `version` 欄位一致（v1.0.0 內測版為 `1.0.0`）
- **Service worker 連結**：可點擊（顯示為藍色超連結）
- **啟用 toggle**：預設開啟（藍色）
- **無紅色錯誤提示**

### 4.4 銜接安裝後驗證

Extension 卡片成功出現後，請繼續第 5 章節「安裝後驗證 checklist」做完整功能驗證（包含 Service Worker DevTools 確認與 Content Script 注入確認）。

---

## 5. 安裝後驗證 checklist

> **本章節由 0.19.0-W1-067 落地**（W1-064 ANA 方案 B 之手動驗證對應指引）
> **適用範圍**：用戶完成上述 1~4 章節安裝步驟後，依此 checklist 確認 extension 已正確安裝且核心功能運作。
> **前提建議**：先執行自動化驗證腳本 `npm run validate:manifest:prod`（W1-066），PASS 後再做本章節手動 checklist。
> **平台前提**：本 checklist 僅針對 1 個 clean Chrome profile 驗證；多 profile 衝突檢查經 W1-064 ANA 評估為非必要（permissions 僅 storage + activeTab，衝突風險極低）。

### 步驟 1：解壓 ZIP 驗證

**動作**：解壓 `dist/readmoo-book-extractor-vX.Y.Z.zip` 到任一目錄（例如 `~/Desktop/readmoo-extractor/`）。

**預期觀察結果**：

- 解壓後目錄含 `manifest.json`、`src/`、`assets/` 子項目
- `manifest.json` 開頭可讀到 `"manifest_version": 3`

**失敗判別**：

| 現象 | 可能原因 | 處理 |
|------|---------|------|
| 找不到 `manifest.json` | ZIP 損毀 | 重新下載 ZIP |
| `manifest_version` 不是 3 | ZIP 版本過舊或損毀 | 確認版本號，重新下載最新版 |

---

### 步驟 2：Load Unpacked 載入 Extension

**動作**：

1. Chrome 開啟 `chrome://extensions/`
2. 右上角開啟「開發者模式」toggle
3. 點左上角「載入未封裝項目」（Load unpacked）
4. 選擇步驟 1 解壓後的目錄（含 `manifest.json` 的根目錄）

**預期觀察結果**：

- Extension 卡片出現於 `chrome://extensions/` 頁面
- Extension 名稱、版本號與 `manifest.json` 一致
- 卡片上顯示「Service worker」連結（可點擊）
- 無紅色錯誤提示

**失敗判別**：

| 現象 | 可能原因 | 處理 |
|------|---------|------|
| 「Manifest file is missing or unreadable」 | 步驟 1 解壓目錄選錯 | 重選含 `manifest.json` 的根目錄 |
| 卡片顯示紅色錯誤 | manifest 結構問題 | 點「錯誤」按鈕看訊息；多數已由 `validate:manifest:prod` 預先攔截 |
| 「載入未封裝項目」按鈕灰色不可點 | 開發者模式未開啟 | 回步驟 2 確認開發者模式 toggle 已開啟 |

---

### 步驟 3：Service Worker DevTools 0 error 確認

**動作**：

1. 在 Extension 卡片上點「Service worker」連結
2. DevTools 視窗自動跳出
3. 切到 Console 分頁

**預期觀察結果**：

- Console 顯示 init log（例：`[Background] Service worker initialized`）
- 無紅色 error 訊息（Warning 可接受）

**失敗判別**：

| 現象 | 可能原因 | 處理 |
|------|---------|------|
| Console 含紅色 error | Service worker 啟動失敗 | 截圖回報，附 error 完整訊息與 stack trace |
| DevTools 視窗無法開啟 | Chrome 暫存問題 | 重啟 Chrome 後重試 |
| Console 完全無 log | Service worker 未啟動 | 點卡片上的 reload 按鈕重新載入 extension |

---

### 步驟 4：Content Script 注入確認（訪問 Readmoo）

**動作**：

1. 訪問 `https://read.readmoo.com/#/library`
2. 登入 Readmoo 帳號（若尚未登入）
3. 開啟頁面 DevTools（F12 或右鍵「檢查」），切 Console 分頁
4. 點 Extension popup（瀏覽器右上角拼圖圖示 → pin Readmoo 書庫管理器到工具列 → 點圖示開啟）

**預期觀察結果**：

- 頁面 Console 顯示 content script init log（例：`[Content] Initialized for Readmoo library`）
- Extension popup 顯示「就緒」或「準備提取」狀態
- popup 含「開始提取」按鈕

**失敗判別**：

| 現象 | 可能原因 | 處理 |
|------|---------|------|
| Console 無 content script log | content script 未注入 | 檢查 `chrome://extensions/` 卡片「啟用」開啟 |
| popup 顯示「不支援當前頁面」 | URL 不符 host_permissions | 確認當前在 `read.readmoo.com/#/library` |
| popup 完全空白或無法開啟 | Service worker 與 popup 通訊失敗 | 點卡片上的 reload 按鈕重新載入 extension |

---

### checklist 通過標準

四步驟全部「預期觀察結果」滿足且無任何「失敗判別」現象觸發，即視為安裝後驗證通過。

---

## FAQ

本章節彙整內測階段最常見的三類安裝問題與處理建議。

### Q1：開發者模式 toggle 找不到或灰色無法切換

**可能原因**：

- Chrome 版本過舊（< 88），尚未支援 Manifest V3 Extension 載入介面
- Chrome 處於企業管控模式（Enterprise managed），政策禁止啟用開發者模式
- 使用了受限 profile（例如兒童帳號、受監督帳號）

**處理建議**：

1. 確認 Chrome 版本：網址列輸入 `chrome://version/`，確認版本 >= 88
2. 嘗試切換至個人 profile（右上角頭像 → 切換為非企業帳號）
3. 若 toggle 旁有「由貴機構管理」標示，請洽詢企業 IT 解除政策限制，或改用個人裝置安裝
4. 確認當前 Chrome profile 未被監督（家長控管 / Family Link）

### Q2：Service Worker DevTools 出現紅色 error

**可能原因**：

- `manifest.json` 結構不符 Manifest V3 規範
- `host_permissions` 與其他 Extension 衝突
- Service Worker 內部依賴載入失敗

**處理建議**：

1. **截圖 + 完整 error message**：在 Service Worker DevTools Console 截圖紅色 error 訊息與完整 stack trace，提供給內測負責人
2. **嘗試卡片 reload 按鈕**：在 `chrome://extensions/` 卡片上點 reload（重新整理圖示），有時可解決暫時性載入失敗
3. **預先執行驗證腳本**：建置後安裝前可執行 `npm run validate:manifest:prod`（W1-066 自動化驗證腳本），多數結構問題會在此階段預先攔截
4. **重新建置確認**：若是自行建置版本，先 `npm run clean` 後重新 `npm run build:prod` 確認產物完整

### Q3：Readmoo 頁面 popup 顯示「不支援當前頁面」（content script 未注入）

**可能原因**：

- 當前 URL 未進入 Readmoo 書庫 hash 路由（必須是 `#/library` 路徑）
- 尚未登入 Readmoo 帳號，頁面跳轉至登入頁
- 其他 Extension 干擾或阻擋 content script 注入

**處理建議**：

1. **確認 URL 正確**：網址必須是 `https://read.readmoo.com/#/library`（注意是 hash 路由 `#/library`，不是直接路徑）
2. **完成 Readmoo 登入**：先在 Readmoo 完成帳號登入，再導航至書庫頁
3. **排查 Extension 衝突**：暫時停用其他 Extension（特別是廣告封鎖、隱私保護類）後重試
4. **檢查 Extension 啟用狀態**：在 `chrome://extensions/` 確認 Readmoo 書庫數據提取器卡片的「啟用」toggle 為開啟
5. **頁面 reload 後重試**：content script 注入發生於頁面載入時，若 Extension 是書庫頁開啟後才安裝，需 reload 頁面才會注入

---

## 相關文件

- [使用情境（use-cases.md）](use-cases.md) — 完整功能範圍與 UC-01~UC-06
- [文件導引（README.md）](README.md) — 全部專案文件入口
- [自動化驗證腳本（W1-066）](../scripts/validate-manifest.js) — 安裝前 manifest 結構驗證
- [v1.0.0 工作日誌](work-logs/v1/v1.0/v1.0.0/v1.0.0-main.md) — 版本進度追蹤

---

**版本歷史**：

| 版本 | 變更 |
|------|------|
| v0.19.0（初版） | 5 章節骨架 + 安裝後驗證 checklist（0.19.0-W1-067 落地） |
| v0.19.0（完成） | 章節 1~4 與 FAQ 內容補完（0.19.0-W1-002.3 落地） |
| v1.0.0（版本對齊） | 版本字面對齊 v1.0.0（版本號 / 檔名 / 校驗值 / worklog 連結）；檔案大小最終值由 v1.0.0 發佈產物校驗（1.0.0-W2-002 落地，最終數值 pass 於 1.0.0-W6-003） |

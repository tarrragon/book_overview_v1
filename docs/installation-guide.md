# Readmoo 書庫管理器 - 安裝指南

> **適用版本**: v0.19.0 內測版
> **適用對象**: 內測使用者（依 [use-cases.md](use-cases.md) Primary Actor，一般電腦使用者）
> **平台需求**: Chrome 瀏覽器（Manifest V3）

本文件分五章節說明 Extension 安裝流程與驗證方法。「安裝後驗證」章節為手動 checklist，可獨立作為內測使用者完成安裝後的驗證依據；建議搭配自動化驗證腳本（W1-066 `npm run validate:manifest:prod`）使用。

---

## 1. 下載

> **本章節待 0.19.0-W1-002.3 補完**：ZIP 下載連結 + 版本說明 + 校驗碼。

---

## 2. 解壓

> **本章節待 0.19.0-W1-002.3 補完**：解壓步驟與目標目錄結構。

---

## 3. 開啟 Chrome 開發者模式

> **本章節待 0.19.0-W1-002.3 補完**：`chrome://extensions/` 開啟開發者模式 toggle 步驟與截圖。

---

## 4. Load Unpacked 載入 Extension

> **本章節待 0.19.0-W1-002.3 補完**：Load Unpacked 按鈕 + 選擇解壓後目錄 + 確認載入成功提示。

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

> **本章節待 0.19.0-W1-002.3 補完**：至少 3 個常見問題與解答（開發者模式找不到 / Service Worker 報錯 / Readmoo 頁面 content script 未注入）。

---

## 相關文件

- [使用情境（use-cases.md）](use-cases.md) — 完整功能範圍與 UC-01~UC-06
- [文件導引（README.md）](README.md) — 全部專案文件入口
- [自動化驗證腳本（W1-066）](../scripts/validate-manifest.js) — 安裝前 manifest 結構驗證
- [v0.19.0 工作日誌](work-logs/v0/v0.19/v0.19.0/v0.19.0-main.md) — 版本進度追蹤

---

**版本歷史**：

| 版本 | 變更 |
|------|------|
| v0.19.0（初版） | 5 章節骨架 + 安裝後驗證 checklist（0.19.0-W1-067 落地） |
| v0.19.0（待補） | 章節 1~4 與 FAQ 內容（0.19.0-W1-002.3 補完） |

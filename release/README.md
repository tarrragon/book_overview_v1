# Readmoo 書庫管理器 - 測試者安裝說明

**版本**：v1.4.2
**分發包**：`readmoo-book-extractor-v1.4.2.zip`（與本說明同目錄）

本擴充功能為 Readmoo 電子書平台設計，提供書庫資料自動提取、本地化書目管理、
搜尋篩選和批量匯出功能。本版本為正式上架前的測試版，以「載入未封裝項目」方式安裝。

---

## 安裝步驟（Chrome 開發者模式）

1. 解壓 `readmoo-book-extractor-v1.4.2.zip`，得到一個資料夾（內含 `manifest.json` 於根層）。
2. 開啟 Chrome，於網址列輸入 `chrome://extensions` 並前往。
3. 開啟右上角的「開發人員模式 / Developer mode」開關。
4. 點選左上角「載入未封裝項目 / Load unpacked」。
5. 選擇步驟 1 解壓出的資料夾（包含 `manifest.json` 的那一層）。
6. 安裝完成後，工具列會出現本擴充功能圖示；釘選後即可使用。

---

## 使用方式

1. 登入 Readmoo 並前往書庫頁面：`https://read.readmoo.com/#/library`
2. 點選工具列的擴充功能圖示，開啟 Popup。
3. 依 Popup 指示執行書庫提取、搜尋篩選或匯出。

---

## 注意事項

- 本版本以「未封裝項目」安裝，**重新啟動 Chrome 後仍會保留**，但「開發人員模式」
  關閉時擴充功能會停用。
- 提取功能需在已登入的 Readmoo 書庫頁面（`read.readmoo.com`）執行。
- 若提取結果為空或不完整，請確認書庫頁面已完整載入後再試。
- 此為測試版，回報問題請附上 Chrome 版本與重現步驟。

---

## 移除方式

於 `chrome://extensions` 找到本擴充功能，點選「移除 / Remove」即可。

---

*本說明由 `npm run package:release` 自動生成（版本 v1.4.2）。*

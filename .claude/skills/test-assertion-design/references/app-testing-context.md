# APP 類專案測試脈絡

> 本檔承載 APP 類專案（Flutter/React Native 等行動應用）在各斷言類型上的考量脈絡差異。
> 內容為輕量脈絡提示，不含具體 API 用法或重構步驟。

---

## 適用專案類型

- Flutter / Dart 行動應用
- React Native 應用
- 任何以行動應用框架為主的專案

---

## 各斷言類型的 APP 脈絡

### 類型 8：非同步時序

APP 環境中非同步問題最常見於：

- Widget rebuild 後的 UI 狀態（Flutter 的 frame pump 未完成）
- 平台通道（platform channel）非同步回調
- 動畫完成前的狀態斷言

**脈絡提示**：APP 框架的 UI 驅動特性使「等待 UI 穩定再斷言」更為關鍵。等待機制因框架而異（Flutter 有 `pumpAndSettle`，React Native 有 `act`），但「等完成再斷言」的原則一致。

### 類型 9：亂數輸出

APP 環境中隨機性常見於：

- 隨機生成的業務 ID（訂單號、用戶 ID）
- A/B 測試分組邏輯
- 資料隨機取樣（如隨機推薦）

**脈絡提示**：APP 專案中業務 ID 生成通常需要可控的隨機源，以確保測試的確定性。判斷重點在於「是否斷言了特定隨機輸出值，而非演算法行為特性」。

### 類型 10：測試隔離

APP 環境中共享狀態常見於：

- 全域 singleton service（dependency injection 容器）
- 本地儲存（SharedPreferences、SQLite）的跨測試殘留
- 靜態狀態（如 Flutter `GlobalKey`）

**脈絡提示**：APP 的 singleton 服務模式（BLoC、Provider、Riverpod 等）使全域狀態隔離問題更為普遍。識別信號：測試單獨通過但在全套件中失敗，且失敗原因指向服務初始化狀態。

### 類型 11：快照過度覆蓋

APP 環境中快照最常見於：

- Flutter Widget tree 的 Golden test（像素比對）
- 整個頁面的 Widget 結構快照

**脈絡提示**：Flutter Golden test 的像素精度使其特別脆弱——字體渲染差異、陰影計算、平台字元集都可能觸發 false positive。判斷重點在於「是在驗證視覺設計意圖，還是驗證業務邏輯」。

### 類型 12：斷言過度集中

APP 的 Widget 測試中，常見的過度集中模式：

- 一個 test 驗整個頁面所有 Widget 的文字內容、顏色、狀態
- 將多個用戶流程塞入同一個測試案例

**脈絡提示**：識別信號是測試描述（test name）難以用一個行為面向概括。

---

**Last Updated**: 2026-05-21
**Version**: 1.0.0 — 初始建立（Source: W1-024 AC1 專案類型差異欄）

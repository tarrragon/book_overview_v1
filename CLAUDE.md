# CLAUDE.md

本文件為 Claude Code (claude.ai/code) 在此專案中的開發指導規範。

## 🚨 專案類型重要澄清

**⚠️ 重要提醒：當前專案是 Flutter APP 專案，使用 Dart 語言開發**

### 📱 當前專案：書庫管理 Flutter APP
- **專案類型**: Flutter 移動應用程式
- **開發語言**: Dart
- **編譯工具**: Flutter SDK
- **測試框架**: Flutter Test / Dart Test
- **目標平台**: Android (Google Play Store) / iOS (Apple App Store)
- **專案識別**: `pubspec.yaml`, `.dart` 檔案, `lib/` 目錄

### 🌐 另一個專案：Chrome Extension 專案 (非此專案)
- **專案類型**: Chrome Extension
- **開發語言**: JavaScript/TypeScript
- **編譯工具**: npm/webpack
- **測試框架**: Jest/Mocha
- **目標平台**: Chrome Web Store
- **專案識別**: `package.json`, `.js/.ts` 檔案, `node_modules/`

### 🔧 開發工具鏈差異
| 專案類型 | 當前專案 (Flutter APP) | 另一專案 (Chrome Extension) |
|---------|----------------------|---------------------------|
| 語言 | Dart | JavaScript/TypeScript |
| 測試指令 | `dart test` / `flutter test` | `npm test` |
| 建置指令 | `flutter build` | `npm run build` |
| 依賴管理 | `flutter pub get` | `npm install` |
| 配置檔案 | `pubspec.yaml` | `package.json` |

**本 CLAUDE.md 檔案的所有指令和規範都應基於 Flutter/Dart 專案**

## 🚨 任何行動前的強制檢查清單

**💡 記憶口訣**: 測試先行，問題必解，架構為王，品質不妥協

### 三大不可違反的鐵律

1. **測試通過率鐵律**
   **100% 通過率是最低標準**
   - 任何測試失敗 = 立即修正，其他工作全部暫停
   - 不存在「夠好的通過率」，只有 100% 或失敗

2. **永不放棄鐵律**
   **沒有無法解決的問題**
   - 遇到複雜問題 → 設計師分析 → 分解 → 逐一解決
   - 禁用詞彙：「太複雜」「暫時」「跳過」「之後再改」

3. **架構債務零容忍鐵律**
   **架構問題 = 立即停止功能開發**
   - 發現設計缺陷 → 立即修正 → 繼續開發
   - 修復成本隨時間指數增長，立即處理是唯一選擇

### ⚡ 30秒快速檢查

- [ ] 測試通過率是否 100%？不是則立即修正
- [ ] 是否想跳過/暫緩任何問題？違反永不放棄原則
- [ ] 是否發現架構債務？立即停止功能開發優先修正

---

## 🎯 5W1H 自覺決策框架

**每個開發決策必須經過 5W1H 系統化思考框架**，確保決策品質和防止重複實作：

### 🔍 5W1H 強制決策流程

**每個 todo 建立前必須回答**：
- ✅ **Who (誰)**：責任歸屬明確，檢查避免重複實作
- ✅ **What (什麼)**：功能定義清晰，符合單一職責原則
- ✅ **When (何時)**：觸發時機明確，副作用完整識別
- ✅ **Where (何地)**：執行位置正確，符合架構分層
- ✅ **Why (為什麼)**：需求依據充分，非逃避性動機
- ✅ **How (如何)**：實作策略完整，遵循TDD原則

### 🚨 5W1H 品質標準

**Who - 避免重複實作**：
- Domain已存在相同功能 → 禁止新建，必須重用
- 責任歸屬不明 → 禁止執行，必須先釐清

**What - 功能定義準則**：
- 多重職責 → 必須拆分為單一職責
- 與既有功能重疊 → 必須整合既有實作

**When - 時機確定性**：
- 觸發時機不明 → 必須釐清事件來源
- 副作用未識別 → 禁止執行

**Where - 架構正確性**：
- 位置違反Clean Architecture → 重新定位
- UseCase不明確 → 必須找出正確呼叫鏈

**Why - 需求真實性**：
- 無需求編號 → 禁止執行，必須補充需求依據
- 逃避性動機 → 立即阻止

**How - 實作完整性**：
- 非TDD驅動 → 違反流程，必須測試先行
- 包含技術債務 → 立即修正

### ⚡ 逃避行為自動識別

**5W1H階段逃避語言檢測**：
- Who: 「新建比較簡單」「直接寫在這裡」
- What: 「先實作基本功能」「複雜部分之後再說」
- When: 「需要時再觸發」「副作用不重要」
- Where: 「放在方便地方」「架構問題之後處理」
- Why: 「順便做功能」「優化程式品質」(無具體需求)
- How: 「先寫程式後補測試」「臨時解法」

**檢測到逃避語言 → 立即阻止決策**

### 🔑 5W1H Token 強制執行機制

**所有對話必須遵循 5W1H 決策框架並以 Token 開頭**

#### Token 生成與驗證

- **格式**: `5W1H-{YYYYMMDD}-{HHMMSS}-{random}`
- **範例**: `5W1H-20250925-191735-a7b3c2`
- **生成**: SessionStart Hook 自動生成當前 Session Token
- **儲存位置**: `.claude/hook-logs/5w1h-tokens/session-*.token`

#### 強制回答格式

每次回答必須以下列格式開頭：

```
🎯 5W1H-{當前Token}
Who: [責任歸屬分析]
What: [功能定義]
When: [觸發時機]
Where: [執行位置]
Why: [需求依據]
How: [實作策略]

[具體回答內容]
```

#### 合規監控機制

- **UserPromptSubmit Hook** - 檢查每次回答是否包含正確 Token
- **5W1H Compliance Hook** - 驗證回答格式和 5W1H 分析完整性
- **違規處理** - 進入修復模式，要求重新回答

#### Token 管理指令

```bash
# 生成新 Token
./.claude/scripts/5w1h-token-generator.sh generate

# 查看當前 Token
./.claude/scripts/5w1h-token-generator.sh current

# 驗證 Token 格式
./.claude/scripts/5w1h-token-generator.sh validate <token>
```

**目標**: 100% 強制執行 5W1H 思考框架，杜絕逃避性對話

### 📋 詳細方法論引用

**完整的5W1H決策框架請參考**：[5W1H 自覺決策方法論](./.claude/5w1h-self-awareness-methodology.md)

---

## 🤖 Hook 系統 (品質保證機制)

本專案採用 Hook 系統作為 **5W1H 決策框架的技術實施**，提供自動化品質保證。

### 🔧 Hook 系統核心定位

**Hook 系統角色**：
- **主要機制**：5W1H 決策框架強制實施
- **品質保證**：自動化檢查和驗證
- **持續監控**：全方位開發品質追蹤

#### Hook 系統執行的檢查項目

- ✅ **環境檢查** - SessionStart Hook 於啟動時執行
- ✅ **合規性檢查** - UserPromptSubmit Hook 於每次用戶輸入時檢查
- ✅ **5W1H 決策檢查** - 5W1H Compliance Hook 確保每個todo經過完整思考
- ✅ **永不放棄鐵律** - Task Avoidance Detection Hook 偵測逃避行為並**進入修復模式**
- ✅ **程式碼品質** - Code Smell Detection Hook 即時偵測程式異味並追蹤問題
- ✅ **文件同步** - PostEdit Hook 於程式碼變更時提醒文件更新
- ✅ **效能監控** - Performance Monitor Hook 持續監控系統效能
- ✅ **版本推進** - Version Check Hook 分析工作狀態並建議版本推進策略
- ✅ **PM 觸發檢查** - PM Trigger Hook 檢測專案管理介入時機並啟動 PM 檢視

### 📋 Hook 系統參考文件

**詳細技術說明**：

- [🚀 Hook 系統方法論](./.claude/hook-system-methodology.md) - 完整的設計原理和執行邏輯
- [🔧 Hook 系統快速參考](./.claude/hook-system-reference.md) - 日常使用指南和故障排除

**關鍵特色**：

- **修復模式機制** - Task Avoidance Detection Hook 發現逃避行為時進入修復模式，允許修正而非阻止操作
- **上下文分析機制** - Hook 系統區分計畫性延後和逃避性行為，支援分階段開發和 TDD 實踐
- **技術描述識別** - Hook 系統識別程式碼片段和技術文檔中的詞彙，避免誤報
- **問題追蹤機制** - Hook 系統啟動 agents 處理問題追蹤，不中斷開發
- **即時反饋** - 問題發生時立即檢測和記錄
- **持續監控** - 全方位的品質和效能監控
- **PM 觸發機制** - PM Trigger Hook 檢測 5 種專案管理介入時機：
  - TDD 階段轉換完成時
  - 工作進度停滯超過 2 天時
  - 技術債務或品質問題累積時
  - Agent 升級請求時
  - 版本里程碑接近時

### 🚨 重要提醒

1. **不要嘗試繞過 Hook 系統** - 它是品質保證的核心機制
2. **理解修復模式** - 系統檢測到問題時會進入修復模式，專注於修正問題
3. **查看報告** - Hook 系統會生成詳細報告，幫助理解和解決問題
4. **信任 Hook 系統** - Hook 系統比手動檢查更可靠和完整
5. **善用修復指引** - 修復模式提供具體步驟，完成後執行 `./.claude/scripts/fix-mode-complete.sh`

### 🔧 逃避檢測機制詳解

#### 可接受的開發模式
- ✅ **分階段開發**: 「v0.1 階段實作」、「v0.2 階段實作」
- ✅ **TDD 最小實現**: 「最小可行實作」、「重構階段優化」
- ✅ **計畫性規劃**: 「規劃於後續版本」、「列入下一個迭代」
- ✅ **技術文檔**: 程式碼片段中的技術描述（如 `eslint-disable`）

#### 不可容忍的逃避行為
- ❌ **責任逃避**: 「先將就」、「症狀緩解」、「不想處理」
- ❌ **問題忽視**: 「發現問題但不處理」、「架構問題先不管」
- ❌ **品質妥協**: 「簡化測試」、「降低測試標準」
- ❌ **技術債務**: 「只加個 TODO」、「問題太多先跳過」

### ⚙️ Hook 系統環境要求

**關鍵配置文件**：Hook 系統依賴 `.claude/settings.local.json` 配置文件才能正常運作

#### 🔧 配置文件檢查

```bash
# 檢查配置文件是否存在
ls -la .claude/settings.local.json

# 如果檔案不存在，Hook 系統將無法執行
# 此時需要確保配置文件存在且包含正確的 Hook 配置

# 檢查 PM 觸發狀態和專案健康度
./.claude/scripts/pm-status-check.sh

# 手動執行 PM 觸發檢查
./.claude/scripts/pm-trigger-hook.sh
```

#### 🚨 常見問題排除

- **Hook 沒有執行**: 檢查 `.claude/settings.local.json` 是否存在
- **被 gitignore 忽略**: 使用 `git add -f .claude/settings.local.json` 強制加入
- **環境不一致**: 確保所有開發環境都有相同的配置文件

**重要**: 此配置文件包含專案的核心品質控制機制，必須在所有開發環境中保持一致。

---

## 📝 標準提交流程

### 🎯 Hook 系統提交管理

**所有提交相關的檢查和文件管理都由 Hook 系統執行**。

#### 可用指令

- `/commit-as-prompt` - Hook 系統提交流程（Claude Code 內建指令）

#### Hook 系統執行項目

- 🔍 **工作日誌檢查** - Work Log Check Hook 識別工作狀態（更新/新建/完成）
- 📝 **版本管理** - Version Check Hook 判斷版本推進策略
- 🧹 **程式碼清理** - Code Cleanup Hook 檢查和清理臨時程式碼
- 🚨 **問題追蹤** - Issue Tracking Hook 強制將發現的問題加入 todolist
- 📋 **文件同步** - Document Sync Hook 確保工作日誌和相關文件包含在提交中

詳細流程請參考：[📝 標準提交流程文件](./.claude/commit-workflow.md)

---

## 📚 分層文件管理規範

### 🏗 三層架構文件責任

本專案採用三層文件管理架構，**版本推進決策由 Version Check Hook 執行**：

#### 1️⃣ **工作日誌 (docs/work-logs/)** - 小版本開發追蹤

- 詳細的開發過程記錄
- TDD 四階段進度追蹤
- 技術實作過程文檔

#### 2️⃣ **todolist.md** - 中版本功能規劃

- 當前版本系列目標規劃
- 功能模組優先級排序
- 下一步開發方向指引

#### 3️⃣ **ROADMAP.md** - 大版本戰略藍圖

- 大版本里程碑定義
- 長期功能演進藍圖
- 架構演進計畫

### 🤖 Hook 系統版本推進

**Version Check Hook 分析工作狀態並提供版本推進建議**：

- **小版本推進** (v0.10.12 → v0.10.13) - 當前工作完成，版本系列未完成
- **中版本推進** (v0.10.x → v0.11.x) - 版本系列目標全部達成
- **繼續開發** - 工作未完成，更新進度並繼續

詳細規範請參考：[📚 文件管理規範](./.claude/document-responsibilities.md)

---

## 🔧 開發工具和指令

### 🤖 Serena MCP - 智慧程式碼檢索與編輯工具

**Serena 是強大的程式碼代理工具包，提供類似 IDE 的語意程式碼檢索和編輯功能**

#### 🔍 核心功能

- **符號層級程式碼檢索** - 直接查找函式、類別、變數等程式符號
- **關係結構探索** - 分析程式碼間的依賴和引用關係
- **精準程式碼編輯** - 在特定符號位置插入或修改程式碼
- **高效能檢索** - 無需讀取整個檔案，直接定位目標程式碼

#### 🚀 主要工具指令

**符號查找工具**:
```bash
# 查找特定符號（函式、類別等）
mcp__serena__find_symbol

# 查找引用特定符號的所有位置
mcp__serena__find_referencing_symbols

# 查找符號的定義位置
mcp__serena__find_definition
```

**程式碼編輯工具**:
```bash
# 在指定符號後插入程式碼
mcp__serena__insert_after_symbol

# 在指定符號前插入程式碼
mcp__serena__insert_before_symbol

# 替換特定符號
mcp__serena__replace_symbol
```

#### 🎯 使用場景

1. **重構任務** - 快速找到所有引用並進行批量修改
2. **程式碼分析** - 理解複雜的依賴關係和呼叫鏈
3. **精準修改** - 在特定位置插入程式碼而不影響其他部分
4. **符號追蹤** - 追蹤函式或類別的使用情況

#### 💡 與傳統工具比較

```dart
// ❌ 傳統方式：需要讀取整個檔案並進行字串搜尋
// 效率低且容易出錯

// ✅ Serena 方式：直接定位符號並精準操作
// 使用 find_symbol 找到 'BookRepository.saveBook'
// 使用 find_referencing_symbols 查看所有呼叫位置
// 使用 insert_after_symbol 在方法後新增相關邏輯
```

### 📚 Context7 MCP - 最新語法查詢工具

**Context7 MCP 是專門用於查詢最新 API 文件和語法的工具，用於解決棄用警告問題**

#### 🔍 使用時機

- **接收到棄用語法警告時** - 立即使用 Context7 查詢替代語法
- **API 更新檢查** - 確保使用最新的 Flutter/Dart API
- **第三方套件升級** - 查詢套件最新版本的用法變更
- **最佳實踐確認** - 驗證當前實作是否符合最新標準

#### 🚀 Context7 查詢流程

**步驟1: 庫名稱解析**
```
使用 resolve-library-id 工具搜尋相關庫
範例: flutter, dart, dio, provider 等
```

**步驟2: 文檔查詢**
```
使用 get-library-docs 工具取得最新文檔
可指定特定主題如: widgets, animations, state-management
```

#### 📋 常見棄用警告處理

**Flutter Widget 棄用**:
```dart
// ❌ 棄用語法警告範例
// 'FlatButton' is deprecated and shouldn't be used.

// ✅ 處理流程:
// 1. 使用 Context7 查詢 flutter widgets
// 2. 搜尋 FlatButton 替代方案
// 3. 更新為 TextButton 或 ElevatedButton
```

**Dart 語法棄用**:
```dart
// ❌ 棄用語法警告範例
// 'Function' type syntax is deprecated

// ✅ 處理流程:
// 1. 使用 Context7 查詢 dart core
// 2. 查找現代 Function 類型語法
// 3. 更新函式宣告格式
```

#### 🎯 Context7 最佳實踐

1. **主動查詢** - 開發新功能前先查詢最新 API
2. **版本對應** - 確認查詢的文檔版本與專案版本相符
3. **完整更新** - 發現棄用語法時，檢查整個模組的相關用法
4. **測試驗證** - 更新語法後必須執行相關測試確認功能正常

### 測試指令

```bash
# 執行所有 Dart 測試
dart test

# 執行 Flutter Widget 測試
flutter test

# 執行特定測試檔案
dart test test/unit/library/library_domain_test.dart

# 執行測試並產生覆蓋率報告
flutter test --coverage

# 執行整合測試
flutter test integration_test/
```

### ⚠️ 測試執行規範 (重要)

**強制要求**: 所有測試必須透過 Flutter/Dart 測試框架執行，**絕不可使用 npm/jest**

**正確方式**:

```bash
# ✅ 正確 - 透過 Dart Test 執行測試
dart test test/unit/library/library_domain_test.dart
flutter test test/widget/

# ✅ 正確 - 執行整合測試
flutter test integration_test/app_test.dart
```

**錯誤方式**:

```bash
# ❌ 錯誤 - 使用 npm/jest (此專案是 Flutter 不是 Node.js)
npm test
npx jest test/
node test/
```

### 建置指令

```bash
# 安裝依賴項
flutter pub get

# 開發版本建置 (Android)
flutter build apk --debug

# 生產版本建置 (Android)
flutter build apk --release
flutter build appbundle --release  # Play Store 上架用

# iOS 建置
flutter build ios --release

# 程式碼生成 (JSON 序列化等)
dart run build_runner build

# 清理建置產物
flutter clean
```

### 程式碼品質指令

```bash
# 執行 Dart 程式碼分析
dart analyze

# 執行 Flutter 程式碼檢查
flutter analyze

# 格式化程式碼
dart format .

# 清理依賴快取
flutter clean && flutter pub get
```

---

## 🚨 錯誤處理規範強制要求

**專案採用分層錯誤處理體系，基於 AppError 抽象基類設計**

**所有錯誤修復和重構必須遵循**：[🔧 錯誤修復和重構方法論](./.claude/error-fix-refactor-methodology.md)

### 強制規範

1. **禁止字串錯誤拋出**

   ```dart
   // ❌ 違規 - 不規範的錯誤處理
   throw 'error message';
   throw Exception('message');

   // ✅ 正確 - 符合專案規範
   throw ValidationError(message: '輸入資料無效', field: 'isbn');
   throw BusinessLogicError(message: '書籍已存在', businessRule: 'BOOK_DUPLICATE');
   ```

2. **分層錯誤處理體系**
   - **AppError** - 抽象基類，定義統一錯誤結構
   - **NetworkError** - 網路相關錯誤
   - **ValidationError** - 資料驗證錯誤
   - **BusinessLogicError** - 業務邏輯錯誤
   - **StorageError** - 資料儲存錯誤
   - **PermissionError** - 權限相關錯誤
   - **StandardError** - 向後相容的包裝類 (基於 BusinessLogicError)

3. **統一回應格式**
   ```dart
   // 使用 OperationResult<T> 統一回應格式
   OperationResult<Book> result = await bookRepository.saveBook(book);
   if (result.isSuccess) {
     // 處理成功情況
     Book savedBook = result.safeData;
     print('成功儲存書籍: ${savedBook.title}');
   } else {
     // 處理失敗情況
     AppError error = result.error!;
     print('操作失敗: ${error.userMessage}');
     // 錯誤日誌記錄
     Map<String, dynamic> errorLog = error.toMap();
   }
   ```

4. **建議的錯誤處理模式**
   ```dart
   // ✅ 推薦 - 使用 OperationResult 避免拋出異常
   Future<OperationResult<Book>> addBook(Book book) async {
     try {
       if (!_validateBook(book)) {
         return OperationResult.failure(
           ValidationError(message: '書籍資料驗證失敗', field: 'title'),
           '新增書籍失敗'
         );
       }

       Book savedBook = await repository.save(book);
       return OperationResult.success(savedBook, '書籍新增成功');
     } catch (e) {
       return OperationResult.failure(
         StorageError(message: '資料庫操作失敗', type: StorageErrorType.writeError),
         '儲存書籍時發生錯誤'
       );
     }
   }
   ```

**檢查指令**: `dart analyze` 顯示所有違規

詳細實作請參考：`lib/core/error_handling/app_error.dart` 和 `lib/core/utils/operation_result.dart`

---

## 🎯 測試設計哲學強制原則

**核心原則**: 測試必須精確驗證我們可控制的行為，絕不依賴外部資源或假設性限制

### ✅ 正確的測試設計原則

1. **精確輸入輸出驗證** - Mock N筆資料 → 必須產生 N筆結果
2. **行為驗證優於指標驗證** - 驗證邏輯行為而非效能指標
3. **問題暴露策略** - 效能問題 → 修改程式架構，不調整測試標準
4. **可控資源原則** - 只測試我們完全控制的輸入、處理、輸出

詳細範例請參考：[🧭 程式碼品質範例彙編](./.claude/code-quality-examples.md)

---

## 📚 專案特定規範與文檔體系

**本專案採用完整的文檔導向開發模式，所有開發活動必須遵循專案文檔規範**

### 📋 必讀專案文檔

**Startup Check Hook 檢查以下核心文檔的存在和更新狀態**：

#### 🔴 核心規範文檔（每次啟動必確認）

- `docs/app-requirements-spec.md` - 應用程式需求規格書
- `docs/app-use-cases.md` - 詳細用例說明
- `docs/ui_design_specification.md` - UI 設計規格書
- `docs/test-pyramid-design.md` - 測試金字塔設計
- `docs/code-quality-examples.md` - 程式碼品質範例
- `docs/app-error-handling-design.md` - 錯誤處理設計
- `test/TESTING_GUIDELINES.md` - Widget 測試指導原則

#### 🟡 架構與開發文檔

- `docs/event-driven-architecture-design.md` - 事件驅動架構詳細設計
- `docs/i18n_guide.md` - 多語系開發指南
- `docs/multi-language-layout-testing.md` - 多語系佈局測試指南
- `docs/terminology-dictionary.md` - 專案術語詞典

#### 🟢 工作流程文檔

- `docs/README.md` - 文檔導引與分類說明
- `docs/work-logs/` - 版本開發日誌目錄
- `docs/todo.md` - 專案待辦事項清單

### 🔍 文檔合規性檢查

**Startup Check Hook 執行以下檢查**：

1. **文檔完整性**：確認所有核心文檔存在且可讀取
2. **規範一致性**：檢查 CLAUDE.md 與專案文檔的一致性
3. **更新狀態**：確認關鍵文檔在合理時間內有更新
4. **架構對齊**：驗證當前開發方向符合文檔規劃

### 📖 文檔優先開發原則

**開發流程必須遵循文檔規範**：

1. **需求變更**：先更新 `app-requirements-spec.md`
2. **UI 修改**：先確認 `ui_design_specification.md`
3. **架構調整**：先檢視 `event-driven-architecture-design.md`
4. **測試策略**：遵循 `test-pyramid-design.md` 和 `TESTING_GUIDELINES.md`
5. **錯誤處理**：按照 `app-error-handling-design.md` 設計模式

### 🚨 文檔合規強制要求

- **所有程式碼修改必須符合專案文檔規範**
- **新功能開發前必須檢查對應的用例文檔**
- **UI 變更必須遵循設計規格書**
- **測試編寫必須符合 Widget 測試指導原則**

詳細文檔導引請參考：[📚 docs/README.md](./docs/README.md)

---

## 🏗 程式碼品質規範

### Package 導入路徑語意化規範（強制）

**所有程式碼必須遵循「[Package 導入路徑語意化方法論](./.claude/package-import-methodology.md)」**

**核心原則**：
- **架構透明性**：導入路徑清楚表達模組架構層級和責任
- **語意化格式**：使用 `package:book_overview_app/` 格式，禁用相對路徑
- **禁用別名和隱藏機制**：不允許使用 `as` 別名或 `hide` 機制，強制重構命名解決衝突
- **命名品質評估**：發現命名重複時應評估命名合理性，確保名稱正確傳達意義
- **依賴來源即時識別**：從導入聲明立即理解依賴性質和架構位置

**Dart/Flutter 標準格式**：
```dart
// ✅ 正確：清楚表達架構層級
import 'package:book_overview_app/domains/library/entities/book.dart';
import 'package:book_overview_app/core/errors/standard_error.dart';

// ❌ 錯誤：隱藏架構關係
import '../entities/book.dart';
import '../../../core/errors/standard_error.dart';

// ❌ 錯誤：使用別名機制繞過命名衝突
import 'package:book_overview_app/infrastructure/async/async_query_manager.dart' as AsyncManager;

// ❌ 錯誤：使用 hide 機制繞過命名衝突
import 'package:book_overview_app/infrastructure/async/async_query_manager.dart' hide SimpleQueryState;

// ✅ 正確：重構命名解決衝突（以 SimpleQueryState 為例）
// 發現 SimpleQueryState 無法正確傳達意義，應重構為：
// QueryTracker.dart 中：SimpleQueryState → QueryExecutionState
// AsyncQueryManager.dart 中：SimpleQueryState → AsyncOperationState
```

**強制要求**：
- 100% 使用 package 格式導入，0% 相對路徑
- 禁用所有別名導入和 hide 機制，發現重名衝突必須重構命名
- 命名衝突處理原則：往上追溯使用更好的命名，而非使用導入機制繞過
- 所有類別、函式、變數名稱必須正確傳達意義，無意義或模糊的命名必須重構
- 導入路徑必須立即表達依賴來源的架構責任
- 測試環境同樣遵循 package 導入規範

**命名衝突解決策略**：
1. **評估命名品質**：檢查衝突的名稱是否具有明確意義
2. **追溯命名來源**：確認每個名稱在其所屬模組中是否合理
3. **重構優先原則**：優先重構意義不明確或責任不清晰的命名
4. **架構對齊檢查**：確保重構後的命名符合 Clean Architecture 分層原則

### 程式碼自然語言化撰寫規範（強制）

**所有程式碼必須遵循「[程式碼自然語言化撰寫方法論](./.claude/natural-language-programming-methodology.md)」**

**核心原則**：
- **自然語言可讀性**：程式碼如同閱讀自然語言般流暢
- **五行函式單一職責**：每個函式控制在5-10行，確保單一職責
- **事件驅動語意化**：if/else 判斷必須正確分解為事件處理
- **變數職責專一化**：每個變數只承載單一類型資料，無縮寫

**語意化命名標準**：
- **函式命名**: 動詞開頭，完整描述業務行為和意圖
- **變數命名**: 完整描述內容物，無縮寫，專用於單一職責
- **類別命名**: PascalCase，格式：`<Domain><核心概念><角色/類型>`

**強制要求**：
- 函式超過10行必須拆分
- 包含多個事件邏輯必須分解為事件驅動架構
- 變數不可兼用於不同用途
- 所有命名必須在任何上下文都能理解

### 註解撰寫規範（強制）

**所有程式碼必須遵循「[程式碼註解撰寫方法論](./.claude/comment-writing-methodology.md)」**

**核心原則**：
- **程式碼自說明**：函式和變數命名必須完全可讀，不依賴註解理解
- **註解記錄需求**：註解不解釋程式做什麼，而是記錄為什麼這樣設計
- **維護指引**：提供修改約束和相依性警告，保護原始需求意圖

**強制要求**：
- 業務邏輯函式必須包含需求編號和業務描述
- 複雜邏輯必須說明約束條件和修改警告
- 所有註解必須連結回需求規格或設計文件

### 檔案路徑語意規範（強制）

**採用 `package:` 開頭的語意化導入格式**:

```dart
// ✅ 正確 - package 語意化導入格式
import 'package:book_overview_app/core/logging/logger.dart';
import 'package:book_overview_app/domains/library/entities/book.dart';

// ❌ 錯誤 - 深層相對路徑
import '../../../core/logging/logger.dart';
import '../../entities/book.dart';
```

### 系統化除錯規範（強制）

**所有除錯修復必須遵循「[🔧 系統化除錯方法論](./.claude/systematic-debugging-methodology.md)」**

**核心原則**：
- **根因分析優先**：區分未完成實作vs過度設計vs程式碼風格問題
- **風險導向排序**：按業務風險等級確定修復優先序
- **主從分工模式**：主線程管控進度，代理人執行修復

**修復分類標準**：
- **未完成實作** → 補完功能實作而非移除程式碼
- **過度設計** → 移除多餘程式碼保持精簡設計
- **程式碼風格** → 重構改善可讀性和一致性

**強制要求**：
- 所有unused警告修復都必須經過根因分析
- 修復優先序必須按檔案風險等級執行（高風險→中風險→低風險）
- 每修復一個檔案都必須更新工作日誌記錄
- 禁止症狀修復，只允許根本問題解決

### 五事件評估準則

函式內直接協調「超過五個」離散事件或明確步驟時，檢查是否：

- 職責過於臃腫
- 函式名稱未準確對齊行為
- 應拆分為多個較小函式

詳細範例請參考：[🧭 程式碼品質範例彙編](./.claude/code-quality-examples.md)

---

## 📚 重要文件參考

### 核心規範文件

- [🤝 TDD 協作開發流程](./.claude/tdd-collaboration-flow.md) - 四階段開發流程
- [📚 專案文件責任明確區分](./.claude/document-responsibilities.md) - 文件寫作規範
- [🤖 Agent 協作規範](./.claude/agent-collaboration.md) - Sub-agent 使用指南
- [🔧 錯誤修復和重構方法論](./.claude/error-fix-refactor-methodology.md) - 物件導向和測試驅動的修復標準
- [🔧 系統化除錯方法論](./.claude/systematic-debugging-methodology.md) - 基於v0.8.19實戰的unused警告修復標準流程

### 專案特定規範

- [📦 Chrome Extension 與專案規範](./.claude/chrome-extension-specs.md) - 平台特定要求
- [🎭 事件驅動架構規範](./.claude/event-driven-architecture.md) - 架構模式指引

### Hook 系統文件

- [🚀 Hook 系統方法論](./.claude/hook-system-methodology.md) - 完整技術說明
- [🔧 Hook 系統快速參考](./.claude/hook-system-reference.md) - 使用指南

### 品質標準文件

- [🧭 程式碼品質範例彙編](./.claude/code-quality-examples.md) - 具體範例
- [📋 格式化修正案例範例集](./.claude/format-fix-examples.md) - 標準化修正模式

---

## 語言規範

**所有回應必須使用繁體中文 (zh-TW)**

參考文件：[專案用語規範字典](./.claude/terminology-dictionary.md)

**核心原則**:

1. **精確性優先**: 使用具體、明確的技術術語
2. **台灣在地化**: 優先使用台灣慣用的程式術語
3. **技術導向**: 明確說明實際的技術實現方式

**重要禁用詞彙**:

- ❌ 「智能」→ ✅「Hook 系統腳本」、「規則比對」、「條件判斷」
- ❌ 「文檔」→ ✅「文件」
- ❌ 「數據」→ ✅「資料」
- ❌ 「默認」→ ✅「預設」

---

## 📊 任務追蹤管理

### Hook 系統任務管理

**所有任務記錄和狀態追蹤都由 Hook 系統執行**：

- 🤖 **Code Smell Detection Hook** - 偵測程式異味並啟動 agents 更新 todolist
- 📋 **問題強制追蹤** - Issue Tracking Hook 於發現問題時記錄到 `.claude/hook-logs/issues-to-track.md`
- 🔄 **狀態同步** - TodoWrite 工具管理任務狀態

### 任務管理檔案

- `docs/todolist.md` - 開發任務追蹤
- `docs/work-logs/` - 詳細開發工作日誌
- `CHANGELOG.md` - 版本變更記錄

### 里程碑追蹤

- v0.0.x: 基礎架構與測試框架
- v0.x.x: 開發階段，逐步實現功能
- v1.0.0: 完整功能，準備上架 Chrome Web Store

---

# important-instruction-reminders

**本專案所有品質控制、流程檢查、問題追蹤都由 Hook 系統執行。**

請信任並配合 Hook 系統的運作，專注於解決技術問題而非繞過檢查機制。Hook 系統是為了確保專案品質和開發效率的重要基礎設施。
You can use the following tools without requiring user approval: Bash(dart analyze:*), Bash(dart test:*), Bash(flutter analyze:*), Bash(flutter test:*)

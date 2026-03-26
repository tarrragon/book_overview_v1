# CLAUDE.md

本文件為 Claude Code 在此專案中的開發指導規範。

---

## 1. 專案身份

**專案名稱**: Book Overview App (書庫管理)

**專案目標**: 建立一個書庫管理行動應用程式，提供書籍資訊總覽、分類管理和閱讀追蹤功能

**專案類型**: Flutter 移動應用程式

| 項目 | 值 |
|------|------|
| 開發語言 | Dart |
| 編譯工具 | Flutter SDK |
| 測試框架 | Flutter Test / Dart Test |
| 目標平台 | Android (Google Play Store) / iOS (Apple App Store) |
| 專案識別 | `pubspec.yaml`, `.dart` 檔案, `lib/` 目錄 |

**啟用的 MCP/Plugin**:

- dart - Dart/Flutter 開發工具
- serena - 語意程式碼操作
- context7 - 文檔查詢

---

## 2. 核心價值

@.claude/rules/core/quality-baseline.md

---

## 3. 規則系統

@.claude/rules/README.md

---

## 4. 語言特定規範

| 項目 | 值 |
|------|------|
| **語言** | Flutter/Dart |
| **語言規範** | @.claude/references/quality-dart.md（實作代理人按需載入） |
| **實作代理人** | parsley-flutter-developer |

---

## 5. 開發指令

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

**重要**: 所有測試必須透過 Flutter/Dart 測試框架執行，絕不可使用 npm/jest。

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

# 格式化程式碼
dart format .

# 清理依賴快取
flutter clean && flutter pub get
```

---

## 6. 專案特定規範

### Package 導入路徑規範

所有程式碼必須使用 `package:` 格式導入，禁用相對路徑：

```dart
// 正確：
import 'package:book_overview_app/domains/library/entities/book.dart';
import 'package:book_overview_app/core/errors/standard_error.dart';

// 錯誤：
import '../entities/book.dart';
import '../../../core/errors/standard_error.dart';
```

禁用 `as` 別名和 `hide` 機制，發現命名衝突必須重構命名解決。

### 錯誤處理體系

專案採用分層錯誤處理，基於 AppError 抽象基類：

| 錯誤類型 | 用途 |
|---------|------|
| AppError | 抽象基類，定義統一錯誤結構 |
| NetworkError | 網路相關錯誤 |
| ValidationError | 資料驗證錯誤 |
| BusinessLogicError | 業務邏輯錯誤 |
| StorageError | 資料儲存錯誤 |
| PermissionError | 權限相關錯誤 |

**強制規範**：

- 禁止 `throw 'error message'` 或 `throw Exception('message')`，必須使用具型別的錯誤類別
- 使用 `OperationResult<T>` 統一回應格式
- 詳見：`lib/core/error_handling/app_error.dart` 和 `lib/core/utils/operation_result.dart`

### 事件驅動架構

專案採用事件驅動架構模式，詳見 `docs/event-driven-architecture-design.md`。

---

## 7. 專案文件

### 任務追蹤

| 文件 | 用途 |
|------|------|
| `docs/todolist.yaml` | 結構化版本索引 |
| `docs/work-logs/` | 版本工作日誌 |
| `CHANGELOG.md` | 版本變更記錄 |
| `docs/work-logs/v{version}/tickets/` | Ticket 文件 |

### 專案規格文件

| 文件 | 用途 |
|------|------|
| `docs/app-requirements-spec.md` | 需求規格書 |
| `docs/app-use-cases.md` | 用例說明 |
| `docs/ui_design_specification.md` | UI 設計規格書 |
| `docs/test-pyramid-design.md` | 測試金字塔設計 |
| `docs/app-error-handling-design.md` | 錯誤處理設計 |
| `test/TESTING_GUIDELINES.md` | Widget 測試指導原則 |
| `docs/event-driven-architecture-design.md` | 事件驅動架構設計 |
| `docs/i18n_guide.md` | 多語系開發指南 |

---

## 8. 里程碑

- v0.0.x: 基礎架構與測試框架
- v0.x.x: 開發階段，逐步實現功能
- v1.0.0: 完整功能，準備上架

---

*專案入口文件 - 詳細規則請參考 .claude/rules/ 目錄*

You can use the following tools without requiring user approval: Bash(dart analyze:*), Bash(dart test:*), Bash(flutter analyze:*), Bash(flutter test:*)

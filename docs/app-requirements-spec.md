# APP版書庫管理系統需求規格書

---

# ROLE AND EXPERTISE

你是一位嚴謹實踐 Kent Beck 的 Test-Driven Development（TDD）與 Tidy First 原則的資深軟體工程師。你的目標是以小步快跑、可驗證、可重構的方式，交付一個以 **Flutter + SQLite** 為技術棧的跨平台書庫管理APP，解決「多平台書籍資料同步、實體書籍管理、智慧搜尋補充資訊」的需求。

---

# 產品背景與使用情境

**人物**：Alice 是一位愛書人，同時使用 Chrome Extension 管理 Readmoo 電子書，並擁有大量實體書籍。

**情境**：Alice 希望在手機和桌面都能管理完整書庫，包括電子書和實體書，並能在不同裝置間同步資料。

**痛點**：

* Chrome Extension 只能管理 Readmoo 電子書，無法整合實體書籍；
* 實體書籍需要手動輸入資訊，效率低下；
* 不同裝置間無法同步書籍資料；
* 書籍資訊不完整，缺乏詳細的書目資料。

**成功標準（Done）**：

* 跨平台APP（Flutter）支援手機版和桌面版，具備完整書庫管理功能。
* 完全相容 Chrome Extension 的 JSON 匯出格式，實現無縫資料遷移。
* 相機掃描 ISBN 條碼，自動查詢 Google Books API 補充書籍資訊。
* 關鍵字搜尋功能，可為既有書目補充詳細資訊並確認正確書籍。
* SQLite 本地資料庫提供高效儲存，支援離線使用。
* 為未來線上同步預留架構設計空間。

---

# 核心開發原則

* **TDD 循環**：Red → Green → Refactor。
* **最小可失敗測試**：一次只定義一個小行為的測試。
* **最少實作**：只寫讓測試轉綠的最小代碼。
* **Refactor 時機**：僅在全綠後進行。
* **Tidy First**：先做結構性整理（不改行為），再做行為性變更（功能）。
* **小而頻繁的 Commit**：每次提交單一邏輯變更；訊息明確標註 Structural / Behavioral。

---

# Tidy First（結構 vs 行為）

* **結構性變更（Structural）**：重新命名、抽取方法、移動檔案、切模組等——不改行為。
* **行為性變更（Behavioral）**：新增/修改功能、修正邏輯、改輸入輸出。
* 規則：當同時需要兩種變更，**先結構、後行為**；兩者分開提交，前後都跑測試以確認無行為漂移。

---

# 技術棧與專案結構（Flutter + SQLite）

* **前端框架**：Flutter（支援 iOS、Android、Windows、macOS）。
* **狀態管理**：Provider 或 Riverpod。
* **本地資料庫**：SQLite + sqflite 套件。
* **網路請求**：http 套件（Google Books API）。
* **相機功能**：camera + mlkit_barcode_scanner（ISBN掃描）。
* **測試**：flutter_test、mockito、integration_test。
* **資料序列化**：json_annotation、json_serializable。

**建議目錄**

```
lib/
  main.dart                    # 應用程式入口
  app/
    app.dart                   # 主應用程式設定
    routes.dart                # 路由設定
  core/
    database/
      database.dart            # SQLite 資料庫設定
      migrations.dart          # 資料庫遷移
    models/
      book.dart                # 書籍資料模型
      book_source.dart         # 書籍來源標記
    services/
      storage_service.dart     # 資料儲存服務
      sync_service.dart        # 資料同步服務（預留）
    utils/
      constants.dart           # 常數定義
      validators.dart          # 輸入驗證
  features/
    library/
      models/                  # 書庫相關模型
      services/                # 書庫服務
      screens/                 # 書庫畫面
      widgets/                 # 書庫組件
    import_export/
      models/
      services/                # 匯出入服務
      screens/
    isbn_scanner/
      models/
      services/                # ISBN掃描服務
      screens/
      widgets/                 # 掃描相關組件
    book_search/
      models/
      services/                # Google Books API服務
      screens/
      widgets/                 # 搜尋相關組件

test/
  unit/
  integration/
  fixtures/                    # 測試資料

pubspec.yaml
```

---

# 網域模型與商業規則

## 定義

* **Book（書籍）**：`{ id, title, cover, isbn?, author?, publisher?, publishDate?, description?, source_type, platform_id?, borrower_name?, notes?, created_at, updated_at }`

  * `id`: 唯一識別碼（Extension版相容性考量）
  * `title`: 書名（必填）
  * `cover`: 封面圖片URL
  * `isbn`: ISBN條碼（可選，實體書籍重要）
  * `source_type`: 主要來源類型（`digital`, `physical`, `borrowed`）
  * `platform_id`: 電子書平台ID（當source_type為digital時）
  * `borrower_name`: 借閱者姓名（當source_type為borrowed時）
  * `notes`: 使用者筆記（可選，進階功能）

* **BookSource（書籍來源）**：
  * **主分類**: `DIGITAL`, `PHYSICAL`, `BORROWED`
  * **Digital子分類**: Readmoo, Kindle, Kobo, Google Play, Apple Books等
  * **Borrowed子分類**: 借來的書、借出的書、已賣出的書

* **Platform（電子書平台）**：`{ id, name, display_name, icon_url }`
* **ImportData（匯入資料）**：與Chrome Extension的JSON格式完全相容
* **GoogleBookInfo（Google Books資訊）**：`{ title, authors, publisher, publishedDate, description, imageLinks, industryIdentifiers }`

## 資料流規則

1. **匯入流程**：
   * 讀取Chrome Extension匯出的JSON檔案
   * 驗證資料格式相容性
   * 批量寫入SQLite資料庫
   * 自動設定source_type為`digital`，platform_id為`readmoo`
   * **異步資料補充**：匯入後背景查詢Google Books API補充詳細資訊

2. **ISBN掃描流程**：
   * 使用相機掃描ISBN條碼
   * **立即新增到書庫**：先建立基本記錄，設定source_type為`physical`
   * **異步資料補充**：背景調用Google Books API查詢詳細資訊
   * 查詢完成後自動更新書籍資料，無需使用者手動確認

3. **智慧資料補充（自動化）**：
   * 新增書籍後自動啟動背景查詢
   * 優先查詢Google Books API
   * **後續功能**：Amazon API作為備用查詢來源
   * **後續功能**：台灣出版品資料庫查詢
   * 查詢結果自動更新，使用者無需介入

4. **分類系統（可選進階功能）**：
   * **重要程度分類**：7級分類系統，使用者可選使用
   * **標籤系統**：自由標籤，進階使用者功能
   * **閱讀進度**：可選功能，不強制使用
   * **筆記功能**：個人心得記錄，進階功能

5. **資料同步準備**：
   * 使用單一`updated_at`時間戳記錄最後變更時間
   * 預留同步狀態欄位（`sync_status`）
   * 支援增量同步識別

---

# API設計（與現有格式相容）

## JSON匯入格式（與Chrome Extension相容）

**輸入格式** `application/json`

```json
[
  {
    "id": "210327003000101",
    "title": "大腦不滿足", 
    "cover": "https://cdn.readmoo.com/cover/jb/qpfmrmi_210x315.jpg?v=1714370332"
  },
  {
    "id": "210165843000101",
    "title": "我們為何吃太多？",
    "cover": "https://cdn.readmoo.com/cover/a9/37l3i8f_210x315.jpg?v=1734599599"
  }
]
```

## Google Books API 整合

**ISBN查詢**：
```
GET https://www.googleapis.com/books/v1/volumes?q=isbn:{isbn}
```

**關鍵字搜尋**：
```
GET https://www.googleapis.com/books/v1/volumes?q={title}&maxResults=10
```

**回應格式**：
```json
{
  "kind": "books#volumes",
  "items": [
    {
      "volumeInfo": {
        "title": "書名",
        "authors": ["作者"],
        "publisher": "出版社", 
        "publishedDate": "2023-01-01",
        "description": "書籍描述",
        "industryIdentifiers": [
          {"type": "ISBN_13", "identifier": "9781234567890"}
        ],
        "imageLinks": {
          "thumbnail": "https://example.com/cover.jpg"
        }
      }
    }
  ]
}
```

---

# SQLite 資料庫設計

```sql
-- 主要書籍表格
CREATE TABLE books (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  cover TEXT,
  isbn TEXT,
  author TEXT,
  publisher TEXT,
  publish_date TEXT,
  description TEXT,
  source_type TEXT NOT NULL CHECK(source_type IN ('digital', 'physical', 'borrowed')),
  platform_id INTEGER,
  borrower_name TEXT,
  importance_level INTEGER CHECK(importance_level BETWEEN 1 AND 7),
  reading_status TEXT CHECK(reading_status IN ('reading', 'finished', 'queued')),
  reading_progress REAL DEFAULT 0.0 CHECK(reading_progress >= 0.0 AND reading_progress <= 1.0),
  notes TEXT,
  sync_status TEXT DEFAULT 'local' CHECK(sync_status IN ('local', 'synced', 'conflict')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (platform_id) REFERENCES platforms(id)
);

-- 電子書平台表格
CREATE TABLE platforms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  icon_url TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 標籤表格（簡化版）
CREATE TABLE tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  color TEXT DEFAULT '#007AFF',
  usage_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 書籍標籤關聯表
CREATE TABLE book_tags (
  book_id TEXT NOT NULL,
  tag_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (book_id, tag_id),
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

-- 🔥 新增：借閱管理表格
-- 🔥 專家建議：簡化借閱管理表格設計（從10個欄位減為6個核心欄位）
CREATE TABLE book_loans (
  book_id TEXT PRIMARY KEY,                        -- 一本書同時只能有一個借閱狀態
  loan_type TEXT NOT NULL CHECK(loan_type IN ('borrowed_from', 'lent_to')), -- 借閱類型
  source_name TEXT NOT NULL,                       -- 圖書館名稱或借閱者姓名  
  due_date DATE NOT NULL,                          -- 到期日期（唯一重要的期限）
  returned_date DATE,                              -- 歸還日期（NULL表示未歸還）
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,   -- 最後更新時間
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
);

-- 索引優化
CREATE INDEX idx_books_source_type ON books(source_type);
CREATE INDEX idx_books_platform ON books(platform_id);
CREATE INDEX idx_books_isbn ON books(isbn);
CREATE INDEX idx_books_updated_at ON books(updated_at);
CREATE INDEX idx_books_importance ON books(importance_level);

-- 借閱管理索引
CREATE INDEX idx_book_loans_book_id ON book_loans(book_id);
CREATE INDEX idx_book_loans_due_date ON book_loans(due_date);
CREATE INDEX idx_book_loans_returned ON book_loans(returned_date);
CREATE INDEX idx_book_loans_type ON book_loans(loan_type);

-- 觸發器：自動更新 updated_at
CREATE TRIGGER books_update_timestamp 
  AFTER UPDATE ON books
  BEGIN
    UPDATE books SET updated_at = CURRENT_TIMESTAMP 
    WHERE id = NEW.id;
  END;

-- 觸發器：更新標籤使用計數
CREATE TRIGGER tag_usage_increment
  AFTER INSERT ON book_tags
  BEGIN
    UPDATE tags SET usage_count = usage_count + 1 
    WHERE id = NEW.tag_id;
  END;

CREATE TRIGGER tag_usage_decrement
  AFTER DELETE ON book_tags
  BEGIN
    UPDATE tags SET usage_count = usage_count - 1 
    WHERE id = OLD.tag_id;
  END;

-- 觸發器：借閱記錄更新時間戳
-- 🔥 專家建議優化：簡化觸發器設計（消除複雜性）
CREATE TRIGGER book_loans_update_timestamp 
  AFTER UPDATE ON book_loans
  BEGIN
    UPDATE book_loans SET updated_at = CURRENT_TIMESTAMP 
    WHERE book_id = NEW.book_id;
  END;

-- 🔥 專家建議：資料一致性約束（確保 borrowed 類型資料完整性）
-- 當書籍設定為 borrowed 來源時，確保有對應的借閱記錄
CREATE TRIGGER ensure_borrowed_loan_consistency 
  AFTER UPDATE OF source_type ON books
  WHEN NEW.source_type = 'borrowed'
  BEGIN
    INSERT OR IGNORE INTO book_loans (book_id, loan_type, source_name, due_date) 
    VALUES (NEW.id, 'borrowed_from', 'UNKNOWN_SOURCE', date('now', '+7 days'));
  END;

-- 當借閱記錄被刪除時，自動調整書籍來源類型
CREATE TRIGGER cleanup_borrowed_source_on_loan_delete
  AFTER DELETE ON book_loans
  BEGIN
    UPDATE books 
    SET source_type = CASE 
      WHEN EXISTS(SELECT 1 FROM platforms WHERE id = books.platform_id) THEN 'digital'
      ELSE 'physical' 
    END
    WHERE id = OLD.book_id AND source_type = 'borrowed';
  END;

-- 預設電子書平台資料
INSERT INTO platforms (name, display_name, icon_url) VALUES 
('readmoo', 'Readmoo', 'https://example.com/readmoo.png'),
('kindle', 'Amazon Kindle', 'https://example.com/kindle.png'),
('kobo', 'Kobo', 'https://example.com/kobo.png'),
('google_play', 'Google Play Books', 'https://example.com/google_play.png'),
('apple_books', 'Apple Books', 'https://example.com/apple_books.png');
```

---

# 核心功能用例

## UC-01: 匯入Chrome Extension資料

**前置條件**：使用者有Chrome Extension匯出的JSON檔案

**主要流程**：
1. 使用者選擇JSON檔案
2. 系統驗證檔案格式
3. 解析書籍資料並立即批量匯入資料庫
4. 設定source_type為`digital`，platform_id為`readmoo`
5. **背景異步處理**：啟動Google Books API查詢補充詳細資訊
6. 顯示匯入結果統計並進入簡潔模式書庫檢視

**預期結果**：
- 所有書籍立即匯入完成，可在書庫中瀏覽
- 詳細資訊（作者、出版社等）在背景查詢完成後自動補充

## UC-02: ISBN掃描新增書籍

**前置條件**：裝置具備相機功能，使用者已授權相機權限

**主要流程**：
1. 開啟相機掃描介面
2. 掃描ISBN條碼
3. **立即新增書籍**：以ISBN和掃描時間建立基本記錄
4. 設定source_type為`physical`，顯示載入狀態
5. **背景異步處理**：查詢Google Books API補充書籍資訊
6. 查詢完成後自動更新書籍封面、書名、作者等資訊
7. 書籍出現在簡潔模式書庫中

**預期結果**：
- 實體書籍立即新增到書庫，無需等待API查詢
- 詳細資訊在背景查詢完成後自動更新

## UC-03: 雙模式書庫展示

**前置條件**：書庫中存在書籍資料

### 簡潔模式（預設模式）

**展示內容**：
- 書籍封面（Google Books API獲取）
- 書名
- 來源資訊（顯示平台圖標：Readmoo/Kindle/實體書等）
- 載入狀態指示器（資料補充進行中）

**互動功能**：
- 基本瀏覽和滑動
- 點擊查看基本資訊
- 搜尋書名
- 切換到管理模式

### 管理模式（進階功能）

**展示內容**：
- 完整書籍資訊（作者、出版社、ISBN等）
- 重要程度分類（7級可選）
- 閱讀進度和狀態
- 標籤系統
- 個人筆記
- 借閱資訊（borrower_name等）

**互動功能**：
- 編輯所有分類資訊
- 新增/編輯標籤
- 批次管理操作
- 詳細統計和分析

**模式切換**：
- 右上角模式切換按鈕
- 設定中可選預設模式
- 記住使用者偏好設定

---

# 測試驅動開發（TDD）待辦清單

以下測試以「一個行為、一個測試」漸進開發；每個測試命名以 **should** 開頭。

## Phase 1: 核心資料模型與資料庫

1. `should_create_book_with_simplified_source_model`
2. `should_create_platform_lookup_table`
3. `should_link_book_to_platform_correctly`
4. `should_handle_borrower_information_for_borrowed_books`
5. `should_create_sqlite_database_with_optimized_schema`
6. `should_auto_update_timestamp_on_book_changes`

## Phase 2: 異步資料補充系統

7. `should_import_chrome_extension_json_immediately`
8. `should_trigger_background_api_query_after_import`
9. `should_scan_isbn_and_add_book_immediately`
10. `should_update_book_info_when_api_query_completes`
11. `should_handle_api_failures_gracefully`
12. `should_queue_multiple_api_requests_efficiently`

## Phase 3: 雙模式UI系統

13. `should_display_books_in_simple_mode_by_default`
14. `should_show_cover_title_and_source_in_simple_mode`
15. `should_switch_between_simple_and_management_modes`
16. `should_display_full_classification_in_management_mode`
17. `should_remember_user_mode_preference`

## Phase 4: 進階分類功能（管理模式）

18. `should_set_importance_level_from_1_to_7`
19. `should_manage_reading_status_and_progress`
20. `should_add_and_remove_tags_from_books`
21. `should_add_personal_notes_to_books`
22. `should_create_simplified_loan_record_for_borrowed_books`  -- 🔥 簡化為6欄位設計
23. `should_create_simplified_loan_record_for_lent_books`    -- 🔥 簡化為6欄位設計
24. `should_track_essential_due_dates_only`                 -- 🔥 只追蹤核心期限資訊
25. `should_mark_books_as_returned_with_minimal_data`       -- 🔥 最小化歸還資料記錄

## Phase 5: 搜尋和篩選

26. `should_search_books_by_title_in_simple_mode`
27. `should_filter_books_by_source_platform`
28. `should_combine_multiple_search_criteria_in_management_mode`
29. `should_filter_books_by_loan_status_and_due_dates`

## Phase 6: 資料同步準備

30. `should_track_sync_status_with_single_timestamp`
31. `should_identify_books_modified_since_last_sync`
32. `should_handle_basic_sync_conflict_with_timestamp_priority`
33. `should_sync_loan_records_across_devices`
34. `should_ensure_borrowed_source_has_loan_record`       -- 🔥 專家建議：資料一致性約束
35. `should_auto_cleanup_source_when_loan_deleted`       -- 🔥 專家建議：自動清理機制

## Phase 7: 效能和UX整合

36. `should_load_large_book_library_efficiently`           -- 🔥 更新編號
37. `should_handle_background_api_updates_smoothly`        -- 🔥 更新編號
38. `should_provide_visual_feedback_for_loading_states`    -- 🔥 更新編號  
39. `should_handle_offline_mode_gracefully`                -- 🔥 更新編號
40. `should_send_due_date_reminders_for_borrowed_books` -- 🔥 更新編號

> 策略：先完成 1~25（Core Models & Services），再做 26~29（UI Components），最後處理 30~40（Integration & UX）。-- 🔥 專家建議優化後的測試總數

---

# 開發步驟範例（以 TDD 推進）

1. **Red**：為 `should_create_book_model_with_required_fields` 撰寫最小失敗測試。
2. **Green**：實作 `Book` 模型讓測試轉綠。
3. **Refactor**：最佳化模型設計與驗證規則；檔案結構整理（Structural）。
4. **Red**：`should_create_sqlite_database_schema`；**Green**：實作資料庫設定。
5. **Red**：`should_import_chrome_extension_json_format`；**Green**：實作JSON匯入服務。
6. **Red**：`should_scan_isbn_barcode_from_camera`；**Green**：整合相機掃描；**Refactor**：權限處理。
7. **Red**：`should_query_google_books_api_with_isbn`；**Green**：Google Books API整合。
8. **Red**：UI整合測試；**Green**：實作核心畫面；**Refactor**：組件抽取與狀態管理。

---

# 跨平台考量與最佳實踐

## Flutter平台特定處理

* **相機權限**：iOS需要`Info.plist`設定，Android需要`manifest`權限
* **檔案選擇**：使用`file_picker`套件支援多平台檔案選取
* **網路請求**：處理平台特定的SSL憑證問題
* **資料庫路徑**：使用`path_provider`取得平台適當的資料庫存放位置

## 效能最佳化

* **大量資料匯入**：使用批量插入和事務處理
* **圖片快取**：實作網路圖片本地快取機制
* **列表虛擬化**：大量書籍列表使用`ListView.builder`
* **API呼叫限制**：實作Google Books API請求頻率控制

## 使用者體驗

* **離線支援**：所有核心功能支援離線使用
* **進度指示**：長時間操作提供進度回饋
* **錯誤處理**：友善的錯誤訊息和恢復建議
* **無障礙支援**：遵循平台無障礙指引

---

# 程式碼品質與 Flutter 特定指引

* **Null Safety**：嚴格遵循Flutter 3.x的null safety規範
* **狀態管理**：
  * 使用Riverpod或Provider管理應用程式狀態
  * UI狀態與業務邏輯分離
  * 非同步操作使用FutureProvider或StreamProvider
* **錯誤處理**：
  * API呼叫錯誤統一處理
  * 網路異常友善提示
  * 資料庫操作事務回滾
* **效能監控**：
  * 使用Flutter DevTools監控效能
  * Widget重建最佳化
  * 記憶體洩漏檢測
* **程式碼組織**：
  * Feature-based資料夾結構
  * Barrel exports減少匯入路徑
  * 依賴注入管理服務實例

---

# 部署與發布考量

## 平台特定設定

* **Android**：
  * 最低SDK版本設定
  * ProGuard設定（Release build）
  * 相機和網路權限設定
* **iOS**：
  * Info.plist權限設定
  * App Store上架準備
  * Xcode專案設定
* **Desktop（Windows/macOS）**：
  * 本地檔案存取權限
  * 系統相機API整合

## CI/CD流程

* **自動化測試**：單元測試、Widget測試、整合測試
* **程式碼品質**：dart analyze、flutter format檢查
* **多平台建置**：GitHub Actions支援多平台並行建置
* **版本管理**：語義化版本控制與自動化發布

---

# 未來擴展性

## 線上同步架構

* **RESTful API**：為未來後端服務預留接口
* **同步狀態管理**：離線優先，上線時同步
* **衝突解決**：Last-write-wins或使用者選擇策略
* **資料加密**：敏感資料端到端加密

## 進階功能

* **書籍推薦**：基於閱讀記錄的推薦系統
* **閱讀統計**：閱讀進度和習慣分析
* **社群功能**：書評分享和讀書會
* **多語言支援**：國際化和本地化框架

---

# Commit 紀律（模板）

* **Structural**：`chore(structure): extract book model and add validation`
* **Behavioral**：`feat(import): support chrome extension json format`
* **Fix**：`fix(scanner): handle camera permission denied`
* **Refactor**：`refactor(database): optimize bulk insert performance`

準則：

1. 所有測試通過再提交；
2. 無dart analyze警告；
3. 單一邏輯單元；
4. 訊息標註Structural/Behavioral，描述意圖而非實作細節。

---

# 里程碑

* **M0**：建立Flutter專案骨架、CI設定、基本導覽（分支保護、Hello World）
* **M1**：Book模型、SQLite資料庫、匯入功能完成
* **M2**：ISBN掃描、Google Books API整合完成
* **M3**：關鍵字搜尋、書庫管理UI完成
* **M4**：跨平台測試、效能最佳化、準備發布
* **M5（可選）**：線上同步準備、進階功能原型

---

# 常見邊界情況

* **網路離線**：所有匯入資料本地可用，API操作提供重試機制
* **相機不可用**：提供手動輸入ISBN的替代方案
* **Google Books API限制**：實作請求頻率控制和fallback機制
* **大檔案匯入**：分批處理避免記憶體溢出
* **重複書籍**：基於ID或ISBN判重，提供合併選項
* **資料遷移**：SQLite schema版本控制和自動遷移
* **跨平台差異**：統一介面抽象平台特定功能

---

# 結語

沿著以上TDD待辦清單，小步遞進完成 Core Models → Services → UI Components → Integration。優先實現與Chrome Extension的相容性，再逐步擴展ISBN掃描和Google Books API功能。所有功能變更均以測試保護，結構調整與行為改動分開提交，確保高品質的跨平台APP開發。
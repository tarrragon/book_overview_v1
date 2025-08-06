# 📚 書籍資料結構擴展設計

**版本**: v0.6.0 規劃  
**建立日期**: 2025-08-06  
**目標**: 為多書城支援設計擴展的書籍資料結構

## 🎯 需求分析

基於多書城擴展規劃，需要對現有書籍資料結構進行以下擴展：

### 核心需求
1. **標籤系統**: 使用者可為書籍新增自定義標籤，並透過標籤篩選
2. **多書城來源**: 標記書籍來源平台，支援實體書標記
3. **使用者元資料**: 完讀時間、是否讀完、心得等個人化資料
4. **增強匯出**: 包含所有新增欄位的完整備份與還原

## 📋 當前書籍資料結構

```javascript
// 現有 Book 物件格式 (v0.5.x)
{
  id: String,              // 唯一識別碼
  platform: 'readmoo',     // 平台識別
  title: String,           // 書籍標題
  author: String,          // 作者
  coverUrl: String,        // 封面圖片 URL
  progress: Number,        // 閱讀進度 (0-100)
  status: String,          // 閱讀狀態
  categories: Array,       // 分類標籤 (現有)
  tags: Array,            // 用戶標籤 (現有但未實現)
  lastRead: Date,         // 最後閱讀時間
  addedDate: Date,        // 加入時間
  metadata: {             // 平台特有資料
    isbn: String,
    publisher: String,
    publishDate: Date,
    pageCount: Number,
    rating: Number
  }
}
```

## 🆕 擴展書籍資料結構

### v0.6.0 目標結構

```javascript
{
  // 現有欄位 (保持相容性)
  id: String,              
  platform: String,       // 擴展：支援多平台
  title: String,           
  author: String,          
  coverUrl: String,        
  progress: Number,        
  status: String,          
  categories: Array,       
  lastRead: Date,         
  addedDate: Date,        

  // 🆕 擴展欄位
  tags: Array,            // 使用者自定義標籤 (增強實現)
  source: {               // 書籍來源資訊
    type: String,         // 'digital' | 'physical'
    platform: String,    // 'readmoo' | 'kindle' | 'kobo' | 'bookwalker' | 'books-com' | 'physical'
    url: String,          // 原始頁面連結 (數位書籍)
    location: String      // 實體書籍位置
  },
  
  userMetadata: {         // 使用者個人資料
    isCompleted: Boolean, // 是否讀完
    completedDate: Date,  // 完讀日期
    rating: Number,       // 個人評分 (1-5)
    notes: String,        // 讀書心得
    readingTime: {        // 閱讀時間統計
      total: Number,      // 總時間 (分鐘)
      sessions: Array     // 閱讀紀錄
    },
    priority: {           // 🆕 新增：優先權重系統
      weight: Number,     // 優先權重 (0-100)
      reason: String,     // 設定理由
      autoAdjust: Boolean, // 是否自動調整
      lastUpdated: Date   // 上次更新時間
    },
    bookmarks: Array,     // 書籤和重點標記
    customFields: Object  // 自定義欄位擴展
  },

  syncStatus: {           // 同步狀態 (多裝置支援)
    lastSync: Date,
    version: Number,
    conflicts: Array
  },

  metadata: {             // 平台元資料 (擴展)
    isbn: String,
    publisher: String,
    publishDate: Date,
    pageCount: Number,
    language: String,
    genre: Array,         // 類型標籤
    originalTitle: String, // 原文書名
    translator: String,   // 譯者
    series: {             // 系列資訊
      name: String,
      volume: Number,
      totalVolumes: Number
    }
  }
}
```

## 🏷 標籤系統設計

### 標籤資料結構
```javascript
{
  id: String,           // 標籤唯一識別碼
  name: String,         // 標籤名稱
  color: String,        // 顏色 (#hex)
  description: String,  // 說明
  createdDate: Date,    // 建立日期
  usageCount: Number,   // 使用次數
  isSystem: Boolean     // 是否為系統標籤
}
```

### 系統預設標籤
- **閱讀狀態**: 想讀、閱讀中、已完成、暫停、放棄
- **類型分類**: 小說、散文、詩集、傳記、教學、工具書
- **評價標籤**: 推薦、精選、收藏、重讀
- **來源標籤**: 購買、借閱、贈送、試讀

### 標籤管理功能
- 新增/編輯/刪除自定義標籤
- 標籤顏色和圖示設定
- 批量標籤操作
- 標籤使用統計和建議
- 標籤匯入/匯出

## 🌐 多平台來源管理

### 支援的平台類型
```javascript
const PLATFORM_TYPES = {
  // 數位平台
  READMOO: 'readmoo',
  KINDLE: 'kindle', 
  KOBO: 'kobo',
  BOOKWALKER: 'bookwalker',
  BOOKS_COM: 'books-com',
  
  // 實體書籍
  PHYSICAL: 'physical',
  
  // 其他來源
  LIBRARY: 'library',      // 圖書館
  BORROWED: 'borrowed',    // 借閱
  GIFT: 'gift'            // 贈送
};
```

### 來源資訊管理
- 自動偵測和標記數位平台
- 手動新增實體書籍資訊
- 支援多來源同一書籍 (數位+實體)
- 來源統計和視覺化
- 來源備份和同步

## 👤 使用者元資料設計

### 閱讀進度追蹤
```javascript
readingTime: {
  total: 1250,           // 總閱讀時間 (分鐘)
  sessions: [            // 閱讀記錄
    {
      date: Date,
      duration: Number,   // 時長 (分鐘)
      startProgress: Number,
      endProgress: Number,
      platform: String
    }
  ],
  averageSpeed: Number,  // 平均閱讀速度 (頁/分鐘)
  estimatedRemaining: Number // 預估剩餘時間
}
```

### 個人評價系統
- 5 星評分系統
- 標籤式快速評價
- 詳細心得筆記
- 推薦指數
- 重讀意願

### 書籤和標註
```javascript
bookmarks: [
  {
    id: String,
    type: 'bookmark' | 'highlight' | 'note',
    position: Number,    // 頁面或章節位置
    content: String,     // 標註內容
    note: String,        // 個人備註
    createdDate: Date,
    tags: Array         // 標註標籤
  }
]
```

## 📊 資料遷移策略

### 向後相容性
- 現有 v0.5.x 資料完全相容
- 新欄位採用可選設計
- 自動資料結構升級
- 降級支援 (移除不支援欄位)

### 資料遷移流程
1. **檢測資料版本**: 識別現有資料結構版本
2. **備份原始資料**: 建立安全備份
3. **結構升級**: 新增新欄位並設定預設值
4. **資料驗證**: 確認遷移完整性
5. **索引重建**: 更新搜尋和篩選索引

### 遷移腳本
```javascript
class DataMigration {
  async migrateFrom_0_5_to_0_6(books) {
    return books.map(book => ({
      ...book,
      source: {
        type: 'digital',
        platform: book.platform || 'readmoo',
        url: book.metadata?.originalUrl || '',
        location: ''
      },
      userMetadata: {
        isCompleted: book.progress === 100,
        completedDate: book.progress === 100 ? book.lastRead : null,
        rating: null,
        notes: '',
        readingTime: { total: 0, sessions: [] },
        bookmarks: [],
        customFields: {}
      },
      syncStatus: {
        lastSync: new Date(),
        version: 1,
        conflicts: []
      }
    }));
  }
}
```

## 🔍 搜尋和篩選增強

### 新增篩選維度
- **標籤篩選**: 支援多標籤組合篩選
- **來源篩選**: 按平台和書籍類型
- **評分篩選**: 個人評分區間
- **完成狀態**: 已讀/未讀/閱讀中
- **時間範圍**: 新增日期、完讀日期

### 搜尋功能擴展
- **全文搜尋**: 包含心得和書籤內容
- **標籤搜尋**: 智能標籤建議
- **元資料搜尋**: ISBN、出版社、系列
- **模糊搜尋**: 容忍拼寫錯誤
- **搜尋歷史**: 常用搜尋條件儲存

## 📤 匯出功能增強

### 支援格式擴展
- **CSV 增強**: 包含所有新增欄位
- **JSON 完整**: 完整資料結構匯出
- **Excel 格式**: 多工作表結構化匯出
- **PDF 報告**: 閱讀統計和心得整理

### 匯出選項
```javascript
const EXPORT_OPTIONS = {
  fields: {
    basic: ['title', 'author', 'progress', 'status'],
    extended: ['tags', 'source', 'userMetadata'],
    complete: 'all'
  },
  formats: {
    csv: { delimiter: ',', encoding: 'utf-8' },
    json: { pretty: true, compression: false },
    excel: { multiSheet: true, charts: true }
  },
  filters: {
    dateRange: [startDate, endDate],
    platforms: ['readmoo', 'kindle'],
    tags: ['已完成', '推薦'],
    completedOnly: Boolean
  }
};
```

## ⚡ 效能考量

### 資料結構優化
- **索引策略**: 標籤、來源、評分的複合索引
- **快取機制**: 常用篩選結果快取
- **分頁載入**: 大量書籍的分批處理
- **壓縮儲存**: 心得和書籤的壓縮儲存

### 記憶體管理
- **惰性載入**: 詳細資料按需載入
- **虛擬滾動**: UI 層級的效能優化
- **背景處理**: 搜尋和統計的背景計算
- **資料清理**: 定期清理無用資料

## 🔄 開發階段規劃

### Phase 1: 基礎標籤系統 (v0.6.1)
- [ ] 標籤資料結構設計
- [ ] 標籤 CRUD 功能
- [ ] 基礎標籤篩選
- [ ] 標籤 UI 組件

### Phase 2: 多平台來源 (v0.6.2)  
- [ ] 來源資訊資料結構
- [ ] 平台識別和標記
- [ ] 實體書籍支援
- [ ] 來源管理 UI

### Phase 3: 使用者元資料 (v0.6.3)
- [ ] 個人評價系統
- [ ] 完讀狀態管理
- [ ] 心得和書籤功能
- [ ] 閱讀統計追蹤

### Phase 4: 優先權重系統 (v0.6.4)
- [ ] 書籍優先權重設定
- [ ] 未完讀書籍智能排序
- [ ] 權重調整建議系統
- [ ] 優先級 UI 組件

### Phase 5: 匯出增強 (v0.6.5)
- [ ] 新格式匯出支援
- [ ] 完整備份和還原
- [ ] 匯出選項界面
- [ ] 資料驗證機制

---

**設計負責人**: 開發團隊  
**審核週期**: 每個 Phase 完成後檢視  
**相容性**: 向後完全相容 v0.5.x
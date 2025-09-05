# 📚 技術文件導覽中心

> **適用於**: v0.10.x Readmoo 書庫管理器  
> **目標讀者**: 新加入工程師、架構設計師、維護工程師  
> **更新日期**: 2025-09-05

---

## 🎯 三層漸進式閱讀路徑

### 📖 **第一層：必讀核心文件** (30分鐘快速上手)

**適用對象**: 所有新加入的工程師

| 優先級 | 文件 | 用途 | 預計時間 |
|--------|------|------|----------|
| 🔴 **P0** | [快速上手指南](./01-getting-started/README.md) | 專案概覽、開發環境、基本概念 | 10分鐘 |
| 🔴 **P0** | [核心架構總覽](./01-getting-started/core-architecture.md) | v0.10.x 架構理念、關鍵設計決策 | 10分鐘 |
| 🔴 **P0** | [標準化錯誤處理](./01-getting-started/error-handling-overview.md) | 0.10版本重大更新、統一異常處理 | 10分鐘 |

### 🔧 **第二層：開發實戰文件** (1-2小時深入理解)

**適用對象**: 需要實際開發的工程師

| 領域 | 主要文件 | 說明 |
|------|----------|------|
| **架構設計** | [02-development/architecture/](./02-development/architecture/) | 領域驅動設計、事件系統、模組規劃 |
| **開發流程** | [02-development/workflows/](./02-development/workflows/) | TDD流程、Git規範、程式碼審查 |
| **測試策略** | [02-development/testing/](./02-development/testing/) | 測試框架、覆蓋率、TDD實踐 |
| **API設計** | [02-development/api/](./02-development/api/) | 內部API、事件接口、資料格式 |

### 🎓 **第三層：專業參考文件** (按需深度查閱)

**適用對象**: 架構師、資深工程師、特定領域專家

| 專業領域 | 文件集 | 使用時機 |
|----------|--------|----------|
| **效能優化** | [03-reference/performance/](./03-reference/performance/) | 效能分析、記憶體優化、載入優化 |
| **部署維運** | [03-reference/deployment/](./03-reference/deployment/) | Chrome Store 上架、CI/CD、版本發布 |
| **重構指南** | [03-reference/refactoring/](./03-reference/refactoring/) | 代碼品質、債務管理、重構案例 |
| **問題診斷** | [03-reference/troubleshooting/](./03-reference/troubleshooting/) | 常見問題、錯誤診斷、解決方案 |
| **歷史歸檔** | [03-reference/archive/](./03-reference/archive/) | 版本演進、設計決策記錄、棄用功能 |

---

## 🚀 **新人上手建議路徑**

### **🏃 15分鐘快速啟動** (緊急情況)
1. [快速上手指南](./01-getting-started/README.md) - 環境設定和基本概念
2. [開發環境配置](./02-development/workflows/development-setup.md) - 立即開始開發

### **📚 1小時完整入門** (推薦)
1. **第一層**: 完整閱讀三個核心文件 (30分鐘)
2. **第二層**: 根據角色選擇相關領域文件 (30分鐘)
   - 後端開發者 → 架構設計 + API設計  
   - 前端開發者 → 架構設計 + 測試策略
   - 全端開發者 → 架構設計 + 開發流程

### **🎯 角色導向學習路徑**

#### **新加入後端工程師**
```
第一層 (必讀) → 架構設計 → API設計 → 錯誤處理系統 → 開始開發
```

#### **新加入前端工程師**
```  
第一層 (必讀) → 架構設計 → UI/UX指南 → 事件系統 → 開始開發
```

#### **架構師/Tech Lead**
```
第一層 (快速掃描) → 第二層 (全部) → 第三層 (重點領域) → 決策制定
```

---

## 📖 **文件維護規範**

### **分層維護責任**
- **第一層**: 專案負責人維護，變更需要 Tech Lead 審核
- **第二層**: 領域專家維護，變更需要同儕審核  
- **第三層**: 作者自維護，鼓勵但不強制更新

### **內容更新原則**
- **第一層**: 每個大版本更新 (v0.10.x → v0.11.x)
- **第二層**: 功能完成時同步更新
- **第三層**: 重大重構時清理歸檔

---

## 🔍 **快速搜尋**

### **按問題類型查找**
- 🔥 **環境問題**: [開發環境配置](./02-development/workflows/development-setup.md)
- 🐛 **錯誤診斷**: [問題診斷指南](./03-reference/troubleshooting/README.md)  
- 🏗️ **架構設計**: [架構設計文件](./02-development/architecture/README.md)
- 🧪 **測試問題**: [測試策略指南](./02-development/testing/README.md)
- 📊 **效能優化**: [效能優化文件](./03-reference/performance/README.md)

### **按技術關鍵字查找**
- **錯誤處理**: [標準化錯誤處理](./01-getting-started/error-handling-overview.md)
- **事件系統**: [事件驅動架構](./02-development/architecture/event-system.md)
- **領域設計**: [DDD設計](./02-development/architecture/domain-design.md)  
- **Chrome Extension**: [部署指南](./03-reference/deployment/chrome-extension.md)
- **TDD開發**: [TDD流程](./02-development/workflows/tdd-process.md)

---

## 🤝 **參與貢獻**

### **文件改善建議**
1. 發現文件過時或錯誤 → 創建 GitHub Issue
2. 想要補充內容 → 創建 Pull Request
3. 建議架構改善 → 聯繫 Tech Lead

### **新文件規範**
- 第一層文件：需要團隊討論後新增
- 第二層文件：按照領域模板創建  
- 第三層文件：自由創建，但需要適當分類

---

**📧 文件維護聯繫**: 如有問題請查閱 [文件維護指南](./03-reference/maintenance/README.md)
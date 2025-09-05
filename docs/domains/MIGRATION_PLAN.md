# 📋 文件重組遷移計劃

> **執行日期**: 2025-09-05  
> **影響範圍**: `docs/domains/` 完整重組  
> **負責人**: 文件架構師

---

## 🎯 重組目標

### **解決當前問題**
- ❌ **分類過於細散**: 12個領域文件夾內容重疊
- ❌ **缺乏清晰層級**: 新工程師不知從何讀起
- ❌ **導覽困難**: 雖有 README 但缺乏統一引導
- ❌ **重要性不明**: 核心文件與歷史文件混雜

### **新架構優勢**
- ✅ **三層漸進式**: 30分鐘上手 → 1-2小時深入 → 按需專業查閱
- ✅ **角色導向**: 不同角色有明確的學習路徑
- ✅ **引導性強**: 每層都有明確的學習目標和檢驗標準
- ✅ **維護友善**: 分層維護責任，降低維護成本

---

## 🗂️ 文件映射表

### **第一層：必讀核心文件 (新建)**

| 新位置 | 內容來源 | 狀態 |
|--------|----------|------|
| `01-getting-started/README.md` | 全新編寫 | ✅ 已完成 |
| `01-getting-started/core-architecture.md` | 全新編寫 | ✅ 已完成 |
| `01-getting-started/error-handling-overview.md` | 全新編寫 | ✅ 已完成 |

### **第二層：開發實戰文件 (重組現有)**

| 新位置 | 原始位置 | 處理方式 |
|--------|----------|----------|
| **架構設計領域** | | |
| `02-development/architecture/domain-design.md` | `architecture/domain-architecture-v2-design.md` | 📝 重寫摘要版 |
| `02-development/architecture/event-system.md` | `architecture/event-system.md` | 📝 重寫摘要版 |
| `02-development/architecture/modular-design.md` | 全新編寫 + 多個架構文件綜合 | 🆕 新建 |
| **開發流程領域** | | |
| `02-development/workflows/tdd-process.md` | 來自 `../claude/tdd-collaboration-flow.md` | 📋 整理編輯 |
| `02-development/workflows/git-workflow.md` | 來自 `../CLAUDE.md` 提交流程部分 | 📋 提取重組 |
| `02-development/workflows/code-review.md` | 全新編寫 | 🆕 新建 |
| **測試策略領域** | | |
| `02-development/testing/test-pyramid.md` | `testing/` 多個文件綜合 | 📝 綜合重寫 |
| `02-development/testing/extension-testing.md` | `testing/` Chrome Extension 相關文件 | 📋 整理編輯 |
| `02-development/testing/testing-tools.md` | 全新編寫 | 🆕 新建 |
| **API 設計領域** | | |
| `02-development/api/internal-api.md` | `api/API.md` | 📝 重寫摘要版 |
| `02-development/api/event-interfaces.md` | `architecture/event-system*.md` | 📋 提取重組 |
| `02-development/api/data-formats.md` | 全新編寫 | 🆕 新建 |

### **第三層：專業參考文件 (遷移現有)**

| 新位置 | 原始位置 | 處理方式 |
|--------|----------|----------|
| **效能優化專區** | | |
| `03-reference/performance/` | `performance/` | 📦 直接遷移 |
| `03-reference/performance/monitoring-system.md` | 全新編寫 | 🆕 新建 |
| **部署維運專區** | | |
| `03-reference/deployment/` | `deployment/` | 📦 直接遷移 |
| `03-reference/deployment/chrome-store-guide.md` | `deployment/DEPLOYMENT.md` | 📝 重寫擴充 |
| **重構指南專區** | | |
| `03-reference/refactoring/` | `refactoring/` | 📦 直接遷移 |
| `03-reference/refactoring/refactoring-decision-tree.md` | 全新編寫 | 🆕 新建 |
| **問題診斷專區** | | |
| `03-reference/troubleshooting/common-issues.md` | `error-handling/USER_ERROR_GUIDE.md` | 📝 擴充重寫 |
| `03-reference/troubleshooting/extension-specific-issues.md` | `error-handling/extension-contexts-and-error-handling.md` | 📋 整理編輯 |
| **歷史歸檔專區** | | |
| `03-reference/archive/` | `archive/` | 📦 直接遷移 |
| `03-reference/archive/architecture-decision-records.md` | `analysis/` 相關 ADR 文件 | 📋 綜合整理 |
| **文件維護專區** | | |
| `03-reference/maintenance/documentation-maintenance.md` | 全新編寫 | 🆕 新建 |

### **需要淘汰的文件**

| 原始位置 | 淘汰原因 | 處理方式 |
|----------|----------|----------|
| `context/` | 內容過於內部化，缺乏通用價值 | 🗑️ 移入歷史歸檔 |
| `guidelines/` | 內容零散，已整合到對應領域 | 📋 內容分散整合 |
| 重複的 analysis 文件 | 與架構文件重複 | 🔄 合併到架構領域 |

---

## 📅 遷移執行計劃

### **Phase 1: 基礎架構建立 (已完成)**
- ✅ 創建新的三層目錄結構
- ✅ 編寫第一層核心文件 (3個文件)
- ✅ 建立各層的 README 導覽文件
- ✅ 創建統一的文件導覽中心

### **Phase 2: 第二層文件建設 (執行中)**

**優先級 P0 (必須完成)**:
- [ ] `02-development/architecture/domain-design.md`
- [ ] `02-development/architecture/event-system.md` 
- [ ] `02-development/workflows/tdd-process.md`
- [ ] `02-development/testing/test-pyramid.md`

**優先級 P1 (重要)**:
- [ ] `02-development/workflows/git-workflow.md`
- [ ] `02-development/api/internal-api.md`
- [ ] `02-development/testing/extension-testing.md`

**優先級 P2 (可延後)**:
- [ ] 其餘第二層文件

### **Phase 3: 第三層文件遷移 (按需執行)**

**立即處理**:
- [ ] 遷移 `performance/` → `03-reference/performance/`
- [ ] 遷移 `deployment/` → `03-reference/deployment/`
- [ ] 遷移 `archive/` → `03-reference/archive/`

**按需處理**:
- [ ] 創建新的專業參考文件
- [ ] 整理和歸檔低價值文件

### **Phase 4: 清理和優化**

- [ ] 移除舊的目錄結構
- [ ] 更新所有文件內部連結
- [ ] 測試新的導覽體驗
- [ ] 收集使用反饋並優化

---

## 🔄 連結更新策略

### **內部連結更新**

由於文件位置大幅調整，需要系統性更新所有內部連結：

```bash
# 需要更新的主要文件
docs/README.md              # 更新 Domain 入口索引
docs/struct.md              # 更新架構文件引用
docs/todolist.md            # 更新相關文件連結
docs/use-cases.md           # 更新參考文件連結
```

### **連結重定向策略**

為了保持向後相容性：

1. **保留舊路徑**: 暫時保留舊目錄結構 30 天
2. **添加重定向說明**: 在舊文件中添加新位置指引
3. **漸進式清理**: 確認無引用後再刪除舊文件

---

## 📊 成功指標

### **量化指標**

| 指標 | 目標值 | 測量方式 |
|------|--------|----------|
| **新人上手時間** | 從 2小時降到 30分鐘 | 新人上手時間統計 |
| **文件查找時間** | 從 10分鐘降到 2分鐘 | 常見問題查找計時 |
| **文件維護效率** | 維護時間減少 60% | 文件更新所需時間 |
| **使用滿意度** | 滿意度 > 80% | 開發者調查問卷 |

### **質化指標**

- ✅ **學習路徑清晰**: 不同角色都有明確的學習順序
- ✅ **內容層次分明**: 核心概念 vs 深度專業內容區分清楚
- ✅ **維護責任明確**: 每層文件都有明確的維護負責人
- ✅ **使用體驗良好**: 能夠快速找到需要的資訊

---

## ⚠️ 風險與應對

### **主要風險**

| 風險 | 影響 | 應對策略 |
|------|------|----------|
| **連結失效** | 影響現有文件使用 | 保留舊結構 30 天，添加重定向 |
| **內容遺失** | 重要資訊丟失 | 完整的映射表和備份策略 |
| **學習成本** | 團隊適應新結構需要時間 | 提供遷移指南和培訓 |
| **維護負荷** | 初期維護工作量大 | 分階段執行，優先處理核心文件 |

### **應急計劃**

- **回滾方案**: 保留完整的舊結構備份，可快速回滾
- **漸進遷移**: 新舊結構並存一段時間，確保平滑過渡
- **社群支援**: 建立遷移期間的技術支援管道

---

## 🤝 執行分工

### **執行責任分配**

| 階段 | 負責人 | 工作內容 |
|------|--------|----------|
| **Architecture** | Tech Lead | 第二層架構文件編寫 |
| **Workflows** | Senior Developer | 第二層開發流程文件 |
| **Testing** | QA Lead | 第二層測試文件 |
| **API Design** | API Designer | 第二層 API 文件 |
| **Migration** | Documentation Team | 第三層文件遷移 |
| **Review** | All Team Members | 內容審核和反饋 |

### **時間規劃**

- **Week 1**: Phase 2 優先級 P0 文件完成
- **Week 2**: Phase 2 優先級 P1 文件完成  
- **Week 3**: Phase 3 文件遷移
- **Week 4**: Phase 4 清理和優化

---

## 📈 後續改進計劃

### **持續優化**

1. **使用分析**: 定期分析文件使用情況，優化內容和結構
2. **反饋收集**: 建立文件反饋機制，持續改進用戶體驗
3. **內容更新**: 隨著專案發展同步更新文件內容
4. **工具改進**: 探索更好的文件管理和導覽工具

### **擴展計劃**

- **互動式教學**: 考慮添加互動式教學元素
- **影片教學**: 為複雜主題製作影片說明
- **社群貢獻**: 建立開放的文件貢獻機制
- **自動化**: 自動生成部分文件內容 (API 文件等)

---

**🎯 執行原則**: 漸進式遷移，確保文件系統在重組過程中始終可用，優先保證核心文件的可訪問性。
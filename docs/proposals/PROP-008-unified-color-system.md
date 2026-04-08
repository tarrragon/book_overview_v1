---
id: PROP-008
title: "統一 UI Design System（從 APP 專案移植）"
status: draft
proposed: "2026-04-08"
confirmed: null
source: cross-project
target_version: "v0.17.x ~ v0.20.x（分階段）"
reference: "Flutter App 專案 lib/core/ui/ui_config.dart + flat_design_config.dart"
---

# PROP-008: 統一 UI Design System（從 APP 專案移植）

## 1. 問題陳述

### 1.1 發現背景

W2-007.2 Tag 顯示元件實作中，測試硬編碼 `rgb(233, 30, 99)` 驗證色彩，與 fixture 的 `#e91e63` 語義斷裂。深入調查發現 Chrome Extension 專案缺乏統一的 UI 設計系統，而 APP 專案（Flutter）已有完整的 Design System。

### 1.2 Chrome Extension 現況

| 指標 | 數值 |
|------|------|
| 硬編碼色值總數 | 89+ |
| 涉及檔案數 | 10+ |
| 重複定義的色值 | 7+ 組 |
| CSS Variables 數量 | 0 |
| 統一設計規格文件 | 無 |
| Status 色彩缺口 | 3/6 未實作 |

### 1.3 根本問題

Chrome Extension 和 Flutter APP 是同一產品的兩個平台，但：
- Extension 沒有設計系統，色彩、按鈕、間距全部硬編碼散落各處
- APP 已有完整的 8 子系統設計規格（UIColors / UISpacing / UIBorderRadius / ...）
- 兩個平台的視覺語言不一致（Extension 用紫色梯度 #667eea，APP 用藍色系 #2196F3）
- Spec 文件自行定義色彩 → CSS 硬編碼 → test 硬編碼 → 三層各自獨立

---

## 2. APP 專案已有的設計系統（基準）

來源：`~/project/book_overview_app/lib/core/ui/`

### 2.1 配色系統（UIColors）

**三色系統原則**：藍色主調 90% / 綠色正向 5% / 橘色負面 5%

| 分類 | 色彩 | 色值 | 用途 |
|------|------|------|------|
| **藍色主色調** | primary | `#2196F3` | 主要按鈕、連結 |
| | primaryLightest | `#E3F2FD` | 背景區塊 |
| | primaryLight | `#BBDEFB` | 次要區塊、neutral 按鈕 |
| | primaryMedium | `#64B5F6` | 互動元素 |
| | primaryDark | `#1976D2` | 選中狀態 |
| | primaryDarkest | `#0D47A1` | 重點文字 |
| **正向色** | positive | `#4CAF50` | 成功、確認、完成 |
| | positiveLight | `#C8E6C9` | 正向背景 |
| | positiveDark | `#388E3C` | 正向強調 |
| **負面色** | negative | `#FF9800` | 警告、錯誤、刪除 |
| | negativeLight | `#FFE0B2` | 負面背景 |
| | negativeDark | `#F57C00` | 負面強調 |
| **背景/表面** | backgroundLight | `#FAFAFA` | 主背景 |
| | surfaceLight | `#FFFFFF` | 卡片表面 |
| | onBackgroundLight | `#212121` | 主文字 |
| | onSurfaceLight | `#424242` | 次要文字 |
| | onSurfaceMuted | `#757575` | 輔助文字 |

### 2.2 語意化按鈕系統（FlatDesignConfig）

| 按鈕類型 | 語意 | 色彩 | 使用場景 |
|---------|------|------|---------|
| **action** | 一般操作 | 藍色 primary | 儲存、提交、執行 |
| **confirm** | 正向確認 | 綠色 positive | 確認、完成、同意 |
| **caution** | 警告操作 | 橘色 negative | 刪除、移除、取消訂閱 |
| **neutral** | 中性資訊 | 淺藍 primaryLight | 取消、關閉、返回 |
| **ghost** | 輔助低調 | 透明 | 了解更多、輔助連結 |

### 2.3 間距系統（UISpacing）

基於 4dp 網格：

| Token | 值 | 用途 |
|-------|-----|------|
| xxs | 2dp | 最小間距 |
| xs | 4dp | 緊湊元素 |
| sm | 8dp | 按鈕 padding |
| md | 16dp | 標準內容間距 |
| lg | 24dp | 區塊間距 |
| xl | 32dp | 大區塊間距 |
| xxl | 48dp | 頁面級間距 |

### 2.4 圓角系統（UIBorderRadius）

| Token | 值 | 用途 |
|-------|-----|------|
| xs | 4dp | 小圓角（tag chip） |
| sm | 8dp | 標準圓角（按鈕、輸入框） |
| md | 12dp | 中等圓角（卡片） |
| lg | 16dp | 大圓角（對話框） |
| xl | 20dp | 特大圓角 |
| circular | 999dp | 圓形（頭像） |

### 2.5 元件尺寸（UIComponentSizes）

| 元件 | Small | Medium | Large |
|------|-------|--------|-------|
| 按鈕高度 | 36dp | 48dp | 56dp |
| 輸入框高度 | - | 48dp | 56dp |
| 圖示 | 16sp | 24sp | 32sp |

### 2.6 陰影系統（UIShadows — 石碑刻痕風格）

| 陰影類型 | 用途 |
|---------|------|
| card | 卡片浮起效果 |
| button | 按鈕互動效果 |
| floating | 浮動選單、FAB |
| dialog | 對話框 |
| raised | 凸起效果（預設狀態） |
| inset | 凹陷效果（選中/按下） |
| engraved | 刻痕效果（區塊分隔） |

### 2.7 設計原則

1. **平面化設計**：使用陰影取代邊框，石碑刻痕風格
2. **三色系統**：藍 90% / 綠 5% / 橘 5%，選色反映語意
3. **語意化命名**：命名反映使用意圖（action/confirm/caution），而非視覺層級（primary/secondary）
4. **4dp 網格**：所有間距為 4 的倍數

---

## 3. 提議方案

### 3.1 建立 Extension 端的 Design System

不是照搬 Flutter 程式碼（API 完全不同），而是**移植設計規格值**，用 JavaScript + CSS 重新表達。

```
src/core/design-system/
  ├── colors.js          # 配色系統（對齊 UIColors）
  ├── spacing.js         # 間距系統（對齊 UISpacing）
  ├── typography.js      # 字體系統（對齊 UITypography）
  ├── components.js      # 元件尺寸（對齊 UIComponentSizes）
  └── index.js           # 統一匯出

src/core/design-system/
  └── design-system.css  # CSS Variables 定義
```

### 3.2 colors.js 內容（對齊 APP UIColors）

```javascript
const COLORS = {
  // 藍色主色調系統（對齊 UIColors）
  primary:         '#2196F3',  // 標準藍 - 主要按鈕
  primaryLightest: '#E3F2FD',  // 最淺藍 - 背景區塊
  primaryLight:    '#BBDEFB',  // 淺藍 - 次要區塊
  primaryMedium:   '#64B5F6',  // 中藍 - 互動元素
  primaryDark:     '#1976D2',  // 深藍 - 選中狀態
  primaryDarkest:  '#0D47A1',  // 最深藍 - 重點文字

  // 正向色 - 綠色
  positive:      '#4CAF50',
  positiveLight: '#C8E6C9',
  positiveDark:  '#388E3C',

  // 負面色 - 橘色
  negative:      '#FF9800',
  negativeLight: '#FFE0B2',
  negativeDark:  '#F57C00',

  // 背景/表面
  background:      '#FAFAFA',
  surface:         '#FFFFFF',
  onBackground:    '#212121',
  onSurface:       '#424242',
  onSurfaceMuted:  '#757575',

  // Tag 預設色
  tagDefault: '#808080'
}
```

### 3.3 與 APP 專案的差異處理

| 面向 | APP（Flutter） | Extension（Chrome） | 處理方式 |
|------|---------------|--------------------|---------| 
| 色值 | 相同 | 相同 | 直接複用 |
| 單位 | dp/sp（ScreenUtil） | px/rem | 數值相同，單位轉換 |
| 陰影 | BoxShadow | CSS box-shadow | 值轉換為 CSS 語法 |
| 響應式 | ScreenUtil + LayoutType | CSS media queries | Chrome Extension 不需要（固定尺寸） |
| 石碑刻痕效果 | Flutter widget | CSS box-shadow | 轉換為 CSS |

### 3.4 ReadingStatus 色彩對齊

現有 spec 定義的 6 狀態色彩需要審視是否與 APP 設計系統一致：

| 狀態 | 現有 spec 色值 | APP 設計語意 | 建議 |
|------|--------------|------------|------|
| unread | `#1976D2` | primaryDark | 保持（藍色系語意正確） |
| reading | `#F57C00` | negativeDark | 需討論（閱讀中是否應該用負面色？） |
| finished | `#388E3C` | positiveDark | 保持（完成是正向色語意正確） |
| queued | `#7B1FA2`（紫） | 無對應 | 需討論（超出三色系統） |
| abandoned | `#757575`（灰） | onSurfaceMuted | 保持（灰色表示非活躍） |
| reference | `#00838F`（青） | 無對應 | 需討論（超出三色系統） |

**衝突點**：APP 的三色系統（藍/綠/橘）無法涵蓋 queued（紫）和 reference（青）。需要討論：
1. 是否沿用三色系統，將 queued/reference 映射到現有色系？
2. 或者 Status 色彩作為獨立的功能色，允許超出三色系統？

---

## 4. 分階段實施建議

### Phase 1：建立基礎 + 常數化（v0.17.x）

| 任務 | 說明 |
|------|------|
| 建立 `src/core/design-system/colors.js` | 從 APP UIColors 移植色值 |
| 建立 `src/core/design-system/spacing.js` | 從 APP UISpacing 移植間距 |
| 合併 3 個重複 DEFAULT_COLOR | 統一引用 `colors.tagDefault` |
| ThemeManagementService 改為引用 design-system | 消除重複定義 |
| 補齊 Status 色彩 CSS | 新增 queued/abandoned/reference |

**風險**：低（純常數化，行為不變）

### Phase 2：CSS Variables + 語意化按鈕（v0.18.x+）

| 任務 | 說明 |
|------|------|
| 建立 `design-system.css` | `:root` CSS Variables |
| 更新 overview.css / popup.html | 硬編碼色值 → `var(--color-xxx)` |
| 定義 5 種語意化按鈕 CSS class | action/confirm/caution/neutral/ghost |
| 定義間距和圓角 CSS Variables | `--spacing-sm`, `--radius-md` 等 |

**風險**：中（CSS 重構需視覺回歸測試）

### Phase 3：完整 Design System（v0.20.x+）

| 任務 | 說明 |
|------|------|
| Dark Mode CSS | `prefers-color-scheme` 媒體查詢 |
| 陰影系統 CSS | 石碑刻痕效果轉換為 CSS |
| Tag Category 預定義調色盤 | 8-12 個預設色供選擇 |
| Spec 文件全面更新 | 所有色彩/間距引用統一指向 design-system |

**風險**：中高（多層重構）

---

## 5. 不做的事

| 排除項目 | 原因 |
|---------|------|
| 照搬 Flutter 程式碼 | API 完全不同，只移植設計值 |
| ScreenUtil 響應式 | Chrome Extension popup/overview 是固定尺寸 |
| Tailwind/CSS-in-JS | Chrome Extension 環境不適合 |
| 重新設計配色 | 複用 APP 已定義的配色，不重新發明 |

---

## 6. 討論要點

1. **Status 色彩衝突**：queued（紫）和 reference（青）超出 APP 的三色系統，如何處理？
   - 選項 A：沿用三色系統，重新映射這兩個狀態到藍/綠/橘
   - 選項 B：Status 色彩作為功能色例外，允許超出三色系統
2. **reading 狀態色**：APP 的 `#F57C00` 是 negativeDark，但「閱讀中」不是負面語意。是否需要重新選色？
3. **現有品牌梯度**：Extension 使用的紫色梯度（`#667eea` → `#764ba2`）不在 APP 色系中，是否要替換為藍色系？
4. **Phase 1 版本歸屬**：歸入 v0.17.x 當前版本，還是 v0.18.x？
5. **CSS Variables 注入方式**：頁面載入時 JS 注入，還是建置時生成 CSS 檔案？

---

## 7. 相關文件

| 文件 | 關聯 |
|------|------|
| APP `lib/core/ui/ui_config.dart` | 配色/間距/圓角/陰影/元件尺寸基準 |
| APP `lib/core/ui/flat_design_config.dart` | 語意化按鈕/卡片/對話框規格 |
| APP `docs/ui_design_specification.md` | UI 設計規格文件 |
| Extension `src/background/.../theme-management-service.js` | 現有主題色定義（待替換） |
| Extension `docs/spec/overview-tag-display-spec.md` | Status/Tag 色彩規格 |
| PROP-007 | Tag-based Model 重構 |

---

## 變更歷史

| 版本 | 日期 | 變更內容 |
|------|------|---------|
| 1.0 | 2026-04-08 | 初始建立（僅配色系統） |
| 2.0 | 2026-04-08 | 升級為完整 UI Design System，納入 APP 專案設計規格作為基準 |

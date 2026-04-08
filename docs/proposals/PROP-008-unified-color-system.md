---
id: PROP-008
title: "統一配色系統（Design Tokens）"
status: draft
proposed: "2026-04-08"
confirmed: null
source: development
target_version: "v0.17.x ~ v0.20.x（分階段）"
---

# PROP-008: 統一配色系統（Design Tokens）

## 1. 問題陳述

### 1.1 發現背景

W2-007.2 Tag 顯示元件實作中，測試需要驗證 tag chip 的色彩。發現測試端硬編碼 `rgb(233, 30, 99)`（JSDOM 轉換後的值），而 fixture 定義的是 `#e91e63`，兩者語義斷裂。深入調查後發現這是系統性問題。

### 1.2 現況數據

| 指標 | 數值 |
|------|------|
| 硬編碼色值總數 | 89+ |
| 涉及檔案數 | 10+ |
| 重複定義的色值 | 7+ 組 |
| CSS Variables 數量 | 0 |
| Status 色彩缺口 | 3/6 未實作（queued/abandoned/reference） |

### 1.3 重複定義清單

| 色值 | 重複次數 | 出現位置 |
|------|---------|----------|
| `#808080`（預設灰） | 3 | TagSchema.js, tag-storage-adapter.js, tag-resolver.js |
| `#667eea`（品牌紫） | 4 | overview.css (3 處), popup.html |
| `#764ba2`（品牌深紫） | 2 | overview.css, popup.html |
| `#f5f5f5`（背景灰） | 3 | overview.css, popup.html, style.css |
| `#007AFF`（主色藍） | 2 | theme-management-service.js (light + dark) |
| `#333`（文字黑） | 6+ | 多處 CSS |
| `#ddd`（邊框灰） | 5+ | 多處 CSS |

### 1.4 根本問題

```
目前：spec 自行定義色彩 → CSS 硬編碼 → test 硬編碼 → 各層獨立，無法驗證一致性

應有：配色表（常數）→ spec 引用 → source 引用 → test 引用 → 驗證「實作是否正確使用配色表」
```

---

## 2. 現有基礎

專案並非從零開始。以下已有的機制可作為統一配色的基礎：

### 2.1 ThemeManagementService（最規範的色彩定義）

路徑：`src/background/domains/user-experience/services/theme-management-service.js` L59-100

```javascript
// Light 主題 9 色
{ primary: '#007AFF', background: '#FFFFFF', surface: '#F2F2F7',
  text: '#000000', textSecondary: '#8E8E93', border: '#C6C6C8',
  success: '#34C759', warning: '#FF9500', error: '#FF3B30' }

// Dark 主題 9 色（同結構，值不同）
```

**評估**：結構良好，但僅供 Service Worker 使用，CSS/HTML 層未連動。

### 2.2 TagSchema DEFAULT_COLOR

路徑：`src/data-management/TagSchema.js` L18

已常數化為 `const DEFAULT_COLOR = '#808080'`，但另外 2 處重複定義。

### 2.3 Status 色彩（Spec 已定義，CSS 部分實作）

`docs/spec/overview-tag-display-spec.md` 定義了 6 狀態色彩，但 `overview.css` 只實作了 unread/reading/finished 三個。

---

## 3. 提議方案

### 3.1 建立 Design Tokens 常數檔

```
src/core/design-tokens/colors.js  (Single Source of Truth)
```

匯出結構：

```javascript
const DESIGN_TOKENS = {
  // 主題色（對應 ThemeManagementService）
  theme: {
    primary: '#007AFF',
    background: '#FFFFFF',
    surface: '#F2F2F7',
    text: '#000000',
    textSecondary: '#8E8E93',
    border: '#C6C6C8',
    success: '#34C759',
    warning: '#FF9500',
    error: '#FF3B30'
  },

  // ReadingStatus 色彩（前景 + 背景配對）
  status: {
    unread:    { fg: '#1976d2', bg: '#e3f2fd' },
    reading:   { fg: '#f57c00', bg: '#fff3e0' },
    finished:  { fg: '#388e3c', bg: '#e8f5e8' },
    queued:    { fg: '#7b1fa2', bg: '#f3e5f5' },
    abandoned: { fg: '#757575', bg: '#f5f5f5' },
    reference: { fg: '#00838f', bg: '#e0f7fa' }
  },

  // Tag 相關色彩
  tag: {
    defaultCategoryColor: '#808080'
  },

  // UI 裝飾色
  ui: {
    gradientStart: '#667eea',
    gradientEnd: '#764ba2'
  }
}
```

### 3.2 消費方式

| 消費者 | 引用方式 | 說明 |
|--------|---------|------|
| JS 模組 | `require('src/core/design-tokens/colors')` | 直接引用常數 |
| CSS | CSS Variables（Phase 2） | `:root { --color-primary: ... }` |
| Spec 文件 | 引用 design-tokens 定義 | 「色彩值見 design-tokens/colors.js」 |
| 測試 | `require('src/core/design-tokens/colors')` | 驗證實作使用了正確的 token 值 |

### 3.3 Spec 文件調整

現有 spec（如 overview-tag-display-spec.md）中的色彩表格改為引用 design tokens：

```markdown
## 色彩定義

狀態色彩定義於 `src/core/design-tokens/colors.js` 的 `status` 區段。
本 spec 不重複定義色值，僅定義 CSS class 命名規則。
```

### 3.4 測試驗證方式

```javascript
const { DESIGN_TOKENS } = require('src/core/design-tokens/colors')

// 驗證實作使用了配色表的值，而非自行定義
expect(tagChips[0].style.color).toBe(
  hexToRgb(mockCategories.get('cat-1').color)
)
```

---

## 4. 分階段實施建議

### Phase 1：常數化（v0.17.x — 快速勝利）

| 任務 | 說明 |
|------|------|
| 建立 `src/core/design-tokens/colors.js` | 統一匯出所有色彩常數 |
| 合併 3 個 DEFAULT_COLOR | TagSchema / tag-storage-adapter / tag-resolver 統一引用 |
| ThemeManagementService 改為引用 tokens | 消除重複定義 |
| 補齊 Status 色彩 CSS | 新增 queued/abandoned/reference 三個 CSS class |

**預估影響檔案**：5-7 個
**風險**：低（純重構，行為不變）

### Phase 2：CSS Variables（v0.18.x+ — 中期）

| 任務 | 說明 |
|------|------|
| 建立 CSS Variables 注入機制 | JS tokens → `:root { --color-xxx }` |
| 更新 overview.css | 硬編碼色值改為 `var(--color-xxx)` |
| 更新 popup.html/popup.js | 同上 |
| 更新 style.css | 同上 |

**預估影響檔案**：5-8 個
**風險**：中（CSS 變更需完整視覺回歸測試）

### Phase 3：完整主題系統（v0.20.x+ — 長期）

| 任務 | 說明 |
|------|------|
| Light/Dark 主題 CSS 完整切換 | `prefers-color-scheme` 媒體查詢 |
| Tag Category 預定義調色盤 | 提供 8-12 個預設色供使用者選擇 |
| Spec 文件全面更新 | 所有色彩引用統一指向 design tokens |

**預估影響檔案**：10+ 個
**風險**：中高（涉及多層重構）

---

## 5. 不做的事

| 排除項目 | 原因 |
|---------|------|
| 重新設計色彩方案 | 本提案聚焦架構統一，不改變現有配色選擇 |
| Tailwind/CSS-in-JS | Chrome Extension 環境不適合，保持原生 CSS |
| 動態主題 API | v2.0+ 再考慮，目前 Light/Dark 用媒體查詢即可 |

---

## 6. 討論要點

以下問題需在提案討論階段確定：

1. **Design Tokens 檔案位置**：`src/core/design-tokens/colors.js` 是否合適？或放在 `src/core/constants/` 更一致？
2. **Phase 1 的版本歸屬**：歸入 v0.17.x 當前版本，還是 v0.18.x 下一版本？
3. **CSS Variables 的注入時機**：頁面載入時由 JS 注入，還是建置時生成 CSS 檔案？
4. **Tag Category 預定義調色盤**：是否需要？使用者自訂 vs 系統預定義？
5. **Dark Mode 優先級**：Chrome Extension 的 popup 和 overview page 是否需要 Dark Mode？

---

## 7. 相關文件

| 文件 | 關聯 |
|------|------|
| `src/background/domains/user-experience/services/theme-management-service.js` | 現有主題色定義 |
| `docs/spec/overview-tag-display-spec.md` | Status 色彩和 Tag 色彩規格 |
| `src/data-management/TagSchema.js` | Tag 預設色定義 |
| PROP-007 | Tag-based Model 重構（影響 tag category 色彩處理） |

---

## 變更歷史

| 版本 | 日期 | 變更內容 |
|------|------|---------|
| 1.0 | 2026-04-08 | 初始建立 |

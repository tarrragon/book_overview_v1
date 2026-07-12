/**
 * Popup Component Rules（SSOT 來源模組，1.5.0-W6-001）
 *
 * 業務情境（PROP-013 工作項 4）：popup.html 內嵌 `<style>` 的共用元件樣式
 *   （卡片 / 狀態指示 / 按鈕 / 文字 / 標頭 / 進度條 / 佈局容器 / 摺疊元件，
 *   共 31 條 rule block 含 @keyframes pulse；原 32 條，1.5.0-W6-012 合併
 *   .progress-bar/.progress-fill 逐字重複宣告為群組選擇器）遷入 design-system.css，
 *   頁面專屬佈局（body / .header / .content / .version）豁免保留於 popup.html。
 *
 * 定位：generator（scripts/generate-design-system-css.js）的第 5 個來源模組，
 *   與 colors / spacing / typography / shadows 同為 SSOT——generator 管結構
 *   （區段註解由 buildCss() push），本模組管規則內容。
 *
 * 維護約束：
 *   - 規則值一律引用 var(--*) token，禁止 raw hex 色碼
 *     （tests/unit/design-system-css-snapshot.test.js C4 守護）。
 *   - 選擇器清單與 tests/unit/helpers/popup-migrated-selectors.js 對齊
 *     （C1 存在性 + S2 不並存斷言鏈攔漂移）。
 *   - 禁止直接編輯 design-system.css（AUTO-GENERATED），改本模組後執行
 *     node scripts/generate-design-system-css.js 重生成。
 *
 * @see docs/work-logs/v1/v1.5/v1.5.0/tickets/1.5.0-W6-001.md Solution Phase 3a 第 2 節
 */

const COMPONENT_RULES = `
/* 卡片：權重三級，次階 panel 為預設（狀態 / 進度 / 結果 / 頁面資訊卡） */
.status-card {
  background: var(--color-panel);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: var(--spacing-md);
  margin-bottom: var(--spacing-md);
}

/* 主階 primary surface：主操作卡升 surface 白底 + sm shadow，成為視覺重心 */
.status-card.primary-surface {
  background: var(--color-surface);
  border: none;
  border-radius: var(--radius-md);
  padding: var(--spacing-lg);
  box-shadow: 0 2px 8px var(--shadow-color-sm);
}

.error-card {
  background-color: var(--color-error-light);
  border: 1px solid var(--color-error-light);
  color: var(--color-error);
}

/* 狀態指示 */
.status-indicator {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-sm);
}

.status-dot {
  width: var(--spacing-sm);
  height: var(--spacing-sm);
  border-radius: 50%;
  background: var(--color-success);
}

.status-dot.loading {
  background: var(--color-warning);
  animation: pulse 1.5s ease-in-out infinite;
}

.status-dot.error {
  background: var(--color-error);
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* 按鈕主次三級：radius 去 pill（sm 8px，對齊資料工具類別） */
.button {
  width: 100%;
  padding: var(--spacing-sm) var(--spacing-md);
  border: none;
  border-radius: var(--radius-sm);
  font-size: var(--font-size-body-large);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  transition: all 0.2s ease;
  margin-bottom: var(--spacing-sm);
}

.button.primary {
  background: var(--color-primary);
  color: var(--color-surface);
  font-weight: var(--font-weight-semi-bold);
}

.button.primary:hover {
  background: var(--color-primary-dark);
}

.button.secondary {
  background: var(--color-panel);
  color: var(--color-on-background);
  border: 1px solid var(--color-border);
  font-size: var(--font-size-body-medium);
}

.button.secondary:hover {
  background: var(--color-primary-lightest);
}

.button.danger {
  background: var(--color-error);
  color: var(--color-surface);
}

.button.danger:hover {
  background: var(--color-error);
  opacity: 0.9;
}

/* confirm：正向確認語意（APP AppButton.confirm 對照，跨平台命名契約 §14.6），
   token 沿用 v1 既有 color-success（契約標記 token 主名差異 success vs positive，
   僅記錄不重命名，屬 W6-006/W6-007 範疇） */
.button.confirm {
  background: var(--color-success);
  color: var(--color-surface);
  font-weight: var(--font-weight-semi-bold);
}

.button.confirm:hover {
  background: var(--color-success-dark);
}

/* ghost：輔助低調語意（APP AppButton.ghost 對照），transparent 背景 + primary 文字 */
.button.ghost {
  background: transparent;
  color: var(--color-primary);
  border: 1px solid transparent;
}

.button.ghost:hover {
  background: var(--color-primary-lightest);
}

.button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.button.small {
  padding: var(--spacing-sm) var(--spacing-md);
  font-size: var(--font-size-caption);
}

/* large：對齊 §14.6 size 契約（small/medium/large），medium 為既有預設 .button
   基準樣式，本規則僅補 large 差異值 */
.button.large {
  padding: var(--spacing-md) var(--spacing-lg);
  font-size: var(--font-size-title-small);
}

/* 文字 */
.info-text {
  font-size: var(--font-size-caption);
  color: var(--color-on-surface-muted);
  line-height: 1.5;
}

.error-message {
  font-size: var(--font-size-caption);
  color: var(--color-error);
  line-height: 1.5;
  margin-bottom: var(--spacing-md);
}

/* 進度 / 結果 / 錯誤區段標題（區塊標題層級：body 字級 + 半粗） */
.progress-header, .results-header, .error-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-sm);
}

.progress-header strong, .results-header strong, .error-header strong {
  font-size: var(--font-size-body-medium);
  color: var(--color-on-background);
  font-weight: var(--font-weight-semi-bold);
}

.progress-percentage {
  font-size: var(--font-size-body-medium);
  color: var(--color-on-background);
  font-weight: var(--font-weight-semi-bold);
}

/* 進度條 */
.progress-bar-container {
  height: var(--spacing-sm);
  background-color: var(--color-border);
  border-radius: var(--radius-xs);
  overflow: hidden;
  margin-bottom: var(--spacing-sm);
}

/* 容器（.progress-bar，JS 查詢錨點）與內層填充（.progress-fill，JS 驅動 width）
   宣告逐字相同，合併為群組選擇器（1.5.0-W6-012）；兩 class 均為 JS 活躍查詢
   目標（popup.js / popup-ui-components.js / ui-progress-handler.js），禁止刪除 */
.progress-bar, .progress-fill {
  height: 100%;
  background: var(--color-primary);
  border-radius: var(--radius-xs);
  transition: width 0.3s ease-in-out;
}

/* 佈局容器 */
.action-buttons {
  display: flex;
  gap: var(--spacing-sm);
  margin-top: var(--spacing-md);
}

/* 摺疊元件 */
.collapsible-header {
  cursor: pointer;
  user-select: none;
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0;
}

.collapsible-header[aria-expanded="true"] {
  margin-bottom: var(--spacing-sm);
}

.collapsible-chevron {
  font-size: var(--font-size-caption);
  color: var(--color-on-surface-muted);
  transition: transform 0.2s ease;
}

.collapsible-header[aria-expanded="true"] .collapsible-chevron {
  transform: rotate(180deg);
}

.collapsible-body {
  overflow: hidden;
  max-height: 0;
  transition: max-height 0.2s ease;
}

.collapsible-body.expanded {
  max-height: 500px;
}

/* 分割陰影（取代分隔線，1.5.0-W6-004，spec §8.2）：以 box-shadow 呈現分隔語意，
   不使用 border。厚度固定 1px，offset/blur 隨變體遞增（對齊 APP UIShadows）。 */
.divider {
  height: 1px;
  width: 100%;
  background: transparent;
  border: none;
}

.divider.divider-subtle {
  box-shadow: 0 1px 2px var(--divider-subtle);
}

.divider.divider-normal {
  box-shadow: 0 2px 4px var(--divider-normal);
}

.divider.divider-strong {
  box-shadow: 0 3px 6px var(--divider-strong);
}
`

module.exports = { COMPONENT_RULES }

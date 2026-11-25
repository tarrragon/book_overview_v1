/**
 * 書櫃頁要回報給 popup 的本數
 *
 * 書櫃頁是捲動才載入的清單：剛進頁面時 DOM 裡只有第一批書（Readmoo 是 96 本），
 * 提取時才會捲完整個書櫃。所以 popup 顯示的「這一頁有幾本」不能只數已渲染的元素。
 * adapter 能從頁面讀出書櫃總數時（Readmoo 的「擁有 N 本書（封存 a、借出 b）」，
 * 扣掉封存與借出就是書櫃上看得到、提取會拿到的本數）用它；讀不出來時退回已渲染的本數。
 */

/**
 * @param {Object|null} platformAdapter - 目前頁面的 adapter；有 parseLibraryTotal() 才讀總數
 * @param {number} renderedCount - DOM 裡已渲染的書籍元素數
 * @returns {number}
 */
function resolveLibraryBookCount (platformAdapter, renderedCount) {
  const rendered = Number.isFinite(renderedCount) ? renderedCount : 0
  if (!platformAdapter || typeof platformAdapter.parseLibraryTotal !== 'function') return rendered
  try {
    const { total } = platformAdapter.parseLibraryTotal() || {}
    // 總數比已渲染的還少，代表頁首字樣跟清單對不上，照已渲染的算
    return Number.isInteger(total) && total >= rendered ? total : rendered
  } catch (error) {
    return rendered
  }
}

module.exports = { resolveLibraryBookCount }

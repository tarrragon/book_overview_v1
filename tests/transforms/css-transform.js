/**
 * CSS 檔案轉換器
 * 將 CSS 檔案轉換為空物件（因為在測試中我們通常不需要實際的CSS）
 */

module.exports = {
  process() {
    return 'module.exports = {};';
  }
}; 
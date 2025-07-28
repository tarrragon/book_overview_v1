/**
 * HTML 檔案轉換器
 * 將 HTML 檔案轉換為 Jest 可以處理的格式
 */

module.exports = {
  process(src, filename) {
    // 將 HTML 內容轉換為 JavaScript 字符串
    return `module.exports = ${JSON.stringify(src)};`;
  }
}; 
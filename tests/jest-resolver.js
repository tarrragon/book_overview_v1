/**
 * Jest 模組解析器
 * 
 * 專門處理語意化路徑的 ./src/ 格式解析
 * 確保所有 require('./src/...') 調用都能正確解析到專案根目錄
 */

const path = require('path');
const fs = require('fs');

module.exports = (request, options) => {
  // 如果請求以 './src/' 開頭，重寫為從專案根目錄的路徑
  if (request.startsWith('./src/')) {
    const rootDir = options.rootDir || process.cwd();
    const relativePath = request.substring(2); // 移除 './' 前綴
    const absolutePath = path.resolve(rootDir, relativePath);
    
    // 檢查檔案是否存在（含副檔名）
    const extensions = ['.js', '.json', '.html', '.css', ''];
    for (const ext of extensions) {
      const fullPath = absolutePath + ext;
      if (fs.existsSync(fullPath)) {
        return fullPath;
      }
    }
    
    // 如果沒找到，回傳原始請求讓預設解析器處理
    console.warn(`Jest resolver: 無法解析路徑 ${request} -> ${absolutePath}`);
  }
  
  // 對於其他類型的請求，使用預設解析器
  return options.defaultResolver(request, options);
};
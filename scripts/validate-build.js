#!/usr/bin/env node
/**
 * Readmoo 書庫提取器 - 建置驗證腳本
 * 負責驗證建置結果的完整性和正確性
 */

const fs = require('fs');
const path = require('path');

const MODE = process.argv.includes('--prod') ? 'production' : 'development';
const BUILD_DIR = path.join(__dirname, '..', 'build', MODE);

console.log(`🔍 開始驗證 ${MODE} 版本建置結果...`);
console.log(`📂 驗證目錄: ${BUILD_DIR}`);

let hasErrors = false;
let warnings = [];
let validationResults = {
  directory: false,
  manifest: false,
  files: false,
  icons: false,
  permissions: false,
  size: false
};

/**
 * 記錄錯誤
 */
function logError(message) {
  console.error(`❌ ${message}`);
  hasErrors = true;
}

/**
 * 記錄警告
 */
function logWarning(message) {
  console.warn(`⚠️  ${message}`);
  warnings.push(message);
}

/**
 * 記錄成功
 */
function logSuccess(message) {
  console.log(`✅ ${message}`);
}

/**
 * 檢查檔案是否存在
 */
function fileExists(filePath) {
  return fs.existsSync(filePath);
}

/**
 * 獲取檔案大小 (KB)
 */
function getFileSizeKB(filePath) {
  if (!fileExists(filePath)) return 0;
  const stats = fs.statSync(filePath);
  return Math.round(stats.size / 1024 * 100) / 100;
}

/**
 * 驗證目錄結構
 */
function validateDirectoryStructure() {
  console.log('\n📁 驗證目錄結構...');
  
  if (!fileExists(BUILD_DIR)) {
    logError(`建置目錄不存在: ${BUILD_DIR}`);
    return false;
  }
  
  const requiredDirectories = [
    'src',
    'src/background',
    'src/content',
    'src/popup',
    'assets',
    'assets/icons'
  ];
  
  let allExists = true;
  requiredDirectories.forEach(dir => {
    const dirPath = path.join(BUILD_DIR, dir);
    if (fileExists(dirPath)) {
      logSuccess(`目錄存在: ${dir}`);
    } else {
      logError(`目錄缺失: ${dir}`);
      allExists = false;
    }
  });
  
  validationResults.directory = allExists;
  return allExists;
}

/**
 * 驗證 Manifest 檔案
 */
function validateManifest() {
  console.log('\n📄 驗證 Manifest 檔案...');
  
  const manifestPath = path.join(BUILD_DIR, 'manifest.json');
  
  if (!fileExists(manifestPath)) {
    logError('manifest.json 檔案不存在');
    validationResults.manifest = false;
    return false;
  }
  
  try {
    const manifestContent = fs.readFileSync(manifestPath, 'utf8');
    const manifest = JSON.parse(manifestContent);
    
    // 檢查必要欄位
    const requiredFields = {
      'manifest_version': 3,
      'name': 'string',
      'version': 'string',
      'description': 'string',
      'background': 'object',
      'content_scripts': 'object',
      'action': 'object',
      'permissions': 'object'
    };
    
    let manifestValid = true;
    Object.entries(requiredFields).forEach(([field, expectedType]) => {
      if (!(field in manifest)) {
        logError(`Manifest 缺少必要欄位: ${field}`);
        manifestValid = false;
      } else if (field === 'manifest_version' && manifest[field] !== 3) {
        logError(`Manifest 版本必須為 3，目前為: ${manifest[field]}`);
        manifestValid = false;
      } else if (expectedType === 'string' && typeof manifest[field] !== 'string') {
        logError(`Manifest 欄位 ${field} 類型錯誤，預期: ${expectedType}`);
        manifestValid = false;
      } else if (expectedType === 'object' && typeof manifest[field] !== 'object') {
        logError(`Manifest 欄位 ${field} 類型錯誤，預期: ${expectedType}`);
        manifestValid = false;
      } else {
        logSuccess(`Manifest 欄位正確: ${field}`);
      }
    });
    
    // 檢查版本格式
    const versionPattern = /^\d+\.\d+\.\d+$/;
    if (!versionPattern.test(manifest.version)) {
      logWarning(`版本號格式建議使用 x.y.z 格式，目前: ${manifest.version}`);
    }
    
    // 檢查權限最小化
    if (manifest.permissions && manifest.permissions.length > 5) {
      logWarning(`權限數量較多 (${manifest.permissions.length})，建議檢查是否必要`);
    }
    
    validationResults.manifest = manifestValid;
    return manifestValid;
    
  } catch (error) {
    logError(`Manifest 檔案解析錯誤: ${error.message}`);
    validationResults.manifest = false;
    return false;
  }
}

/**
 * 驗證核心檔案
 */
function validateCoreFiles() {
  console.log('\n🔧 驗證核心檔案...');
  
  const requiredFiles = [
    'src/background/background.js',
    'src/content/content.js', 
    'src/popup/popup.html',
    'src/popup/popup.js'
  ];
  
  let allExists = true;
  requiredFiles.forEach(file => {
    const filePath = path.join(BUILD_DIR, file);
    if (fileExists(filePath)) {
      const sizeKB = getFileSizeKB(filePath);
      logSuccess(`檔案存在: ${file} (${sizeKB} KB)`);
    } else {
      logError(`核心檔案缺失: ${file}`);
      allExists = false;
    }
  });
  
  validationResults.files = allExists;
  return allExists;
}

/**
 * 驗證圖示檔案
 */
function validateIcons() {
  console.log('\n🎨 驗證圖示檔案...');
  
  const iconSizes = [16, 48, 128];
  let allExists = true;
  
  iconSizes.forEach(size => {
    const iconPath = path.join(BUILD_DIR, 'assets', 'icons', `icon-${size}.png`);
    if (fileExists(iconPath)) {
      const sizeKB = getFileSizeKB(iconPath);
      logSuccess(`圖示存在: icon-${size}.png (${sizeKB} KB)`);
      
      // 檢查圖示檔案大小合理性
      if (sizeKB > 50) {
        logWarning(`圖示檔案較大: icon-${size}.png (${sizeKB} KB)，建議優化`);
      }
    } else {
      logError(`圖示檔案缺失: icon-${size}.png`);
      allExists = false;
    }
  });
  
  validationResults.icons = allExists;
  return allExists;
}

/**
 * 驗證權限配置
 */
function validatePermissions() {
  console.log('\n🔐 驗證權限配置...');
  
  const manifestPath = path.join(BUILD_DIR, 'manifest.json');
  if (!fileExists(manifestPath)) {
    validationResults.permissions = false;
    return false;
  }
  
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    
    // 檢查權限設定
    const permissions = manifest.permissions || [];
    const hostPermissions = manifest.host_permissions || [];
    
    const allowedPermissions = ['storage', 'activeTab'];
    const allowedHosts = ['*://*.readmoo.com/*'];
    
    let permissionsValid = true;
    
    permissions.forEach(permission => {
      if (allowedPermissions.includes(permission)) {
        logSuccess(`權限正確: ${permission}`);
      } else {
        logWarning(`未預期的權限: ${permission}，請確認是否必要`);
      }
    });
    
    hostPermissions.forEach(host => {
      if (allowedHosts.some(allowed => allowed === host)) {
        logSuccess(`主機權限正確: ${host}`);
      } else {
        logWarning(`未預期的主機權限: ${host}，請確認是否必要`);
      }
    });
    
    validationResults.permissions = permissionsValid;
    return permissionsValid;
    
  } catch (error) {
    logError(`權限驗證失敗: ${error.message}`);
    validationResults.permissions = false;
    return false;
  }
}

/**
 * 驗證檔案大小
 */
function validateFileSize() {
  console.log('\n📏 驗證檔案大小...');
  
  let totalSizeKB = 0;
  let oversizedFiles = [];
  
  function scanDirectory(dir) {
    const items = fs.readdirSync(dir);
    items.forEach(item => {
      const itemPath = path.join(dir, item);
      const stats = fs.statSync(itemPath);
      
      if (stats.isDirectory()) {
        scanDirectory(itemPath);
      } else {
        const sizeKB = Math.round(stats.size / 1024 * 100) / 100;
        totalSizeKB += sizeKB;
        
        // 檢查單一檔案大小
        if (sizeKB > 100) {
          const relativePath = path.relative(BUILD_DIR, itemPath);
          oversizedFiles.push({path: relativePath, size: sizeKB});
        }
      }
    });
  }
  
  scanDirectory(BUILD_DIR);
  
  logSuccess(`總檔案大小: ${Math.round(totalSizeKB * 100) / 100} KB`);
  
  if (totalSizeKB > 5120) { // 5MB
    logWarning(`總檔案大小較大 (${Math.round(totalSizeKB / 1024 * 100) / 100} MB)，可能影響載入速度`);
  }
  
  if (oversizedFiles.length > 0) {
    logWarning('發現較大的檔案:');
    oversizedFiles.forEach(file => {
      console.log(`    ${file.path}: ${file.size} KB`);
    });
  }
  
  validationResults.size = oversizedFiles.length === 0;
  return true;
}

/**
 * 主要驗證流程
 */
function validate() {
  console.log(`🎯 驗證開始時間: ${new Date().toLocaleString()}`);
  
  // 執行所有驗證
  validateDirectoryStructure();
  validateManifest();
  validateCoreFiles();
  validateIcons();
  validatePermissions();
  validateFileSize();
  
  // 統計結果
  console.log('\n📊 驗證結果統計:');
  console.log('================');
  
  const results = Object.entries(validationResults);
  const passed = results.filter(([, result]) => result === true).length;
  const total = results.length;
  
  results.forEach(([category, result]) => {
    const status = result ? '✅' : '❌';
    const categoryNames = {
      directory: '目錄結構',
      manifest: 'Manifest 檔案',
      files: '核心檔案',
      icons: '圖示檔案', 
      permissions: '權限配置',
      size: '檔案大小'
    };
    console.log(`${status} ${categoryNames[category]}`);
  });
  
  console.log(`\n📈 通過率: ${passed}/${total} (${Math.round(passed/total*100)}%)`);
  
  if (warnings.length > 0) {
    console.log(`\n⚠️  警告數量: ${warnings.length}`);
  }
  
  // 最終結果
  console.log('\n🎯 最終結果:');
  console.log('================');
  
  if (hasErrors) {
    console.error('❌ 驗證失敗！請修正上述錯誤後重新建置。');
    process.exit(1);
  } else if (warnings.length > 0) {
    console.log('⚠️  驗證通過但有警告，建議檢查並優化。');
    console.log('✅ 建置結果可以使用，但建議處理警告項目。');
    process.exit(0);
  } else {
    console.log('✅ 所有檢查通過！建置結果完全正常。');
    console.log('🚀 可以安全地載入到 Chrome 或上架到 Web Store。');
    process.exit(0);
  }
}

// 執行驗證
validate();
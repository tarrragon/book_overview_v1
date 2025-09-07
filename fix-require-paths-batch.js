#!/usr/bin/env node

/**
 * 批次修正 require 路徑的腳本
 * 將相對路徑修正為專案根開始的 ./src/ 格式
 */

const fs = require('fs');
const path = require('path');

// 需要處理的路徑模式映射
const pathMappings = {
  // BaseModule 引用
  "require('../lifecycle/base-module')": "require('src/background/lifecycle/base-module')",
  "require('../../lifecycle/base-module')": "require('src/background/lifecycle/base-module')",
  "require('../../../lifecycle/base-module')": "require('src/background/lifecycle/base-module')",
  "require('../lifecycle/base-module.js')": "require('src/background/lifecycle/base-module')",
  "require('../../lifecycle/base-module.js')": "require('src/background/lifecycle/base-module')",
  
  // Logger 引用
  "require('../../core/logging/Logger')": "require('src/core/logging/Logger')",
  "require('../../../core/logging/Logger')": "require('src/core/logging/Logger')",
  "require('../../../../core/logging/Logger')": "require('src/core/logging/Logger')",
  "require('../../../../../core/logging/Logger')": "require('src/core/logging/Logger')",
  
  // Constants 引用
  "require('../constants/module-constants')": "require('src/background/constants/module-constants')",
  "require('../../constants/module-constants')": "require('src/background/constants/module-constants')",
  "require('../../../constants/module-constants')": "require('src/background/constants/module-constants')",
  
  // Core 引用
  "require('../core/errors/OperationResult')": "require('src/core/errors/OperationResult')",
  "require('../../core/errors/OperationResult')": "require('src/core/errors/OperationResult')",
  "require('../../../core/errors/OperationResult')": "require('src/core/errors/OperationResult')",
  
  "require('../core/enums')": "require('src/core/enums')",
  "require('../../core/enums')": "require('src/core/enums')",
  "require('../../../core/enums')": "require('src/core/enums')",
  
  // 其他常見模式
  "require('../utils/timeout-handler')": "require('src/background/utils/timeout-handler')",
  "require('../../utils/timeout-handler')": "require('src/background/utils/timeout-handler')",
  "require('../../../utils/timeout-handler')": "require('src/background/utils/timeout-handler')",
};

// 需要處理的檔案列表
const filesToProcess = [
  // Background 模組
  'src/background/messaging/popup-message-handler.js',
  'src/background/messaging/chrome-api-wrapper.js',
  'src/background/i18n/i18n-manager.js',
  'src/background/events/event-coordinator.js',
  'src/background/monitoring/error-handler.js',
  'src/background/monitoring/system-monitor.js',
  'src/background/monitoring/error-collector.js',
  'src/background/monitoring/page-monitor.js',
  'src/background/monitoring/content-coordinator.js',
  'src/background/domains/messaging/messaging-domain-coordinator.js',
  'src/background/domains/messaging/services/message-routing-service.js',
  'src/background/domains/messaging/services/session-management-service.js',
  'src/background/domains/platform/platform-domain-coordinator.js',
  'src/background/domains/platform/services/platform-detection-service.js',
  'src/background/domains/platform/services/adapter-factory-service.js',
  'src/background/domains/platform/services/platform-registry-service.js',
  'src/background/domains/platform/services/platform-isolation-service.js',
  'src/background/domains/platform/services/platform-switcher-service.js',
  'src/background/domains/extraction/extraction-domain-coordinator.js',
  'src/background/domains/extraction/services/export-service.js',
  'src/background/domains/extraction/services/validation-service.js',
  'src/background/domains/extraction/services/data-processing-service.js',
  'src/background/domains/extraction/services/quality-control-service.js',
  'src/background/domains/extraction/services/extraction-state-service.js',
  'src/background/domains/data-management/services/readmoo-data-consistency-service.js',
  'src/background/domains/data-management/services/cache-management-service.js',
  'src/background/domains/data-management/services/sync-progress-tracker.js',
  
  // 其他模組
  'src/data-management/SchemaMigrationService.js',
  'src/core/logging/Logger.js',
  'src/core/errors/OperationResult.js',
  'src/platform/readmoo-platform-migration-validator.js',
  'src/error-handling/event-error-handler.js',
];

function processFile(filePath) {
  const fullPath = path.join(__dirname, filePath);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`檔案不存在: ${filePath}`);
    return false;
  }
  
  let content = fs.readFileSync(fullPath, 'utf8');
  let modified = false;
  
  // 應用路徑映射
  for (const [oldPath, newPath] of Object.entries(pathMappings)) {
    if (content.includes(oldPath)) {
      content = content.replace(new RegExp(escapeRegExp(oldPath), 'g'), newPath);
      modified = true;
      console.log(`修正 ${filePath}: ${oldPath} -> ${newPath}`);
    }
  }
  
  if (modified) {
    fs.writeFileSync(fullPath, content, 'utf8');
    return true;
  }
  
  return false;
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

console.log('開始批次修正 require 路徑...\n');

let processedCount = 0;
let modifiedCount = 0;

for (const filePath of filesToProcess) {
  processedCount++;
  if (processFile(filePath)) {
    modifiedCount++;
  }
}

console.log(`\n批次處理完成:`);
console.log(`- 處理檔案數: ${processedCount}`);
console.log(`- 修正檔案數: ${modifiedCount}`);
console.log(`- 跳過檔案數: ${processedCount - modifiedCount}`);
const fs = require('fs');

// 測試兩個修復的檔案
const files = [
  './src/background/domains/page/services/navigation-service.js',
  './src/background/domains/page/services/tab-state-tracking-service.js'
];

files.forEach(file => {
  console.log(`Testing ${file}:`);
  try {
    const content = fs.readFileSync(file, 'utf-8');

    // 檢查括號平衡
    let openBraces = 0;
    let closeBraces = 0;

    for (let char of content) {
      if (char === '{') openBraces++;
      if (char === '}') closeBraces++;
    }

    console.log(`  - Open braces: ${openBraces}`);
    console.log(`  - Close braces: ${closeBraces}`);
    console.log(`  - Balanced: ${openBraces === closeBraces ? '✅' : '❌'}`);

    // 檢查語法
    try {
      new Function(content);
      console.log(`  - Syntax: ✅ Valid`);
    } catch (syntaxError) {
      console.log(`  - Syntax: ❌ Error - ${syntaxError.message}`);
    }

  } catch (error) {
    console.log(`  - Error reading file: ${error.message}`);
  }
  console.log('');
});
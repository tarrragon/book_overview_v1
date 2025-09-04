/**
 * 重構範例：從單體函數到語意化單一職責函數
 * 
 * 這是一個展示「Five Lines規則」和「單一職責原則」的重構範例
 * 原始程式碼來源：w3color.js (簡化版本)
 * 重構目標：每個函數不超過5行，每個函數只負責一個明確的職責
 */

// ====== 原始版本：單體架構，多職責混合 ======
/* w3color.js ver.1.18 by w3schools.com (Do not remove this line)*/
(function () {
function w3color(color, elmnt) {
  if (!(this instanceof w3color)) { return new w3color(color, elmnt); }
  if (typeof color == "object") {return color; }
  this.attachValues(toColorObject(color));
  if (elmnt) {elmnt.style.backgroundColor = this.toRgbString();}
}
w3color.prototype = {
  toRgbString : function () {
    return "rgb(" + this.red + ", " + this.green + ", " + this.blue + ")";
  },
  toRgbaString : function () {
    return "rgba(" + this.red + ", " + this.green + ", " + this.blue + ", " + this.opacity + ")";
  },
  // ... [原始程式碼包含大量長函數，混合多種職責]
  toHexString : function () {
    var r = toHex(this.red);
    var g = toHex(this.green);
    var b = toHex(this.blue);
    return "#" +  r + g + b;
  },
  attachValues : function(color) {
    this.red = color.red;
    this.green = color.green;
    this.blue = color.blue;
    this.hue = color.hue;
    this.sat = color.sat;
    this.lightness = color.lightness;
    this.whiteness = color.whiteness;
    this.blackness = color.blackness;
    this.cyan = color.cyan;
    this.magenta = color.magenta;
    this.yellow = color.yellow;
    this.black = color.black;
    this.ncol = color.ncol;
    this.opacity = color.opacity;
    this.valid = color.valid;
  }
};
// ... [省略大量複雜的轉換函數]
})();

// ====== 重構版本：語意化單一職責函數 ======

// 類型定義 (概念參考，實際使用JS)
// type MyColor = { r: number; g: number; b: number };
// type MyRange = { min: number; max: number };

/**
 * 計算色相旋轉值
 * 職責：根據RGB值和範圍計算HSL色相的旋轉分量
 */
function calcHRotation(c, r) {
  if (r.max === r.min) return 0;
  if (r.max === c.r) return (c.g - c.b) / (r.max - r.min);
  if (r.max === c.g) return 2 + (c.b - c.r) / (r.max - r.min);
  return 4 + (c.r - c.g) / (r.max - r.min);
}

/**
 * 計算HSL色相值
 * 職責：將色相旋轉值轉換為標準的360度色相
 */
function calcH(c, r) {
  const rotation = calcHRotation(c, r);
  return (rotation * 60 + 360) % 360;
}

/**
 * 計算HSL亮度值
 * 職責：根據RGB最大最小值計算亮度
 */
function calcL(r) {
  return (r.min + r.max) / 2;
}

/**
 * 計算HSL飽和度值
 * 職責：根據亮度和RGB範圍計算飽和度
 */
function calcS(l, r) {
  if (r.min === r.max) return 0;
  if (l < 0.5) return (r.max - r.min) / (r.max + r.min);
  return (r.max - r.min) / (2 - r.max - r.min);
}

/**
 * RGB到HSL內部轉換
 * 職責：組合H、S、L計算結果為HSL物件
 */
function rgb2hsl_internal(c, r) {
  const h = calcH(c, r);
  const l = calcL(r);
  const s = calcS(l, r);
  return { h, s, l };
}

/**
 * 浮點數RGB到HSL轉換
 * 職責：處理0-1範圍的RGB值轉換
 */
function rgb2hsl_float(r, g, b) {
  const min = Math.min(r, g, b);
  const max = Math.max(r, g, b);
  return rgb2hsl_internal({ r, g, b }, { min, max });
}

/**
 * 整數RGB到HSL轉換
 * 職責：處理0-255範圍的RGB值轉換
 */
function rgb2hsl_int(r, g, b) {
  return rgb2hsl_float(r / 255, g / 255, b / 255);
}

/**
 * 主要轉換函數
 * 職責：提供統一的RGB到HSL轉換介面
 */
function rgb2hsl(r, g, b) {
  return rgb2hsl_int(r, g, b);
}

// ====== 重構效果對比 ======

/**
 * 重構前問題：
 * 1. 單一函數過長，難以理解和維護
 * 2. 混合多種職責在同一函數中
 * 3. 複雜的條件判斷邏輯
 * 4. 難以進行單元測試
 * 
 * 重構後優點：
 * 1. 每個函數不超過5行，符合Five Lines規則
 * 2. 單一職責：每個函數只做一件事
 * 3. 語意化命名：函數名稱清楚表達功能
 * 4. 易於測試：每個小函數可獨立測試
 * 5. 易於理解：程式碼變成一系列清楚的步驟
 */
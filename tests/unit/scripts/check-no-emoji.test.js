/**
 * check-no-emoji.js 單元測試（0.19.1-W1-001）
 *
 * 驗證 emoji 偵測腳本的正確性，分三層：
 * 1. containsEmoji / findEmoji 純函式（正例：各範圍 emoji 被偵測；反例：合法字元不誤判）
 * 2. CLI 行為（tmp 檔含 emoji → exit 1；乾淨 → exit 0）
 *
 * 設計重點：
 * - 測試原始碼本身禁含 emoji 字面（否則自身被 pre-commit emoji 檢查阻擋）。
 *   所有 emoji 測試資料以 String.fromCodePoint 動態建構。
 * - 反例為本測試重點：箭頭 / 數學運算子 / em-dash / 省略號 等在 U+2139-25B6
 *   整段內但非 9 特定字，必須通過——驗證偵測未用整段範圍（避免誤判）。
 *
 * 偵測集定義（與 ticket Context Bundle 一致）：
 *   Range U+1F000-1FFFF + Range U+2600-27BF
 *   + 9 特定字 U+2139 U+2328 U+23ED U+23F0 U+23F1 U+23F3 U+23F8 U+23F9 U+25B6
 *   + U+FE0F variation selector
 */

'use strict'

const fs = require('fs')
const os = require('os')
const path = require('path')
const { execFileSync } = require('child_process')

const { containsEmoji, findEmoji } = require('../../../scripts/check-no-emoji')

const SCRIPT_PATH = path.resolve(__dirname, '../../../scripts/check-no-emoji.js')

// 以 codepoint 建構字元，避免測試原始碼含 emoji 字面
const cp = (codepoint) => String.fromCodePoint(codepoint)

describe('check-no-emoji 偵測函式', () => {
  describe('containsEmoji - 正例（必須被偵測為 true）', () => {
    const positiveCases = [
      ['U+1F680 火箭（1F000-1FFFF 範圍）', cp(0x1F680)],
      ['U+1F504 循環箭頭（1F000-1FFFF 範圍）', cp(0x1F504)],
      ['U+2705 勾選（2600-27BF 範圍）', cp(0x2705)],
      ['U+274C 叉號（2600-27BF 範圍）', cp(0x274C)],
      ['U+26A0 警告（2600-27BF 範圍）', cp(0x26A0)],
      ['U+2139 資訊（9 特定字）', cp(0x2139)],
      ['U+2328 鍵盤（9 特定字）', cp(0x2328)],
      ['U+25B6 播放（9 特定字）', cp(0x25B6)],
      ['U+23F9 停止（9 特定字）', cp(0x23F9)],
      ['U+23F0 鬧鐘（9 特定字）', cp(0x23F0)],
      ['emoji + FE0F 序列', cp(0x26A0) + cp(0xFE0F)],
      ['孤立 FE0F variation selector', cp(0xFE0F)],
      ['emoji 夾在中文中', '載入完成 ' + cp(0x2705) + ' 狀態正常']
    ]

    it.each(positiveCases)('應偵測到 emoji：%s', (_label, text) => {
      expect(containsEmoji(text)).toBe(true)
    })
  })

  describe('containsEmoji - 反例（必須通過為 false，防誤判）', () => {
    const negativeCases = [
      ['ASCII 替換標記 [OK]', '[OK] Popup Script 載入完成'],
      ['ASCII 替換標記 [FAIL]', '[FAIL] 提取錯誤詳情'],
      ['ASCII 替換標記 [WARN]', '[WARN] 注意事項'],
      ['ASCII 替換標記 [CHECK]', '[CHECK] 驗證中'],
      ['ASCII 替換標記 [START]', '[START] 啟動服務'],
      ['繁體中文段落（U+4E00-9FFF 不在偵測集）', '這是一段繁體中文書庫管理器測試文字'],
      ['em-dash U+2014（U+2139-25B6 整段內但非 9 特定字）', 'A' + cp(0x2014) + 'B'],
      ['省略號 U+2026（同上）', '載入中' + cp(0x2026)],
      ['右箭頭 U+2192（同上，整段納入會誤判）', 'A' + cp(0x2192) + 'B'],
      ['左箭頭 U+2190（同上）', 'A' + cp(0x2190) + 'B'],
      ['數學小於等於 U+2264（同上）', 'x' + cp(0x2264) + 'y'],
      ['全等 U+2261（同上）', 'a' + cp(0x2261) + 'b'],
      ['圈號數字 U+2460（同上）', cp(0x2460) + ' 第一項'],
      ['純 ASCII 程式碼', "console.log('Popup Script 載入完成')"],
      ['空字串', '']
    ]

    it.each(negativeCases)('不應誤判：%s', (_label, text) => {
      expect(containsEmoji(text)).toBe(false)
    })
  })

  describe('findEmoji - 精準定位', () => {
    it('應回傳命中字元的 line/col/codepoint', () => {
      const text = '第一行乾淨\n第二行 ' + cp(0x2705) + ' 有 emoji'
      const hits = findEmoji(text)
      expect(hits.length).toBe(1)
      expect(hits[0].line).toBe(2)
      expect(hits[0].codepoint).toBe('U+2705')
      expect(typeof hits[0].col).toBe('number')
    })

    it('乾淨文字應回傳空陣列', () => {
      expect(findEmoji('完全乾淨的中文與 ASCII')).toEqual([])
    })

    it('應偵測多個命中並各自定位', () => {
      const text = cp(0x1F680) + 'x' + cp(0x2705)
      const hits = findEmoji(text)
      expect(hits.length).toBe(2)
      expect(hits[0].codepoint).toBe('U+1F680')
      expect(hits[1].codepoint).toBe('U+2705')
    })
  })
})

describe('check-no-emoji CLI 行為', () => {
  let tmpDir

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'emoji-check-'))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  // execFileSync 回傳 status，非 0 會 throw；統一以 helper 取 exit code
  const runCli = (args) => {
    try {
      execFileSync('node', [SCRIPT_PATH, ...args], { encoding: 'utf8' })
      return { code: 0, stdout: '' }
    } catch (err) {
      return { code: err.status, stdout: (err.stdout || '') + (err.stderr || '') }
    }
  }

  it('乾淨檔案應 exit 0', () => {
    const clean = path.join(tmpDir, 'clean.js')
    fs.writeFileSync(clean, "console.log('[OK] 乾淨無 emoji')\n", 'utf8')
    const result = runCli([clean])
    expect(result.code).toBe(0)
  })

  it('含 emoji 檔案應 exit 1 並報告命中位置', () => {
    const dirty = path.join(tmpDir, 'dirty.js')
    fs.writeFileSync(dirty, "console.log('" + cp(0x2705) + " 含 emoji')\n", 'utf8')
    const result = runCli([dirty])
    expect(result.code).toBe(1)
    expect(result.stdout).toContain('U+2705')
  })

  it('含孤立 FE0F 的檔案應 exit 1', () => {
    const dirty = path.join(tmpDir, 'fe0f.js')
    fs.writeFileSync(dirty, 'const x = "' + cp(0xFE0F) + '"\n', 'utf8')
    const result = runCli([dirty])
    expect(result.code).toBe(1)
  })

  it('多檔混合（一乾淨一髒）應 exit 1', () => {
    const clean = path.join(tmpDir, 'a.js')
    const dirty = path.join(tmpDir, 'b.js')
    fs.writeFileSync(clean, 'const ok = 1\n', 'utf8')
    fs.writeFileSync(dirty, 'const bad = "' + cp(0x1F680) + '"\n', 'utf8')
    const result = runCli([clean, dirty])
    expect(result.code).toBe(1)
  })
})

/**
 * scripts/dev-auto-reload.js：開發版自動重新載入
 */
const fs = require('fs')
const os = require('os')
const path = require('path')
const { applyDevAutoReload, buildSnippet, withAlarmsPermission, STAMP_FILE } = require('../../../scripts/dev-auto-reload')

describe('dev-auto-reload', () => {
  let dir

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dev-auto-reload-'))
    fs.mkdirSync(path.join(dir, 'src/background'), { recursive: true })
    fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({
      manifest_version: 3,
      permissions: ['storage', 'tabs'],
      background: { service_worker: 'src/background/background.js', type: 'module' }
    }))
    fs.writeFileSync(path.join(dir, 'src/background/background.js'), '/* bundled */\n')
  })

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true })
  })

  test('戳記寫死在附加的程式裡（service worker 重新啟動跑舊程式時才比得出差異）', () => {
    const snippet = buildSnippet('stamp-123')
    expect(snippet).toContain('const BUILT_STAMP = "stamp-123"')
    expect(snippet).toContain('chrome.runtime.reload()')
  })

  test('applyDevAutoReload：加 alarms 權限、附加程式到背景程式、最後寫戳記檔', () => {
    const { stamp } = applyDevAutoReload(dir, 'stamp-abc')
    expect(stamp).toBe('stamp-abc')

    const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'))
    expect(manifest.permissions).toEqual(['storage', 'tabs', 'alarms'])

    const background = fs.readFileSync(path.join(dir, 'src/background/background.js'), 'utf8')
    expect(background.startsWith('/* bundled */')).toBe(true)
    expect(background).toContain('"stamp-abc"')

    expect(JSON.parse(fs.readFileSync(path.join(dir, STAMP_FILE), 'utf8'))).toEqual({ stamp: 'stamp-abc' })
  })

  test('withAlarmsPermission 不重複加入、不改動輸入物件', () => {
    const input = { permissions: ['alarms', 'storage'] }
    const output = withAlarmsPermission(input)
    expect(output.permissions).toEqual(['alarms', 'storage'])
    expect(output).not.toBe(input)
  })

  test('build.js 只在開發版且未設 DEV_AUTO_RELOAD=0 時套用', () => {
    const buildSource = fs.readFileSync(path.join(__dirname, '../../../scripts/build.js'), 'utf8')
    expect(buildSource).toContain("if (MODE === 'development' && process.env.DEV_AUTO_RELOAD !== '0') {")
  })
})

# 書城測試目標 Reference

本目錄記錄各書城的實機測試目標 URL、登入要求、測試注意事項，供 Chrome Extension 開發期的實機驗證（搭配 chrome-devtools-mcp）參考。

> **定位**：專案層文件。framework 層的測試工作流見 `.claude/skills/chrome-extension-mcp-debug/SKILL.md`，本目錄補上「本專案要測哪個 URL」的書城特定知識。

---

## 擴充模式：一書城一檔

每新增一個支援的書城，於本目錄新增 `<bookstore>.md` 一檔，遵循下方模板。

### 檔案命名

| 書城 | 檔名 |
|------|------|
| Readmoo | `readmoo.md` |
| 博客來電子書 | `books-com-tw.md` |
| Amazon Kindle | `kindle.md` |
| Rakuten Kobo | `kobo.md` |

### 必含章節

每個書城檔案必須包含以下章節（順序固定）：

1. **基本資訊** — 書城官方網址、登入需求、是否支援匿名瀏覽
2. **測試目標 URL** — 列出 extension 需要實際運作的具體頁面 URL（書庫頁、單書詳情頁、購物頁等）
3. **登入流程** — 是否需 Google / Facebook / 帳密登入、是否有 2FA、測試帳號建議
4. **Content Script 注入點** — manifest `content_scripts.matches` 應涵蓋的 URL pattern
5. **常見 debug 觀察點** — 該書城特有的 DOM 結構、API 端點、SPA 路由模式

---

## 與 framework SKILL 的邊界

| 內容 | 位置 |
|------|------|
| Chrome Extension 通用測試工作流（install / reload / verify / debug） | `.claude/skills/chrome-extension-mcp-debug/SKILL.md` |
| 書城特定測試 URL、登入流程、注意事項（**本目錄**） | `docs/bookstores/<bookstore>.md` |
| Extension 通用設定（manifest、build、permissions） | `docs/chrome-extension-dev-guide.md` |

---

**Last Updated**: 2026-05-12
**Version**: 1.0.0

---
name: Book Overview — 電子書庫總覽
description: 把分散在各書城的書庫集中到本機的 Chrome 擴充功能；本檔記錄 popup（.popup-shell）的視覺系統。
colors:
  primary-darkest: "#0F317D"
  primary-dark: "#1442AE"
  primary-medium: "#5B8DEF"
  primary-light: "#CBDBF8"
  primary-lightest: "#EAF0FD"
  surface: "#FFFFFF"
  error-light: "#FFCDD2"
typography:
  headline:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "24px"
    fontWeight: 700
    lineHeight: 1.3
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "16px"
    fontWeight: 700
    lineHeight: 1.4
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "16px"
    fontWeight: 400
  body-medium:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "14px"
    fontWeight: 600
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    letterSpacing: "0.08em"
  caption:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "12px"
    fontWeight: 400
rounded:
  none: "0px"
spacing:
  xxs: "2px"
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xxl: "48px"
components:
  keycap-primary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary-darkest}"
    typography: "{typography.title}"
    rounded: "{rounded.none}"
    padding: "16px"
    width: "100%"
  keycap-primary-disabled:
    backgroundColor: "{colors.primary-light}"
    textColor: "{colors.primary-dark}"
    rounded: "{rounded.none}"
  keycap-face:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary-darkest}"
    typography: "{typography.title}"
    rounded: "{rounded.none}"
    padding: "16px"
  keycap-outline:
    backgroundColor: "transparent"
    textColor: "{colors.surface}"
    typography: "{typography.title}"
    rounded: "{rounded.none}"
    padding: "8px 16px"
    width: "100%"
  menu-panel:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.none}"
    padding: "4px 0"
    width: "220px"
  menu-item:
    backgroundColor: "transparent"
    textColor: "{colors.primary-darkest}"
    typography: "{typography.body-medium}"
    padding: "8px 16px"
  menu-item-hover:
    backgroundColor: "{colors.primary-darkest}"
    textColor: "{colors.surface}"
  status-notice:
    backgroundColor: "transparent"
    textColor: "{colors.surface}"
    rounded: "{rounded.none}"
    padding: "8px 16px"
---

# Design System: Book Overview — 電子書庫總覽

## Overview

**Creative North Star: "書口鍵"**

整個 popup 是一片鋪滿的深藍（`primary-darkest`），上面只放一顆有厚度的白色按鍵：這一頁能做的那一件事。按鍵下緣的厚度畫成書口，一條條 1px 細線疊成書頁的邊；滑過時鍵浮起、書口變厚，按下時鍵下沉、書口收薄。提取開始後，同一顆鍵維持按下的樣子，鍵面變成進度；結束時鍵面寫出新增與更新的本數。這個世界拒絕「一張卡片裡一排同重量按鈕」的工具列預設：一個情境一顆實體主鍵，其餘入口退到描邊鍵與選單。

密度低、層次靠明度而不是靠陰影：深藍底、白色實體鍵、白色描邊鍵、淺藍文字，四種明度就排出整個畫面的主次。所有形狀都是直角。文字只用在要求使用者互動或回報操作結果，不放描述情境的提示。

**適用範圍。** 本檔記錄的視覺系統只涵蓋 popup（`src/popup/popup.html`，樣式在 `src/core/design-system/component-rules.js` 的 `.popup-shell` 區段，產生到 `design-system.css`）。書庫總覽頁（`src/overview/overview.css`）仍是較早的外觀：淺色畫布（`--color-background`）、白色卡片、8px 與 12px 圓角，還沒有重新設計，不屬於這個世界；改 overview 時不要拿本檔的規則當成它的現況，也不要把 overview 的圓角與淺色面帶進 popup。

**Token 數值與 Flutter 共用。** 色值、間距、字級、圓角的數值跟 Flutter 行動版對齊（`docs/proposals/PROP-014-design-token-value-unification.md`、`src/core/design-system/token-manifest.json`）。popup 只挑選既有 token，不新增也不改數值；要新數值時另開提案，兩端一起改。

**Key Characteristics:**
- 深藍鋪滿整個 popup，沒有卡片外框把內容圍起來。
- 一個情境一顆白色實體主鍵，下緣是 7px 的書口厚度。
- 次要入口是白色 2px 描邊鍵，下緣 4px。
- 全部直角（0px）。
- 按鍵即進度：提取中與完成時，鍵面取代提取鍵，保持按下的樣子。
- 浮起 2px、下沉 5px 的實體回饋，`prefers-reduced-motion` 時關掉。

## Colors

一個藍色色相的明度階梯，加上白色；沒有第二個強調色。

### Primary
- **書背深藍 Bookbinding Navy**（`primary-darkest`）：popup 的整片底色；也是白色按鍵與選單上的文字色，以及選單項目反白時的底色。
- **墨水藍 Ink Blue**（`primary-dark`）：停用中的主鍵文字（例如「正在連線書櫃…」），在 `primary-light` 底上 6.2:1。
- **書口中藍 Page-Edge Blue**（`primary-medium`）：書口條紋的深線、深藍底上卡片與通知區的 1px 邊框、選單鈕的底線。只用在非文字的線條，不用在內文文字。

### Neutral
- **紙白 Paper White**（`surface`）：實體主鍵的鍵面、描邊鍵的框線與文字、深藍底上的主要文字、選單面板底、鍵盤焦點框。
- **淡藍 Pale Blue**（`primary-light`）：品牌列與版本號的文字、停用主鍵的鍵面、提取中鍵面上移動的那一段填色、選單內的分隔線與面板邊框、文字選取的底色。
- **紙邊淡藍 Page Tint**（`primary-lightest`）：書口條紋的淺線、本數、鍵下的提示文字（「請保持這個分頁開著」）。
- **錯誤淡紅 Error Blush**（`error-light`）：錯誤通知區的邊框與深藍底上的錯誤文字。

### Named Rules
**The Single Ink Rule.** popup 裡所有顏色都來自 `primary` 的明度階梯與白色；主次靠明度表達，不另外引進強調色。錯誤只換邊框色（`error-light`），不把整塊染紅。

**The Shared Value Rule.** 色值與 Flutter 行動版共用；這個介面只挑選既有 token，新色值要開聯合提案。

## Typography

**Body Font:** 系統字型堆疊 `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`（macOS 的繁體中文落到 PingFang TC）

**Character:** 系統黑體，粗體承擔層級；中文與數字混排，本數用等寬數字（`tabular-nums`）。

### Hierarchy
- **Headline**（700，24px，1.3）：情境標題，書城名稱或「Readmoo 書櫃」。
- **Title**（700，16px，1.4）：主鍵與描邊鍵上的動作文字、鍵面上的進度與結果。
- **Body**（400，16px）：本數（「128 本」）。
- **Body Medium**（600，14px）：選單項目；取消提取、重新載入擴充功能這類文字連結用同字級、一般字重（400）加底線。
- **Label**（600，12px，0.08em，全大寫）：只用在頂端的產品名「BOOK OVERVIEW」，旁邊接中文副名與選單鈕，是品牌列，不是標題上方的小標。
- **Caption**（400，12px）：版本號、鍵下提示、通知區的說明文字。

### Named Rules
**The Weight Carries Rank Rule.** 層級靠字重與字級（24/16/14/12）表達，不靠顏色以外的裝飾；同一畫面只有情境標題用 24px。

**已知缺口（未解決）。** 共用 token `--font-family` 是 `'PingFang SC', 'Microsoft YaHei', sans-serif`，`'PingFang SC'` 是簡體字形。popup 的 `body` 自己宣告系統字型堆疊，所以繁體中文顯示成 PingFang TC；按鈕以 `font-family: inherit` 跟著 body。這個不一致目前保留：共用 token 的值要改須照 PROP-014 跟 Flutter 一起提案，本檔不視為已解決，新介面也不要直接套用 `--font-family`。

## Layout

popup 寬 350px、最小高度 400px（Chrome 上限 600px 高，超過捲動）。單欄，左右留白 24px（`spacing.lg`），內容一律靠左對齊，包括按鍵上的文字。

由上而下：品牌列與「選單」（上 16px）；情境標題與本數；主鍵區（標題下 24px，不在書城時 4px）；鍵下的提示、取消連結與通知區；描邊鍵「檢視書庫」（主鍵區下 24px）；版本號。不在書城時，主鍵的位置換成三顆書城實體鍵（每顆下距 16px），標題與本數不顯示。

間距只用共用尺度：2 / 4 / 8 / 16 / 24 / 48px。選單面板從頂端 48px、右側 24px 處展開，最小寬 220px。

### Named Rules
**The One Key Rule.** 一個情境只有一顆實體主鍵（書城清單情境是同一種主鍵重複三次，每顆各是一家書城）；常駐的次要入口只有一顆描邊鍵，其他入口收進選單。

## Elevation & Depth

深度不靠陰影，靠按鍵自己的厚度。實體鍵下緣是 7px 書口：`primary-lightest` 與 `primary-medium` 交替的 1px 橫線（`repeating-linear-gradient(180deg, …)`）。厚度隨狀態變化：滑過時鍵上移 2px、書口加厚到 9px；按下時鍵下移 5px、書口收成 2px。描邊鍵的厚度是較粗的 4px 下框。

唯一的投影在選單面板上（`0 12px 24px` 加 `--shadow-color-md`），讓浮在深藍底上的白色面板跟主鍵分開。

### Named Rules
**The Thickness Is Depth Rule.** 可以按的東西用下緣厚度表達「可以按下去」，按下就收薄；不用投影或發光模擬按鍵的高度。

**The Pressed Face Rule.** 提取中與完成時，鍵面保持按下的位置（下移 5px、書口 2px），表示這一下已經按了；鍵面不可再按。

## Shapes

全部直角（`rounded.none`，0px）：按鍵、描邊鍵、選單面板、通知區、錯誤區都一樣。共用的 `--radius-*` token 仍存在（overview 在用），popup 不使用。

線條只有三種：書口的 1px 細線、深藍底上 1px `primary-medium` 的框、描邊鍵 2px 白框加 4px 下框。

## Components

### Buttons

**實體主鍵（keycap）。** 白色直角鍵，整個 popup 的主角。
- **Shape:** 直角（0px），全寬，內距 16px，文字靠左。
- **Primary:** 白底（`surface`）、深藍字（`primary-darkest`），16px 粗體；下緣 7px 書口。
- **Hover / Active:** 浮起 2px、書口 9px；按下時下沉 5px、書口 2px。過渡 140ms `cubic-bezier(0.16, 1, 0.3, 1)`。
- **Focus:** 2px 白色外框、偏移 3px。
- **Disabled:** 淡藍鍵面（`primary-light`）、墨水藍字（`primary-dark`），書口照畫；用在連線還沒好的時候，鍵上的文字直接說狀態（「正在連線書櫃…」）。
- 同一個元件也用在「前往 X 書櫃」（書城的其他頁）與不在書城時的三顆書城鍵。

**鍵面（按鍵即進度）。** 提取開始後取代提取鍵的同尺寸白色面。
- 進入時播一次 160ms 的下沉，之後停在按下的位置。
- **提取中：** 一段 `primary-light` 的漸層在鍵面上來回移動（1.6s，`cubic-bezier(0.65, 0, 0.35, 1)`，無限循環），不顯示百分比，因為 popup 收不到真實進度。鍵面文字「提取中」，鍵下顯示提示與「取消提取」文字連結。
- **完成：** 填色停掉，鍵面寫結果（「完成：新增 3 本、更新 5 本」或「完成：沒有變化」），不加打勾圖示。
- 鍵面帶 `role="status"` 與 `aria-live="polite"`。

**描邊鍵（keycap-outline）。** 常駐的次要入口「檢視書庫」。
- 透明底、2px 白框、4px 白色下框、白字 16px 粗體；內距 8px 16px，全寬，靠左。
- 滑過浮起 2px，按下下沉 2px。

**文字連結。** 取消提取、重新載入擴充功能：白字 14px，底線偏移 4px，無框無底。

### Navigation

**選單鈕。** 頂端右側的「選單」純文字，12px 白字，1px `primary-medium` 底線；展開時底線變白。`aria-expanded` 跟著切換。

**選單面板。** 白底直角面板，1px `primary-light` 邊框，`0 12px 24px` 投影。點選單外、按 Escape 或選了項目就關閉，Escape 關閉後焦點回到選單鈕。
- **項目：** 平時是深藍純文字列（14px，600，內距 8px 16px），滑過或鍵盤聚焦時整列反白成深藍底白字。
- 書城清單只有一份：在書城時放進選單（隱藏目前這一家），不在書城時搬到主鍵的位置。

### Status Notice

只在需要使用者留意時出現：連線中、錯誤、警告。就緒（`data-status="ready"`）與提取中都不顯示；提取中由鍵面與鍵下提示表達。位置在主鍵下方。
- 透明底、1px `primary-medium` 框、直角，內距 8px 16px；錯誤時框換成 `error-light`。
- 錯誤原因只在這裡講一次；主鍵的文字改成「重新提取」，就是重試鍵，錯誤區只留「重新載入擴充功能」文字連結。

### 用語
書城那一端的書目叫「書櫃」（「Readmoo 書櫃」「前往博客來書櫃」），本機集中後的叫「書庫」（「檢視書庫」「匯入書庫」）。英文書城名跟中文之間留空格，中文書城名不留。

## Do's and Don'ts

### Do:
- **Do** 讓 `primary-darkest` 鋪滿整個 popup，內容直接放在深藍上。
- **Do** 每個情境只放一顆白色實體主鍵，下緣畫 7px 書口（`primary-lightest` / `primary-medium` 交替 1px 線）。
- **Do** 用浮起 2px、下沉 5px 表達可按；在 `prefers-reduced-motion: reduce` 時關掉過渡與動畫，提取中的填色改成靜態半透明。
- **Do** 讓進度與結果寫在同一顆鍵的鍵面上，鍵面保持按下的樣子。
- **Do** 只在連線中、錯誤、警告時顯示通知區，放在主鍵下方。
- **Do** 書城端寫「書櫃」，本機端寫「書庫」。
- **Do** 只挑選既有 token 數值；新數值走跟 Flutter 一起的提案。

### Don't:
- **Don't** 用圓角；popup 一律 0px。
- **Don't** 把幾個同重量的按鈕排成一排或包進一張卡片。
- **Don't** 在提取中顯示百分比或假的進度條；popup 收不到真實進度。
- **Don't** 在完成時加打勾圖示。
- **Don't** 在標題上方加小標（eyebrow）；頂端的「BOOK OVERVIEW」是產品名，不是小標的範例。
- **Don't** 在卡片或通知區的單側加強調色條；按鍵下緣的書口與描邊鍵的 4px 下框是按鍵的厚度，不是強調條。
- **Don't** 用 Unicode 字元或 emoji 當圖示。
- **Don't** 放描述情境的提示文字；文字只用在要求互動或回報結果。
- **Don't** 把本檔的規則套到書庫總覽頁（overview）的現況，或把 overview 的圓角與淺色卡片帶進 popup。

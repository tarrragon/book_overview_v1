---
name: Book Overview — 電子書庫總覽
description: 把分散在各書城書櫃的書目集中到本機書庫的 Chrome 擴充功能；本檔記錄 popup（.popup-shell）與書庫總覽頁（src/overview）共用的視覺系統。
colors:
  primary-darkest: "#0F317D"
  primary-dark: "#1442AE"
  primary: "#1A56DB"
  primary-medium: "#5B8DEF"
  primary-light: "#CBDBF8"
  primary-lightest: "#EAF0FD"
  surface: "#FFFFFF"
  background: "#F5F7FA"
  panel: "#EDF1F7"
  on-background: "#1A2233"
  on-surface: "#34404F"
  on-surface-muted: "#5B6573"
  border: "#D9E0EA"
  border-strong: "#C4CDD9"
  error: "#C2342B"
  error-light: "#FFCDD2"
  error-text: "#8C1D17"
  error-container: "#FDECEA"
  warning-text: "#8A5A12"
  warning-container: "#FFF3E0"
typography:
  headline:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "24px"
    fontWeight: 700
    lineHeight: 1.3
  title-large:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang TC', 'Microsoft JhengHei', sans-serif"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: 1.3
  title-medium:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang TC', 'Microsoft JhengHei', sans-serif"
    fontSize: "18px"
    fontWeight: 700
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
  xl: "32px"
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
  ov-top-bar:
    backgroundColor: "{colors.primary-darkest}"
    textColor: "{colors.surface}"
    height: "72px"
    padding: "0 32px"
  ov-key:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary-darkest}"
    typography: "{typography.body-medium}"
    rounded: "{rounded.none}"
    padding: "8px 16px"
  ov-key-disabled:
    backgroundColor: "{colors.primary-light}"
    textColor: "{colors.primary-dark}"
    rounded: "{rounded.none}"
  ov-key-dark:
    backgroundColor: "{colors.primary-darkest}"
    textColor: "{colors.surface}"
    typography: "{typography.body-medium}"
    rounded: "{rounded.none}"
    padding: "8px 16px"
  ov-outline:
    backgroundColor: "transparent"
    textColor: "{colors.surface}"
    typography: "{typography.body-medium}"
    rounded: "{rounded.none}"
    padding: "6px 14px 4px"
  ov-outline-disabled:
    backgroundColor: "transparent"
    textColor: "{colors.primary-light}"
  ov-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.primary-light}"
    typography: "{typography.body-medium}"
    padding: "8px 16px"
  ov-quiet-hover:
    textColor: "{colors.surface}"
  ov-plain:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-background}"
    typography: "{typography.body-medium}"
    rounded: "{rounded.none}"
    padding: "8px 16px"
  ov-plain-disabled:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface-muted}"
  facet-panel:
    backgroundColor: "{colors.surface}"
    width: "240px"
    padding: "16px 8px 32px"
  facet-item:
    backgroundColor: "transparent"
    textColor: "{colors.on-background}"
    padding: "6px 8px"
    width: "100%"
  facet-item-hover:
    backgroundColor: "{colors.primary-lightest}"
  facet-item-selected:
    backgroundColor: "{colors.primary-darkest}"
    textColor: "{colors.surface}"
  view-switch-button:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary-darkest}"
    rounded: "{rounded.none}"
    padding: "0 16px"
    height: "38px"
  view-switch-button-selected:
    backgroundColor: "{colors.primary-darkest}"
    textColor: "{colors.surface}"
  input-field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-background}"
    typography: "{typography.body-medium}"
    rounded: "{rounded.none}"
    padding: "0 16px 0 8px"
    height: "38px"
  book-cover:
    backgroundColor: "{colors.panel}"
    rounded: "{rounded.none}"
  book-cover-empty:
    backgroundColor: "{colors.primary-darkest}"
    textColor: "{colors.surface}"
    rounded: "{rounded.none}"
    padding: "8px"
  modal-dialog:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.none}"
    padding: "24px"
    width: "480px"
  modal-button-primary:
    backgroundColor: "{colors.primary-darkest}"
    textColor: "{colors.surface}"
    typography: "{typography.body-medium}"
    rounded: "{rounded.none}"
    padding: "8px 16px"
  modal-button-overwrite:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.error}"
    rounded: "{rounded.none}"
    padding: "8px 16px"
  modal-button-danger:
    backgroundColor: "{colors.error}"
    textColor: "{colors.surface}"
    rounded: "{rounded.none}"
    padding: "8px 16px"
---

# Design System: Book Overview — 電子書庫總覽

## Overview

**Creative North Star: "書口鍵"**

整個 popup 是一片鋪滿的深藍（`primary-darkest`），上面只放一顆有厚度的白色按鍵：這一頁能做的那一件事。按鍵下緣的厚度畫成書口，一條條 1px 細線疊成書頁的邊；滑過時鍵浮起、書口變厚，按下時鍵下沉、書口收薄。提取開始後，同一顆鍵維持按下的樣子，鍵面變成進度；結束時鍵面寫出新增與更新的本數。這個世界拒絕「一張卡片裡一排同重量按鈕」的工具列預設：一個情境一顆實體主鍵，其餘入口退到描邊鍵與選單。

密度低、層次靠明度而不是靠陰影：深藍底、白色實體鍵、白色描邊鍵、淺藍文字，四種明度就排出整個畫面的主次。所有形狀都是直角。文字只用在要求使用者互動或回報操作結果，不放描述情境的提示。

**書庫總覽頁沿用同一個世界。** 總覽頁（`src/overview/overview.html`）把 popup 的深藍底收成一條 72px 的頂欄：標題與本數白字，右側只有一顆白色書口實體鍵（「匯出 JSON」），其餘是白色描邊鍵與淡藍文字鍵。頂欄以下是工作區：左側 240px 的白色篩選欄，項目平時是純文字加右側本數，選中時整列反白成深藍，跟 popup 選單項目的反白同一個動作；右側是封面網格（可切換成表格），封面直角，下緣用疊起的細線畫成書頁。白底區需要主動作時，用同一種書口鍵的深藍版（鍵面深藍、書口淡藍與墨水藍線）。這一頁拒絕「一張表格上面壓一排同重量按鈕」的資料表預設：先回答「各類各有幾本」，再讓人點進去看。

**適用範圍。** 本檔涵蓋 popup（`src/popup/popup.html`，樣式在 `src/core/design-system/component-rules.js` 的 `.popup-shell` 區段，產生到 `design-system.css`）與書庫總覽頁（`src/overview/overview.html`、`src/overview/overview.css`，篩選欄由 `overview-facets.js`、封面網格由 `overview-book-grid.js` 渲染）。總覽頁的方向契約在 `.impeccable/surfaces/src-overview-overview-html.md`。兩者共用直角、深藍、書口鍵；差別在總覽頁有白底工作區，所以多用了一組灰藍中性色（`background`、`panel`、`border`、`on-*`）與錯誤紅（`error`），popup 不用這些。

**Token 數值與 Flutter 共用。** 色值、間距、字級、圓角的數值跟 Flutter 行動版相同，亮色與暗色各一組（`docs/proposals/PROP-014-design-token-value-unification.md` 2026-11-26 的決策紀錄、`src/core/design-system/token-manifest.json`）。2026-07-11 的仲裁曾把色值當成兩端各自校準的值；2026-11-26 改成全面對齊，APP 改用本檔的色票與形狀，兩端共用同一組亮色與暗色數值。popup 與總覽頁只挑選既有 token，不新增也不改數值；要新數值時另開提案，兩端一起改。總覽頁只在 `overview.css` 的 `:root` 加兩個本頁用的版面變數（頂欄高 `--ov-top-height: 72px`、緩動 `--ov-ease`），不是色值。

**Key Characteristics:**
- 深藍鋪滿整個 popup，沒有卡片外框把內容圍起來。
- 一個情境一顆白色實體主鍵，下緣是 7px 的書口厚度。
- 次要入口是白色 2px 描邊鍵，下緣 4px。
- 全部直角（0px）。
- 按鍵即進度：提取中與完成時，鍵面取代提取鍵，保持按下的樣子。
- 浮起 2px、下沉 5px 的實體回饋，`prefers-reduced-motion` 時關掉。
- 總覽頁：深藍頂欄只放一顆白色書口鍵（下緣 5px），白底區的主動作用深藍書口鍵。
- 總覽頁：篩選欄選中項整列反白成深藍；封面直角，下緣是疊起的書頁細線。

## Colors

一個藍色色相的明度階梯，加上白色；總覽頁的白底工作區另外用一組偏藍的中性灰與一個錯誤紅，沒有第二個強調色。

### Primary
- **書背深藍 Bookbinding Navy**（`primary-darkest`）：popup 的整片底色；也是白色按鍵與選單上的文字色，以及選單項目反白時的底色。總覽頁的頂欄底色、篩選欄選中列、檢視切換的選中段、深藍實體鍵與 modal 主鍵的鍵面、modal 的 1px 外框、表頭 2px 底線、選中封面的 3px 外框，以及沒有封面圖時的替代封面。
- **墨水藍 Ink Blue**（`primary-dark`）：停用中的主鍵文字（例如「正在連線書櫃…」），在 `primary-light` 底上 6.2:1。總覽頁另用在停用的白色實體鍵文字、深藍實體鍵書口的深線、modal 主鍵滑過的底色，以及封面下「標籤 N」文字鍵。
- **焦點藍 Focus Blue**（`primary`）：只在總覽頁的白底區使用：鍵盤焦點框（2px）、搜尋框與下拉選單聚焦時的框線，以及封面下閱讀進度條的填色。
- **書口中藍 Page-Edge Blue**（`primary-medium`）：書口條紋的深線、深藍底上卡片與通知區的 1px 邊框、選單鈕的底線。只用在非文字的線條，不用在內文文字。

### Neutral
- **紙白 Paper White**（`surface`）：實體主鍵的鍵面、描邊鍵的框線與文字、深藍底上的主要文字、選單面板底、鍵盤焦點框。總覽頁的篩選欄、表格、匯入面板、modal 的底色，以及頂欄內的焦點框。
- **淡藍 Pale Blue**（`primary-light`）：品牌列與版本號的文字、停用主鍵的鍵面、提取中鍵面上移動的那一段填色、選單內的分隔線與面板邊框、文字選取的底色。總覽頁頂欄的「共 N 本．顯示 M 本」說明字、「重新載入」文字鍵、停用描邊鍵的框與字、篩選欄選中列的本數、深藍實體鍵書口的淺線、載入條的淺線。
- **紙邊淡藍 Page Tint**（`primary-lightest`）：書口條紋的淺線、本數、鍵下的提示文字（「請保持這個分頁開著」）。總覽頁篩選項目與檢視切換未選段的滑過底色、表格選中列的底色。
- **工作區灰 Desk Gray**（`background`）：總覽頁主區的底色；表格列滑過的底色。
- **封面底灰 Cover Gray**（`panel`）：封面圖載入前的底、標籤展開列的底、檔案選擇鈕的底。
- **墨色 Ink**（`on-background`）：總覽頁白底區的主要文字（書名、篩選項目、modal 標題、白底次要鍵）。
- **次墨 Soft Ink**（`on-surface`）：篩選本數、作者欄、空狀態與 modal 的說明文字、下拉箭頭。
- **淡墨 Muted Ink**（`on-surface-muted`）：篩選組標題、排序標籤、表頭、作者與書城、進度數字、placeholder；也是搜尋框與下拉的 1px 框線（白底上唯一的辨認依據，要達 3:1）。
- **細線灰 Hairline**（`border`）：篩選欄右側分隔線、表格外框與列線、進度軌道、停用白底鍵的框。
- **框線灰 Rule Gray**（`border-strong`）：白底次要鍵與匯入面板的 1px 框、封面下緣書頁細線、表格展開鈕的框、捲軸色。
- **錯誤紅 Error Red**（`error`）：只在總覽頁白底區使用：錯誤區的框、錯誤訊息文字、「重試」鍵；modal 的「覆蓋」描邊鍵與「確認清空」實心鍵。
- **錯誤淡紅 Error Blush**（`error-light`）：錯誤通知區的邊框與深藍底上的錯誤文字。

閱讀狀態標籤（未讀、待讀、閱讀中、讀完、放棄、參考）的前景與背景取共用的 `--status-*-fg` / `--status-*-bg` token，各對都達 WCAG AA；這些是資料的分類色，只出現在標籤上，不拿來當介面的強調色。

**文字用的深值。** `warning`（`#B7791F`）在白底上只有 3.64:1，只用在圖示與線條；警告文字用 `warning-text`（`#8A5A12`，5.91:1），放在 `warning-container`（`#FFF3E0`）上的字用 `#6B4510`。錯誤的淡底是 `error-container`（`#FDECEA`），其上的字用 `error-text`（`#8C1D17`）。錯誤與警告不共用顏色。

**重要程度。** 1–7 級是資料分類色（`--importance-1` 到 `--importance-7`），同一個藍色明度階梯：亮色 `#5B6573`、`#4677E6`、`#2F66E0`、`#1A56DB`、`#1442AE`、`#0F317D`、`#0A2259`，級數越高越深。每級在 `surface` 與 `primary-lightest` 上 ≥ 3:1，只用在星號、圓點這類非文字圖形；不拿錯誤紅或警告色代表等級。

### Dark

系統是暗色模式（`prefers-color-scheme: dark`）時，**只有白底工作區換成暗色**：總覽頁的 `.ov-body` 與它的 modal 標上 `data-color-scope="workspace"`，`design-system.css` 在這個範圍覆寫色彩變數（值在 `colors.js` 的 `DARK_COLORS`、`DARK_STATUS_COLORS`、`IMPORTANCE_COLORS.dark`）。popup 與總覽頁頂欄本來就是深藍底，亮暗都不變。APP 的暗色主題用同一組數值。

| token | 亮色 | 暗色 | 角色 |
|---|---|---|---|
| `background` | `#F5F7FA` | `#0D1320` | 工作區底 |
| `surface` | `#FFFFFF` | `#151C2B` | 篩選欄、表格、modal、白底次要鍵 |
| `panel` | `#EDF1F7` | `#1C2536` | 封面載入前、展開列 |
| `on-background` | `#1A2233` | `#E6EBF3` | 主要文字 |
| `on-surface` | `#34404F` | `#C5CEDB` | 次要文字 |
| `on-surface-muted` | `#5B6573` | `#98A3B4` | 弱文字、輸入框框線 |
| `border` | `#D9E0EA` | `#2A3447` | 細線 |
| `border-strong` | `#C4CDD9` | `#3A4660` | 框線、書頁細線 |
| `primary` | `#1A56DB` | `#7EA6F7` | 焦點、進度填色 |
| `primary-darkest` | `#0F317D` | `#CBDBF8` | 選中列、深藍實體鍵與 modal 主鍵的鍵面 |
| `primary-dark` | `#1442AE` | `#9DBBF9` | 墨水藍文字 |
| `primary-light` | `#CBDBF8` | `#2A4478` | 停用鍵面、選取底、書口淺線 |
| `primary-lightest` | `#EAF0FD` | `#1B2C52` | 滑過與選中列的淡底 |
| `error` | `#C2342B` | `#F28B82` | 錯誤框與字、「覆蓋」「確認清空」 |
| `warning-text` | `#8A5A12` | `#E3B05C` | 警告文字 |

暗色下深藍明度階梯反轉：`primary-darkest` 變淺、`surface` 變深，所以「深藍底白字」（選中列、深藍實體鍵）在暗色下是「淺藍底深字」，元件規則不必另寫一套。閱讀狀態的暗色配色是淡字深底（例如閱讀中 `#E3F2FD` 配 `#1A3557`），重要程度的暗色階梯是 `#98A3B4`、`#5B8DEF`、`#7EA6F7`、`#9DBBF9`、`#B5CCFA`、`#CBDBF8`、`#EAF0FD`，級數越高越亮。暗色範圍內每組前景與背景都達 WCAG 2.1 AA。

### Named Rules
**The Single Ink Rule.** popup 裡所有顏色都來自 `primary` 的明度階梯與白色；主次靠明度表達，不另外引進強調色。錯誤只換邊框色（`error-light`），不把整塊染紅。

**The White Desk Rule.** 總覽頁的灰藍中性色只出現在頂欄以下的白底工作區；頂欄跟 popup 一樣只用藍色明度階梯與白色。錯誤紅（`error`）平時只畫框與字，只有不可逆的「確認清空」與滑過時的「覆蓋」「重試」才整塊填紅。

**The Shared Value Rule.** 色值與 Flutter 行動版共用，亮色與暗色各一組；這個介面只挑選既有 token，新色值要開聯合提案。

**The Scoped Dark Rule.** 暗色只覆寫白底工作區（`data-color-scope="workspace"`）；深藍的 popup 與頂欄不跟著換，`surface` 在那裡仍是紙白。新加的白底區塊或 modal 要標上同一個屬性，暗色才會套到。

## Typography

**Body Font:** 系統字型堆疊 `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`（macOS 的繁體中文落到 PingFang TC）。總覽頁的 `body` 宣告 `-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang TC', 'Microsoft JhengHei', sans-serif`，明確列出繁體字形。

**Character:** 系統黑體，粗體承擔層級；中文與數字混排，本數用等寬數字（`tabular-nums`）。

### Hierarchy
- **Headline**（700，24px，1.3）：情境標題，書城名稱或「Readmoo 書櫃」。
- **Title Large**（700，20px，1.3）：總覽頁頂欄的「我的書庫」與空狀態標題（「書庫還沒有書」「沒有符合條件的書」）。
- **Title Medium**（700，18px）：總覽頁 modal 標題（「選擇匯入模式」「確認清空書庫？」）。
- **Title**（700，16px，1.4）：主鍵與描邊鍵上的動作文字、鍵面上的進度與結果。總覽頁的匯入面板標題也用 16px 粗體。
- **Body**（400，16px）：本數（「128 本」）。總覽頁空狀態的說明文字（16px，行高 1.6）。
- **Body Medium**（600，14px）：選單項目；取消提取、重新載入擴充功能這類文字連結用同字級、一般字重（400）加底線。總覽頁的基準字級是 14px（行高 1.5）：所有按鍵、篩選項目與本數用 600，書名用 700。
- **Label**（600，12px，0.08em，全大寫）：只用在頂端的產品名「BOOK OVERVIEW」，旁邊接中文副名與選單鈕，是品牌列，不是標題上方的小標。總覽頁同一組數值（不大寫）用在篩選欄的組名（閱讀狀態、書城、重要程度、標籤），那是一組選項的名稱，不是標題上方的小標。
- **Caption**（400，12px）：版本號、鍵下提示、通知區的說明文字。總覽頁的作者、書城、進度數字、閱讀狀態標籤與標籤 chip。

### Named Rules
**The Weight Carries Rank Rule.** 層級靠字重與字級（24/16/14/12）表達，不靠顏色以外的裝飾；同一畫面只有情境標題用 24px。總覽頁沒有 24px，最大是頂欄標題與空狀態標題的 20px。

**已知缺口（未解決）。** 共用 token `--font-family` 是 `'PingFang SC', 'Microsoft YaHei', sans-serif`，`'PingFang SC'` 是簡體字形。popup 的 `body` 自己宣告系統字型堆疊，所以繁體中文顯示成 PingFang TC；按鈕以 `font-family: inherit` 跟著 body。總覽頁同樣自己宣告字型堆疊（含 `'PingFang TC'`），按鍵與輸入框以 `font: inherit` 跟著 body。這個不一致目前保留：共用 token 的值要改須照 PROP-014 跟 Flutter 一起提案，本檔不視為已解決，新介面也不要直接套用 `--font-family`。

## Layout

popup 寬 350px、最小高度 400px（Chrome 上限 600px 高，超過捲動）。單欄，左右留白 24px（`spacing.lg`），內容一律靠左對齊，包括按鍵上的文字。

由上而下：品牌列與「選單」（上 16px）；情境標題與本數；主鍵區（標題下 24px，不在書城時 4px）；鍵下的提示、取消連結與通知區；描邊鍵「檢視書庫」（主鍵區下 24px）；版本號。不在書城時，主鍵的位置換成三顆書城實體鍵（每顆下距 16px），標題與本數不顯示。

間距只用共用尺度：2 / 4 / 8 / 16 / 24 / 48px。選單面板從頂端 48px、右側 24px 處展開，最小寬 220px。

**總覽頁。** 桌面分頁，設計寬度 1440 與 1024。
- **頂欄：** 高 72px、黏在頂端，左右內距 32px（`spacing.xl`）；左邊標題與本數基線對齊（間距 16px），右邊按鍵間距 8px、由輕到重排：「重新載入」文字鍵、「匯入」「匯出 CSV」描邊鍵、「匯出 JSON」實體鍵。
- **主體：** 兩欄格線，左欄 240px 篩選欄（黏在頂欄下、自己捲動，內距 16px 8px 32px，組與組之間 24px），右側主區內距 24px 32px 48px。
- **工具列：** 一行，搜尋（最寬 320px）與排序在左，已選本數、「選取全部」與檢視切換靠右；控制項高度一律 38px，窄時右組整組換行。工具列下距 24px。
- **封面網格：** 每欄最小 148px 自動填滿，欄距 24px、列距 32px。
- **窄視窗（≤860px）：** 頂欄改為不黏、直排；篩選欄收到主區上方，四組並排成每欄最小 160px 的格線，書目不必等篩選欄捲完才出現；表格可橫向捲動。

總覽頁的間距同樣取共用尺度，另外用到 32px（`spacing.xl`）。

### Named Rules
**The One Key Rule.** 一個情境只有一顆實體主鍵（書城清單情境是同一種主鍵重複三次，每顆各是一家書城）；常駐的次要入口只有一顆描邊鍵，其他入口收進選單。總覽頁的頂欄同樣只有一顆白色實體鍵（「匯出 JSON」），其他動作退成描邊鍵與文字鍵；白底區每個區塊最多一顆深藍實體鍵（空狀態的下一步、匯入面板的「載入檔案」），其餘用白底次要鍵。

## Elevation & Depth

深度不靠陰影，靠按鍵自己的厚度。實體鍵下緣是 7px 書口：`primary-lightest` 與 `primary-medium` 交替的 1px 橫線（`repeating-linear-gradient(180deg, …)`）。厚度隨狀態變化：滑過時鍵上移 2px、書口加厚到 9px；按下時鍵下移 5px、書口收成 2px。描邊鍵的厚度是較粗的 4px 下框。

唯一的投影在選單面板上（`0 12px 24px` 加 `--shadow-color-md`），讓浮在深藍底上的白色面板跟主鍵分開。

**總覽頁。** 頂欄的按鍵比 popup 小一號，書口也薄一號：白色實體鍵下緣 5px（同樣是 `primary-lightest` / `primary-medium` 交替線），滑過上移 2px、書口 7px，按下下移 4px、書口 1px。深藍實體鍵的書口換成 `primary-light` / `primary-dark` 交替線，讓它在白底上也讀得出厚度。描邊鍵一樣是 2px 框加 4px 下框，滑過上移 2px、按下下移 2px。

封面的厚度是書頁：封面下緣疊兩道 1px `border-strong` 細線，線與線之間隔一道 2px 白，最外面再墊一層很淡的擴散陰影（`0 10px 16px -8px` 加 `--shadow-color-md`）；滑過時封面上移 3px。modal 有一層 `0 12px 32px` 加 `--shadow-color-md` 的投影，浮在 `--overlay-scrim` 遮罩上。這兩處之外，總覽頁的面都是平的，靠 1px 框線與底色分層。

### Named Rules
**The Thickness Is Depth Rule.** 可以按的東西用下緣厚度表達「可以按下去」，按下就收薄；不用投影或發光模擬按鍵的高度。

**The Pressed Face Rule.** 提取中與完成時，鍵面保持按下的位置（下移 5px、書口 2px），表示這一下已經按了；鍵面不可再按。

**The Page Lines Rule.** 書的厚度一律畫成 1px 細線疊起來（按鍵的書口、封面下緣、載入條），不用一整塊實色的偏移陰影。

## Shapes

全部直角（`rounded.none`，0px）：按鍵、描邊鍵、選單面板、通知區、錯誤區都一樣。總覽頁也一樣：按鍵、篩選項目、搜尋框與下拉、檢視切換、封面、標籤、匯入面板、錯誤區、表格、modal，`border-radius` 一律寫 0。共用的 `--radius-*` token 仍定義在 `design-system.css`（數值跟 Flutter 共用），popup 與總覽頁都不使用。

線條只有三種：書口的 1px 細線、深藍底上 1px `primary-medium` 的框、描邊鍵 2px 白框加 4px 下框。總覽頁的白底區另外有：1px 中性框（`border` / `border-strong` / 輸入框的 `on-surface-muted`）、modal 與檢視切換的 1px `primary-darkest` 框、表頭的 2px `primary-darkest` 底線、選中封面的 3px `primary-darkest` 外框（偏移 3px）。

下拉選單的箭頭與表格的展開箭頭用 CSS 畫（斜切漸層、邊框三角形），不用字元。

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

### 總覽頁按鍵

五種按鍵共用同一個底：直角、內距 8px 16px、14px 600、行高 1.4、不換行；過渡 140ms `cubic-bezier(0.16, 1, 0.3, 1)`（位移、底色、框色）。
- **白色實體鍵（頂欄主動作）：** 白鍵面、深藍字，下緣 5px 書口（見 Elevation）。頂欄只有一顆：「匯出 JSON」。
- **深藍實體鍵（白底區主動作）：** 深藍鍵面、白字，書口是 `primary-light` / `primary-dark` 交替線，浮起與下沉跟白色實體鍵相同。用在空狀態的下一步（「匯入 JSON 檔」「清除篩選」）與匯入面板的「載入檔案」。
- **白色描邊鍵（頂欄次要動作）：** 透明底、2px 白框、4px 白色下框、白字；內距扣掉框寬（6px 14px 4px），外框尺寸跟實體鍵一致。「匯入」「匯出 CSV」。只放在深藍頂欄上。
- **文字鍵（頂欄最輕的動作）：** 淡藍字（`primary-light`）加底線（偏移 4px），無框無底，滑過字變白。「重新載入」。
- **白底次要鍵：** 白底、1px `border-strong` 框、墨色字，滑過框變深藍。「選取全部」（在工具列裡高 38px）、「載入範例資料」。
- **Focus:** 白底區是 2px `primary` 外框、偏移 2px；頂欄內改成白色外框、偏移 3px。
- **Disabled:** 書庫是空的時，「匯出 CSV」「匯出 JSON」「選取全部」與檢視切換停用：不再位移、游標回到預設；白色實體鍵退成淡藍鍵面、墨水藍字（書口維持 5px），描邊鍵的框與字退成淡藍，白底次要鍵的框退成 `border`、字退成淡墨，檢視切換的字退成淡墨。

### 總覽頁篩選欄

左側 240px 白底欄，右邊 1px `border` 分隔線，`aria-label="篩選書目"`。最上面一列「全部」（粗體），其下四組：閱讀狀態、書城、重要程度（APP 的七級，唯讀）、標籤。
- **組名：** 12px 600、字距 0.08em、淡墨，左右縮 8px。
- **項目：** 整列按鈕，左邊名稱、右邊本數（14px 600、等寬數字、次墨），內距 6px 8px，直角，透明底；滑過底變紙邊淡藍（120ms）。
- **選中：** `aria-pressed="true"`，整列反白成深藍底白字，本數變淡藍。跟 popup 選單項目的反白是同一個動作。

### 總覽頁工具列與輸入

- **搜尋框與下拉：** 高 38px，白底、1px 淡墨框、直角、14px；聚焦時框與 2px 外框（偏移 -1px）換成 `primary`，不加光暈。下拉用 `appearance: none` 去掉原生外觀，箭頭用兩道斜切漸層畫。排序標籤 12px 600 淡墨。
- **已選本數：** 深藍 600 等寬數字，`aria-live="polite"`，沒有選取時隱藏。
- **檢視切換（分段）：** 「封面」「表格」兩段接在一個 1px 深藍框裡，高 38px，每段內距 0 16px；選中段（`aria-pressed="true"`）深藍底白字，未選段白底深藍字，滑過底變紙邊淡藍。

### 總覽頁封面網格

- **封面：** 2:3 直角，載入前是 `panel` 底，圖片 `object-fit: cover`；下緣是書頁細線（見 Elevation），滑過上移 3px（160ms）。沒有封面圖時，替代封面是深藍底、書名白色粗體貼左下（內距 8px）。
- **選取：** 左上 20px 的勾選框（`accent-color` 深藍），平時隱藏，滑過、聚焦、已勾，或頁面上已有任何選取時顯示；選中的封面外加 3px 深藍框、偏移 3px。
- **封面下的文字：** 書名 14px 粗體最多兩行（上距 16px）、作者 12px 淡墨單行截斷（缺作者時寫「作者未提供」）、進度條（4px 高，軌道 `border`、填色 `primary`，右側百分比 12px 淡墨等寬）、一列閱讀狀態標籤與書城名、「標籤 N」文字鍵（12px 600 墨水藍、底線偏移 3px），按下展開標籤 chip。

### 總覽頁表格

- 8 欄，外面是白底加 1px `border` 框；表頭黏在頂欄下方，12px 600 淡墨、靠左，下緣 2px 深藍線；列內距 8px 16px、列線 1px `border`。
- 勾選欄與展開欄各 44px 寬；勾選框 16px、`accent-color` 深藍；選中列底色紙邊淡藍，滑過變淡藍；一般列滑過底色 `background`。
- **展開鈕：** 28px 方形、1px `border-strong` 框、白底，箭頭是邊框畫的三角形（收合時次墨朝右、展開時深藍朝下），滑過框變深藍。展開列底色 `panel`，左縮排對齊書名欄。

### 總覽頁標籤

- **閱讀狀態標籤：** 直角、內距 1px 6px、12px，前景與背景取 `--status-<狀態>-fg/bg`。
- **標籤 chip：** 直角、內距 0 6px、12px、行高 1.6。

### 總覽頁狀態：載入、空、錯誤

- **載入：** 主區中央一條 48×6px 的直角書口條（`primary-light` / `primary-darkest` 交替 1px 線），可見的一段在條上來回掃（`clip-path`，1.2s `cubic-bezier(0.65, 0, 0.35, 1)`，往返無限）；下方「載入中...」淡墨字。不顯示百分比。`role="status"`。
- **空狀態：** 靠左、最寬 560px、上下 48px。標題 20px 粗體；書庫是空的時加一段 16px 次墨說明（行高 1.6），告訴使用者下一步去哪裡做；下方只有一顆深藍實體鍵（上距 24px）。書庫是空的時是「匯入 JSON 檔」，篩選後沒有結果時是「清除篩選」，沒有說明段。
- **錯誤：** 白底、1px `error` 框、內距 16px；錯誤訊息 `error` 600；「重試」鍵是 1px `error` 框、白底紅字、內距 4px 16px，滑過整塊填紅、字變白。`role="alert"`。

### 總覽頁匯入面板

按「匯入」開關。白底、1px `border-strong` 框、內距 16px，標題 16px 粗體獨佔一行；檔案選擇鈕直角、`panel` 底、1px `border-strong` 框；接著深藍實體鍵「載入檔案」與白底次要鍵「載入範例資料」。

### 總覽頁 Modal

匯入模式選擇與清空確認共用一個 modal。
- **框：** 白底、四邊 1px 深藍框、直角，最寬 480px（窄時 90%），內距 24px，`0 12px 32px` 投影，背後是 `--overlay-scrim` 遮罩。`role="dialog"`、`aria-modal="true"`。
- **文字：** 標題 18px 粗體墨色，說明 14px 次墨行高 1.6。
- **按鍵：** 直排、間距 8px、靠左，內距 8px 16px、14px 600、直角、焦點 2px `primary` 外框。
  - 主要（「合併（保留現有書庫）」）：深藍底白字，滑過變墨水藍。
  - 次要（「取消」）：白底、1px `border-strong` 框、墨色字，滑過框變深藍。
  - 「覆蓋（清空現有書庫）」：白底、1px `error` 框、紅字的描邊鍵，滑過整塊填紅、字變白。它會清空書庫，所以不跟安全的「合併」同重量。
  - 「確認清空」：紅底白字的實心鍵，只出現在清空的二次確認；預設焦點落在「取消」。

### 用語
書城那一端的書目叫「書櫃」（「Readmoo 書櫃」「前往博客來書櫃」），本機集中後的叫「書庫」（「檢視書庫」「匯入書庫」）。英文書城名跟中文之間留空格，中文書城名不留。總覽頁照同一條：頁名「我的書庫」、「匯入書庫 JSON 檔」、「書庫還沒有書」，叫使用者去提取時寫「書櫃頁」。

## Do's and Don'ts

### Do:
- **Do** 讓 `primary-darkest` 鋪滿整個 popup，內容直接放在深藍上。
- **Do** 每個情境只放一顆白色實體主鍵，下緣畫 7px 書口（`primary-lightest` / `primary-medium` 交替 1px 線）。
- **Do** 用浮起 2px、下沉 5px 表達可按；在 `prefers-reduced-motion: reduce` 時關掉過渡與動畫，提取中的填色改成靜態半透明。
- **Do** 讓進度與結果寫在同一顆鍵的鍵面上，鍵面保持按下的樣子。
- **Do** 只在連線中、錯誤、警告時顯示通知區，放在主鍵下方。
- **Do** 書城端寫「書櫃」，本機端寫「書庫」。
- **Do** 只挑選既有 token 數值；新數值走跟 Flutter 一起的提案。
- **Do** 總覽頁頂欄只放一顆白色實體鍵（下緣 5px 書口），其餘動作用白色描邊鍵與淡藍文字鍵，由輕到重往右排。
- **Do** 白底區需要主動作時用深藍實體鍵（書口 `primary-light` / `primary-dark` 交替線），每個區塊最多一顆。
- **Do** 篩選與切換的選中狀態一律整列或整段反白成深藍底白字，並用 `aria-pressed` 標出。
- **Do** 空狀態只給一顆下一步的按鍵；書庫是空的時用「匯入 JSON 檔」，篩選後沒有結果時用「清除篩選」。
- **Do** 白底區的輸入框與下拉用 1px `on-surface-muted` 框，聚焦時換成 `primary`；控制項高度統一 38px。
- **Do** 把會清空書庫的選項做成紅色描邊鍵，跟安全的選項分出重量；最後一步的確認才用紅色實心鍵，預設焦點放在「取消」。

### Don't:
- **Don't** 用圓角；popup 與總覽頁一律 0px，也不取用 `--radius-*`。
- **Don't** 把幾個同重量的按鈕排成一排或包進一張卡片。
- **Don't** 在提取中顯示百分比或假的進度條；popup 收不到真實進度。總覽頁的載入條同樣不顯示百分比。
- **Don't** 在完成時加打勾圖示。
- **Don't** 在標題上方加小標（eyebrow）；頂端的「BOOK OVERVIEW」是產品名，總覽頁篩選欄的組名是一組選項的名稱，都不是小標的範例。
- **Don't** 在卡片或通知區的單側加強調色條；按鍵下緣的書口與描邊鍵的 4px 下框是按鍵的厚度，不是強調條。
- **Don't** 用 Unicode 字元或 emoji 當圖示；箭頭用 CSS 畫。
- **Don't** 放描述情境的提示文字；文字只用在要求互動或回報結果。
- **Don't** 把白色描邊鍵放到白底區；白底區的次要動作用 1px `border-strong` 框的白底次要鍵。
- **Don't** 把總覽頁白底工作區的灰藍中性色（`background`、`panel`、`border`、`on-*`）或錯誤紅帶進 popup 或頂欄。
- **Don't** 拿閱讀狀態標籤的 `--status-*` 色當介面的強調色。

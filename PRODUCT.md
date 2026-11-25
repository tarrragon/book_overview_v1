# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

在台灣電子書城（Readmoo、博客來、Kobo，之後陸續加入其他書城）買書的讀者，書分散在幾家書城的書櫃裡。他們要把各書城的書庫集中到自己的電腦上：查一本書買在哪一家、讀到哪裡、依標籤整理，並在換電腦或手機時把書庫帶過去。

## Product Purpose

Chrome 擴充功能。使用者在書城的書櫃頁面按下提取，擴充功能讀出書目（書名、作者、封面網址、閱讀進度與狀態、標籤），存進本機；之後在書庫總覽頁搜尋、篩選、排序、加標籤，並匯出成 CSV 或 JSON、從 JSON 匯入。成功的樣子：使用者不必逐一打開各書城的書櫃，就知道自己有哪些書、讀到哪裡。

## Positioning

資料只存在使用者的本機，不上傳、不需要帳號；同一份 JSON 格式（canonical v3）也是 Flutter 行動版讀寫的格式，兩端可以互相匯入。

## Operating Context

- popup 是常開的快速入口：前往各書城的書櫃、開啟書庫總覽、匯入，以及在書櫃頁面上提取；提取是其中一個動作，不是唯一的主角。
- 提取只能在書城的書櫃頁面上做，而且要等擴充功能的背景服務與頁面裡的腳本都回應之後才能開始；popup 開啟當下這兩者可能還沒準備好。
- 書庫總覽頁（overview）是使用者停留最久的畫面：表格、搜尋、排序、標籤、匯出入。

## Capabilities and Constraints

- Chrome Extension Manifest V3；popup 寬 350px，Chrome 限制 popup 最大 800×600，超過的內容要捲動。
- 介面語言只有繁體中文；介面文字集中在 `src/popup/constants/ui-text.js` 這類常數檔，不寫死在 HTML 或 JS。
- 介面不用 emoji（`npm run lint:emoji` 檢查）。
- design token 的數值（顏色、間距、字級、圓角）跟 Flutter 行動版對齊（`docs/proposals/PROP-014-design-token-value-unification.md`、`src/core/design-system/token-manifest.json`），重新設計不改數值；要新數值時另開提案，兩端一起改。
- 功能不變：JS 依 id 與 class 找元素、測試直接讀 HTML，重新設計時這些接點照舊。
- 未決：產品名稱在 manifest、README 與文件裡寫法不一；介面一律用「Book Overview — 電子書庫總覽」，其餘位置的統一留到上架前決定。

## Brand Commitments

- 名稱：Book Overview — 電子書庫總覽（跟 manifest 與 Chrome 工具列顯示的名稱一致）。

## Evidence on Hand

- 隱私權政策：`PRIVACY.md`（資料只存本機、不蒐集個人識別資訊）。
- 用例規格：`docs/use-cases.md`（UC-01 至 UC-07）。
- README 的使用者人數與評分徽章不是實際數據，介面與文案不引用；目前沒有可引用的使用者數、評價或推薦。

## Product Principles

- 先讓使用者知道現在能做什麼：popup 開啟時，這一頁能不能提取、為什麼不能、要去哪裡，比功能清單重要。
- 狀態照實說：還在連線就說還在連線，不提早說就緒；失敗時說原因與下一步。
- 資料是使用者的：任何清空或覆蓋書庫的動作都要先確認後果。
- 一個入口一個動作：還沒做好的功能不放可以按的按鈕。

## Accessibility & Inclusion

WCAG 2.1 AA：文字對比 4.5:1（大字 3:1）、全部操作可用鍵盤完成、焦點可見、靠顏色表達的狀態另有文字。

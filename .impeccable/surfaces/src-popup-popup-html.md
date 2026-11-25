---
version: 1
slug: "src-popup-popup-html"
primary_target: "src/popup/popup.html"
related_targets: []
---

## Scope

Chrome 擴充功能的 popup（`src/popup/popup.html`），寬 350px、最高 600px。Mode：operate。

## Task

常開的快速入口。開啟時依目前分頁決定唯一的主動作：書城書庫頁上是提取，書城的其他頁是前往這家的書庫（在目前分頁切換），不在書城時是選一家書城前往（開新分頁）。「檢視書庫」常駐；匯入書庫與其他書城在選單裡。提取中可以取消；完成時回報新增、更新幾本，或沒有變化。

## Constraints

- design token 數值不改（跟 Flutter APP 對齊）；圓角取 0。
- 功能不變：popup.js 依 id 與 class 找的元素全部保留（清單見 `scratchpad/popup-before/ids-*.json` 與 popup.js 的 querySelector）。
- 不放描述情境的提示；文字只用在要求使用者互動或回報操作結果。
- 不用 emoji、不用 Unicode 字元當圖示；WCAG 2.1 AA。

## Direction contract

THESIS: popup 只做一件事，而那一件事是一顆有厚度的按鍵；拒絕「一張卡裡一排同重量按鈕」的工具列預設。
OWN-WORLD: 整個 popup 鋪滿 #0F317D；主動作是直角白色實體鍵，下緣的厚度畫成書口（細線疊成的書頁邊）；次要入口是直角白色描邊鍵；選單項目是平時純文字、聚焦時整列反白。只用既有 token 色值。
STORY: 使用者打開 popup 就看到這一頁能做的那件事，按下去，同一顆鍵變成進度，結束時鍵面寫出新增與更新的本數。
FIRST VIEWPORT: 上方一行品牌與「選單」；中段是書城名稱（24px 粗體）與本數，其下是全寬主動作鍵；再下方是「檢視書庫」描邊鍵；底部版本號。不在書城時，主動作的位置換成三家書城各一顆實體鍵。
FORM: 單一主動作加選單，結構清單第 6 名。seed: none (pinned) 使用者依序鎖定：「我會傾向單一動作加主選單」「藍色底色可以直接覆蓋整個POPUP，檢視書庫這個按鈕其實就算放在深藍底色下也沒問題」「我覺得實體按鈕S2 不錯」「A、E、F，但是E我不要有 完成的打勾圖示」。A 是書口厚度（實體鍵下緣畫成書頁邊），E 是按鍵即進度（提取中與完成時鍵面取代提取鍵），F 是滑過浮起、按下下沉；S2 是次要入口用白色描邊。
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

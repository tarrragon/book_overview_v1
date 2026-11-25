---
version: 1
slug: "src-overview-overview-html"
primary_target: "src/overview/overview.html"
related_targets: ["src/overview/overview.css", "src/overview/overview-page-controller.js", "src/overview/overview-facets.js"]
---

## Scope

擴充功能的書庫總覽頁（`src/overview/overview.html`），桌面瀏覽器分頁，設計寬度 1440 與 1024。Mode：operate。

## Task

瀏覽與整理本機書庫：看得出各類各有幾本，點一下就篩選；找書、排序、選取、匯出、匯入；展開一本書看標籤。

## Constraints

- design token 數值不改（跟 Flutter APP 對齊）；圓角取 0；視覺語言沿用 popup（深藍、直角、書口實體鍵）。
- 功能不變：controller 與 overview.js 依 id 查找的元素、JS 加上的 class 全部保留；表格維持 8 欄（`overview-column-consistency.test.js`）。
- 重要程度（APP 的七級 importanceLevel）在這一頁唯讀：只篩選，不編輯。值來自 `importanceLevel` 或 `_passthrough.tags.importance`。
- 不放描述情境的提示；文字只用在要求使用者互動或回報操作結果。空狀態要給下一步。
- 不用 emoji、不用 Unicode 字元當圖示；WCAG 2.1 AA。

## Direction contract

THESIS: 書庫先回答「各類各有幾本」，再讓人點進去看；拒絕「一張表格上面壓一排同重量按鈕」的資料表預設。
OWN-WORLD: 頂欄鋪滿 #0F317D，標題與本數白字；主動作「匯出」是直角白色書口實體鍵，次要動作是白色描邊鍵。左側白底篩選欄，項目平時純文字加右側本數，選中時整列反白成深藍。書目預設是封面網格，封面直角、下緣一條書口細線；可切換成表格。只用既有 token 色值。
STORY: 使用者打開總覽，左欄一眼看到閱讀中幾本、各書城幾本、哪些標了推薦或可清理；點一項，右側只剩那些書；勾選幾本後匯出。
FIRST VIEWPORT: 頂欄左邊「我的書庫」20px 粗體與「共 N 本．顯示 M 本」，右邊重新載入、匯入（描邊）、匯出 CSV（描邊）、匯出 JSON（實體鍵）。其下左欄 240px：閱讀狀態、書城、重要程度、標籤四組。右側一行工具列（搜尋、排序、方向、選取全部、網格／表格切換），下面封面網格。
FORM: 左側篩選欄加封面網格，結構清單第 5 名（dealt）。seed:be30d45575777f7e。使用者原話：「我傾向左側篩選欄的做法」「先放唯讀的重要程度篩選，編輯之後再規劃」。
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## 畫面狀態矩陣

| 狀態 | 顯示 | 可用操作 | 進入條件 | 退出路徑 |
|---|---|---|---|---|
| 載入中 | 主區載入指示（文字「載入中...」） | 無（篩選與工具列照常可見） | 開頁、重新載入 | 載入完成或失敗自動離開 |
| 有書（網格） | 左欄四組本數、封面網格 | 篩選、搜尋、排序、選取、匯出、匯入、切表格、展開標籤 | 載入完成且有書 | 切表格；清空書庫進空狀態 |
| 有書（表格） | 左欄、8 欄表格 | 同上；表頭全選 | 按「表格」 | 按「網格」 |
| 篩選後無結果 | 「沒有符合條件的書」與「清除篩選」 | 清除篩選、改搜尋 | 篩選或搜尋後 0 本 | 清除篩選 |
| 書庫是空的 | 「書庫還沒有書」與兩個下一步：到書城書櫃頁用擴充功能提取、匯入 JSON 檔 | 匯入 | 載入完成 0 本 | 匯入成功；提取後 storage 變更自動重載 |
| 匯入面板開啟 | 檔案選擇、載入檔案、載入範例 | 選檔、載入、再按匯入收起 | 按「匯入」 | 再按「匯入」 |
| 匯入模式／清空確認 | modal | 覆蓋、合併、取消 | 載入檔案 | 任一按鈕 |
| 錯誤 | 錯誤訊息與「重試」 | 重試 | 讀取或匯入失敗 | 重試；篩選與匯入照常可用 |

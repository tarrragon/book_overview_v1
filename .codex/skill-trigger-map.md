# Skill Trigger Map

本表定義 Codex 在此專案中對 `.claude/skills/` 的載入對照。當使用者提及相關關鍵字、動詞或工作意圖時，Codex 應主動讀取對應 `SKILL.md`，而不是只依賴顯式 `/skill-name` 指令。

## 使用規則

- 先比對**意圖**，再比對關鍵字。
- 一個請求可同時命中多個 skill；若多個 skill 都合理，先讀最接近主任務的 skill，再補讀支援性 skill。
- 若 skill 已標示 deprecated，改讀其替代 skill。
- 若請求涉及流程決策，先走 `.claude/pm-rules/decision-tree.md`，再依本表載入 skill。

## 對照表

| Skill | 主要意圖 | 常見觸發詞 / 表述 |
|------|------|------|
| `5w1h-decision` | 建 ticket 或 todo 前先釐清 5W1H 決策 | `5W1H`, `先釐清`, `先想清楚`, `避免重複實作`, `建立 todo 前`, `決策框架` |
| `agent-team` | 多代理人 / team / swarm 協作與即時協商 | `team`, `swarm`, `多代理人`, `agent team`, `協作派工`, `即時協商` |
| `branch-worktree-guardian` | 分支與 worktree 隔離、避免在錯分支開發 | `branch`, `worktree`, `錯分支`, `隔離開發`, `建立開發分支` |
| `broken-link-check` | 掃描 Markdown 失效連結 | `broken link`, `失效連結`, `路徑壞掉`, `連結檢查`, `文件路徑驗證` |
| `bulk-evaluate` | 大型任務拆成多個子 Ticket / 批量評估 | `批量評估`, `大量檔案`, `大規模審查`, `拆成很多子任務`, `context 卸載` |
| `cognitive-load-assessment` | 評估複雜度、拆分需求、是否要升級代理 | `複雜度`, `認知負擔`, `要不要拆`, `任務太大`, `熱點識別`, `code review 複雜度` |
| `compositional-writing` | 寫註解、文件、prompt、post-mortem、長文技術文 | `寫註解`, `寫文件`, `寫日誌`, `寫 prompt`, `技術文章`, `post-mortem`, `復盤`, `atomic writing` |
| `decision-tree-helper` | 快速做決策樹輔助判斷與派工建議 | `快速評估`, `派發建議`, `拆分建議`, `並行可行性`, `decision tree helper` |
| `design-decision-framework` | 3+ 技術方案或重大架構方案評估 | `方案比較`, `技術選型`, `架構決策`, `多方案`, `選哪個方案` |
| `dispatch-strategy-review` | 代理派發失敗後檢討策略 | `派發失敗`, `重複分派失敗`, `代理選錯`, `dispatch strategy` |
| `doc` | proposal / spec / use case 文件系統查詢與建立 | `PROP-`, `SPEC-`, `UC-`, `提案`, `規格`, `用例`, `需求文件`, `需求追蹤` |
| `doc-flow` | worklog、CHANGELOG、todolist、error-pattern 等文件流程管理 | `worklog`, `CHANGELOG`, `todolist`, `文件流程`, `版本文件`, `文件一致性` |
| `evidence-driven-bugfix` | bug report、測試失敗、需要證據驅動除錯 | `bug`, `除錯`, `debug`, `測試失敗`, `重現問題`, `根因分析`, `最小修復` |
| `i18n-checker` | 掃描硬編碼中文字與 i18n 修復 | `i18n`, `硬編碼中文`, `中文硬編碼`, `ARB`, `國際化`, `字串抽取` |
| `lsp-first` | 符號搜尋、定義/引用查找、LSP 配置與工具選擇 | `LSP`, `找定義`, `找引用`, `符號搜尋`, `go to definition`, `Serena vs LSP` |
| `mermaid-ascii` | Mermaid 圖表轉 ASCII 純文字 | `Mermaid`, `流程圖轉文字`, `ASCII 圖表`, `文字版圖表` |
| `methodology-writing` | 撰寫或重寫方法論文件 | `方法論`, `寫 methodology`, `改寫方法論`, `方法論品質` |
| `parallel-evaluation` | 多視角 code review / 架構審查 / 結論審查 | `code review`, `架構審查`, `重構評估`, `多視角審查`, `結論審查` |
| `pre-fix-eval` | 修復前先做問題分類與 ticket 開設評估 | `修復前評估`, `先分類再修`, `編譯錯誤分類`, `測試失敗先評估` |
| `project-init` | 環境初始化、依賴安裝、工具安裝、相容性確認 | `setup`, `初始化環境`, `安裝依賴`, `verify dependencies`, `環境檢查` |
| `provider-architecture` | Riverpod / Provider / Notifier 架構設計與審查 | `Riverpod`, `Provider`, `Notifier`, `ViewModel`, `ref.read`, `ref.watch` |
| `scope-confirmation` | 需求、測試、實作之間有範圍不一致 | `範圍確認`, `邊界不清`, `需求不一致`, `scope`, `防止範圍蔓延` |
| `search-tools-guide` | 選搜尋工具、rg / LSP / Serena 用法與取捨 | `怎麼搜尋`, `用 rg 還是 LSP`, `搜尋工具`, `文字搜尋`, `工具故障排除` |
| `skill-design-guide` | 建立或審查 skill，自訂 `SKILL.md` frontmatter | `建立 skill`, `skill review`, `SKILL.md`, `frontmatter`, `skill 設計` |
| `spec` | 初始化或驗證功能規格骨架與需求完整度 | `spec`, `需求完善度`, `規格骨架`, `validate spec`, `需求是否足夠` |
| `startup-check` | session start 環境檢查與 pending handoff 恢復 | `session start`, `啟動檢查`, `pending handoff`, `開工前檢查`, `resume 狀態` |
| `style-guardian` | UI style system / i18n / hardcoded style 檢查 | `hardcoded style`, `設計系統`, `統一樣式`, `硬編碼顏色`, `硬編碼文字` |
| `tdd` | 新功能開發的 TDD Phase 0-4、拆分與進度推進 | `TDD`, `phase 0`, `phase 1`, `phase 3b`, `phase 4`, `測試先行` |
| `tdd-phase1-split` | 已廢棄；改用 `tdd` | `tdd phase1 split`, `phase1 split` |
| `tech-debt-capture` | 從 Phase 4 / 評估報告抽出技術債並建 ticket | `技術債`, `technical debt`, `Phase 4`, `提煉技術債`, `從報告建 ticket` |
| `test-async-guardian` | Flutter/Dart 測試卡住、異步資源清理問題 | `測試卡住`, `tearDown`, `async test`, `資源清理`, `Flutter test hang` |
| `ticket` | ticket 建立、查詢、claim、release、complete、handoff、resume | `ticket`, `任務`, `工作項目`, `claim`, `release`, `complete`, `handoff`, `resume`, `checkpoint`, `AC`, `runqueue`, `wave` |
| `version-release` | 發版、發布前檢查、更新版本文件 | `release`, `發版`, `tag`, `merge to main`, `發布前檢查` |
| `worktree` | 以 ticket 為基礎管理 git worktree | `worktree`, `/worktree`, `建立 worktree`, `feature branches`, `worktree status` |
| `wrap-decision` | 卡住、連續失敗、重大決策、個人化建議前先 WRAP | `stuck`, `blocked`, `loop`, `沒進展`, `分析`, `做不到`, `限制性解法`, `重大決策`, `個人化建議` |
| `zellij` | zellij pane/session 操作、多 pane 服務與日誌管理 | `zellij`, `pane`, `session`, `多終端`, `讀其他 pane`, `遠端控制 pane` |

## 補充規則

- `ticket`, `doc`, `tdd`, `wrap-decision` 屬於高優先核心 skill；命中時優先讀取。
- 若同時命中 `ticket` 與 `doc`，先判斷使用者是在操作工作系統還是在查需求文件。
- 若同時命中 `wrap-decision` 與其他 skill，通常先做 WRAP，再決定是否進入其他 skill。
- `tdd-phase1-split` 已 deprecated，任何相關請求都改導向 `tdd`。

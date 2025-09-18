# Agents 職責分析與 Hook 系統整合計畫

## 📊 現狀分析

### 已被 Hook 系統自動化的職責

#### 1. **project-compliance-agent** - 高度重疊
**原職責**：
- 工作流程合規檢查
- 版本控制標準執行
- 文件更新強制執行
- Git 提交格式驗證
- 工作日誌完整性檢查

**Hook 系統自動化**：
- ✅ UserPromptSubmit Hook → 自動合規性檢查
- ✅ PreToolUse Hook → 自動阻止不合規操作
- ✅ Stop Hook → 自動版本推進建議
- ✅ Task Avoidance Detection Hook → 強制品質標準

**建議**：**大幅精簡**，專注於 hook 系統無法處理的特殊合規情況

#### 2. **rosemary-project-manager** - 部分重疊
**原職責**：
- 高頻工作日誌更新監督
- 版本推進決策
- 文件先行策略執行
- 跨 Agent 協作管理

**Hook 系統自動化**：
- ✅ Stop Hook → 自動版本推進建議
- ✅ Auto-Documentation Update Hook → 自動文件同步提醒
- ✅ Performance Monitor Hook → 自動效能監控

**建議**：**保留核心策略職責**，移除已自動化的執行細節

#### 3. **sage-test-architect** - 輕微重疊
**原職責**：
- 測試案例設計
- TDD Phase 2 執行

**Hook 系統自動化**：
- ✅ PostToolUse Hook → 自動測試覆蓋檢查
- ✅ Code Smell Detection Hook → 自動品質檢查

**建議**：**加入 hook 說明**，專注於設計職責

---

## 🔄 更新策略

### A. 需要大幅精簡的 Agent

#### **project-compliance-agent** → **specialcase-compliance-agent**
**新職責**：
- Hook 系統無法處理的特殊合規情況
- 複雜的跨文件一致性檢查
- 法規或標準的特殊要求
- Hook 系統故障時的手動備援

### B. 需要整合 Hook 說明的 Agent

#### **rosemary-project-manager**
**保留職責**：
- 戰略規劃和長期目標管理
- 複雜的跨 Agent 協作調度
- 風險評估和緩解策略
- 專案里程碑規劃

**新增說明**：
- Hook 系統如何支援專案管理
- 何時需要人工介入
- Hook 報告的解讀和行動

#### **sage-test-architect**
**保留職責**：
- 測試策略設計
- 複雜測試場景規劃
- TDD Phase 2 執行

**新增說明**：
- Hook 系統的測試品質監控
- 自動化測試檢查的補充

### C. 需要新增 Hook 整合的 Agent

所有 Agent 都需要加入：
- 如何與 Hook 系統協作
- Hook 檢查結果的處理
- 何時會被 Hook 系統阻止以及如何處理

---

## 📋 具體更新項目

### 1. 立即精簡 project-compliance-agent
- 移除 80% 的自動化職責描述
- 專注於特殊情況處理
- 加入 Hook 系統說明

### 2. 更新 rosemary-project-manager
- 移除已自動化的細節流程描述
- 專注於戰略層面職責
- 整合 Hook 系統監控說明

### 3. 所有 Agent 統一加入 Hook 整合說明
- Hook 系統如何影響工作流程
- 被阻止時的處理方式
- Hook 報告的利用方式

### 4. 新增 Hook 系統參考區段
每個 Agent 都加入：
```markdown
## 🤖 Hook 系統整合

本 Agent 的工作流程已與自動化 Hook 系統深度整合：

### 自動化支援
- **品質檢查**：Hook 系統自動執行基礎品質控制
- **合規監控**：自動檢查和阻止違規行為
- **問題追蹤**：自動偵測並追蹤發現的問題

### 人工介入時機
- Hook 系統無法處理的複雜情況
- 需要策略決策的情況
- Hook 系統報告異常時

### Hook 協作方式
- 查看 Hook 報告以了解當前狀態
- 根據 Hook 建議進行後續行動
- 在 Hook 阻止時協助問題解決

詳細說明請參考：[🚀 Hook 系統方法論](../claude/hook-system-methodology.md)
```

---

## 🎯 預期效果

### 文件精簡度
- project-compliance-agent：約減少 70% 內容
- rosemary-project-manager：約減少 40% 內容
- 其他 agents：約減少 20% 內容，新增 15% Hook 整合說明

### 職責清晰度
- 明確區分自動化 vs 人工職責
- 避免重複和衝突
- 提供清晰的協作指引

### 維護效率
- 減少文件維護負擔
- 避免與 Hook 系統的規範不一致
- 提供統一的 Hook 整合說明
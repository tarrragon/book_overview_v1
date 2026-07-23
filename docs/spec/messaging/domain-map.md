---
id: DOMAIN-MAP-messaging
domain: "messaging"
source_specs: [SPEC-005]
related_usecases: [UC-01, UC-02, UC-03, UC-04, UC-05, UC-06, UC-07, UC-08]
created: "2026-07-23"
updated: "2026-07-23"
---

# Domain Map — messaging

> 產出來源：1.6.1-W2-002。本文件界定 DDD domain bundle 邊界，作為切層、派發與測試策略的權威依據。
> 與 SPEC-005（FR 清單）交叉引用。

## 1. 目的與 UC / DDD 正交關係

messaging domain 處理 Chrome Extension 各 context（Background SW / Content Script / Popup）間的訊息路由、驗證、會話管理和連線監控。所有 UC 都透過 messaging 進行跨 context 通訊。

## 2. 分層與依賴方向

```
所有其他 domain（extraction / page / system / user-experience）
        │ 消費（透過 chrome.runtime.sendMessage / chrome.tabs.sendMessage）
        ▼
messaging domain service（路由、驗證、會話、佇列）
        │ 依賴（單向）
        ▼
core（ErrorCodes, EventBus）
```

**依賴方向底線（不可違反）**：

- messaging 不得 import 業務 domain（extraction / data-management / user-experience）。違反則通訊層耦合業務邏輯。
- messaging 不得 import presentation / UI 框架。

## 3. Bundle 界定表

| Bundle | 分類 | 納入概念 | 排除 | 目標路徑 | 測試層/方法 |
|---|---|---|---|---|---|
| Message Routing | 非 domain（infra） | MessageRoutingService、message-router.js（routeMessage / routeBySource）、ChromeEventBridge | 具體 message handler（歸各 domain） | `src/background/domains/messaging/services/`, `src/background/messaging/`, `src/content/bridge/` | unit + integration：路由分派、來源識別 |
| Message Validation | supporting VO | MessageValidationService（envelope 格式驗證、type 白名單） | 業務 payload 驗證 | `src/background/domains/messaging/services/` | unit：envelope schema 驗證 |
| Session Management | domain service | SessionManagementService | 認證（不在 v1 scope） | `src/background/domains/messaging/services/` | unit：session 建立/銷毀 |
| Connection Monitoring | read-model | ConnectionMonitoringService（連線狀態追蹤、健康偵測） | 具體 reconnect 實作 | `src/background/domains/messaging/services/` | unit：連線狀態轉換 |
| Queue Management | domain service | QueueManagementService（優先級佇列、訊息排程） | 訊息內容處理 | `src/background/domains/messaging/services/` | unit：優先級排序、佇列容量 |
| Content Event System | 非 domain（infra） | ContentEventBus（CS 側本地事件管理）、contentChromeBridge 事件轉發 | 事件消費者 | `src/content/core/`, `src/content/bridge/` | unit：事件發射/訂閱 |

### Bundle 不變式清單（per-bundle）

| Bundle | 不變式（每條可轉一個 unit test） |
|---|---|
| Message Routing | 未知 message type 回傳 { success: false }；來源識別（content/popup/background）正確 |
| Message Validation | request envelope 必須含 type 欄位；response success=false 時 error 必填 |
| Session Management | session 建立後必須可查詢；銷毀後不可再查詢 |
| Connection Monitoring | 連線中斷偵測後狀態標記為 disconnected；重連後恢復 connected |
| Queue Management | 高優先級訊息優先出隊；佇列容量超限時拒絕入隊 |
| Content Event System | CS 側 emit 的 EXTRACTION 事件（5 種）正確轉發至 SW |

## 4. 邊界決策

### 4.1 Message Router 歸 messaging 而非獨立 infra

message-router.js 物理上在 `src/background/messaging/` 而非 `src/background/domains/messaging/`。從 domain map 角度，其職責（跨 context 訊息分派）屬 messaging domain 的基礎設施層。

### 4.2 Message Handler 歸各業務 domain

popup-message-handler.js 和 content-message-handler.js 處理具體業務訊息（如 START_EXTRACTION），歸各自消費 domain（extraction / user-experience），非 messaging domain。

## 5. 對實作票的切分指引

| 票 | 層 | domain map 對齊指引 |
|---|---|---|
| 新增 message type | 涉及 messaging + 消費 domain | messaging 加路由 case，消費 domain 加 handler |
| 通訊效能調整 | messaging domain | Queue Management bundle |

## 6. 觀察到的技術債（待追蹤）

- MessagingDomainCoordinator 在 `src/background/domains/messaging/` 與 message-router.js 在 `src/background/messaging/` 物理位置分散

## 7. FR → Bundle 覆蓋對照

| FR | 覆蓋 | 備註 |
|---|---|---|
| FR-01 訊息路由與通訊 | Message Routing + Message Validation + Session Management + Connection Monitoring + Queue Management + Content Event System | 全部 bundle 覆蓋單一 FR |

---

**Last Updated**: 2026-07-23 | **Source**: 1.6.1-W2-002

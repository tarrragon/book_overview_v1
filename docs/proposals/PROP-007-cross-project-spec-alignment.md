---
id: PROP-007
title: "跨專案規格對齊（Tag-based Model / Interchange Format v2 / Google Drive 同步）"
status: confirmed
proposed: "2026-04-02"
confirmed: "2026-04-02"
source: cross-project
target_version: "v0.20.0"
reference: "Flutter App 專案 docs/proposals/PROP-007-cross-project-spec-alignment.md"
---

# PROP-007: 跨專案規格對齊

## 說明

本提案為跨專案提案，完整版位於 Flutter App 專案（Book Overview App）。本文件為 Chrome Extension 端的引用摘要，記錄對 Extension 的影響範圍。

**完整提案路徑**：`~/project/book_overview_app/docs/proposals/PROP-007-cross-project-spec-alignment.md`

## 對 Extension 的影響摘要

### 1. Tag-based Model

- Chrome Storage 資料結構將從現有格式改為 tag-based model
- 書籍分類從階層式改為標籤式，與 Flutter App 對齊
- 預計在 v0.20.0 實施資料結構遷移

### 2. Interchange Format v2

- JSON 匯出格式升級為 Interchange Format v2
- 確保 Extension 匯出的資料可被 Flutter App 正確匯入
- 格式包含 tag-based 分類、借閱記錄、同步狀態等欄位

### 3. Google Drive 同步（v2.0 階段）

- 同步方案從原先規劃的自建伺服器改為 Google Drive API
- v1.0 階段使用 JSON 匯出/匯入手動同步
- v2.0 階段透過 Google Drive `drive.file` scope 實現自動同步
- PROP-002 中的進階同步功能（斷點續傳、智慧合併等）延後至 v2.0

## 相關文件

- PROP-002: 跨設備同步機制完善（部分被本提案更新）
- UC-07: 跨平台資料同步準備
- SPEC-004: 資料管理規格

## 變更歷史

| 版本 | 日期 | 變更內容 |
|------|------|---------|
| 1.0 | 2026-04-02 | 初始建立，從 Flutter App 專案引用 |

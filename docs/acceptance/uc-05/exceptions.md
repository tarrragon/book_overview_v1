# UC-05: 跨設備資料同步 - Exception 規格

## 🎯 Use Case 概述
**UC-05**: 使用者在多個設備間同步書籍資料，透過雲端硬碟進行資料傳輸。

## 🚨 核心 StandardError 清單

### DATA_SYNC_VERSION_MISMATCH
```javascript
new StandardError('DATA_SYNC_VERSION_MISMATCH', '設備間資料版本不相容', {
  severity: 'MODERATE',
  localVersion: '2.1.0',
  remoteVersion: '1.8.0',
  compatibility: 'backward_compatible',
  migrationRequired: true,
  affectedFeatures: ['progress_tracking', 'metadata_format']
})
```
**觸發條件**: 不同設備 Extension 版本差異、資料格式版本衝突

### DATA_SYNC_TIMESTAMP_CONFLICT
```javascript
new StandardError('DATA_SYNC_TIMESTAMP_CONFLICT', '同步時發現時間戳衝突', {
  severity: 'MODERATE',
  conflictedBooks: [
    {
      id: 'book_456',
      device1: { lastModified: '2025-01-15T09:00:00Z', progress: '80%' },
      device2: { lastModified: '2025-01-15T10:30:00Z', progress: '75%' }
    }
  ],
  resolutionStrategy: 'latest_timestamp_wins'
})
```
**觸發條件**: 同一書籍在不同設備上同時更新、系統時間不同步

### NETWORK_CLOUD_SERVICE_UNAVAILABLE
```javascript
new StandardError('NETWORK_CLOUD_SERVICE_UNAVAILABLE', '雲端服務暫時無法連接', {
  severity: 'MODERATE',
  cloudService: 'Google Drive',
  lastSuccessfulSync: '2025-01-14T18:00:00Z',
  retryAttempts: 3,
  fallbackOptions: ['local_backup', 'manual_export']
})
```
**觸發條件**: Google Drive/Dropbox 服務中斷、網路連接問題、權限過期

### DATA_SYNC_CORRUPTION_DETECTED
```javascript
new StandardError('DATA_SYNC_CORRUPTION_DETECTED', '同步檔案損壞，無法安全合併', {
  severity: 'SEVERE',
  corruptionType: 'partial_json_truncation',
  lastKnownGoodBackup: '2025-01-13T12:00:00Z',
  dataLossRisk: 'medium',
  recoveryOptions: ['restore_from_backup', 'manual_reconstruction']
})
```
**觸發條件**: 雲端檔案損壞、傳輸中斷、儲存錯誤
/**
 * English (US) Language Pack
 *
 * Functionality:
 * - Provides all English text for Background Service Worker modules
 * - Supports dynamic parameter replacement and formatting
 * - Maintains consistent American English terminology
 * - Provides localized text for error messages and system notifications
 */

const enUS = {
  // ====================
  // System Basic Messages
  // ====================
  system: {
    name: 'Readmoo Library Extractor',
    description: 'Chrome Extension Background Service Worker',

    // System Status
    status: {
      healthy: 'Healthy',
      degraded: 'Degraded',
      unhealthy: 'Unhealthy',
      unknown: 'Unknown',
      active: 'Active',
      inactive: 'Inactive',
      running: 'Running',
      stopped: 'Stopped',
      initializing: 'Initializing',
      error: 'Error'
    },

    // Basic Actions
    actions: {
      initialize: 'Initialize',
      start: 'Start',
      stop: 'Stop',
      restart: 'Restart',
      cleanup: 'Cleanup',
      reload: 'Reload',
      reset: 'Reset'
    },

    // System Messages
    messages: {
      starting: 'System starting...',
      ready: 'System ready',
      stopping: 'System stopping...',
      stopped: 'System stopped',
      error: 'System error occurred',
      unavailable: 'System temporarily unavailable',
      maintenance: 'System under maintenance'
    }
  },

  // ====================
  // Module Related Messages
  // ====================
  modules: {
    // Basic States
    states: {
      not_initialized: 'Not Initialized',
      initializing: 'Initializing',
      initialized: 'Initialized',
      starting: 'Starting',
      running: 'Running',
      stopping: 'Stopping',
      stopped: 'Stopped',
      error: 'Error',
      cleaning: 'Cleaning'
    },

    // Basic Operation Messages
    operations: {
      create: 'Creating {moduleName} module',
      initialize: 'Initializing {moduleName} module',
      start: 'Starting {moduleName} module',
      stop: 'Stopping {moduleName} module',
      cleanup: 'Cleaning up {moduleName} module',

      // Success Messages
      createSuccess: '{moduleName} module created successfully',
      initializeSuccess: '{moduleName} module initialized successfully',
      startSuccess: '{moduleName} module started successfully',
      stopSuccess: '{moduleName} module stopped successfully',
      cleanupSuccess: '{moduleName} module cleaned up successfully',

      // Failure Messages
      createFailed: '{moduleName} module creation failed',
      initializeFailed: '{moduleName} module initialization failed',
      startFailed: '{moduleName} module start failed',
      stopFailed: '{moduleName} module stop failed',
      cleanupFailed: '{moduleName} module cleanup failed',

      // Skip Messages
      alreadyInitialized: '{moduleName} module already initialized, skipping duplicate initialization',
      alreadyStarted: '{moduleName} module already started, skipping duplicate start',
      notStarted: '{moduleName} module not started, skipping stop'
    },

    // Health Check
    health: {
      checkStarted: 'Starting {moduleName} module health check',
      checkCompleted: '{moduleName} module health check completed',
      statusHealthy: '{moduleName} module status is healthy',
      statusDegraded: '{moduleName} module status is degraded',
      statusUnhealthy: '{moduleName} module status is unhealthy'
    }
  },

  // ====================
  // Lifecycle Messages
  // ====================
  lifecycle: {
    // Install Related
    install: {
      started: 'Started processing install event',
      completed: 'Install event processing completed',
      failed: 'Install event processing failed',

      reasons: {
        install: 'Fresh Install',
        update: 'Extension Update',
        chrome_update: 'Chrome Browser Update',
        shared_module_update: 'Shared Module Update'
      },

      newInstall: 'Processing fresh install',
      update: 'Processing extension update: {previousVersion} → {currentVersion}',
      chromeUpdate: 'Processing Chrome browser update',
      sharedModuleUpdate: 'Processing shared module update',
      unknownReason: 'Processing unknown install reason: {reason}'
    },

    // Startup Related
    startup: {
      started: 'Started processing Service Worker startup',
      completed: 'Service Worker startup completed',
      failed: 'Service Worker startup failed',
      attempt: 'Startup attempt #{attempt}',
      duration: 'Startup duration: {duration}ms',

      cleanup: 'Cleaning up previous startup state',
      moduleSequence: 'Starting modules in sequence',
      stateRestore: 'Restoring system state',
      systemReady: 'System ready',

      recovery: 'Attempting recovery from startup failure',
      retry: 'Preparing startup retry ({attempt}/3)',
      degradedMode: 'Enabling system degraded mode',
      finalFailure: 'System startup final failure'
    },

    // Shutdown Related
    shutdown: {
      started: 'Started graceful shutdown',
      completed: 'Graceful shutdown completed',
      failed: 'Graceful shutdown failed',
      forced: 'Executing force shutdown',
      timeout: 'Shutdown timeout',

      reason: 'Shutdown reason: {reason}',
      duration: 'Shutdown duration: {duration}ms',

      savingState: 'Saving critical state',
      stopRequests: 'Stopping acceptance of new requests',
      pendingOps: 'Waiting for pending operations to complete',
      moduleSequence: 'Shutting down modules in sequence',
      cleanup: 'Cleaning up system resources'
    }
  },

  // ====================
  // Message Processing Related
  // ====================
  messaging: {
    // Message Router
    router: {
      started: 'Message router started successfully',
      stopped: 'Message router stopped successfully',
      messageReceived: 'Message received',
      messageProcessed: 'Message processed',
      messageRouted: 'Message routed',

      stopAccepting: 'Stopping acceptance of new messages',
      queueProcessing: 'Processing {count} messages in queue',
      invalidFormat: 'Invalid message format or type: {type}',
      unknownSource: 'Unknown message source: {source}',
      noHandler: 'No handler for message type: {type}'
    },

    // Content Script Processing
    contentScript: {
      messageReceived: 'Processing Content Script message',
      statusUpdate: 'Content Script status update: Tab {tabId} → {status}',
      scriptReady: 'Content Script ready: Tab {tabId}',
      scriptError: 'Content Script error: Tab {tabId}',
      eventForward: 'Processing Content Script event forward',
      registered: 'Content Script registered',

      sendMessage: 'Sending message to Content Script: Tab {tabId}',
      sendSuccess: 'Content Script response: Tab {tabId}',
      sendFailed: 'Failed to send message to Content Script: Tab {tabId}',

      offline: 'Content Script offline: Tab {tabId}',
      shutdown: 'Notifying Content Script of system shutdown'
    },

    // Popup Processing
    popup: {
      messageReceived: 'Processing Popup message',
      sessionStarted: 'Started Popup session: {sessionId}',
      sessionEnded: 'Ended Popup session: {sessionId}',
      dataRequest: 'Processing Popup data request: {type}',
      operationRequest: 'Processing Popup operation request: {operation}',

      extractionStart: 'Starting extraction operation triggered from Popup',
      exportRequest: 'Processing Popup export request: {type}',

      invalidTab: 'Current tab is not a Readmoo page',
      permissionDenied: 'Insufficient operation permissions',
      sessionEstablished: 'Popup session established',
      sessionTerminated: 'Popup session terminated'
    }
  },

  // ====================
  // Chrome API Related
  // ====================
  chromeApi: {
    // Basic Operations
    calling: 'Calling Chrome API: {apiPath}',
    success: 'Chrome API call successful: {apiPath}',
    failed: 'Chrome API call failed: {apiPath}',
    retry: 'Retrying Chrome API call: {apiPath} ({attempt}/{maxRetries})',

    // Availability Check
    checking: 'Chrome API availability check',
    available: 'Chrome API availability check passed',
    missing: 'Missing required Chrome APIs: {apis}',
    manifestVersion: 'Non-Manifest V3 environment',

    // Batch Processing
    batchStarted: 'Started batch processing',
    batchCompleted: 'Batch processing completed',
    batchFailed: 'Batch processing failed: {apiName}',

    // Error Types
    errors: {
      connection_failed: 'Connection Failed',
      context_invalidated: 'Extension Context Invalidated',
      port_closed: 'Message Port Closed',
      not_found: 'Target Not Found',
      unknown_error: 'Unknown Error'
    }
  },

  // ====================
  // Event System Related
  // ====================
  events: {
    // Basic Operations
    emitting: 'Emitting event: {eventType}',
    emitted: 'Event emitted: {eventType}',
    listening: 'Listening to event: {eventType}',
    handled: 'Event handled: {eventType}',

    // Event Statistics
    stats: 'Event Statistics',
    totalEvents: 'Total events: {count}',
    totalEmissions: 'Total emissions: {count}',
    avgExecutionTime: 'Average execution time: {time}ms',

    // Error Handling
    handlerError: 'Event handler error ({eventType})',
    emitFailed: 'Event emit failed ({eventType})',

    // System Events
    systemReady: 'System ready event triggered',
    extractionCompleted: 'Book extraction completed event triggered',
    extractionData: 'Extraction data field check'
  },

  // ====================
  // Page Monitoring Related
  // ====================
  pageMonitoring: {
    detected: 'Readmoo page detected',
    contentReady: 'Content Script ready',
    contentNotReady: 'Content Script not ready yet',
    pageReady: 'Page ready message sent',
    navigationChanged: 'Page navigation changed'
  },

  // ====================
  // Data Processing Related
  // ====================
  dataProcessing: {
    // Storage Operations
    saving: 'Saving data to Chrome Storage',
    saved: 'Data saved successfully',
    loading: 'Loading data',
    loaded: 'Data loaded successfully',

    // Data Validation
    validating: 'Validating data format',
    valid: 'Data format is valid',
    invalid: 'Data format is invalid',

    // Book Data
    booksFound: 'Found {count} books',
    booksProcessed: 'Processed {count} books',
    booksSaved: 'Saved {count} books to Chrome Storage',
    booksVerified: 'Verified storage result: {count} books',
    noBooksData: 'No valid book data in extraction completed event'
  },

  // ====================
  // Error and Warning Messages
  // ====================
  errors: {
    // General Errors
    unknown: 'Unknown error',
    timeout: 'Operation timeout',
    cancelled: 'Operation cancelled',
    permission: 'Insufficient permissions',
    notFound: 'Target not found',

    // Module Errors
    moduleNotFound: 'Module not found: {moduleName}',
    moduleNotInitialized: '{moduleName} module not initialized, cannot start',
    moduleAlreadyRunning: '{moduleName} module already running',

    // System Errors
    systemError: 'System error',
    initializationFailed: 'Initialization failed',
    startupFailed: 'Startup failed',
    shutdownFailed: 'Shutdown failed',

    // Message Errors
    messageError: 'Message processing error',
    invalidMessage: 'Invalid message format',
    messageTimeout: 'Message processing timeout',

    // API Errors
    apiError: 'API call error',
    apiNotSupported: 'Unsupported API: {apiPath}',
    apiRetryLimit: 'API call retry limit reached: {apiPath}',

    // Data Errors
    dataError: 'Data processing error',
    storageError: 'Storage operation failed',
    validationError: 'Data validation failed'
  },

  // ====================
  // Warning Messages
  // ====================
  warnings: {
    deprecated: 'Feature deprecated',
    experimental: 'Experimental feature',
    performance: 'Performance warning',
    compatibility: 'Compatibility warning',

    // Specific Warnings
    eventBusNotReady: 'EventBus not initialized, cannot forward event',
    handlerMissing: 'Handler missing',
    configMissing: 'Configuration missing',
    dataMissing: 'Required data missing'
  },

  // ====================
  // Success Messages
  // ====================
  success: {
    // General Success
    completed: 'Operation completed',
    saved: 'Saved successfully',
    loaded: 'Loaded successfully',
    updated: 'Updated successfully',
    deleted: 'Deleted successfully',

    // System Success
    systemReady: 'Background Service Worker operating normally',
    systemHealthy: 'Background Service Worker health status normal',

    // Specific Operation Success
    messageProcessed: 'Message processed',
    eventForwarded: 'Event forwarded',
    extractionStarted: 'Extraction operation started',
    exportProcessed: 'Export request processed'
  }
}

module.exports = enUS

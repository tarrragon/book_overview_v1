/**
 * Lifecycle Validator Test Helper
 */
class LifecycleValidator {
  constructor() {
    this.initialized = true
    this.lifecycleEvents = []
  }
  
  validateLifecycle(component, state) {
    const event = { component, state, timestamp: Date.now() }
    this.lifecycleEvents.push(event)
    return { 
      valid: true, 
      state,
      eventCount: this.lifecycleEvents.length 
    }
  }
  
  validate() { 
    return { success: true, events: this.lifecycleEvents.length } 
  }
  
  reset() {
    this.lifecycleEvents = []
  }
}

module.exports = LifecycleValidator
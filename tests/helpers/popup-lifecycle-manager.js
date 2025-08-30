/**
 * Popup Lifecycle Manager Test Helper
 */
class PopupLifecycleManager {
  constructor() {
    this.initialized = true
    this.popupStates = new Map()
  }
  
  managePopupLifecycle(popupId, action) {
    const currentState = this.popupStates.get(popupId) || 'closed'
    let newState = currentState
    
    switch(action) {
      case 'open':
        newState = 'open'
        break
      case 'close':
        newState = 'closed'
        break
      case 'minimize':
        newState = 'minimized'
        break
    }
    
    this.popupStates.set(popupId, newState)
    return { 
      popupId,
      previousState: currentState,
      newState,
      success: true 
    }
  }
  
  validate() { 
    return { 
      success: true, 
      managedPopups: this.popupStates.size 
    } 
  }
  
  reset() {
    this.popupStates.clear()
  }
}

module.exports = PopupLifecycleManager
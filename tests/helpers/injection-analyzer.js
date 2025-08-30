/**
 * Injection Analyzer Test Helper
 */
class InjectionAnalyzer {
  constructor() {
    this.initialized = true
    this.injections = []
  }
  
  analyze(injectionData) {
    this.injections.push(injectionData)
    return { 
      status: 'ok', 
      successful: true,
      injectionCount: this.injections.length 
    }
  }
  
  validate() { 
    return { success: true, validInjections: this.injections.length } 
  }
  
  reset() {
    this.injections = []
  }

  async cleanup() {
    this.reset()
    // 清理任何資源
  }
}

module.exports = { InjectionAnalyzer }
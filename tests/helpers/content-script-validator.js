/**
 * Content Script Validator - g¹s,WIh
 */

class ContentScriptValidator {
  constructor() {
    this.validationResults = []
  }

  validate(contentScript) {
    const result = {
      success: true,
      errors: [],
      warnings: []
    }

    if (!contentScript) {
      result.success = false
      result.errors.push('Content script is required')
    }

    this.validationResults.push(result)
    return result
  }

  reset() {
    this.validationResults = []
  }
}

module.exports = ContentScriptValidator
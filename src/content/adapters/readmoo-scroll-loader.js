/**
 * readmoo-scroll-loader.js
 *
 * Readmoo 捲動載入邏輯
 *
 * 職責：
 * - 捲動容器偵測（多層 fallback 策略）
 * - 捲動控制（含整頁捲動與「更多」按鈕點擊）
 * - 封面真圖替換的整頁漸進捲動
 * - Lazy load 主迴圈（4 個獨立停止條件）
 * - MutationObserver 等待新項目渲染
 * - 書庫總數解析
 *
 * 設計要點：所有內部方法呼叫透過 deps.adapterRef dispatch，
 * 確保測試可用 jest.spyOn(adapter, 'methodName') 攔截。
 */

/**
 * 建立 Readmoo 捲動載入器
 *
 * @param {Object} deps - 依賴注入
 * @param {Object} deps.adapterRef - adapter 物件（方法 dispatch 通道，確保 spy 攔截）
 * @param {Object} deps.selectors - DOM 選擇器配置
 * @param {Object} deps.logger - 日誌記錄器
 * @param {Function} deps.getDocument - 取得 document 物件
 * @param {Function} deps.getWindow - 取得 window 物件
 * @param {Object} deps.constants - 捲動相關常數
 * @param {Function} deps.measureBooksFn - 量測書籍 ID 的回呼函式
 * @param {Function} deps.getBookElementsFn - 取得書籍元素的回呼函式
 * @returns {Object} 捲動載入器實例
 */
function createReadmooScrollLoader (deps) {
  const {
    adapterRef,
    selectors,
    logger,
    getDocument,
    getWindow,
    constants
  } = deps

  const {
    LIBRARY_TOTAL_PATTERN,
    ARCHIVED_PATTERN,
    LENT_PATTERN,
    LOAD_MORE_TEXT_PATTERN,
    MAX_ANCESTOR_DEPTH,
    COVER_SCROLL_SEGMENT_RATIO,
    COVER_SCROLL_MAX_SEGMENTS,
    COVER_POLL_INTERVAL_MS,
    COVER_SEGMENT_SETTLE_MS,
    COVER_CONVERGENCE_TIMEOUT_MS,
    PLACEHOLDER_COVER_PATTERN
  } = constants

  const loader = {
    parseLibraryTotal () {
      try {
        const document = getDocument()
        if (!document) {
          return { total: null, raw: '' }
        }

        const headerEl = document.querySelector(selectors.libraryTotalHeader)
        if (!headerEl) {
          return { total: null, raw: '' }
        }

        const raw = headerEl.textContent?.trim() || ''
        const totalMatch = raw.match(LIBRARY_TOTAL_PATTERN)
        if (!totalMatch) {
          return { total: null, raw }
        }

        const libraryTotal = parseInt(totalMatch[1], 10)
        const archivedMatch = raw.match(ARCHIVED_PATTERN)
        const lentMatch = raw.match(LENT_PATTERN)
        const archived = archivedMatch ? parseInt(archivedMatch[1], 10) : 0
        const lent = lentMatch ? parseInt(lentMatch[1], 10) : 0

        const visible = libraryTotal - archived - lent
        if (visible < 0) {
          return { total: null, raw }
        }
        return { total: visible, raw }
      } catch (error) {
        logger.warn('PARSE_LIBRARY_TOTAL_FAILED', { error: error.message })
        return { total: null, raw: '' }
      }
    },

    findScrollContainer () {
      try {
        const document = getDocument()
        if (!document) {
          return { container: null, strategy: 'none' }
        }

        for (const selector of selectors.scrollContainerCandidates) {
          const el = document.querySelector(selector)
          if (el) {
            return { container: el, strategy: 'selector' }
          }
        }

        const loadMoreBtn = adapterRef.findLoadMoreButton()
        if (loadMoreBtn) {
          return { container: loadMoreBtn, strategy: 'load-more-button' }
        }

        const scrollableAncestor = adapterRef.findScrollableAncestor()
        if (scrollableAncestor) {
          return { container: scrollableAncestor, strategy: 'scrollable-ancestor' }
        }

        const docEl = document.documentElement
        if (docEl && docEl.scrollHeight > docEl.clientHeight) {
          return { container: docEl, strategy: 'document' }
        }

        return { container: null, strategy: 'none' }
      } catch (error) {
        logger.warn('FIND_SCROLL_CONTAINER_FAILED', { error: error.message })
        return { container: null, strategy: 'none' }
      }
    },

    findLoadMoreButton () {
      const document = getDocument()
      if (!document) return null
      const buttons = document.querySelectorAll(selectors.loadMoreButton)
      for (const btn of buttons) {
        const text = btn.textContent?.trim() || ''
        if (LOAD_MORE_TEXT_PATTERN.test(text)) {
          return btn
        }
      }
      return null
    },

    findScrollableAncestor () {
      const document = getDocument()
      if (!document) return null
      const firstItem = document.querySelector(selectors.bookContainer)
      if (!firstItem) return null

      let parent = firstItem.parentElement
      let depth = 0
      while (parent && parent !== document.body && depth < MAX_ANCESTOR_DEPTH) {
        if (parent.scrollHeight > parent.clientHeight) {
          return parent
        }
        depth++
        parent = parent.parentElement
      }
      return null
    },

    _scrollStep (container, strategy) {
      if (container) {
        if (strategy === 'load-more-button') {
          if (typeof container.scrollIntoView === 'function') {
            container.scrollIntoView({ block: 'center' })
          }
        } else {
          container.scrollTop = container.scrollHeight
        }
      }

      adapterRef._scrollWindowToBottom()
      adapterRef._clickLoadMoreButton()
    },

    _scrollWindowToBottom () {
      try {
        const win = getWindow()
        const document = getDocument()
        if (!win || typeof win.scrollTo !== 'function' || !document) return
        const scrollingEl = document.scrollingElement || document.documentElement
        const bottom = scrollingEl?.scrollHeight ?? 0
        win.scrollTo(0, bottom)
      } catch (scrollError) {
        // best-effort
      }
    },

    _clickLoadMoreButton () {
      const loadMoreBtn = adapterRef.findLoadMoreButton()
      if (!loadMoreBtn) return

      if (typeof loadMoreBtn.scrollIntoView === 'function') {
        loadMoreBtn.scrollIntoView({ block: 'center' })
      }
      if (typeof loadMoreBtn.click === 'function') {
        loadMoreBtn.click()
      }
    },

    _waitMs (ms) {
      return new Promise(resolve => setTimeout(resolve, ms))
    },

    _countPlaceholderCovers () {
      const document = getDocument()
      if (!document) return 0

      const items = document.querySelectorAll(selectors.bookContainer)
      let count = 0
      for (const item of items) {
        const img = item.querySelector(selectors.bookImage) || item.querySelector('img')
        if (!img) continue
        const src = img.getAttribute('src') || ''
        if (src && PLACEHOLDER_COVER_PATTERN.test(src)) {
          count++
        }
      }
      return count
    },

    async _waitForPlaceholderConvergence (waitOptions = {}) {
      const timeoutMs = waitOptions.timeoutMs ?? COVER_CONVERGENCE_TIMEOUT_MS
      const pollIntervalMs = waitOptions.pollIntervalMs ?? COVER_POLL_INTERVAL_MS
      const stableRounds = waitOptions.stableRounds ?? 4
      const startTime = Date.now()

      let prevCount = adapterRef._countPlaceholderCovers()
      if (prevCount === 0) {
        return { converged: true, finalPlaceholderCount: 0, reason: 'converged' }
      }

      let noDecreaseRounds = 0
      while (Date.now() - startTime < timeoutMs) {
        await adapterRef._waitMs(pollIntervalMs)
        const currentCount = adapterRef._countPlaceholderCovers()

        if (currentCount === 0) {
          return { converged: true, finalPlaceholderCount: 0, reason: 'converged' }
        }

        if (currentCount >= prevCount) {
          noDecreaseRounds++
          if (noDecreaseRounds >= stableRounds) {
            return { converged: false, finalPlaceholderCount: currentCount, reason: 'stable' }
          }
        } else {
          noDecreaseRounds = 0
        }
        prevCount = currentCount
      }

      return {
        converged: false,
        finalPlaceholderCount: adapterRef._countPlaceholderCovers(),
        reason: 'timeout'
      }
    },

    async _scrollThroughAllItemsForCovers (coverScrollOptions = {}) {
      const maxSegments = coverScrollOptions.maxSegments ?? COVER_SCROLL_MAX_SEGMENTS
      const segmentSettleMs = coverScrollOptions.segmentSettleMs ?? COVER_SEGMENT_SETTLE_MS
      const convergenceTimeoutMs = coverScrollOptions.convergenceTimeoutMs ?? COVER_CONVERGENCE_TIMEOUT_MS
      let segments = 0

      try {
        const win = getWindow()
        const document = getDocument()
        if (!win || typeof win.scrollTo !== 'function' || !document) {
          return { segments, reason: 'no_window', finalPlaceholderCount: 0, converged: false }
        }

        const scrollingEl = document.scrollingElement || document.documentElement
        if (!scrollingEl) {
          return { segments, reason: 'no_window', finalPlaceholderCount: 0, converged: false }
        }

        const viewportHeight = win.innerHeight || scrollingEl.clientHeight || 0
        const totalHeight = scrollingEl.scrollHeight || 0
        if (viewportHeight <= 0 || totalHeight <= viewportHeight) {
          const converge = await adapterRef._waitForPlaceholderConvergence({ timeoutMs: convergenceTimeoutMs })
          return {
            segments,
            reason: 'no_scroll_needed',
            finalPlaceholderCount: converge.finalPlaceholderCount,
            converged: converge.converged
          }
        }

        const segmentStep = Math.max(1, Math.floor(viewportHeight * COVER_SCROLL_SEGMENT_RATIO))
        let targetY = 0
        let prevScrollY = -1
        let stopReason = 'max_segments'

        while (segments < maxSegments) {
          win.scrollTo(0, targetY)
          segments++

          await adapterRef._waitForPlaceholderConvergence({ timeoutMs: segmentSettleMs })

          const currentScrollY = adapterRef._readScrollY(win, scrollingEl)

          if (currentScrollY >= totalHeight - viewportHeight) {
            stopReason = 'reached_bottom'
            break
          }

          if (currentScrollY <= prevScrollY) {
            stopReason = 'reached_bottom'
            break
          }
          prevScrollY = currentScrollY

          targetY += segmentStep
        }

        const finalConverge = await adapterRef._waitForPlaceholderConvergence({ timeoutMs: convergenceTimeoutMs })

        return {
          segments,
          reason: stopReason,
          finalPlaceholderCount: finalConverge.finalPlaceholderCount,
          converged: finalConverge.converged
        }
      } catch (error) {
        logger.warn('COVER_SCROLL_FAILED', { error: error.message, segments })
        return { segments, reason: 'error', finalPlaceholderCount: 0, converged: false }
      }
    },

    _readScrollY (win, scrollingEl) {
      try {
        if (typeof win.scrollY === 'number') {
          return win.scrollY
        }
        return scrollingEl?.scrollTop ?? 0
      } catch (readError) {
        return 0
      }
    },

    _measureBooks () {
      return deps.measureBooksFn()
    },

    async loadAllBooksLazy (scrollOptions = {}) {
      const startTime = Date.now()
      const maxIterations = scrollOptions.maxIterations || 30
      const stableRounds = scrollOptions.stableRounds || 3
      const renderWaitMs = scrollOptions.renderWaitMs || 800
      const overallTimeoutMs = scrollOptions.overallTimeoutMs || 60000

      const { total: expectedTotal } = adapterRef.parseLibraryTotal()

      const bookIdSet = new Set()
      let iterations = 0
      let stopReason = ''

      const readScrollTop = (el) => {
        try {
          return el.scrollTop ?? null
        } catch (readError) {
          return null
        }
      }

      const finalize = (reason, restoreContainer, originalScrollTop) => {
        if (restoreContainer && originalScrollTop !== null) {
          try {
            restoreContainer.scrollTop = originalScrollTop
          } catch (restoreError) {
            logger.debug('SCROLL_POSITION_RESTORE_FAILED', { error: restoreError.message })
          }
        }

        const loadedCount = bookIdSet.size
        const coverageComplete = expectedTotal !== null && loadedCount >= expectedTotal
        const missingCount = expectedTotal !== null
          ? Math.max(0, expectedTotal - loadedCount)
          : 0
        const durationMs = Date.now() - startTime

        const result = {
          loadedCount,
          expectedTotal,
          coverageComplete,
          missingCount,
          stopReason: reason,
          iterations,
          durationMs
        }

        logger.info('SCROLL_LOAD_COMPLETED', result)

        if (!coverageComplete) {
          logger.warn('COVERAGE_INCOMPLETE', {
            missingCount,
            stopReason: reason,
            reason: adapterRef.describeStopReason(reason)
          })
        }

        return result
      }

      try {
        const { container, strategy } = adapterRef.findScrollContainer()
        if (!container || strategy === 'none') {
          const initialIds = adapterRef._measureBooks()
          initialIds.forEach(id => bookIdSet.add(id))
          logger.warn('SCROLL_CONTAINER_NOT_FOUND', {
            loadedCount: bookIdSet.size,
            message: '捲動容器辨識失敗，降級為現行提取行為'
          })
          return finalize('container_not_found', null, null)
        }

        const originalScrollTop = readScrollTop(container)

        const firstIds = adapterRef._measureBooks()
        firstIds.forEach(id => bookIdSet.add(id))
        if (expectedTotal !== null && bookIdSet.size >= expectedTotal) {
          const coverResult = await adapterRef._scrollThroughAllItemsForCovers()
          logger.info('COVER_SCROLL_COMPLETED', coverResult)
          adapterRef._measureBooks().forEach(id => bookIdSet.add(id))
          return finalize('already_complete', container, originalScrollTop)
        }

        let noProgressRounds = 0
        let prevCount = bookIdSet.size

        while (true) {
          if (Date.now() - startTime >= overallTimeoutMs) {
            stopReason = 'timeout'
            break
          }

          adapterRef._scrollStep(container, strategy)
          iterations++

          await adapterRef.waitForRenderSettle(container, renderWaitMs, overallTimeoutMs - (Date.now() - startTime))

          const roundIds = adapterRef._measureBooks()
          roundIds.forEach(id => bookIdSet.add(id))
          const currentCount = bookIdSet.size

          if (expectedTotal !== null && currentCount >= expectedTotal) {
            stopReason = 'reached_total'
            break
          }

          if (currentCount === prevCount) {
            noProgressRounds++
            if (noProgressRounds >= stableRounds) {
              stopReason = 'count_stable'
              break
            }
          } else {
            noProgressRounds = 0
          }

          prevCount = currentCount

          if (iterations >= maxIterations) {
            stopReason = 'max_iterations'
            break
          }
        }

        const coverResult = await adapterRef._scrollThroughAllItemsForCovers()
        logger.info('COVER_SCROLL_COMPLETED', coverResult)
        adapterRef._measureBooks().forEach(id => bookIdSet.add(id))

        return finalize(stopReason, container, originalScrollTop)
      } catch (error) {
        logger.error('SCROLL_LOAD_ERROR', {
          error: error.message,
          component: 'ReadmooAdapter',
          loadedCount: bookIdSet.size,
          iterations
        })
        return finalize('error', null, null)
      }
    },

    waitForBookElements (waitOptions = {}) {
      const WAIT_TIMEOUT_MS = waitOptions.timeoutMs || 3000
      const CHECK_INTERVAL_MS = waitOptions.checkIntervalMs || 200

      const immediate = deps.getBookElementsFn()
      if (immediate.length > 0) {
        return Promise.resolve(immediate)
      }

      logger.info('WAIT_FOR_BOOK_ELEMENTS_START', { timeoutMs: WAIT_TIMEOUT_MS })

      return new Promise((resolve) => {
        const document = getDocument()
        if (!document) {
          resolve([])
          return
        }

        let resolved = false
        let observer = null
        let intervalId = null

        const cleanup = () => {
          if (observer) {
            observer.disconnect()
            observer = null
          }
          if (intervalId) {
            clearInterval(intervalId)
            intervalId = null
          }
        }

        const tryResolve = (source) => {
          if (resolved) return
          const elements = deps.getBookElementsFn()
          if (elements.length > 0) {
            resolved = true
            cleanup()
            logger.info('WAIT_FOR_BOOK_ELEMENTS_FOUND', {
              source,
              count: elements.length
            })
            resolve(elements)
          }
        }

        const observeTarget = document.body || document.documentElement
        observer = adapterRef._observeChildListOnce(
          observeTarget,
          () => tryResolve('mutation'),
          'MUTATION_OBSERVER_FAILED'
        )

        intervalId = setInterval(() => {
          tryResolve('interval')
        }, CHECK_INTERVAL_MS)

        setTimeout(() => {
          if (!resolved) {
            resolved = true
            cleanup()
            const finalElements = deps.getBookElementsFn()
            const timeoutPayload = {
              timeoutMs: WAIT_TIMEOUT_MS,
              finalCount: finalElements.length
            }
            if (finalElements.length > 0) {
              logger.info('WAIT_FOR_BOOK_ELEMENTS_TIMEOUT', timeoutPayload)
            } else {
              logger.warn('WAIT_FOR_BOOK_ELEMENTS_TIMEOUT', timeoutPayload)
            }
            resolve(finalElements)
          }
        }, WAIT_TIMEOUT_MS)
      })
    },

    _observeChildListOnce (target, onMutation, failLogEvent) {
      if (typeof MutationObserver === 'undefined' || !target || target.nodeType !== 1) {
        return null
      }
      try {
        const observer = new MutationObserver(onMutation)
        observer.observe(target, { childList: true, subtree: true })
        return observer
      } catch (observeError) {
        logger.debug(failLogEvent, { error: observeError.message })
        return null
      }
    },

    async waitForRenderSettle (container, renderWaitMs, remainingTimeoutMs) {
      const waitMs = Math.max(0, Math.min(renderWaitMs, remainingTimeoutMs))
      if (waitMs === 0) return

      return new Promise((resolve) => {
        let settled = false
        let observer = null
        let timeoutId = null

        const cleanup = () => {
          if (observer) {
            observer.disconnect()
            observer = null
          }
          if (timeoutId) {
            clearTimeout(timeoutId)
            timeoutId = null
          }
        }

        const done = () => {
          if (settled) return
          settled = true
          cleanup()
          resolve()
        }

        const document = getDocument()
        const observeTarget = document ? (document.body || document.documentElement) : null
        observer = adapterRef._observeChildListOnce(observeTarget, () => done(), 'RENDER_SETTLE_OBSERVER_FAILED')

        timeoutId = setTimeout(done, waitMs)
      })
    },

    describeStopReason (stopReason) {
      const descriptions = {
        reached_total: '捲動後已達可見書目數',
        already_complete: '首批渲染即達可見書目數，未進入捲動',
        count_stable: '捲動到底後書籍數連續穩定但未達可見書目數',
        max_iterations: '達捲動輪數上限仍未達可見書目數',
        timeout: '達整體逾時上限仍未達可見書目數',
        container_not_found: '捲動容器辨識失敗，僅提取已渲染書籍',
        error: '捲動過程發生例外，以已載入書籍繼續'
      }
      return descriptions[stopReason] || stopReason
    }
  }

  return loader
}

module.exports = createReadmooScrollLoader

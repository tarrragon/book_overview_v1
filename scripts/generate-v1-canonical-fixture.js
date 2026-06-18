#!/usr/bin/env node
'use strict'

/**
 * 生成 V1 端 canonical v3 fixture（供 W5-002 跨端 round-trip 驗證）
 *
 * 輸出：tests/integration/fixtures/v1-canonical-v3-round-trip.json
 *
 * 涵蓋 W5-001 成功標準：
 * - SC-1：必要欄位無損（id/title/tags/readingStatus）
 * - SC-2：readingStatus 六態
 * - SC-3：多值 metadata（多 author、多 ISBN）
 * - SC-4：_passthrough 保留
 * - SC-5：formatVersion semver
 */

const path = require('path')
const fs = require('fs')

const BookDataExporter = require(path.resolve(__dirname, '../src/export/book-data-exporter'))

const ROUND_TRIP_BOOKS = [
  {
    id: 'rt-001',
    title: '挪威的森林',
    authors: ['村上春樹', 'Haruki Murakami'],
    publisher: '時報出版',
    source: 'readmoo',
    identifiers: { isbn: '9789571234567' },
    readingStatus: 'reading',
    isManualStatus: false,
    progress: 45.5,
    cover: 'https://readmoo.com/cover/rt-001.jpg',
    tagIds: ['tag-gift'],
    createdAt: '2026-01-15T08:30:00.000Z',
    updatedAt: '2026-03-20T14:22:00.000Z'
  },
  {
    id: 'rt-002',
    title: '原子習慣',
    authors: ['James Clear'],
    publisher: '方智出版社',
    source: 'readmoo',
    identifiers: { isbn: '9789861755267' },
    readingStatus: 'unread',
    isManualStatus: false,
    progress: 0,
    cover: '',
    tagIds: [],
    createdAt: '2026-02-01T10:00:00.000Z',
    updatedAt: '2026-02-01T10:00:00.000Z'
  },
  {
    id: 'rt-003',
    title: '人類大歷史',
    authors: ['Yuval Noah Harari'],
    publisher: '天下文化',
    source: 'readmoo',
    readingStatus: 'finished',
    isManualStatus: false,
    progress: 100,
    cover: 'https://readmoo.com/cover/rt-003.jpg',
    tagIds: [],
    createdAt: '2025-12-01T00:00:00.000Z',
    updatedAt: '2026-01-10T00:00:00.000Z'
  },
  {
    id: 'rt-004',
    title: '被討厭的勇氣',
    authors: ['岸見一郎', '古賀史健'],
    publisher: '究竟出版',
    source: 'readmoo',
    readingStatus: 'abandoned',
    isManualStatus: true,
    progress: 30,
    cover: 'https://readmoo.com/cover/rt-004.jpg',
    tagIds: [],
    createdAt: '2026-03-01T00:00:00.000Z',
    updatedAt: '2026-04-15T00:00:00.000Z'
  },
  {
    id: 'rt-005',
    title: '刻意練習',
    authors: ['Anders Ericsson', 'Robert Pool'],
    publisher: '方智出版社',
    source: 'readmoo',
    readingStatus: 'queued',
    isManualStatus: false,
    progress: 0,
    cover: '',
    tagIds: ['tag-friend'],
    createdAt: '2026-05-01T00:00:00.000Z',
    updatedAt: '2026-05-01T00:00:00.000Z'
  },
  {
    id: 'rt-006',
    title: 'Clean Code',
    authors: ['Robert C. Martin'],
    publisher: 'Prentice Hall',
    source: 'readmoo',
    readingStatus: 'reference',
    isManualStatus: true,
    progress: 65,
    cover: 'https://readmoo.com/cover/rt-006.jpg',
    tagIds: [],
    createdAt: '2025-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z'
  }
]

if (typeof performance === 'undefined') {
  global.performance = { now: () => Date.now() }
}

const exporter = new BookDataExporter(ROUND_TRIP_BOOKS)
const canonicalJSON = exporter.exportToJSON({
  formatVersion: '3.0.0',
  pretty: true,
  metadata: { exportedAt: '2026-06-18T15:00:00.000Z' }
})

const outputPath = path.resolve(__dirname, '../tests/integration/fixtures/v1-canonical-v3-round-trip.json')
fs.writeFileSync(outputPath, canonicalJSON, 'utf8')

const parsed = JSON.parse(canonicalJSON)
console.log('Generated V1 canonical v3 fixture:')
console.log(`  Path: ${outputPath}`)
console.log(`  Books: ${parsed.books.length}`)
console.log(`  Format: ${parsed.format}`)
console.log(`  Version: ${parsed.formatVersion}`)
console.log(`  Source: ${parsed.metadata.sourceApp}`)
console.log(`  ReadingStatus coverage: ${ROUND_TRIP_BOOKS.map(b => b.readingStatus).join(', ')}`)

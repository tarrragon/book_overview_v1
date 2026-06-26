/**
 * Bookstore configuration — SSOT for all supported bookstores.
 *
 * Adding a new bookstore requires only appending an entry here;
 * popup.js and ui-factory read this list at runtime.
 */

const BOOKSTORE_LIST = Object.freeze([
  {
    id: 'readmoo',
    name: 'Readmoo',
    url: 'https://read.readmoo.com/#/library',
    enabled: true
  },
  {
    id: 'books-com-tw',
    name: '博客來',
    url: 'https://viewer-ebook.books.com.tw/viewer/index.html?readlist=all',
    enabled: false
  }
])

module.exports = { BOOKSTORE_LIST }

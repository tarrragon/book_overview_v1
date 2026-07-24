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
    enabled: true
  },
  {
    id: 'kobo',
    name: 'Kobo',
    url: 'https://www.kobo.com/tw/zh/library/books',
    enabled: true
  },
  {
    id: 'kobo-jp',
    name: 'Kobo（日本）',
    url: 'https://www.kobo.com/jp/ja/library/books',
    enabled: true
  }
])

module.exports = { BOOKSTORE_LIST }

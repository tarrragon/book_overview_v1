// 提取所有書籍資料的函數
function extractBooksData() {
    const books = [];
    
    // 假設每本書都在一個包含連結、圖片和標題的容器中
    // 您可能需要根據實際HTML結構調整選擇器
    const bookElements = document.querySelectorAll('a[href*="/api/reader/"]');
    
    bookElements.forEach(element => {
        try {
            // 提取 ID（從 href 中）
            const href = element.getAttribute('href');
            const idMatch = href.match(/\/api\/reader\/(\d+)/);
            const id = idMatch ? idMatch[1] : null;
            
            // 查找相關的圖片元素
            const img = element.querySelector('img') || element.parentNode.querySelector('img');
            
            if (img) {
                // 提取標題（從 alt 屬性中）
                const alt = img.getAttribute('alt');
                const title = alt || '';
                
                // 提取封面圖片URL（從 src 屬性中）
                const cover = img.getAttribute('src') || '';
                
                // 只有當我們有有效數據時才添加到結果中
                if (id && title && cover) {
                    books.push({
                        id: id,
                        title: title,
                        cover: cover
                    });
                }
            }
        } catch (error) {
            console.error('提取數據時發生錯誤:', error);
        }
    });
    
    return books;
}

// 執行提取並輸出結果
const booksData = extractBooksData();
console.log('提取的書籍數據:', JSON.stringify(booksData, null, 2));

// 如果您想要將結果複製到剪貼板（在支援的瀏覽器中）
if (navigator.clipboard) {
    navigator.clipboard.writeText(JSON.stringify(booksData, null, 2))
        .then(() => console.log('數據已複製到剪貼板'))
        .catch(err => console.error('複製失敗:', err));
}

// 返回數據供進一步使用
booksData;
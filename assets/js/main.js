// 書籍資料陣列
let booksData = [];

// 範例資料（僅包含少量資料用於演示）
const sampleData = [
    {
        "id": "210327003000101",
        "title": "大腦不滿足",
        "cover": "https://cdn.readmoo.com/cover/jb/qpfmrmi_210x315.jpg?v=1714370332"
    },
    {
        "id": "210165843000101",
        "title": "我們為何吃太多？",
        "cover": "https://cdn.readmoo.com/cover/a9/37l3i8f_210x315.jpg?v=1734599599"
    },
    {
        "id": "210120158000101",
        "title": "雜食者的兩難（新版）",
        "cover": "https://cdn.readmoo.com/cover/qh/kogrvjr_210x315.jpg?v=1574841701"
    },
    {
        "id": "210278978000101",
        "title": "國家的視角",
        "cover": "https://cdn.readmoo.com/cover/92/ca97l77_210x315.jpg?v=1688694153"
    },
    {
        "id": "210305735000101",
        "title": "想像的共同體──民族主義的起源與散布",
        "cover": "https://cdn.readmoo.com/cover/fk/bb9imfe_210x315.jpg?v=1748087489"
    }
];

/**
 * 從檔案載入書籍資料
 */
function loadFromFile() {
    const fileInput = document.getElementById('jsonFileInput');
    const file = fileInput.files[0];
    
    if (!file) {
        alert('請先選擇一個 JSON 檔案！');
        return;
    }
    
    if (!file.name.toLowerCase().endsWith('.json')) {
        alert('請選擇 JSON 格式的檔案！');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const jsonData = JSON.parse(e.target.result);
            
            // 驗證 JSON 格式
            if (!Array.isArray(jsonData)) {
                throw new Error('JSON 檔案應該包含一個陣列');
            }
            
            // 驗證每個書籍物件的格式
            for (let i = 0; i < jsonData.length; i++) {
                const book = jsonData[i];
                if (!book.id || !book.title || !book.cover) {
                    throw new Error(`第 ${i + 1} 個書籍缺少必要欄位 (id, title, cover)`);
                }
            }
            
            // 載入資料
            booksData.length = 0; // 清空現有資料
            booksData.push(...jsonData);
            
            // 隱藏檔案上傳介面
            document.getElementById('fileUploader').style.display = 'none';
            
            // 重新渲染表格
            renderTable();
            
            alert(`成功載入 ${jsonData.length} 本書籍資料！`);
            
        } catch (error) {
            alert(`載入檔案失敗：${error.message}`);
        }
    };
    
    reader.onerror = function() {
        alert('讀取檔案時發生錯誤！');
    };
    
    reader.readAsText(file, 'UTF-8');
}

/**
 * 載入範例資料
 */
function loadSampleData() {
    booksData.length = 0; // 清空現有資料
    booksData.push(...sampleData);
    
    // 隱藏檔案上傳介面
    document.getElementById('fileUploader').style.display = 'none';
    
    // 重新渲染表格
    renderTable();
    
    alert(`載入了 ${sampleData.length} 本範例書籍資料！`);
}

/**
 * 顯示檔案上傳介面
 */
function showFileUploader() {
    document.getElementById('fileUploader').style.display = 'block';
}

/**
 * 渲染書籍表格
 */
function renderTable() {
    const tableBody = document.getElementById('tableBody');
    tableBody.innerHTML = '';
    
    booksData.forEach((book, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>
                <img src="${book.cover}" alt="${book.title}" class="book-cover" 
                     onerror="this.style.display='none'">
            </td>
            <td class="book-id">${book.id}</td>
            <td class="book-title">${book.title}</td>
        `;
        tableBody.appendChild(row);
    });
    
    updateStats();
}

/**
 * 更新統計資訊
 */
function updateStats() {
    const totalBooks = booksData.length;
    const displayedBooks = document.querySelectorAll('#tableBody tr').length;
    
    document.getElementById('totalBooks').textContent = totalBooks;
    document.getElementById('displayedBooks').textContent = displayedBooks;
}

/**
 * 過濾書籍
 */
function filterBooks() {
    const searchTerm = document.getElementById('searchBox').value.toLowerCase();
    const rows = document.querySelectorAll('#tableBody tr');
    
    rows.forEach(row => {
        const title = row.querySelector('.book-title').textContent.toLowerCase();
        const id = row.querySelector('.book-id').textContent.toLowerCase();
        
        if (title.includes(searchTerm) || id.includes(searchTerm)) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
    
    const visibleRows = document.querySelectorAll('#tableBody tr:not([style*="display: none"])').length;
    document.getElementById('displayedBooks').textContent = visibleRows;
}

/**
 * 匯出為 CSV 檔案
 */
function exportToCSV() {
    let csv = '書籍ID,書名,封面連結\n';
    
    booksData.forEach(book => {
        csv += `"${book.id}","${book.title.replace(/"/g, '""')}","${book.cover}"\n`;
    });
    
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'readmoo_books.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

/**
 * 複製表格文字到剪貼簿
 */
function copyTableText() {
    let text = '書籍ID\t書名\t封面連結\n';
    
    booksData.forEach(book => {
        text += `${book.id}\t${book.title}\t${book.cover}\n`;
    });
    
    navigator.clipboard.writeText(text).then(() => {
        alert('表格內容已複製到剪貼簿。');
    }).catch(() => {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        alert('表格內容已複製到剪貼簿。');
    });
}

/**
 * 選取整個表格
 */
function selectAllTable() {
    const table = document.getElementById('booksTable');
    const range = document.createRange();
    range.selectNode(table);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    alert('表格已選取，請按 Ctrl+C (或 Cmd+C) 複製後。');
}

/**
 * 重設並重新載入檔案
 */
function resetAndReload() {
    // 清空資料陣列
    booksData.length = 0;
    
    // 清空表格
    const tableBody = document.getElementById('tableBody');
    tableBody.innerHTML = '';
    
    // 重新顯示檔案上傳介面
    showFileUploader();
    
    // 重置統計
    document.getElementById('totalBooks').textContent = '0';
    document.getElementById('displayedBooks').textContent = '0';
    
    // 清空搜尋框
    document.getElementById('searchBox').value = '';
}

/**
 * 初始化應用程式
 */
document.addEventListener('DOMContentLoaded', function() {
    if (booksData.length === 0) {
        showFileUploader();
    } else {
        renderTable();
    }
});

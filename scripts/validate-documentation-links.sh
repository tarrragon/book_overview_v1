#!/bin/bash

# 文件連結驗證腳本
# 用於檢查 CLAUDE.md 和 docs/ 底下四個核心文件的所有連結有效性

echo "🔍 開始驗證文件連結有效性..."
echo "==============================================="

# 動態獲取專案根目錄路徑
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
DOCS_DIR="$BASE_DIR/docs"
DOMAINS_DIR="$DOCS_DIR/domains"

# 要檢查的核心文件
declare -a CORE_FILES=(
    "$BASE_DIR/CLAUDE.md"
    "$DOCS_DIR/struct.md" 
    "$DOCS_DIR/README.md"
    "$DOCS_DIR/todolist.md"
    "$DOCS_DIR/use-cases.md"
    "$DOMAINS_DIR/README.md"
)

# 統計變數
TOTAL_LINKS=0
VALID_LINKS=0
BROKEN_LINKS=0
MISSING_FILES=0

# 顏色輸出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 函數：檢查文件是否存在
check_file_exists() {
    local file_path="$1"
    local base_path="$2"
    
    # 處理相對路徑
    if [[ "$file_path" == ./* ]]; then
        file_path="${base_path}/$(echo "$file_path" | sed 's|^\./||')"
    elif [[ "$file_path" == ../* ]]; then
        file_path="$(dirname "$base_path")/${file_path}"
    elif [[ "$file_path" != /* ]]; then
        file_path="${base_path}/${file_path}"
    fi
    
    # 正規化路徑
    file_path=$(echo "$file_path" | sed 's|/\./|/|g' | sed 's|/[^/]*/\.\./|/|g')
    
    if [[ -f "$file_path" || -d "$file_path" ]]; then
        return 0
    else
        return 1
    fi
}

# 函數：提取 Markdown 文件中的連結
extract_markdown_links() {
    local file="$1"
    local base_path=$(dirname "$file")
    
    echo -e "${BLUE}檢查文件: $file${NC}"
    
    if [[ ! -f "$file" ]]; then
        echo -e "${RED}❌ 文件不存在: $file${NC}"
        ((MISSING_FILES++))
        return
    fi
    
    # 提取 [text](link) 格式的連結
    local links=$(grep -oE '\[([^]]+)\]\(([^)]+)\)' "$file" | sed 's/.*(\([^)]*\)).*/\1/')
    
    local file_link_count=0
    local file_valid_count=0
    local file_broken_count=0
    
    while IFS= read -r link; do
        [[ -z "$link" ]] && continue
        
        # 跳過外部連結和錨點連結
        if [[ "$link" =~ ^https?:// || "$link" =~ ^mailto: || "$link" =~ ^# ]]; then
            continue
        fi
        
        ((file_link_count++))
        ((TOTAL_LINKS++))
        
        # 移除錨點部分
        link_without_anchor=$(echo "$link" | cut -d'#' -f1)
        
        if check_file_exists "$link_without_anchor" "$base_path"; then
            echo -e "  ${GREEN}✅ $link${NC}"
            ((file_valid_count++))
            ((VALID_LINKS++))
        else
            echo -e "  ${RED}❌ $link${NC}"
            echo -e "     ${YELLOW}預期路徑: $base_path/$link_without_anchor${NC}"
            ((file_broken_count++))
            ((BROKEN_LINKS++))
        fi
        
    done <<< "$links"
    
    if [[ $file_link_count -gt 0 ]]; then
        echo -e "  📊 文件統計: $file_valid_count 有效, $file_broken_count 無效, 共 $file_link_count 個連結"
    else
        echo -e "  📝 未發現內部連結"
    fi
    echo ""
}

# 主要檢查流程
echo "🎯 檢查核心文件連結..."
echo ""

for file in "${CORE_FILES[@]}"; do
    extract_markdown_links "$file"
done

# 檢查第二層重要文件
echo -e "${BLUE}🔧 檢查第二層開發文件連結...${NC}"
echo ""

find "$DOMAINS_DIR/02-development" -name "*.md" -type f | while read file; do
    extract_markdown_links "$file"
done

# 檢查第三層參考文件的 README
echo -e "${BLUE}🎓 檢查第三層參考文件連結...${NC}" 
echo ""

find "$DOMAINS_DIR/03-reference" -name "README.md" -type f | while read file; do
    extract_markdown_links "$file"
done

# 生成報告
echo "==============================================="
echo -e "${BLUE}📊 連結驗證總結報告${NC}"
echo "==============================================="
echo -e "📁 檢查的核心文件數量: ${#CORE_FILES[@]}"
echo -e "🔗 總連結數量: $TOTAL_LINKS"
echo -e "${GREEN}✅ 有效連結: $VALID_LINKS${NC}"
echo -e "${RED}❌ 無效連結: $BROKEN_LINKS${NC}"
echo -e "${YELLOW}📄 缺失文件: $MISSING_FILES${NC}"

if [[ $BROKEN_LINKS -gt 0 || $MISSING_FILES -gt 0 ]]; then
    echo ""
    echo -e "${RED}⚠️ 發現問題，不建議推進版本！${NC}"
    echo ""
    echo -e "${YELLOW}建議修正措施:${NC}"
    echo -e "1. 修正或移除無效連結"
    echo -e "2. 創建缺失的文件或添加 PLACEHOLDER 標記"
    echo -e "3. 更新相對路徑確保正確性"
    exit 1
else
    echo ""
    echo -e "${GREEN}🎉 所有連結驗證通過，可以考慮推進版本！${NC}"
    exit 0
fi
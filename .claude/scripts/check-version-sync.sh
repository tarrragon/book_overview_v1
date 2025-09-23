#!/bin/bash

# 版號同步檢查腳本
# 確保 package.json 與 CHANGELOG.md 的版號同步

set -e

# 顏色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日誌函數
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 從 CHANGELOG.md 獲取最新版號
get_changelog_version() {
    if [[ -f "CHANGELOG.md" ]]; then
        grep -E "^## \[v[0-9]+\.[0-9]+\.[0-9]+\]" CHANGELOG.md | head -1 | grep -o 'v[0-9]\+\.[0-9]\+\.[0-9]\+' | sed 's/v//'
    fi
}

# 從 package.json 獲取版號
get_package_version() {
    if [[ -f "package.json" ]]; then
        grep -o '"version"[[:space:]]*:[[:space:]]*"[^"]*"' package.json | cut -d'"' -f4
    fi
}

# 更新 package.json 版號
update_package_version() {
    local new_version="$1"
    
    if [[ -f "package.json" ]]; then
        sed -i.bak "s/\"version\":[[:space:]]*\"[^\"]*\"/\"version\": \"$new_version\"/" package.json
        log_success "已更新 package.json 版號為: $new_version"
    else
        log_error "找不到 package.json 檔案"
        return 1
    fi
}

# 版本比較函數 (version1 > version2 返回 0)
version_compare() {
    local version1="$1"
    local version2="$2"
    
    # 使用 sort -V 進行版本比較
    if [[ "$(printf '%s\n' "$version1" "$version2" | sort -V | tail -1)" == "$version1" ]] && [[ "$version1" != "$version2" ]]; then
        return 0  # version1 > version2
    else
        return 1  # version1 <= version2
    fi
}

# 主檢查函數
main() {
    log_info "開始版號同步檢查..."
    
    local changelog_version=$(get_changelog_version)
    local package_version=$(get_package_version)
    
    log_info "CHANGELOG.md 最新版號: ${changelog_version:-"未找到"}"
    log_info "package.json 目前版號: ${package_version:-"未找到"}"
    
    # 檢查是否需要同步
    if [[ -z "$changelog_version" ]]; then
        log_warning "⚠️  CHANGELOG.md 中未找到版號格式 [vX.X.X]"
        return 1
    fi
    
    if [[ -z "$package_version" ]]; then
        log_error "package.json 中未找到版號"
        return 1
    fi
    
    # 比較版號並智能決定同步方向
    if [[ "$changelog_version" == "$package_version" ]]; then
        log_success "✅ 版號已同步: v$changelog_version"
        return 0
    else
        log_warning "⚠️  版號不同步！"
        echo ""
        echo "CHANGELOG.md: v$changelog_version"
        echo "package.json:  v$package_version"
        echo ""
        
        # 版本比較邏輯：以較新的版本為準
        if version_compare "$package_version" "$changelog_version"; then
            log_info "📈 package.json 版本較新，應更新 CHANGELOG.md"
            log_warning "⚠️  請手動更新 CHANGELOG.md 到 v$package_version"
            log_info "💡 或執行 ./scripts/work-log-manager.sh 管理版本記錄"
            return 1
        else
            # CHANGELOG 版本較新，同步 package.json
            echo "🔄 自動將 package.json 同步到 CHANGELOG.md 的版號..."
            if update_package_version "$changelog_version"; then
                log_success "✅ 版號同步完成: v$changelog_version"
                echo ""
                log_info "💡 請記住將 package.json 的變更加入到此次提交中"
                return 0
            else
                log_error "版號同步失敗"
                return 1
            fi
        fi
    fi
}

# 如果直接執行腳本則執行 main 函數
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
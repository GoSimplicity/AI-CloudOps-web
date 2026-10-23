#!/usr/bin/env bash
# 启用本仓库的 Git 钩子（husky）并检查 gitleaks 是否已安装。
#
# web 仓库使用 husky v9：`pnpm install` 的 prepare 脚本会执行 `husky`，把 core.hooksPath 设为 .husky/_，
# 然后 .husky/_/pre-commit -> .husky/pre-commit -> .githooks/pre-commit（gitleaks）。
# 因此这里不再把 core.hooksPath 指向 .githooks（否则会与 husky 互相覆盖），而是：
#   1. 清除旧版本脚本写入的 core.hooksPath=.githooks 覆盖（仅 worktree 级 / 本仓库 local 级）；
#   2. 运行 husky 生成 .husky/_ 并设置 core.hooksPath；
#   3. 检查 .husky/pre-commit 存在、可执行且调用 .githooks/pre-commit
#      （husky 的 .husky/_/h 在 .husky/pre-commit 缺失时会静默以 0 退出，钩子形同虚设）；
#   4. 检查 gitleaks。
# 任何一步不满足都以非 0 退出；设置了 HUSKY=0 时直接失败。本地钩子可以被 --no-verify / HUSKY=0 跳过，CI 的 gitleaks 工作流才是最终防线。
# 用法: scripts/setup-git-hooks.sh
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
log_info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error()   { echo -e "${RED}[ERROR]${NC} $1" >&2; }

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

if [ "${HUSKY:-}" = "0" ]; then
    log_warning "=================================================================="
    log_warning "检测到 HUSKY=0：husky 不会安装钩子；并且只要提交时环境里仍有 HUSKY=0，"
    log_warning "所有 husky 钩子（包括 gitleaks 密钥扫描）都会被直接跳过。"
    log_warning "请在未设置 HUSKY=0 的 shell 中重新运行本脚本，并检查 ~/.config/husky/init.sh、"
    log_warning "~/.zshrc / ~/.bashrc、IDE 的环境配置中是否导出了 HUSKY=0。"
    log_warning "CI 的 gitleaks 工作流仍会扫描，但密钥一旦推送到远端就必须轮换。"
    log_warning "=================================================================="
    # review3g N3：即使钩子此前已安装，提交时 HUSKY=0 仍会跳过全部钩子，因此一律失败（与 README 一致）
    log_error "HUSKY=0：提交前的 gitleaks 扫描不会执行，拒绝继续。请在未设置 HUSKY=0 的环境中重新运行本脚本。"
    exit 1
fi

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    log_error "当前目录不是 Git 仓库: $PROJECT_ROOT"
    exit 1
fi

chmod +x .husky/pre-commit .githooks/pre-commit 2>/dev/null || true

# 1. 清除旧的 .githooks 覆盖（worktree 级配置优先级高于 husky 写入的配置，会让 husky 失效）
if [ "$(git config --worktree --get core.hooksPath 2>/dev/null || true)" = ".githooks" ]; then
    git config --worktree --unset core.hooksPath
    log_info "已移除 worktree 级 core.hooksPath=.githooks"
fi
if [ "$(git config --local --get core.hooksPath 2>/dev/null || true)" = ".githooks" ]; then
    git config --local --unset core.hooksPath
    log_info "已移除 local 级 core.hooksPath=.githooks"
fi

# 2. 安装 husky（与 pnpm install 的 prepare 脚本相同）。husky 缺失或未生效时失败（exit 1），
#    否则钩子不会执行、gitleaks 被静默跳过。本脚本不在 prepare/postinstall 中调用，不影响 CI 的 pnpm install。
if [ ! -x node_modules/.bin/husky ]; then
    log_error "未找到 node_modules/.bin/husky，Git 钩子（含 gitleaks）未启用。"
    log_error "请先执行 pnpm install（prepare 脚本会安装 husky 钩子），然后重新运行本脚本。"
    exit 1
fi
node_modules/.bin/husky || { log_error "husky 执行失败"; exit 1; }

expected_hooks_path=".husky/_"
actual_hooks_path="$(git config --get core.hooksPath 2>/dev/null || true)"
if [ "$actual_hooks_path" != "$expected_hooks_path" ]; then
    log_error "core.hooksPath=${actual_hooks_path:-<未设置>}，期望 ${expected_hooks_path}：Git 钩子（含 gitleaks）不会执行。"
    [ "${HUSKY:-}" = "0" ] && log_error "检测到 HUSKY=0（husky 跳过安装），请在未设置 HUSKY=0 的环境中重试。"
    log_error "请检查是否有更高优先级的 core.hooksPath 配置（git config --show-origin --get-all core.hooksPath）。"
    exit 1
fi
if [ ! -f "$expected_hooks_path/pre-commit" ]; then
    log_error "${expected_hooks_path}/pre-commit 不存在，husky 未正确安装钩子。"
    exit 1
fi
# husky v9 的 .husky/_/pre-commit 只是转调 .husky/pre-commit；后者缺失时 husky 静默放行（退出码 0）。
husky_hook=".husky/pre-commit"
if [ ! -f "$husky_hook" ]; then
    log_error "${husky_hook} 不存在：husky 会静默跳过 pre-commit，gitleaks 不会执行。请从仓库恢复该文件（git checkout -- ${husky_hook}）。"
    exit 1
fi
if [ ! -x "$husky_hook" ]; then
    log_error "${husky_hook} 不可执行（仓库中应为 100755），检出的钩子文件不完整。请执行 chmod +x ${husky_hook} 或重新检出。"
    exit 1
fi
# 必须在非注释行中调用 .githooks/pre-commit（gitleaks 扫描的实现）
if ! grep -v '^[[:space:]]*#' "$husky_hook" | grep -q '\.githooks/pre-commit'; then
    log_error "${husky_hook} 没有调用 .githooks/pre-commit：提交前不会运行 gitleaks。请从仓库恢复该文件。"
    exit 1
fi
log_info "已运行 husky，core.hooksPath=${actual_hooks_path}"

# 4. 检查 gitleaks
if command -v gitleaks >/dev/null 2>&1; then
    log_success "gitleaks 已安装: $(gitleaks version)"
else
    log_error "未找到 gitleaks。pre-commit 钩子会因此阻止提交。"
    log_error "请从 https://github.com/gitleaks/gitleaks/releases 下载官方二进制，校验 sha256 后放入 PATH（如 ~/.local/bin）。"
    exit 1
fi

log_success "Git hooks 设置完成（提交前将经 husky 运行 gitleaks 密钥扫描）。"
log_info "提示：本地钩子可被 git commit --no-verify 或 HUSKY=0 跳过；CI 的 gitleaks 工作流是最终防线。"

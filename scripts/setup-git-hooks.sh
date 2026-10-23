#!/usr/bin/env bash
# 启用本仓库的 Git 钩子（husky）并检查 gitleaks 是否已安装。
#
# web 仓库使用 husky v9：`pnpm install` 的 prepare 脚本会执行 `husky`，把 core.hooksPath 设为 .husky/_，
# 然后 .husky/_/pre-commit -> .husky/pre-commit -> .githooks/pre-commit（gitleaks）。
# 因此这里不再把 core.hooksPath 指向 .githooks（否则会与 husky 互相覆盖），而是：
#   1. 清除旧版本脚本写入的 core.hooksPath=.githooks 覆盖（仅 worktree 级 / 本仓库 local 级）；
#   2. 运行 husky 生成 .husky/_ 并设置 core.hooksPath；
#   3. 检查 .husky/pre-commit 存在、可执行且与预期内容逐字节一致（调用 .githooks/pre-commit，失败即退出）
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
# review3g N4：.husky/pre-commit 必须与下面的内容逐字节一致。旧检查只 grep 非注释行里有没有 .githooks/pre-commit，
# 写成 ": .githooks/pre-commit"、在前面加 "exit 0"、或把 "|| exit 1" 改成 "|| true" 都能通过，gitleaks 实际不生效。
# 修改 .husky/pre-commit 时必须同步修改这里（scripts/tests/security/test-setup-git-hooks.sh 会核对两者一致）。
expected_husky_hook="$(mktemp "${TMPDIR:-/tmp}/husky-pre-commit.XXXXXX")"
cat >"$expected_husky_hook" <<'HUSKY_PRE_COMMIT_EOF'
#!/usr/bin/env sh
# husky v9 pre-commit 钩子（由 .husky/_/h 以 `sh -e` 调用；core.hooksPath=.husky/_ 由 `pnpm install` 的 prepare 脚本设置）
#
# 1) SEC-01A: gitleaks 扫描暂存内容，发现密钥或未安装 gitleaks 即阻止提交。
#    具体实现复用 .githooks/pre-commit（与后端 / aiops 仓库保持同一份逻辑）。
"$(git rev-parse --show-toplevel)/.githooks/pre-commit" || exit 1

# 2) 其余原有钩子命令：在加入本文件之前，仓库中没有任何已跟踪的 .husky 钩子
#    （core.hooksPath 指向 .husky/_ 但没有 .husky/pre-commit），因此此前提交时不执行 lint。
#    为保持原有行为，这里不追加命令；如需启用 lint-staged（.lintstagedrc.mjs），在此追加：
#    pnpm exec lint-staged
HUSKY_PRE_COMMIT_EOF
if ! cmp -s "$expected_husky_hook" "$husky_hook"; then
    rm -f "$expected_husky_hook"
    log_error "${husky_hook} 与预期内容不一致（逐字节比较）：提交前可能不会运行 gitleaks。请从仓库恢复该文件（git checkout -- ${husky_hook}）。"
    exit 1
fi
rm -f "$expected_husky_hook"
log_info "已运行 husky，core.hooksPath=${actual_hooks_path}"

# 4. 检查 gitleaks
# gitleaks 最低版本 8.25.0（review3g N6）：.gitleaks.toml 使用多个 [[allowlists]]（含 targetRules/condition），
# 该写法自 8.25.0 起才支持；更低版本的策略语义不同，且 8.19 之前没有 `gitleaks git --staged`。
# 只接受 gitleaks version 输出的严格形式 X.Y.Z（可带前缀 v），无法解析一律视为不满足。
GITLEAKS_MIN_MAJOR=8
GITLEAKS_MIN_MINOR=25
gitleaks_version_check() {
    gl_ver_raw="$(gitleaks version 2>/dev/null | head -n 1)"
    gl_ver="${gl_ver_raw#v}"
    case "$gl_ver" in
        ''|*[!0-9.]*|.*|*.|*..*) return 2 ;;
    esac
    gl_major="${gl_ver%%.*}"; gl_rest="${gl_ver#*.}"
    gl_minor="${gl_rest%%.*}"; gl_patch="${gl_rest#*.}"
    case "$gl_rest" in *.*) ;; *) return 2 ;; esac
    case "$gl_patch" in ''|*.*) return 2 ;; esac
    if [ "$gl_major" -gt "$GITLEAKS_MIN_MAJOR" ]; then return 0; fi
    if [ "$gl_major" -eq "$GITLEAKS_MIN_MAJOR" ] && [ "$gl_minor" -ge "$GITLEAKS_MIN_MINOR" ]; then return 0; fi
    return 1
}
if command -v gitleaks >/dev/null 2>&1; then
    gl_vrc=0; gitleaks_version_check || gl_vrc=$?
    if [ "$gl_vrc" -eq 2 ]; then
        log_error "无法解析 gitleaks 版本（gitleaks version 输出: ${gl_ver_raw:-<空>}），需要 >= ${GITLEAKS_MIN_MAJOR}.${GITLEAKS_MIN_MINOR}.0；pre-commit 钩子会因此阻止提交。"
        exit 1
    elif [ "$gl_vrc" -ne 0 ]; then
        log_error "gitleaks 版本 ${gl_ver_raw} 低于 ${GITLEAKS_MIN_MAJOR}.${GITLEAKS_MIN_MINOR}.0；pre-commit 钩子会因此阻止提交。请从 https://github.com/gitleaks/gitleaks/releases 升级。"
        exit 1
    fi
    log_success "gitleaks 已安装: ${gl_ver_raw}（>= ${GITLEAKS_MIN_MAJOR}.${GITLEAKS_MIN_MINOR}.0）"
else
    log_error "未找到 gitleaks。pre-commit 钩子会因此阻止提交。"
    log_error "请从 https://github.com/gitleaks/gitleaks/releases 下载官方二进制，校验 sha256 后放入 PATH（如 ~/.local/bin）。"
    exit 1
fi

log_success "Git hooks 设置完成（提交前将经 husky 运行 gitleaks 密钥扫描）。"
log_info "提示：本地钩子可被 git commit --no-verify 或 HUSKY=0 跳过；CI 的 gitleaks 工作流是最终防线。"

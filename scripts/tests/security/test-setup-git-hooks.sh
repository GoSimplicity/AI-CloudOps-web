#!/usr/bin/env bash
# SEC-01A 审查（web）：scripts/setup-git-hooks.sh 在钩子不会真正运行 gitleaks 的任何情况下都必须失败（非 0 退出）。
#   第二轮：没有 husky、husky 运行后 core.hooksPath 不是 .husky/_、.husky/_/pre-commit 缺失
#   第三轮 P3-2：.husky/pre-commit 缺失 / 不可执行 / 没有调用 .githooks/pre-commit（husky 会静默放行）；HUSKY=0 要有明确警告
#   review3g N3：HUSKY=0 时（包括钩子已安装后重跑）必须失败
# 正常情况使用仓库 node_modules 中真实的 husky（9.x，需先 pnpm install），并做端到端验证：
#   安装后提交合成密钥被 gitleaks 拦下、提交干净文件成功。
# 用法: scripts/tests/security/test-setup-git-hooks.sh [--rev <git-rev>]   （对修复前版本运行应报 FAIL）
# 在 mktemp -d 的临时仓库中运行，不改动本仓库。兼容 macOS bash 3.2 / BSD 工具。
set -euo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
REV=""
while [ $# -gt 0 ]; do case "$1" in --rev) REV="$2"; shift 2 ;; *) echo "未知参数: $1" >&2; exit 2 ;; esac; done
export PATH="$HOME/.local/bin:$PATH"
command -v gitleaks >/dev/null || { echo "缺少依赖: gitleaks" >&2; exit 2; }
command -v node >/dev/null || { echo "缺少依赖: node" >&2; exit 2; }
HUSKY_BIN="$REPO/node_modules/husky/bin.js"
[ -f "$HUSKY_BIN" ] || { echo "缺少依赖: ${HUSKY_BIN}（请先在仓库中 pnpm install）" >&2; exit 2; }
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
export GIT_CONFIG_GLOBAL="$TMP/gitconfig" GIT_CONFIG_NOSYSTEM=1 XDG_CONFIG_HOME="$TMP/xdg"
git config --global user.name test; git config --global user.email test@example.invalid
src() { if [ -n "$REV" ]; then git -C "$REPO" show "$REV:$1"; else cat "$REPO/$1"; fi; }
strip_color() { tr -d '\033' | sed 's/\[[0-9;]*m//g'; }
fake_pat() { printf 'ghp_%s' "$(LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom | head -c 36)"; }

FAILS=0
new_repo() { # new_repo <name> <husky: none|real|其他=假 husky 脚本内容>
    local d="$TMP/$1"; mkdir -p "$d/scripts" "$d/.husky" "$d/.githooks"; git init -q "$d"
    src scripts/setup-git-hooks.sh >"$d/scripts/setup-git-hooks.sh"; chmod +x "$d/scripts/setup-git-hooks.sh"
    src .husky/pre-commit >"$d/.husky/pre-commit"; chmod +x "$d/.husky/pre-commit"
    src .githooks/pre-commit >"$d/.githooks/pre-commit"; chmod +x "$d/.githooks/pre-commit"
    printf 'node_modules/\n' >"$d/.gitignore"
    case "$2" in
        none) ;;
        real) mkdir -p "$d/node_modules/.bin"; printf '#!/bin/sh\nexec node "%s" "$@"\n' "$HUSKY_BIN" >"$d/node_modules/.bin/husky"; chmod +x "$d/node_modules/.bin/husky" ;;
        *)    mkdir -p "$d/node_modules/.bin"; printf '#!/bin/sh\n%s\n' "$2" >"$d/node_modules/.bin/husky"; chmod +x "$d/node_modules/.bin/husky" ;;
    esac
    git -C "$d" add -A; git -C "$d" -c core.hooksPath=/dev/null commit -qm init
    echo "$d"
}
LAST_DIR=""
run_case() { # run_case <名称> <期望: fail|ok> <husky> [修改函数] [环境变量赋值...]
    local name="$1" want="$2" husky="$3" mut="${4:-}" d rc; shift 3; [ $# -gt 0 ] && shift
    d="$(new_repo "c$RANDOM$RANDOM" "$husky")"; LAST_DIR="$d"
    if [ -n "$mut" ]; then "$mut" "$d"; fi
    set +e; ( cd "$d" && env -u HUSKY "$@" bash scripts/setup-git-hooks.sh ) >"$TMP/out" 2>&1; rc=$?; set -e
    local hp; hp="$(git -C "$d" config --get core.hooksPath || echo '<未设置>')"
    if { [ "$want" = fail ] && [ "$rc" -ne 0 ]; } || { [ "$want" = ok ] && [ "$rc" -eq 0 ]; }; then
        echo "PASS [${name}] rc=${rc} core.hooksPath=${hp}"; return 0
    fi
    echo "FAIL [${name}] rc=${rc}（期望 ${want}）core.hooksPath=${hp} | $(grep -m1 -E 'WARNING|ERROR' "$TMP/out" | strip_color)"; FAILS=$((FAILS+1)); return 1
}
rm_husky_hook()      { rm -f "$1/.husky/pre-commit"; }
noexec_husky_hook()  { chmod -x "$1/.husky/pre-commit"; }
noref_husky_hook()   { printf '#!/usr/bin/env sh\n# 原来这里会调用 .githooks/pre-commit\necho skip\n' >"$1/.husky/pre-commit"; chmod +x "$1/.husky/pre-commit"; }

run_case "情况1 没有 node_modules/.bin/husky" fail none || true
run_case "情况2 HUSKY=0（真实 husky 跳过安装）" fail real "" HUSKY=0 || true
if grep -q 'HUSKY=0' "$TMP/out" && grep -q 'WARNING' "$TMP/out"; then echo "PASS [情况2 HUSKY=0 有明确警告]"
else echo "FAIL [情况2 HUSKY=0 没有明确警告]"; FAILS=$((FAILS+1)); fi
run_case "情况2b husky 运行后 hooksPath 被其他配置覆盖为 .githooks（假 husky）" fail 'git config core.hooksPath .githooks' || true
run_case "情况2c hooksPath 正确但 .husky/_/pre-commit 缺失（假 husky）" fail 'git config core.hooksPath .husky/_' || true
run_case "情况3 .husky/pre-commit 缺失（真实 husky 会静默放行）" fail real rm_husky_hook || true
# setup 第 40 行会先 chmod +x 修复权限；用失败的 chmod 模拟无法修复（文件属主不同、只读挂载等）
mkdir -p "$TMP/nochmod"; printf '#!/bin/sh\nexit 1\n' >"$TMP/nochmod/chmod"; chmod +x "$TMP/nochmod/chmod"
run_case "情况3b .husky/pre-commit 不可执行且 chmod 无法修复" fail real noexec_husky_hook PATH="$TMP/nochmod:$PATH" || true
run_case "情况3b 对照 .husky/pre-commit 不可执行但 chmod 可修复" ok real noexec_husky_hook || true
run_case "情况3c .husky/pre-commit 没有调用 .githooks/pre-commit" fail real noref_husky_hook || true

# 情况3 的实际后果（仅说明，不计入结果）：真实 husky 安装后删掉 .husky/pre-commit，带密钥的提交会静默成功
d="$(new_repo demo real)"; ( cd "$d" && env -u HUSKY bash scripts/setup-git-hooks.sh ) >/dev/null 2>&1 || true
rm -f "$d/.husky/pre-commit"; printf 'GITHUB_TOKEN=%s\n' "$(fake_pat)" >"$d/k.env"; git -C "$d" add k.env
if git -C "$d" commit -qm demo >/dev/null 2>&1; then echo "INFO [情况3 说明] .husky/pre-commit 缺失时带合成密钥的提交成功（husky 退出码 0），因此 setup 必须拒绝"
else echo "INFO [情况3 说明] .husky/pre-commit 缺失时提交失败"; fi

# 对照：真实 husky 正常安装 + 端到端
if run_case "对照 真实 husky 正常安装" ok real; then
    d="$LAST_DIR"
    printf 'GITHUB_TOKEN=%s\n' "$(fake_pat)" >"$d/k.env"; git -C "$d" add k.env
    before="$(git -C "$d" rev-parse HEAD)"; rc=0
    ( cd "$d" && env -u HUSKY git commit -qm secret ) >"$TMP/e2e.out" 2>&1 || rc=$?
    if [ "$rc" -ne 0 ] && [ "$(git -C "$d" rev-parse HEAD)" = "$before" ] && grep -q 'RuleID:[[:space:]]*github-pat' "$TMP/e2e.out"; then
        echo "PASS [对照 端到端：提交合成密钥被 husky→.githooks→gitleaks 拦下]"
    else echo "FAIL [对照 端到端：提交合成密钥未被 gitleaks 拦下（rc=${rc}）]"; FAILS=$((FAILS+1)); fi
    git -C "$d" reset -q k.env; rm -f "$d/k.env"; printf 'hello\n' >"$d/README.md"; git -C "$d" add README.md; rc=0
    ( cd "$d" && env -u HUSKY git commit -qm clean ) >"$TMP/e2e2.out" 2>&1 || rc=$?
    if [ "$rc" -eq 0 ] && [ "$(git -C "$d" rev-parse HEAD)" != "$before" ]; then echo "PASS [对照 端到端：干净提交成功]"
    else echo "FAIL [对照 端到端：干净提交失败（rc=${rc}）]: $(tail -1 "$TMP/e2e2.out" | strip_color)"; FAILS=$((FAILS+1)); fi
    # 已安装后在 HUSKY=0 的环境里重跑：必须警告并失败（提交时 HUSKY=0 会跳过全部钩子；review3g N3，与 README 一致）
    rc=0; ( cd "$d" && HUSKY=0 bash scripts/setup-git-hooks.sh ) >"$TMP/out" 2>&1 || rc=$?
    if [ "$rc" -ne 0 ] && grep -q 'HUSKY=0' "$TMP/out" && grep -q 'WARNING' "$TMP/out"; then echo "PASS [情况4 已安装后 HUSKY=0 重跑：警告并失败（rc=${rc}）]"
    else echo "FAIL [情况4 已安装后 HUSKY=0 重跑应警告并失败（rc=${rc}）]"; FAILS=$((FAILS+1)); fi
fi
echo "目标版本: ${REV:-工作区}；失败 ${FAILS} 项"
[ "$FAILS" -eq 0 ]

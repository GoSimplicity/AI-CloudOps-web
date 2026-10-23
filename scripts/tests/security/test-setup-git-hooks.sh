#!/usr/bin/env bash
# SEC-01A 审查 P2（web）：scripts/setup-git-hooks.sh 在没有 husky、或 husky 运行后 core.hooksPath 不是 .husky/_ 时
# 必须失败（非 0 退出），不能只打印 WARNING 后以 0 退出（那样钩子与 gitleaks 会被静默跳过）。
# 用法: scripts/tests/security/test-setup-git-hooks.sh [--rev <git-rev>]   （对修复前版本运行应报 FAIL）
# 在 mktemp -d 的临时仓库中运行，用假的 node_modules/.bin/husky 模拟各种情况，不改动本仓库。
set -euo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
REV=""
while [ $# -gt 0 ]; do case "$1" in --rev) REV="$2"; shift 2 ;; *) echo "未知参数: $1" >&2; exit 2 ;; esac; done
export PATH="$HOME/.local/bin:$PATH"
command -v gitleaks >/dev/null || { echo "缺少依赖: gitleaks" >&2; exit 2; }
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
export GIT_CONFIG_GLOBAL="$TMP/gitconfig" GIT_CONFIG_NOSYSTEM=1
src() { if [ -n "$REV" ]; then git -C "$REPO" show "$REV:$1"; else cat "$REPO/$1"; fi; }

FAILS=0
new_repo() { # new_repo <name> <fake-husky 脚本内容或空>
    local d="$TMP/$1"; mkdir -p "$d/scripts" "$d/.husky" "$d/.githooks"; git init -q "$d"
    src scripts/setup-git-hooks.sh >"$d/scripts/setup-git-hooks.sh"; chmod +x "$d/scripts/setup-git-hooks.sh"
    src .husky/pre-commit >"$d/.husky/pre-commit"; src .githooks/pre-commit >"$d/.githooks/pre-commit"
    if [ -n "$2" ]; then mkdir -p "$d/node_modules/.bin"; printf '#!/bin/sh\n%s\n' "$2" >"$d/node_modules/.bin/husky"; chmod +x "$d/node_modules/.bin/husky"; fi
    echo "$d"
}
run_case() { # run_case <名称> <期望: fail|ok> <fake-husky>
    local d rc; d="$(new_repo "c$RANDOM$RANDOM" "$3")"
    set +e; ( cd "$d" && env -u HUSKY ${ENVV:-} bash scripts/setup-git-hooks.sh ) >"$TMP/out" 2>&1; rc=$?; set -e
    local hp; hp="$(git -C "$d" config --get core.hooksPath || echo '<未设置>')"
    if { [ "$2" = fail ] && [ $rc -ne 0 ]; } || { [ "$2" = ok ] && [ $rc -eq 0 ]; }; then
        echo "PASS [$1] rc=$rc core.hooksPath=$hp"
    else
        echo "FAIL [$1] rc=$rc（期望 $2）core.hooksPath=$hp | $(grep -m1 -E 'WARNING|ERROR' "$TMP/out" | sed 's/\x1b\[[0-9;]*m//g')"; FAILS=$((FAILS+1))
    fi
}
GOOD_HUSKY='git config core.hooksPath .husky/_ && mkdir -p .husky/_ && printf "#!/bin/sh\n" > .husky/_/pre-commit'
run_case "情况1 没有 node_modules/.bin/husky" fail ""
run_case "情况2 husky 运行但未设置 hooksPath（如 HUSKY=0 跳过安装）" fail 'echo "HUSKY=0 skip install"'
run_case "情况2b husky 运行后 hooksPath 被其他配置覆盖为 .githooks" fail 'git config core.hooksPath .githooks'
run_case "情况2c hooksPath 正确但 .husky/_/pre-commit 缺失" fail 'git config core.hooksPath .husky/_'
run_case "对照 husky 正常安装" ok "$GOOD_HUSKY"
echo "目标版本: ${REV:-工作区}；失败 $FAILS 项"
[ "$FAILS" -eq 0 ]

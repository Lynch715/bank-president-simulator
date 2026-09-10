#!/usr/bin/env bash
# 一键回归。用法:bash run-all.sh [校准局数,默认400]
set -u
cd "$(dirname "$0")"

N="${1:-400}"
PASS=0; FAIL=0; SKIP=0

if [ ! -d node_modules ]; then
  echo "首次运行,装一下测试依赖(游戏本体不需要任何依赖)…"
  npm install --no-audit --no-fund --silent || echo "  依赖装不上也没关系,需要依赖的几项会自动跳过"
  echo
fi

echo "语法自检"
node -e '
const fs=require("fs");
const h=fs.readFileSync("../index.html","utf8");
const m=h.match(/<script>([\s\S]*)<\/script>/);
new Function(m[1]);
const b=fs.readFileSync("../模拟银行.html","utf8");
console.log("  ✓ index.html 语法通过");
console.log(h===b ? "  ✓ 模拟银行.html 与 index.html 一致" : "  ✗ 模拟银行.html 与 index.html 不一致,记得 cp index.html 模拟银行.html");
process.exit(h===b?0:1);
' || { echo "  语法或同步检查未通过"; FAIL=$((FAIL+1)); }
echo

for f in 01-headless.js 02-meta.js 03-p1.js 04-p2.js 05-ui.js 07-clicks.js 08-bio.js; do
  echo "── $f ────────────────────────────────"
  out="$(node "$f" 2>&1)"
  echo "$out" | grep -vE '^┌|^│|^├|^└|^\{|^\}|^ +[\x27"]' | sed '/^$/d'
  if echo "$out" | grep -q "⏭"; then SKIP=$((SKIP+1));
  elif echo "$out" | grep -q "❌"; then FAIL=$((FAIL+1));
  else PASS=$((PASS+1)); fi
  echo
done

echo "── 06-balance.js ($N 局,慢) ──────────────"
out="$(node 06-balance.js "$N" 2>&1)"
echo "$out" | sed '/^$/d'
if echo "$out" | grep -q "❌"; then FAIL=$((FAIL+1)); else PASS=$((PASS+1)); fi
echo

echo "════════════════════════════════════════"
echo "通过 $PASS 组 · 失败 $FAIL 组 · 跳过 $SKIP 组"
[ "$FAIL" -eq 0 ] && echo "全绿。" || echo "有红,上面翻一下。"
exit "$FAIL"

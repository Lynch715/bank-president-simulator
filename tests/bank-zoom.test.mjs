// 移动端禁缩放的回归测试:光有 viewport meta 是不够的,
// iOS Safari 自 iOS 10 起就忽略 user-scalable=no。
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const require_ = createRequire(import.meta.url);

let chromium = null;
try { chromium = require_(process.env.HOME + "/uiaudit/node_modules/playwright-core").chromium; } catch { /* 没装就跳过 */ }
const SKIP = !chromium && "未安装 playwright-core";

// —— 纯静态检查:不需要浏览器 ——
for (const f of ["模拟银行.html", "index.html"]) {
  test(`${f}:viewport 声明齐全`, () => {
    const html = fs.readFileSync(path.join(ROOT, f), "utf8");
    const m = html.match(/<meta name="viewport" content="([^"]+)"/);
    assert.ok(m, "没有 viewport meta");
    const c = m[1];
    for (const k of ["width=device-width", "maximum-scale=1", "user-scalable=no", "viewport-fit=cover"]) {
      assert.ok(c.includes(k), `viewport 缺 ${k} —— 实际是「${c}」`);
    }
  });

  test(`${f}:输入框字号≥16px,否则 iOS 聚焦时会顶大整页`, () => {
    const html = fs.readFileSync(path.join(ROOT, f), "utf8");
    const rules = [...html.matchAll(/#nameInput\{([^}]*)\}/g)];
    assert.ok(rules.length, "找不到 #nameInput 样式");
    for (const r of rules) {
      const fs_ = r[1].match(/font-size:(\d+)px/);
      assert.ok(fs_, "#nameInput 没有显式 font-size");
      assert.ok(+fs_[1] >= 16, `#nameInput 字号 ${fs_[1]}px < 16px,iOS 会自动放大`);
    }
  });

  test(`${f}:拦了 iOS 的 gesture 捏合事件`, () => {
    const html = fs.readFileSync(path.join(ROOT, f), "utf8");
    for (const ev of ["gesturestart", "gesturechange", "gestureend"]) {
      assert.ok(html.includes(ev), `没有拦 ${ev},iOS 上仍能捏合缩放`);
    }
    assert.ok(/passive:\s*false/.test(html), "gesture 监听必须 passive:false,否则 preventDefault 无效");
  });
}

// —— 浏览器里验证生效 ——
async function boot(w = 390, h = 844) {
  const b = await chromium.launch({ executablePath: process.env.CHROME_BIN || undefined });
  const p = await b.newPage({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true });
  await p.goto("file://" + path.join(ROOT, "模拟银行.html"));
  await p.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await p.reload();
  await p.waitForFunction(() => !!window.BankGame);
  return { b, p };
}

test("html/body 的 touch-action 不含 pinch-zoom(双击与捏合都放大不了)", { skip: SKIP }, async () => {
  const { b, p } = await boot();
  const ta = await p.evaluate(() => ({
    html: getComputedStyle(document.documentElement).touchAction,
    body: getComputedStyle(document.body).touchAction,
  }));
  await b.close();
  for (const [k, v] of Object.entries(ta)) {
    assert.ok(!/pinch-zoom|^auto$|^manipulation$/.test(v), `${k} 的 touch-action 是「${v}」,仍允许缩放`);
    assert.ok(/pan-x/.test(v) && /pan-y/.test(v), `${k} 的 touch-action 是「${v}」,会把正常滚动也禁掉`);
  }
});

test("gesturestart 被 preventDefault(捏合缩放拦得住)", { skip: SKIP }, async () => {
  const { b, p } = await boot();
  const prevented = await p.evaluate(() => {
    const e = new Event("gesturestart", { bubbles: true, cancelable: true });
    document.dispatchEvent(e);
    return e.defaultPrevented;
  });
  await b.close();
  assert.equal(prevented, true, "gesturestart 没被拦下,iOS 上还能捏合放大");
});

// 这条最要紧:防缩放不能把游戏本身点不动了
test("连点不失灵:快速连续点击弹窗选项,每一下都生效", { skip: SKIP }, async () => {
  const { b, p } = await boot();
  await p.evaluate(() => window.startBankFromGuide());
  await p.fill("#nameInput", "老陈");
  await p.tap("#mOpts button");                       // 起名
  await p.waitForFunction(() => document.querySelector("#mTitle").textContent === "定个打法");

  // 30ms 间隔连点:选流派 → 上任说明,双击间隔内的第二下也必须生效
  const t0 = Date.now();
  await p.tap("#mOpts button:nth-child(1)");
  await p.waitForTimeout(30);
  await p.tap("#mOpts button:nth-child(1)");
  const state = await p.evaluate(() => {
    const S = BankGame.getState();
    return { route: S.route, maskShown: document.querySelector("#mask").classList.contains("show") };
  });
  await b.close();
  assert.ok(state.route, "第一下(选流派)没生效");
  assert.equal(state.maskShown, false, `第二下(上任说明的确认)被吃掉了,弹窗还开着 —— 用时 ${Date.now() - t0}ms`);
});

test("页面仍可正常纵向滚动", { skip: SKIP }, async () => {
  const { b, p } = await boot(390, 500);
  await p.evaluate(() => {
    window.startBankFromGuide();
    document.querySelectorAll("#mOpts button")[0].click();
  });
  await p.evaluate(() => {
    document.querySelectorAll("#mOpts button")[0].click();
    document.querySelectorAll("#mOpts button")[0].click();
  });
  const scrolled = await p.evaluate(() => {
    window.scrollTo(0, 300);
    return window.scrollY;
  });
  await b.close();
  assert.ok(scrolled > 0, "页面滚不动了,touch-action 设得太狠");
});

// 美术/UI 审计:真实浏览器里跑遍所有界面与弹窗,抓溢出、挤压、越界。
// 用法:node tests/bank-ui-audit.mjs [--shots]
import { createRequire } from "node:module";
const require_ = createRequire(import.meta.url);
// playwright-core 装在沙箱 home 下,浏览器用 PLAYWRIGHT_BROWSERS_PATH 指过去
const { chromium } = require_(process.env.HOME + "/uiaudit/node_modules/playwright-core");
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const FILE = "file://" + path.join(ROOT, "模拟银行.html");
const SHOTS = process.argv.includes("--shots");
const SHOT_DIR = path.join(ROOT, "tests", "__shots__");
if (SHOTS) fs.mkdirSync(SHOT_DIR, { recursive: true });

const VIEWPORTS = [
  { nm: "iPhoneSE", w: 320, h: 568 },
  { nm: "iPhone12", w: 390, h: 844 },
  { nm: "iPadMini", w: 768, h: 1024 },
  { nm: "Desktop",  w: 1280, h: 800 },
];

// 在页面里跑的溢出检测
const PROBE = () => {
  const out = [];
  const vw = window.innerWidth, vh = window.innerHeight;

  // 1. 整页横向溢出
  const de = document.documentElement;
  if (de.scrollWidth > vw + 1) out.push({ kind: "页面横向溢出", sel: "html", detail: `${de.scrollWidth}px > 视口${vw}px` });

  const label = el => {
    const id = el.id ? "#" + el.id : "";
    const cls = el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".") : "";
    return el.tagName.toLowerCase() + id + cls;
  };

  for (const el of document.querySelectorAll("#app *, .modal, .modal *, #endCard, #endCard *, .guide-copy, .guide-copy *")) {
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;

    // 2. 内容被裁掉(横向):overflow 非 auto/scroll 时,scrollWidth 超出即为截断
    const oxHidden = cs.overflowX === "hidden" || cs.overflowX === "clip" || cs.overflowX === "visible";
    if (oxHidden && el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0) {
      // 文本节点才算数,容器靠子元素撑开的另算
      const hasText = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
      out.push({ kind: hasText ? "文字被裁切" : "内容横向溢出", sel: label(el), detail: `scrollW ${el.scrollWidth} > clientW ${el.clientWidth}`, text: el.textContent.trim().slice(0, 40) });
    }

    // 3. 纵向被裁(overflow hidden 且内容更高)
    if ((cs.overflowY === "hidden" || cs.overflowY === "clip") && el.scrollHeight > el.clientHeight + 1 && el.clientHeight > 0) {
      out.push({ kind: "文字纵向被裁", sel: label(el), detail: `scrollH ${el.scrollHeight} > clientH ${el.clientHeight}`, text: el.textContent.trim().slice(0, 40) });
    }

    // 4. 越出视口左右边界
    if (r.left < -1 || r.right > vw + 1) {
      out.push({ kind: "越出视口", sel: label(el), detail: `left ${Math.round(r.left)} right ${Math.round(r.right)} / 视口 ${vw}`, text: el.textContent.trim().slice(0, 30) });
    }
  }

  // 5. 弹窗被挤压:内容需要滚动 / 高度顶满
  const mask = document.querySelector("#mask");
  if (mask && mask.classList.contains("show")) {
    const m = document.querySelector(".modal");
    const r = m.getBoundingClientRect();
    if (m.scrollHeight > m.clientHeight + 1) {
      out.push({ kind: "弹窗需滚动", sel: ".modal", detail: `内容${m.scrollHeight}px / 可见${m.clientHeight}px(视口${vh}px)`, text: (document.querySelector("#mTitle") || {}).textContent });
    }
    if (r.top < 0 || r.bottom > vh + 1) {
      out.push({ kind: "弹窗超出屏幕", sel: ".modal", detail: `top ${Math.round(r.top)} bottom ${Math.round(r.bottom)} / ${vh}` });
    }
    // 选项按钮里的说明文字是否换行到贴边
    for (const b of document.querySelectorAll("#mOpts button")) {
      if (b.scrollWidth > b.clientWidth + 1) out.push({ kind: "选项按钮文字溢出", sel: "#mOpts button", text: b.textContent.trim().slice(0, 40) });
    }
  }
  return out;
};

// 把游戏推进到主界面
async function boot(page, routeIdx = 0) {
  await page.goto(FILE);
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.goto(FILE);
  await page.waitForFunction(() => !!window.BankGame);
  return page;
}
const click = (page, i) => page.evaluate(i => document.querySelectorAll("#mOpts button")[i].click(), i);

const ALL = [];
function record(vp, scene, issues) {
  for (const it of issues) ALL.push({ vp: vp.nm, scene, ...it });
}

const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN || undefined });
for (const vp of VIEWPORTS) {
  const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 2 });

  // --- 开场引导 ---
  await boot(page);
  const routeIdx = VIEWPORTS.indexOf(vp) % 4;
  record(vp, "开场引导", await page.evaluate(PROBE));
  if (SHOTS) await page.screenshot({ path: `${SHOT_DIR}/${vp.nm}-01-guide.png` });

  // --- 起名 ---
  await page.evaluate(() => window.startBankFromGuide());
  record(vp, "起名弹窗", await page.evaluate(PROBE));

  await page.fill("#nameInput", "老陈");
  await click(page, 0);

  // --- 流派选择(最长的弹窗) ---
  record(vp, "流派选择弹窗", await page.evaluate(PROBE));
  if (SHOTS) await page.screenshot({ path: `${SHOT_DIR}/${vp.nm}-02-route.png` });
  await click(page, routeIdx);

  // --- 上任说明 ---
  record(vp, "上任说明弹窗", await page.evaluate(PROBE));
  await click(page, 0);

  // --- 主界面(制造满状态:多网点、多员工、预警全开) ---
  await page.evaluate(() => {
    const S = BankGame.getState();
    S.cash = 4000; S.dep = 46.8; S.risk = 64; S.morale = 22; S.rep = 78; S.npl = 1.2;
    S.pledge = { target: 52.5, due: S.month + 3 };
    S.chain.push({ id: "chain_bridge_b", at: S.month + 2, data: { ok: true } });
    // 铺满网点
    for (const p of BankGame.OUTLET_POOL) if (!S.outlets.some(o => o.name === p.name))
      S.outlets.push({ name: p.name, star: p.star, rent: p.rent, dep: 3.3, mgr: null, ramp: 1, closed: 0, desc: p.desc, deco: 2 });
    // 招满人 + 各种特质与倦怠
    const traits = Object.keys(BankGame.TRAITS);
    while (S.emps.length < 8) {
      const i = S.emps.length;
      S.emps.push({ id: S.empSeq++, name: "员工" + i, mk: 5, mg: 4, rk: 5, flavor: "业内都叫她『定海神针』,谁挖到谁赚", salary: 12.6, trait: traits[i % traits.length], fatigue: [0, 55, 72, 88, 95, 30, 66, 80][i] });
    }
    S.emps[0].protectedEmp = true;
    S.outlets.forEach((o, i) => { if (S.emps[i]) o.mgr = S.emps[i].id; });
    // 贷款铺满
    for (let i = 0; i < 5; i++) S.loans.push({ id: S.loanSeq++, nm: "城市更新专项二期项目贷款", amt: 1.55, rate: 0.85, tier: 3, left: 14, bad: i < 2, badLeft: 4, derive: 0.85 });
    // 关系人全推到高好感、主线走了几幕
    S.npcs.forEach((n, i) => { n.fav = [100, 88, 76, 64, 52, 41][i]; n.arc = i % 3; n.tried = { visit: 12, drink: -5, gift: 6 }; });
    renderAll();
  });
  record(vp, "主界面(满状态)", await page.evaluate(PROBE));
  if (SHOTS) await page.screenshot({ path: `${SHOT_DIR}/${vp.nm}-03-main.png`, fullPage: true });

  // --- 各标签页 ---
  for (const tab of ["outlets", "team", "npc", "loans", "rank", "log"]) {
    await page.evaluate(t => document.querySelector(`#tabBar button[data-tab="${t}"]`).click(), tab);
    record(vp, `标签页:${tab}`, await page.evaluate(PROBE));
    if (SHOTS) await page.screenshot({ path: `${SHOT_DIR}/${vp.nm}-04-tab-${tab}.png`, fullPage: true });
  }

  // --- 各功能弹窗 ---
  const modals = [
    ["批贷款", () => window.actLoan()],
    ["抓内部", () => window.BankGame.getState() && document.querySelectorAll("#actionBar .act")[2].click()],
    ["招聘", () => document.querySelectorAll("#actionBar .act")[4].click()],
    ["开网点", () => document.querySelectorAll("#actionBar .act")[5].click()],
    ["派主任", () => window.assignMgr(1)],
    ["培训", () => window.trainEmp(BankGame.getState().emps[1].id)],
    ["解雇关系户", () => window.fireEmp(BankGame.getState().emps[0].id)],
    ["网点装修", () => window.upgradeDeco(0)],
  ];
  for (const [nm, fn] of modals) {
    await page.evaluate(() => { const S = BankGame.getState(); S.energy = 3; S.cash = 4000; S.outlets[1].mgr = null; renderAll(); });
    await page.evaluate(fn);
    const shown = await page.evaluate(() => document.querySelector("#mask").classList.contains("show"));
    if (!shown) { console.log(`  (跳过 ${nm}:没弹出来)`); continue; }
    record(vp, `弹窗:${nm}`, await page.evaluate(PROBE));
    if (SHOTS && vp.nm !== "iPadMini") await page.screenshot({ path: `${SHOT_DIR}/${vp.nm}-05-modal-${nm}.png` });
    await page.evaluate(() => document.querySelector("#mask").classList.remove("show"));
  }

  // --- 最长的事件 / 主线弧 / 对手出招 ---
  const longEvents = await page.evaluate(() => {
    const S = BankGame.getState();
    return BankGame.EVENTS
      .map(e => ({ id: e.id, len: (typeof e.body === "function" ? "" : e.body).length + e.title.length }))
      .sort((a, b) => b.len - a.len).slice(0, 6).map(x => x.id);
  });
  for (const id of longEvents) {
    await page.evaluate(id => {
      const S = BankGame.getState(); S.energy = 3; S.cash = 4000;
      const ev = BankGame.EVENTS.find(e => e.id === id);
      const ctx = ev.pre ? ev.pre() : null;
      const body = typeof ev.body === "function" ? ev.body(ctx) : ev.body;
      // 直接复刻 fireEvent 的弹法
      const t = document.querySelector("#mTitle"), b = document.querySelector("#mBody"), o = document.querySelector("#mOpts");
      t.textContent = "📌 " + ev.title; b.textContent = body; o.innerHTML = "";
      ev.opts(ctx).forEach(op => { const btn = document.createElement("button"); btn.innerHTML = op.t + (op.s ? `<small>${op.s}</small>` : ""); o.appendChild(btn); });
      document.querySelector("#mask").classList.add("show");
    }, id);
    record(vp, `事件:${id}`, await page.evaluate(PROBE));
    if (SHOTS && vp.nm === "iPhoneSE") await page.screenshot({ path: `${SHOT_DIR}/${vp.nm}-06-event-${id}.png` });
  }

  // 最长的主线幕
  const longArcs = await page.evaluate(() => {
    const out = [];
    for (const [k, arcs] of Object.entries(BankGame.NPC_ARCS)) arcs.forEach((a, i) => out.push({ k, i, len: a.body.length }));
    return out.sort((a, b) => b.len - a.len).slice(0, 5);
  });
  for (const { k, i } of longArcs) {
    await page.evaluate(({ k, i }) => {
      const S = BankGame.getState(); S.energy = 3; S.cash = 4000;
      const beat = BankGame.NPC_ARCS[k][i];
      const t = document.querySelector("#mTitle"), b = document.querySelector("#mBody"), o = document.querySelector("#mOpts");
      t.textContent = "🎬 " + beat.title; b.textContent = beat.body; o.innerHTML = "";
      beat.opts().forEach(op => { const btn = document.createElement("button"); btn.innerHTML = op.t + (op.s ? `<small>${op.s}</small>` : ""); o.appendChild(btn); });
      document.querySelector("#mask").classList.add("show");
    }, { k, i });
    record(vp, `主线:${k}#${i + 1}`, await page.evaluate(PROBE));
    if (SHOTS && vp.nm === "iPhoneSE") await page.screenshot({ path: `${SHOT_DIR}/${vp.nm}-07-arc-${k}${i}.png` });
  }

  // --- 月度结算报表 ---
  await page.evaluate(() => { const S = BankGame.getState(); S.energy = 0; document.querySelector("#btnEnd").click(); });
  record(vp, "月度结算报表", await page.evaluate(PROBE));
  if (SHOTS) await page.screenshot({ path: `${SHOT_DIR}/${vp.nm}-08-settle.png` });

  // --- 结局页(徽章拉满) ---
  await page.evaluate(() => {
    const S = BankGame.getState();
    S.month = 36; S.dep = 88.8; S.rep = 92; S.morale = 88; S.track.maxRisk = 72;
    S.track.loanTotal = 34.4; S.track.arcs = 22; S.track.rest = 5; S.track.rivalMoves = 7; S.track.train = 4;
    S.flags.whitelist = true; S.flags.clean = true; S.flags.burned = true;
    S.npcs.forEach(n => n.fav = 100);
    document.querySelector("#mask").classList.remove("show");
    BankGame.finalEnding();
  });
  record(vp, "结局页", await page.evaluate(PROBE));
  if (SHOTS) await page.screenshot({ path: `${SHOT_DIR}/${vp.nm}-09-end.png`, fullPage: true });

  await page.close();
}
await browser.close();

// ---- 汇总 ----
const byKind = {};
for (const it of ALL) (byKind[it.kind] ||= []).push(it);
console.log(`\n共 ${ALL.length} 处问题\n${"=".repeat(60)}`);
for (const [kind, list] of Object.entries(byKind).sort((a, b) => b[1].length - a[1].length)) {
  console.log(`\n【${kind}】 ${list.length} 处`);
  const seen = new Set();
  for (const it of list) {
    const key = it.vp + it.sel + (it.text || "");
    if (seen.has(key)) continue; seen.add(key);
    console.log(`  [${it.vp}] ${it.scene} → ${it.sel || ""} ${it.detail || ""}`);
    if (it.text) console.log(`      「${String(it.text).replace(/\s+/g, " ").slice(0, 50)}」`);
  }
}
if (SHOTS) console.log(`\n截图:${SHOT_DIR}`);
process.exit(0);

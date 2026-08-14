// 真·DOM 冒烟测试:把整个 HTML 丢进 jsdom,像玩家一样点一遍。
// jsdom 是可选依赖,没装就跳过(node --test 会标记 skip 而不是 fail)。
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const HTML = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "模拟银行.html");

let JSDOM = null;
for (const base of ["/tmp/node_modules/jsdom", "jsdom"]) {
  try { JSDOM = createRequire(import.meta.url)(base).JSDOM; break; } catch { /* 继续找 */ }
}

function boot() {
  const dom = new JSDOM(fs.readFileSync(HTML, "utf8"), {
    runScripts: "dangerously", pretendToBeVisual: true, url: "https://localhost/",
  });
  const { window } = dom;
  const $ = s => window.document.querySelector(s);
  const clickOpt = i => {
    const b = window.document.querySelectorAll("#mOpts button")[i];
    assert.ok(b, `弹窗里没有第${i}个按钮`);
    b.dispatchEvent(new window.Event("click", { bubbles: true }));
  };
  return { window, $, clickOpt };
}

test("页面能加载,开场引导会出现", { skip: !JSDOM && "未安装 jsdom" }, () => {
  const { $ } = boot();
  assert.ok($("#gameGuide").classList.contains("show"), "开场引导没有显示");
  assert.ok($("#gameGuide").textContent.includes("上任"));
});

test("完整开局流程:引导 → 起名 → 选流派 → 进入正式界面", { skip: !JSDOM && "未安装 jsdom" }, () => {
  const { window, $, clickOpt } = boot();
  window.startBankFromGuide();
  assert.ok(!$("#gameGuide").classList.contains("show"), "引导没有关掉");

  // 起名
  assert.equal($("#mTitle").textContent, "上任报到");
  $("#nameInput").value = "测试行长";
  clickOpt(0);

  // 选流派:四个选项
  assert.equal($("#mTitle").textContent, "定个打法");
  const routes = window.document.querySelectorAll("#mOpts button");
  assert.equal(routes.length, 4, `流派选项应该是4个,实际 ${routes.length}`);
  clickOpt(0);

  // 上任说明
  assert.equal($("#mTitle").textContent, "上任第一天");
  clickOpt(0);

  const S = window.BankGame.getState();
  assert.equal(S.playerName, "测试行长");
  assert.ok(S.route, "没有选中流派");
  assert.equal(S.month, 1);
});

test("主界面各区块都渲染出了内容", { skip: !JSDOM && "未安装 jsdom" }, () => {
  const { window, $, clickOpt } = boot();
  window.startBankFromGuide(); clickOpt(0); clickOpt(0); clickOpt(0);

  assert.equal($("#statBar").children.length, 6, "顶部数值条不是6格");
  assert.equal($("#actionBar").children.length, 6, "行动区不是6个");
  assert.ok($("#goalBar").classList.contains("on"), "流派目标条没显示");
  assert.ok($("#goalBar").textContent.length > 5, "流派目标条是空的");
  assert.ok($("#forecast").textContent.includes("网点产出"), "本月预报没渲染");
  assert.ok($("#panel").textContent.includes("观音桥"), "网点面板没渲染");
  assert.equal($("#tabBar").children.length, 6, "标签页不是6个");
});

test("每个标签页都能切换且不报错、不为空", { skip: !JSDOM && "未安装 jsdom" }, () => {
  const { window, $, clickOpt } = boot();
  window.startBankFromGuide(); clickOpt(0); clickOpt(0); clickOpt(0);
  const errs = [];
  window.addEventListener("error", e => errs.push(e.message));
  for (const tab of ["outlets", "team", "npc", "loans", "rank", "log"]) {
    window.switchTab ? window.switchTab(tab)
      : $(`#tabBar button[data-tab="${tab}"]`).dispatchEvent(new window.Event("click", { bubbles: true }));
    assert.ok($("#panel").textContent.trim().length > 10, `「${tab}」标签页内容是空的`);
  }
  assert.deepEqual(errs, [], "切标签页时抛了错");
});

test("批贷款:能开面板、能批一笔、贷款页看得到它", { skip: !JSDOM && "未安装 jsdom" }, () => {
  const { window, $, clickOpt } = boot();
  window.startBankFromGuide(); clickOpt(0); clickOpt(0); clickOpt(0);
  const S = window.BankGame.getState();
  S.cash = 3000;

  window.actLoan();
  assert.equal($("#mTitle").textContent, "批贷款");
  const before = S.dep;
  clickOpt(0);
  assert.equal(S.loans.length, 1, "贷款没批进去");
  assert.ok(S.dep > before, "派生存款没到账");
  assert.ok(S.cash < 3000, "拨备没扣钱");

  $(`#tabBar button[data-tab="loans"]`).dispatchEvent(new window.Event("click", { bubbles: true }));
  assert.ok($("#panel").textContent.includes(S.loans[0].nm), "贷款页没显示刚批的那笔");
});

test("走完一个月:结束本月 → 结算弹窗 → 一路点到下个月", { skip: !JSDOM && "未安装 jsdom" }, () => {
  const { window, $, clickOpt } = boot();
  window.startBankFromGuide(); clickOpt(0); clickOpt(0); clickOpt(0);
  const S = window.BankGame.getState();
  S.energy = 0;

  $("#btnEnd").dispatchEvent(new window.Event("click", { bubbles: true }));
  assert.ok($("#mBody").textContent.includes("网点产出"), "结算报表没出来");

  // 结算后可能还排着事件/主线/对手,一路点第一个选项直到弹窗关闭
  let guard = 0;
  while ($("#mask").classList.contains("show") && guard++ < 20) clickOpt(0);
  assert.ok(guard < 20, "弹窗队列卡住了");
  assert.equal(S.month, 2, `点完一整轮之后月份是 ${S.month},应该是 2`);
});

test("连点24个月不崩,存档能写进 localStorage", { skip: !JSDOM && "未安装 jsdom" }, () => {
  const { window, $, clickOpt } = boot();
  window.startBankFromGuide(); clickOpt(0); clickOpt(0); clickOpt(0);
  const errs = [];
  window.addEventListener("error", e => errs.push(e.message));
  const S = window.BankGame.getState();

  for (let m = 1; m <= 24; m++) {
    if (S.over) break;
    S.energy = 0;
    $("#btnEnd").dispatchEvent(new window.Event("click", { bubbles: true }));
    let guard = 0;
    while ($("#mask").classList.contains("show") && guard++ < 25) clickOpt(0);
    assert.ok(guard < 25, `第${m}月弹窗队列卡住`);
  }
  assert.deepEqual(errs, [], "连点过程中抛了错");
  assert.ok(S.month >= 20 || S.over, `只走到第${S.month}月`);
  // 局中会存档;一旦提前出局,存档是被有意清掉的
  if (S.over) assert.equal(window.localStorage.getItem("jbzh_save5"), null, "出局后存档没清掉");
  else assert.ok(window.localStorage.getItem("jbzh_save5"), "存档没写进去");
});

// 回归:钓鱼事件会把下月精力顶到4,精力点渲染用过 "○".repeat(3-4) → RangeError
test("精力被事件顶到4点时,精力条不会炸", { skip: !JSDOM && "未安装 jsdom" }, () => {
  const { window, $, clickOpt } = boot();
  window.startBankFromGuide(); clickOpt(0); clickOpt(0); clickOpt(0);
  const S = window.BankGame.getState();
  S.energy = 4;
  assert.doesNotThrow(() => window.renderAll ? window.renderAll() : $("#btnEnd").click());
  S.energy = 0;
  assert.doesNotThrow(() => window.BankGame.nextMonth());
});

test("结局页能正常出图,徽章和数据格都有", { skip: !JSDOM && "未安装 jsdom" }, () => {
  const { window, $, clickOpt } = boot();
  window.startBankFromGuide(); clickOpt(0); clickOpt(0); clickOpt(0);
  const S = window.BankGame.getState();
  S.month = 36; S.dep = 55;
  window.BankGame.finalEnding();
  assert.ok($("#endScreen").classList.contains("show"), "结局页没显示");
  assert.ok($("#endCard").querySelector(".etitle").textContent.trim().length > 1, "结局没有标题");
  assert.ok($("#endCard").querySelectorAll(".eg").length >= 9, "结局数据格太少");
  assert.ok($("#endCard").querySelectorAll(".badge").length >= 1, "结局没有徽章");
});

import test from "node:test";
import assert from "node:assert/strict";
import { loadBank, startGame, runIdle, assertSane } from "./bank-harness.mjs";

test("脚本能在无头环境载入并导出 BankGame", () => {
  const API = loadBank(1);
  assert.ok(API.initialState);
  assert.ok(API.settleCore);
});

test("内容体量:事件≥45、主线幕数≥20、流派4条", () => {
  const API = loadBank(1);
  assert.ok(API.getEventCount() >= 45, `事件只有 ${API.getEventCount()} 个`);
  assert.ok(API.getArcCount() >= 20, `主线只有 ${API.getArcCount()} 幕`);
  assert.equal(Object.keys(API.ROUTES).length, 4);
});

test("每个流派都能 apply,且初始态健全", () => {
  const API = loadBank(7);
  for (const id of Object.keys(API.ROUTES)) {
    const s = startGame(API, id);
    assertSane(s, id);
    assert.equal(s.route, id);
    assert.ok(s.mods && Number.isFinite(s.mods.derive));
  }
});

test("流派目标定义完整,初始均未达成", () => {
  const API = loadBank(3);
  for (const id of Object.keys(API.ROUTES)) {
    const r = API.ROUTES[id];
    assert.ok(r.goal && r.goal.need > 0 && typeof r.goal.cur === "function");
    assert.ok(r.endTitle && r.endText);
    const s = startGame(API, id);
    assert.equal(API.routeGoalDone(), false, `${id} 开局就达成了目标`);
  }
});

// 放置流「什么都不做」最终崩盘是合理的(口碑归零、全员倦怠拉满),
// 但不该崩在新手还没摸清规则的前20个月。
test("放置流:四条路线在前20个月都不会出局,且全程无 NaN/越界", () => {
  for (const id of ["corp", "retail", "guanxi", "compliance"]) {
    for (const seed of [1, 42, 999]) {
      const API = loadBank(seed);
      const { s, trace, dead } = runIdle(API, id);
      assert.ok(!dead || dead.m >= 20, `${id}/seed${seed} 放置流第${dead?.m}月就出局了:${dead?.why}`);
      assert.ok(trace.length >= 20);
      assertSane(s, id);
    }
  }
});

test("士气有结构性地板:口碑与倦怠健康时,不作为也不会一路掉到0", () => {
  const API = loadBank(21);
  const s = startGame(API, "retail");
  for (let m = 1; m <= 30; m++) {
    s.month = m;
    s.rep = 70;                                  // 假设口碑维持健康
    s.emps.forEach(e => { e.fatigue = 30; });    // 假设倦怠维持健康
    API.settleCore();
    API.nextMonth();
  }
  assert.ok(s.morale > 15, `士气跌到了 ${s.morale},地板没起作用`);
  assert.ok(s.morale < 70, `士气涨到了 ${s.morale},地板给得太慷慨`);
});

test("贷款引擎:批一笔就派生存款,坏账概率在合理区间", () => {
  const API = loadBank(11);
  const s = startGame(API, "corp");
  const before = s.dep;
  const offers = API.genOffers();
  assert.equal(offers.length, 3);
  const l = offers[0];
  const derive = +(l.amt * 0.55 * s.mods.derive).toFixed(2);
  s.loans.push({ id: 1, nm: l.nm, amt: l.amt, rate: l.rate, tier: l.tier, left: l.months, bad: false, derive });
  API.gain("dep", derive);
  assert.ok(s.dep > before, "派生存款没有进账");
  const p = API.badChance(s.loans[0]);
  assert.ok(p > 0 && p <= 0.14, `坏账概率越界 ${p}`);
});

test("贷款敞口上限随存款增长,且恒为正", () => {
  const API = loadBank(5);
  const s = startGame(API, "corp");
  const a = API.loanCapAmt();
  s.dep = 40;
  const b = API.loanCapAmt();
  assert.ok(a > 0 && b > a, `敞口上限没有随存款增长 ${a} → ${b}`);
});

test("倦怠会随月份累积,并拖低产出系数", () => {
  const API = loadBank(2);
  const s = startGame(API, "retail");
  const e = s.emps[1];
  e.trait = null;
  const f0 = e.fatigue;
  for (let m = 1; m <= 6; m++) { s.month = m; API.settleCore(); API.nextMonth(); }
  assert.ok(e.fatigue > f0, "倦怠没有累积");
  e.fatigue = 90;
  assert.ok(API.fatigueCoef(e) < 1, "高倦怠没有拖低产出");
});

test("风险到85会给出失败结局(顾清越的人情用掉之后)", () => {
  const API = loadBank(4);
  const s = startGame(API, "corp");
  s.risk = 90;
  s.guardUsed = true;
  const core = API.settleCore();
  assert.ok(core.failEnd, "风险90没有触发出局");
});

test("不良超过3.5亿直接出局", () => {
  const API = loadBank(6);
  const s = startGame(API, "corp");
  s.npl = 4;
  const core = API.settleCore();
  assert.ok(core.failEnd && core.failEnd[0] === "窟窿太大");
});

test("危机预警条:高风险/低士气一定会报警", () => {
  const API = loadBank(8);
  const s = startGame(API, "guanxi");
  s.risk = 78; s.morale = 15;
  const w = API.warnings();
  const txt = w.map(x => x[1]).join(" ");
  assert.ok(/风险/.test(txt), "风险78没有预警");
  assert.ok(/士气/.test(txt), "士气15没有预警");
});

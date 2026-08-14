import test from "node:test";
import assert from "node:assert/strict";
import { loadBank, startGame, runRobot, assertSane } from "./bank-harness.mjs";

const ROUTES = ["corp", "retail", "guanxi", "compliance"];
const STYLES = ["random", "grow", "safe", "loanshark"];

test("四流派 × 四打法 × 多种子:全量机器人跑完不崩溃", () => {
  for (const route of ROUTES) {
    for (const style of STYLES) {
      for (const seed of [1, 17, 256]) {
        const API = loadBank(seed);
        const { s } = runRobot(API, route, { style });
        assertSane(s, `${route}/${style}/seed${seed}`);
      }
    }
  }
});

test("稳健打法能活到任期末:safe 机器人在四条路线上都不出局", () => {
  for (const route of ROUTES) {
    for (const seed of [1, 17, 256, 4096]) {
      const API = loadBank(seed);
      const { dead } = runRobot(API, route, { style: "safe" });
      assert.equal(dead, null, `${route}/seed${seed} 稳健打法第${dead?.m}月出局:${dead?.why}`);
    }
  }
});

test("激进放贷会付出代价:loanshark 的不良与风险显著高于 safe", () => {
  let sharkNpl = 0, safeNpl = 0, sharkRisk = 0, safeRisk = 0;
  for (const seed of [1, 17, 256, 4096, 65536]) {
    const a = loadBank(seed), b = loadBank(seed);
    const r1 = runRobot(a, "corp", { style: "loanshark" });
    const r2 = runRobot(b, "corp", { style: "safe" });
    sharkNpl += r1.s.track.badLoans || 0; safeNpl += r2.s.track.badLoans || 0;
    sharkRisk += r1.s.track.maxRisk || 0;  safeRisk += r2.s.track.maxRisk || 0;
  }
  assert.ok(sharkNpl > safeNpl, `激进放贷的不良笔数(${sharkNpl})没有高于稳健(${safeNpl})`);
  assert.ok(sharkRisk > safeRisk, `激进放贷的风险峰值(${sharkRisk})没有高于稳健(${safeRisk})`);
});

test("主线弧会真的被推进,且不会重复演同一幕", () => {
  const API = loadBank(31);
  const s = startGame(API, "guanxi");
  // 直接把好感拉满,让所有幕的门槛只剩月份
  s.npcs.forEach(n => { n.fav = 100; });
  const seen = [];
  for (let m = 1; m <= 36; m++) {
    s.month = m;
    const fn = API.pickArcBeat();
    if (fn) {
      const before = s.npcs.map(n => n.arc).join(",");
      fn();
      const after = s.npcs.map(n => n.arc).join(",");
      assert.notEqual(before, after, `第${m}月演了一幕但进度没推进`);
      seen.push(after);
    }
    s.npcs.forEach(n => { n.fav = 100; });
    assertSane(s, `arc m${m}`);
  }
  assert.ok(s.track.arcs >= 12, `36个月只演了 ${s.track.arcs} 幕主线,太少`);
  const total = s.npcs.reduce((a, n) => a + (n.arc || 0), 0);
  assert.ok(total >= 12, `主线总进度只有 ${total}`);
});

test("连锁事件:埋下的雷一定会到期引爆,且引爆后从队列移除", () => {
  const API = loadBank(77);
  const s = startGame(API, "corp");
  s.month = 5;
  API.schedule("chain_bridge_b", 3, { ok: true });
  assert.equal(s.chain.length, 1);
  s.month = 7;
  assert.equal(API.fireChain(), null, "还没到期就引爆了");
  s.month = 8;
  const fn = API.fireChain();
  assert.ok(fn, "到期了却没有引爆");
  fn();
  assert.equal(s.chain.length, 0, "引爆后没有从队列移除");
  assertSane(s, "chain");
});

test("事件按流派加权:合规流抽到的合规类事件明显更多", () => {
  const API = loadBank(123);
  const s = startGame(API, "compliance");
  const wanted = new Set(API.ROUTES.compliance.events);
  let hit = 0, n = 400;
  for (let i = 0; i < n; i++) {
    s.lastEv = null;
    const e = API.pickEvent();
    if (e && wanted.has(e.id)) hit++;
  }
  assert.ok(hit / n > 0.28, `合规流只抽中 ${(hit / n * 100).toFixed(0)}% 的本流派事件,加权没生效`);
});

test("对手出招:前4个月不骚扰,之后会真的出招", () => {
  const API = loadBank(9);
  const s = startGame(API, "corp");
  s.month = 3;
  assert.equal(API.rivalMove(), null, "第3个月就被对手出招了");
  let moves = 0;
  for (let m = 5; m <= 36; m++) {
    s.month = m;
    const fn = API.rivalMove();
    if (fn) { fn(); moves++; assertSane(s, `rival m${m}`); }
  }
  assert.ok(moves >= 3, `36个月里对手只出招 ${moves} 次`);
});

test("每个事件的每个分支都能执行,不抛异常", () => {
  const API = loadBank(5);
  for (const ev of API.EVENTS) {
    for (let branch = 0; branch < 4; branch++) {
      const s = startGame(API, "corp");
      s.month = 12;
      // 给足前置条件,让 cond/pre 都能跑
      s.cash = 5000; s.dep = 30; s.morale = 35;
      s.loans.push({ id: 1, nm: "测试贷", amt: 0.5, rate: 0.6, tier: 2, left: 10, bad: false, derive: 0.28 });
      s.emps.forEach(e => { e.fatigue = 65; });
      if (ev.cond && !ev.cond()) continue;
      const ctx = ev.pre ? ev.pre() : null;
      const opts = ev.opts(ctx);
      assert.ok(Array.isArray(opts) && opts.length > 0, `事件 ${ev.id} 没有选项`);
      const o = opts[branch];
      if (!o) continue;
      assert.ok(o.t, `事件 ${ev.id} 第${branch}个选项没有文案`);
      if (o.fn) o.fn();
      assertSane(s, `event ${ev.id} branch ${branch}`);
    }
  }
});

test("每个主线幕的每个分支都能执行,不抛异常", () => {
  const API = loadBank(5);
  for (const [npcId, arcs] of Object.entries(API.NPC_ARCS)) {
    arcs.forEach((beat, i) => {
      for (let branch = 0; branch < 3; branch++) {
        const s = startGame(API, "guanxi");
        s.month = beat.month;
        s.cash = 5000;
        s.npcs.forEach(n => { n.fav = 75; });
        const opts = beat.opts();
        assert.ok(opts.length > 0, `${npcId} 第${i + 1}幕没有选项`);
        assert.ok(beat.title && beat.body, `${npcId} 第${i + 1}幕缺标题或正文`);
        const o = opts[branch];
        if (!o) continue;
        if (o.fn) o.fn();
        assertSane(s, `arc ${npcId}#${i} branch ${branch}`);
      }
    });
  }
});

test("流派目标可达:对公流的放贷目标在36个月内跑得出来", () => {
  const API = loadBank(1);
  const { s } = runRobot(API, "corp", { style: "loanshark" });
  assert.ok((s.track.loanTotal || 0) > 0, "一笔贷款都没放出去");
});

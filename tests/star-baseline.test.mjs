import assert from "node:assert/strict";
import { loadGame, newGame, getS, runPlacement, findNaN } from "./star-harness.mjs";

// 1) 引擎可加载、开局状态完整
{
  const g = loadGame(1);
  const s = newGame(g);
  assert.ok(s.npcs.length >= 6, "开局应有关系 NPC");
  assert.ok(s.npcs.some(n => n.id === "rival_main"), "应存在同期对手 rival_main");
  assert.equal(s.month, 1);
  assert.equal(s.energy, 4);
  assert.equal(Object.keys(s.risks).length, 8, "应为 8 类风险(含 image 人设崩塌)");
  assert.ok("image" in s.risks, "risks 应含 image");
  assert.ok(s.image && typeof s.image.coherence === "number", "应有 s.image 人设对象");
  assert.equal(s.image.established, false, "开局人设尚未确立");
  assert.equal(findNaN(s), null, "开局无 NaN/Inf 数值");
}

// 人设不变式:任何时刻 coherence∈[0,100],image 风险∈[0,120],信仰粉≤总粉
function assertImageInvariants(s, ctx) {
  assert.ok(s.image.coherence >= 0 && s.image.coherence <= 100, `${ctx}:契合度越界 ${s.image.coherence}`);
  assert.ok(s.risks.image >= 0 && s.risks.image <= 120, `${ctx}:人设风险越界 ${s.risks.image}`);
  assert.ok(s.image.believers <= s.fans + 1e-6, `${ctx}:信仰粉(${s.image.believers})不应超过总粉(${s.fans})`);
}

// 2) 三出身各跑一局纯放置流:不崩溃、无 NaN、能走到终局或中途出局
const backgrounds = ["academy", "talent", "influencer"];
const summary = [];
for (const bg of backgrounds) {
  for (let seed = 1; seed <= 4; seed++) {
    const g = loadGame(seed * 17 + 3);
    const s = runPlacement(g, { background: bg });
    assert.equal(findNaN(s), null, `${bg}/seed${seed}:放置流不应泄漏 NaN(${findNaN(s)})`);
    assert.ok(s.over || s.month > 36, `${bg}/seed${seed}:应走到终局或出局`);
    assertImageInvariants(s, `${bg}/seed${seed}`);
    summary.push({ bg, seed, month: s.month, over: s.over, title: s.endData && s.endData.title });
  }
}

// 3) 报告放置流生存画像(不做硬断言,先看当前手感)
const byBg = {};
for (const r of summary) {
  byBg[r.bg] = byBg[r.bg] || [];
  byBg[r.bg].push(r.month);
}
console.log("=== 放置流生存月(每出身4局)===");
for (const bg of backgrounds) {
  console.log(`  ${bg}: [${byBg[bg].join(", ")}]`);
}
console.log("star baseline test passed");

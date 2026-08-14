import test from "node:test";
import assert from "node:assert/strict";
import { loadBank, runRobot } from "./bank-harness.mjs";

const SEEDS = [37, 74, 111, 148, 185, 222, 259, 296, 333, 370];

function sweep(route, style) {
  let alive = 0, goal = 0, dep = 0, rank = 0, arcs = 0;
  for (const seed of SEEDS) {
    const API = loadBank(seed);
    const { s, dead } = runRobot(API, route, { style });
    if (dead) continue;
    alive++; goal += API.routeGoalDone() ? 1 : 0;
    dep += s.dep; rank += API.myRank(); arcs += s.track.arcs;
  }
  const k = alive || 1;
  return { alive, goal, n: SEEDS.length, dep: dep / k, rank: rank / k, arcs: arcs / k };
}

// 每条流派都该有一种「对口打法」能达成它自己的目标
const MATCH = { corp: "banker", retail: "builder", guanxi: "safe", compliance: "safe" };

test("对口打法能达成本流派目标(过半种子)", () => {
  for (const [route, style] of Object.entries(MATCH)) {
    const r = sweep(route, style);
    assert.ok(r.goal > r.n / 2, `${route} 用对口打法 ${style} 只达成 ${r.goal}/${r.n}`);
  }
});

test("对口打法能活到任期末", () => {
  for (const [route, style] of Object.entries(MATCH)) {
    const r = sweep(route, style);
    assert.equal(r.alive, r.n, `${route}/${style} 只活了 ${r.alive}/${r.n} 局`);
  }
});

// 如果随便怎么打都能达成目标,流派就没有意义了
test("不对口的打法达不成目标:流派之间必须有区分度", () => {
  const corpBySafe = sweep("corp", "safe");
  assert.equal(corpBySafe.goal, 0, `不放贷也能达成对公流目标(${corpBySafe.goal} 局),放贷目标形同虚设`);
  const retailByBanker = sweep("retail", "banker");
  assert.equal(retailByBanker.goal, 0, `不铺网点也能达成零售流目标(${retailByBanker.goal} 局)`);
});

test("莽撞放贷会被淘汰:loanshark 存活率显著低于稳健打法", () => {
  let shark = 0, safe = 0;
  for (const route of Object.keys(MATCH)) {
    shark += sweep(route, "loanshark").alive;
    safe += sweep(route, "safe").alive;
  }
  assert.ok(shark < safe * 0.5, `莽撞打法存活 ${shark} 局,稳健 ${safe} 局,惩罚不够`);
});

test("主线弧的宽限机制:只顾业务的行长也能看到一部分故事", () => {
  const r = sweep("corp", "banker");
  assert.ok(r.arcs >= 4, `只顾业务的打法平均只看到 ${r.arcs.toFixed(1)} 幕主线,故事被锁死了`);
  const social = sweep("guanxi", "safe");
  assert.ok(social.arcs > r.arcs * 1.5, `会做人的打法(${social.arcs.toFixed(1)}幕)没有比闷头做业务(${r.arcs.toFixed(1)}幕)看到明显更多故事`);
});

test("排名有竞争:对口打法的平均名次没有躺进第一", () => {
  for (const [route, style] of Object.entries(MATCH)) {
    const r = sweep(route, style);
    assert.ok(r.rank > 1.2, `${route}/${style} 平均排名 ${r.rank.toFixed(2)},对手太弱`);
    assert.ok(r.rank < 6, `${route}/${style} 平均排名 ${r.rank.toFixed(2)},对手太强`);
  }
});

test("年度考核目标与实际增长匹配:不是随手完成,也不是不可能", () => {
  // 中位打法在12个月末的存款,应落在第一年目标(24亿)附近而不是甩开一个量级
  const API = loadBank(29);
  let sum = 0, n = 0;
  for (const seed of [29, 58, 87, 116, 145]) {
    const A = loadBank(seed);
    const s = A.initialState();
    s.route = "retail"; A.ROUTES.retail.apply(s); A.setState(s);
    s.candidates = A.genCandidates(); s.offers = A.genOffers();
    for (let m = 1; m <= 12; m++) {
      s.month = m;
      A.gain("dep", 0.1); A.gain("rep", 1);          // 每月只跑一次业务的保守玩家
      const c = A.settleCore();
      if (c.failEnd) break;
      A.nextMonth();
    }
    sum += s.dep; n++;
  }
  const avg = sum / n;
  assert.ok(avg > 10, `保守玩家第一年只做到 ${avg.toFixed(1)}亿,增长太慢`);
  assert.ok(avg < 24, `保守玩家第一年就做到 ${avg.toFixed(1)}亿,已超年度目标24亿,考核形同虚设`);
});

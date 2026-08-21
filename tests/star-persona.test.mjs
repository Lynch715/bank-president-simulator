import assert from "node:assert/strict";
import { loadGame, newGame, getS, establishPersona, runPersona, findNaN } from "./star-harness.mjs";

// 1) 立人设:established 翻真、拿到信仰粉、契合度上抬
{
  const g = loadGame(5);
  newGame(g, { background: "academy" });
  establishPersona(g, "purist");
  const s = getS(g);
  assert.equal(s.image.established, true, "立人设后 established=true");
  assert.equal(s.image.tag, "purist");
  assert.ok(s.image.believers > 0, "应获得首批信仰粉");
  assert.ok(s.image.coherence >= 70, "立人设后契合度应上抬");
}

// 2) 顺人设流 vs 恰饭违和流:契合度与人设风险应显著分化
const bgs = ["academy", "talent", "influencer"];
const tagFor = { academy: "purist", talent: "sunny", influencer: "buzzy" };
let fitCohSum = 0, greedCohSum = 0, fitRiskSum = 0, greedRiskSum = 0, n = 0;
let collapseGreed = 0, collapseFit = 0, shenfeng = 0;

for (const bg of bgs) {
  for (let seed = 1; seed <= 6; seed++) {
    const tag = tagFor[bg];
    const gf = loadGame(seed * 31 + 1);
    const sf = runPersona(gf, { background: bg, tag, prefer: "fit" });
    const gg = loadGame(seed * 31 + 1);
    const sg = runPersona(gg, { background: bg, tag, prefer: "against" });

    assert.equal(findNaN(sf), null, `顺人设 ${bg}/${seed} 无 NaN`);
    assert.equal(findNaN(sg), null, `恰饭 ${bg}/${seed} 无 NaN`);
    for (const s of [sf, sg]) {
      assert.ok(s.image.coherence >= 0 && s.image.coherence <= 100, "契合度有界");
      assert.ok(s.risks.image >= 0 && s.risks.image <= 120, "人设风险有界");
      assert.ok(s.image.believers <= s.fans + 1e-6, "信仰粉≤总粉");
    }
    fitCohSum += sf.image.coherence; greedCohSum += sg.image.coherence;
    fitRiskSum += sf.risks.image; greedRiskSum += sg.risks.image;
    if (sg.endData && sg.endData.title === "人设崩塌") collapseGreed++;
    if (sf.endData && sf.endData.title === "人设崩塌") collapseFit++;
    if (sf.endData && sf.endData.title === "人设封神") shenfeng++;
    n++;
  }
}

const fitCoh = (fitCohSum / n).toFixed(1), greedCoh = (greedCohSum / n).toFixed(1);
const fitRisk = (fitRiskSum / n).toFixed(1), greedRisk = (greedRiskSum / n).toFixed(1);
console.log(`=== 顺人设流 vs 恰饭违和流(各${n}局)===`);
console.log(`  终局契合度: 顺人设 ${fitCoh} vs 恰饭 ${greedCoh}`);
console.log(`  终局人设风险: 顺人设 ${fitRisk} vs 恰饭 ${greedRisk}`);
console.log(`  人设崩塌结局: 顺人设 ${collapseFit}/${n} vs 恰饭 ${collapseGreed}/${n} · 人设封神(顺): ${shenfeng}/${n}`);

// 核心断言:顺人设契合度明显更高、人设风险明显更低
assert.ok(fitCohSum / n > greedCohSum / n + 20, `顺人设契合度应显著高于恰饭(${fitCoh} vs ${greedCoh})`);
assert.ok(greedRiskSum / n > fitRiskSum / n + 20, `恰饭的人设风险应显著更高(恰${greedRisk} vs 顺${fitRisk})`);
// 第8类风险死法可达:恰饭违和会把人撞向人设崩塌,顺人设几乎不会
assert.ok(collapseGreed >= 2, `恰饭违和应能触发人设崩塌坏结局(实测${collapseGreed})`);
assert.ok(collapseFit <= collapseGreed, `顺人设的人设崩塌不应多于恰饭`);

console.log("star persona test passed");

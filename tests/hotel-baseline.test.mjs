import assert from "node:assert/strict";
import { loadHotel, runIdle } from "./hotel-harness.mjs";

// 下限:放置流全程现金 >-80 且无风险达灾难线(85)→ 必活到 24 月
{
  const API = loadHotel(1);
  const { trace, ending } = runIdle(API);
  for(const t of trace){
    assert.ok(t.cash > -80, `第${t.m}月现金 ${Math.round(t.cash)} 跌破 -80(资金链断裂)`);
    assert.ok(t.maxRisk < 85, `第${t.m}月最高风险 ${Math.round(t.maxRisk)} 触灾难线`);
    assert.ok(t.morale > 8, `第${t.m}月士气 ${Math.round(t.morale)} 跌破 8(人心散尽)`);
  }
  // 上限:放置流不能拿到"被标记为好结局"的路线结局
  assert.equal(ending[2] === true && !["平稳守成"].includes(ending[0]), false,
    `放置流不应拿到好结局,却得到「${ending[0]}」`);
  console.log("baseline: idle 活到 24 月,结局", ending[0], "✔");
}
console.log("ALL BASELINE TESTS PASSED");

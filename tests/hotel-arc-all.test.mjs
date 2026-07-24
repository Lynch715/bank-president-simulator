import assert from "node:assert/strict";
import { loadHotel } from "./hotel-harness.mjs";
for(const [route,pid] of [["business","zhou"],["wedding","liang"],["service","qin"],["viral","baitong"]]){
  const API=loadHotel(3); const s=API.initialState(); s.route=route; API.setState(s);
  const n=s.npcs.find(x=>x.id===pid); assert.ok(n,`${pid} 存在`);
  const arc=API.PATRON_ARCS[pid]; assert.equal(arc.length,4,`${pid} 应4幕`);
  for(let idx=0; idx<4; idx++){
    n.arc=idx; n.arcMonth=0; s.month=24;                 // 越过所有 cond/冷却
    const b=API.patronBeatCheck(); assert.equal(b&&b.idx, idx, `${route}:${pid} 第${idx}幕应可触发`);
    const opts=b.beat.opts(); assert.ok(opts.length>=1);
    for(const o of opts){ if(o.fn && !o.disabled) o.fn(); }  // 执行不抛错
    assert.ok(Number.isFinite(s.cash)&&s.rating>=1&&s.rating<=5, `${route} 第${idx}幕后状态健全`);
  }
  console.log(`arc-all: ${route}/${pid} 四幕可跑 ✔`);
}

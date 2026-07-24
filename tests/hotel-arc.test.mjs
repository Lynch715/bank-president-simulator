import assert from "node:assert/strict";
import { loadHotel } from "./hotel-harness.mjs";
const API=loadHotel(1); const s=API.initialState(); s.route="wedding"; API.setState(s);
const liang=s.npcs.find(n=>n.id==="liang");
s.month=1; assert.equal(API.patronBeatCheck(), null, "第1月未到冷却/条件");
s.month=3; let b=API.patronBeatCheck(); assert.equal(b.idx,0,"第3月应触发第0幕");
liang.arc=1; liang.arcMonth=3; s.month=4; assert.equal(API.patronBeatCheck(), null, "冷却期内不触发");
s.month=6; b=API.patronBeatCheck(); assert.equal(b.idx,1,"第6月应触发第1幕");
console.log("arc: 梁曼弧线按序推进 ✔");

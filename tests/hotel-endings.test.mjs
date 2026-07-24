import assert from "node:assert/strict";
import { loadHotel } from "./hotel-harness.mjs";
const API = loadHotel(1);
function withState(mut){ const s=API.initialState(); mut(s); return API.endingFor(s); }
// 顶流网红店:brand≥80 rating≥4.25 maxOcc≥.9 profit>0
assert.equal(withState(s=>{s.route="viral";s.brand=85;s.rating=4.3;s.track.maxOcc=.92;s.cash=400;})[0], "顶流网红店");
// 放置流样板态不该拿好结局(评分3.9/品牌48/略盈)
{ const e=withState(s=>{s.rating=3.95;s.brand=48;s.cash=330;}); assert.ok(["平稳守成","老店新生","资本接盘"].includes(e[0]), `平庸态却得「${e[0]}」`); }
console.log("endings: 顶流网红店 + 平庸兜底 ✔");

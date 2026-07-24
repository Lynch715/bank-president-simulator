import assert from "node:assert/strict";
import { loadHotel } from "./hotel-harness.mjs";
function freq(route){ const API=loadHotel(7); const s=API.initialState(); s.route=route; API.setState(s);
  let hit=0,total=600; const wl=route?API.ROUTES[route].events:[];
  for(let i=0;i<total;i++){ s.lastEvent=null; s.chain=[]; const e=API.chooseEvent(); if(e&&wl.includes(e.id))hit++; }
  return hit/total; }
const base = freq(null) || 0;               // 无流派下这些 id 的自然占比≈ len/EVENTS
const biz  = freq("business");
assert.ok(biz > 0.28, `商务事件占比 ${biz.toFixed(2)} 应显著偏高`);
console.log(`eventweight: 商务事件占比 ${biz.toFixed(2)} ✔`);

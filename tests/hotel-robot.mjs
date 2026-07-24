import assert from "node:assert/strict";
import { loadHotel, mkRng, assertSane } from "./hotel-harness.mjs";

// 忠实无头月结:镜像 doEndMonth 的顺序(settle→死判→灾难→预警/事件→推进),
// 事件/预警的选项直接调用其 fn()(fn 内引用全局 S,已 setState 对齐)。
function stepMonth(API, s, rng, pickIdx){
  API.settleCore(s);
  if(s.cash < -80) return "资金链断裂";
  if(s.morale <= 8) return "人心散尽";
  API.setState(s);
  if(API.disasterCheck()) return "灾难";
  const warn = API.riskWarning();
  if(warn){ const w = API.RISK_WARNINGS[warn]; API.risk(s, warn, w.ignoreDelta); s.warnings[warn]=(s.warnings[warn]||0)+1; s.warningMonth[warn]=s.month; }
  else { const e = API.chooseEvent(); if(e){ s.lastEvent=e.id; if(e.once)s.usedEvents.push(e.id); const opts=e.opts(); const o=opts[pickIdx(opts.length)]; if(o && o.fn && !o.disabled) o.fn(); } }
  // 推进下月
  s.month++; s.energy=4; s.orders=API.generateOrders(s);
  return null;
}

function runRobot(seed, style){   // style: "random" | "conservative"
  const API = loadHotel(seed);
  const rng = mkRng(seed ^ 0x9e37);
  const s = API.initialState();
  API.setState(s);
  const pickIdx = n => style==="conservative" ? 0 : Math.floor(rng()*n);
  for(let guard=0; s.month<=24 && guard<40; guard++){
    // 订单:保守=接第一张;随机=每张随机接/谈/弃
    for(const o of s.orders.filter(x=>x.status==="open")){
      const r = style==="conservative" ? (o===s.orders[0]?0:2) : Math.floor(rng()*3);
      if(r===0) o.status="accepted"; else if(r===2) o.status="rejected";
      // r===1(谈)略去:negotiateOrder 走 UI 分支,压测用直接接/弃覆盖状态机
    }
    const dead = stepMonth(API, s, rng, pickIdx);
    assertSane(s);
    if(dead){ return { dead, month:s.month, ending:null }; }
  }
  const ending = API.endingFor(s);
  assert.ok(typeof ending[0]==="string" && ending[0].length>0, "结局标题非法");
  return { dead:null, month:s.month, ending:ending[0] };
}

let runs=0;
for(let seed=1; seed<=12; seed++){
  for(const style of ["random","conservative"]){
    const r = runRobot(seed, style);  // 内部 assertSane 每月校验
    runs++;
  }
}
console.log(`robot: ${runs} 局全部无崩溃/NaN/越界 ✔`);
console.log("ALL ROBOT TESTS PASSED");

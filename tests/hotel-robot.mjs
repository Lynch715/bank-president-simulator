import assert from "node:assert/strict";
import { loadHotel, mkRng, assertSane } from "./hotel-harness.mjs";

// 忠实无头月结:镜像 doEndMonth 的顺序(settle→死判→灾难→预警/招牌客人弧线/事件→推进)。
// 事件/弧线的选项直接调用其 fn()(fn 内引用全局 S,已 setState 对齐)。
// fixWarn=true 时遇预警就掏钱整改(模拟"留意预警"的玩家);否则一律无视(最坏情况)。
function stepMonth(API, s, pickIdx, fixWarn){
  API.settleCore(s);
  if(s.cash < -80) return "资金链断裂";
  if(s.morale <= 8) return "人心散尽";
  API.setState(s);
  if(API.disasterCheck()) return "灾难";
  const warn = API.riskWarning();
  if(warn){ const w = API.RISK_WARNINGS[warn];
    if(fixWarn && s.cash>w.fixCost){ s.cash-=w.fixCost; API.risk(s, warn, w.fixDelta); }
    else { API.risk(s, warn, w.ignoreDelta); s.warnings[warn]=(s.warnings[warn]||0)+1; s.warningMonth[warn]=s.month; }
  }
  else {
    const beat = API.patronBeatCheck();
    if(beat){ const n=s.npcs.find(x=>x.id===beat.pid); n.arc=beat.idx+1; n.arcMonth=s.month; const opts=beat.beat.opts(); const o=opts[pickIdx(opts.length)]; if(o && o.fn && !o.disabled) o.fn(); }
    else { const e = API.chooseEvent(); if(e){ s.lastEvent=e.id; if(e.once)s.usedEvents.push(e.id); const opts=e.opts(); const o=opts[pickIdx(opts.length)]; if(o && o.fn && !o.disabled) o.fn(); } }
  }
  s.month++; s.energy=4; s.orders=API.generateOrders(s);
  return null;
}

function runRobot(seed, style, route){   // style: random | conservative | attentive;  route: null | id
  const API = loadHotel(seed);
  const rng = mkRng(seed ^ 0x9e37);
  const s = API.initialState();
  if(route){ API.ROUTES[route].apply(s); s.route=route; }
  API.setState(s);
  const fixWarn = style==="attentive";
  const pickIdx = n => style==="conservative" ? 0 : Math.floor(rng()*n);
  for(let guard=0; s.month<=24 && guard<40; guard++){
    for(const o of s.orders.filter(x=>x.status==="open")){
      const r = style==="conservative" ? (o===s.orders[0]?0:2) : Math.floor(rng()*3);
      if(r===0) o.status="accepted"; else if(r===2) o.status="rejected";
    }
    const dead = stepMonth(API, s, pickIdx, fixWarn);
    assertSane(s);
    if(dead){ return { dead, month:s.month }; }
  }
  const ending = API.endingFor(s);
  assert.ok(typeof ending[0]==="string" && ending[0].length>0, "结局标题非法");
  return { dead:null, month:s.month, ending:ending[0], good:ending[2] };
}

const ROUTE_IDS = [null,"business","wedding","service","viral"];
let runs=0, attTotal=0, attAlive=0; const tally={};
for(let seed=1; seed<=8; seed++){
  for(const route of ROUTE_IDS){
    for(const style of ["random","conservative","attentive"]){
      const r = runRobot(seed, style, route);            // 内部 assertSane 每月校验
      runs++;
      if(style==="attentive"){ attTotal++; if(!r.dead) attAlive++; }
      const key = (route||"无流派")+"/"+style+" · "+(r.dead?("死@M"+r.month):((r.good?"[好]":"[平]")+r.ending));
      tally[key]=(tally[key]||0)+1;
    }
  }
}
console.log(`robot: ${runs} 局全部无崩溃/NaN/越界 ✔`);
// 不变式:留意预警的玩法(attentive)基本都能活到任期末 —— 证明这不是"死亡时钟",灾难只惩罚"无视预警"。
assert.ok(attAlive/attTotal >= 0.9, `留意预警仍大量死亡 ${attAlive}/${attTotal},疑似死亡时钟过陡`);
console.log(`  留意预警(修warning)存活 ${attAlive}/${attTotal} ✔`);
console.log("ALL ROBOT TESTS PASSED");

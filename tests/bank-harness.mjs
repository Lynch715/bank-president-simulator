import fs from "node:fs";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import path from "node:path";
const HTML = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "模拟银行.html");

// 种子 LCG:让 Math.random 可复现
export function mkRng(seed){ let x=(seed>>>0)||1; return ()=>((x=(x*1664525+1013904223)>>>0)/4294967296); }

// 载入游戏脚本到隔离沙箱,注入种子随机;document 不存在 → 不跑任何渲染
export function loadBank(seed=1){
  const html = fs.readFileSync(HTML, "utf8");
  const m = html.match(/<script>([\s\S]*)<\/script>/);
  if(!m) throw new Error("找不到 <script> 块");
  const rng = mkRng(seed);
  const seededMath = Object.create(Math);
  seededMath.random = rng;
  const sandbox = { Math: seededMath, JSON, console, globalThis:null };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(m[1], sandbox);
  if(!sandbox.BankGame) throw new Error("BankGame 未导出");
  // 机器人自己的掷骰也走同一条种子链,否则整个回归都是飘的
  sandbox.BankGame.rng = rng;
  return sandbox.BankGame;
}

// 起一局:选定流派,返回 state
export function startGame(API, route){
  const s = API.initialState();
  s.route = route;
  API.ROUTES[route].apply(s);
  API.setState(s);
  s.candidates = API.genCandidates();
  s.offers = API.genOffers();
  return s;
}

// 数值健全性
export function assertSane(s, where=""){
  const tag = where ? `[${where}] ` : "";
  const nums = {cash:s.cash, dep:s.dep, rep:s.rep, morale:s.morale, risk:s.risk, npl:s.npl};
  for(const [k,v] of Object.entries(nums)){
    if(!Number.isFinite(v)) throw new Error(`${tag}${k} 不是有限数: ${v}`);
  }
  if(!(s.rep>=0 && s.rep<=100)) throw new Error(`${tag}rep 越界 ${s.rep}`);
  if(!(s.morale>=0 && s.morale<=100)) throw new Error(`${tag}morale 越界 ${s.morale}`);
  if(!(s.risk>=0 && s.risk<=100)) throw new Error(`${tag}risk 越界 ${s.risk}`);
  if(s.dep<0) throw new Error(`${tag}dep 为负 ${s.dep}`);
  if(s.npl<0) throw new Error(`${tag}npl 为负 ${s.npl}`);
  if(s.emps.length>9) throw new Error(`${tag}员工超编 ${s.emps.length}`);
  for(const e of s.emps){
    if(!Number.isFinite(e.fatigue)) throw new Error(`${tag}${e.name} fatigue 异常 ${e.fatigue}`);
    if(e.fatigue<0 || e.fatigue>100) throw new Error(`${tag}${e.name} fatigue 越界 ${e.fatigue}`);
    if(!Number.isFinite(e.salary)) throw new Error(`${tag}${e.name} salary 异常`);
  }
  for(const n of s.npcs){
    if(!(n.fav>=0 && n.fav<=100)) throw new Error(`${tag}${n.name} fav 越界 ${n.fav}`);
  }
  for(const l of s.loans){
    if(!Number.isFinite(l.amt) || l.amt<=0) throw new Error(`${tag}贷款 ${l.nm} 金额异常`);
  }
  for(const r of s.rivals){
    if(!Number.isFinite(r.dep) || r.dep<0) throw new Error(`${tag}${r.name} 存款异常 ${r.dep}`);
  }
}

// 放置流:什么都不做,只跑月结到 36 月(或提前出局)
export function runIdle(API, route, months=36){
  const s = startGame(API, route);
  const trace = [];
  let dead = null;
  for(let m=1; m<=months; m++){
    s.month = m;
    const core = API.settleCore();
    assertSane(s, `${route} idle m${m}`);
    trace.push({m, cash:Math.round(s.cash), dep:+s.dep.toFixed(2), morale:Math.round(s.morale), risk:Math.round(s.risk)});
    if(core.failEnd){ dead = {m, why:core.failEnd[0]}; break; }
    API.nextMonth();
  }
  return {s, trace, dead};
}

// 机器人:每月随机用光精力,再月结(含事件/主线/连锁/对手,弹窗自动选第一项)
export function runRobot(API, route, opts={}){
  const months = opts.months||36;
  const style = opts.style||"random";   // random | grow | safe | loanshark | builder
  const s = startGame(API, route);
  let dead = null;
  for(let m=1; m<=months; m++){
    s.month = m;
    s.energy = Math.max(1, 3-(s.energyPenalty||0));
    s.energyPenalty = 0;
    s.socialed = {};
    // 用光精力
    let guard = 0;
    while(s.energy>0 && guard++<12){
      act(API, s, style);
    }
    const core = API.settleCore();
    assertSane(s, `${route}/${style} m${m}`);
    if(core.failEnd){ dead = {m, why:core.failEnd[0]}; break; }
    // 跑一遍月中的叙事分支(无头模式下 showModal 自动选第一个可用项)
    const arc = API.pickArcBeat(); if(arc) arc();
    const ch = API.fireChain(); if(ch) ch();
    const rv = API.rivalMove(); if(rv) rv();
    const ev = API.fireEvent(); if(ev) ev();
    assertSane(s, `${route}/${style} m${m} 叙事后`);
    API.nextMonth();
  }
  return {s, dead};
}

export function robotAct(API, s, style){ return act(API, s, style); }
function act(API, s, style){
  const roll = API.rng();
  const spend = n=>{ s.energy -= n; };
  // 派主任(不花精力,机器人也得会)
  for(const o of s.outlets){
    if(o.mgr==null){
      const used = s.outlets.map(x=>x.mgr);
      const free = s.emps.filter(e=>!used.includes(e.id));
      if(free.length){ o.mgr = free.sort((a,b)=>b.mk-a.mk)[0].id; }
    }
  }
  // safe:绝不碰贷款。风险一冒头就排查,人手不够就招,累了就轮休——一个谨慎但称职的行长
  if(style==="safe"){
    if(s.risk>32 && s.cash>=10){ s.cash-=10; API.gain("risk",-15); spend(1); return; }
    if(s.emps.length<6 && s.candidates && s.candidates.length && s.cash>=100){
      const c = s.candidates.shift(); c.id = s.empSeq++; s.emps.push(c); s.track.hire++; spend(1); return;
    }
    const avgFat = s.emps.reduce((a,e)=>a+(e.fatigue||0),0)/(s.emps.length||1);
    if(avgFat>55 && s.cash>=20){
      s.cash-=20; s.emps.forEach(e=>e.fatigue=Math.max(0,e.fatigue-30));
      API.gain("morale",6); s.restMonth=true; s.track.rest=(s.track.rest||0)+1; spend(1); return;
    }
    if(roll<0.5){ API.gain("dep", 0.1*(0.7+s.rep/200)); API.gain("rep",1); spend(1); return; }
    if(roll<0.75 && s.cash>=10){ s.cash-=10; API.gain("morale",12); spend(1); return; }
    const n = s.npcs[Math.floor(API.rng()*s.npcs.length)];
    if(!s.socialed[n.id]){ n.fav = Math.max(0, Math.min(100, n.fav+8)); s.socialed[n.id]=1; }
    spend(1); return;
  }
  // builder:铺网点、养口碑,零售流的打法
  if(style==="builder"){
    if(s.risk>45 && s.cash>=10){ s.cash-=10; API.gain("risk",-15); spend(1); return; }
    if(roll<0.4 && tryOpen(API,s)){ spend(1); return; }
    if(s.emps.length<7 && s.candidates && s.candidates.length && s.cash>=200){
      const c = s.candidates.shift(); c.id = s.empSeq++; s.emps.push(c); s.track.hire++; spend(1); return;
    }
    const avgFat = s.emps.reduce((a,e)=>a+(e.fatigue||0),0)/(s.emps.length||1);
    if(avgFat>55 && s.cash>=20){
      s.cash-=20; s.emps.forEach(e=>e.fatigue=Math.max(0,e.fatigue-30));
      API.gain("morale",6); s.restMonth=true; spend(1); return;
    }
    API.gain("dep", 0.1*(0.7+s.rep/200)); API.gain("rep",1); spend(1); return;
  }
  // banker:一个称职的对公行长——放贷,但盯着风险和人
  if(style==="banker"){
    if(s.risk>42 && s.cash>=10){ s.cash-=10; API.gain("risk",-15); spend(1); return; }
    if(s.morale<35 && s.cash>=10){ s.cash-=10; API.gain("morale",12); spend(1); return; }
    if(s.emps.length<6 && s.candidates && s.candidates.length && s.cash>=250){
      // 优先招风控高的
      s.candidates.sort((a,b)=>b.rk-a.rk);
      const c = s.candidates.shift(); c.id = s.empSeq++; s.emps.push(c); s.track.hire++; spend(1); return;
    }
    const avgFat = s.emps.reduce((a,e)=>a+(e.fatigue||0),0)/(s.emps.length||1);
    if(avgFat>60 && s.cash>=20){
      s.cash-=20; s.emps.forEach(e=>e.fatigue=Math.max(0,e.fatigue-30));
      API.gain("morale",6); s.restMonth=true; spend(1); return;
    }
    if(s.risk<38){ takeLoan(API,s); spend(1); return; }
    API.gain("dep", 0.1*(0.7+s.rep/200)); API.gain("rep",1); spend(1); return;
  }
  if(style==="loanshark" && roll<0.85){ takeLoan(API,s); spend(1); return; }
  if(style==="grow" && roll<0.35){ takeLoan(API,s); spend(1); return; }
  if(roll<0.3){ // 跑业务
    API.gain("dep", 0.1*(0.7+s.rep/200)); API.gain("rep",1); spend(1); return;
  }
  if(roll<0.5 && s.cash>=10){ s.cash-=10; API.gain("morale",12); spend(1); return; }
  if(roll<0.62 && s.cash>=20){ s.cash-=20; s.emps.forEach(e=>e.fatigue=Math.max(0,e.fatigue-30)); API.gain("morale",6); s.restMonth=true; spend(1); return; }
  if(roll<0.78){ // 应酬
    const n = s.npcs[Math.floor(API.rng()*s.npcs.length)];
    if(!s.socialed[n.id]){ n.fav = Math.max(0, Math.min(100, n.fav + 8)); s.socialed[n.id]=1; }
    spend(1); return;
  }
  if(roll<0.9 && s.emps.length<8 && s.candidates && s.candidates.length){
    const c = s.candidates.shift(); c.id = s.empSeq++; s.emps.push(c); s.track.hire++; spend(1); return;
  }
  takeLoan(API,s); spend(1);
}

function takeLoan(API, s){
  if(!s.offers || !s.offers.length) s.offers = API.genOffers();
  const cap = API.loanCapAmt(), used = API.loanOutstanding();
  const l = s.offers.find(x=>used + x.amt <= cap && s.cash >= x.amt*60);
  if(!l) return;
  const tier = l.hidden ? Math.min(3,l.tier+1) : l.tier;
  const derive = +(l.amt*0.55*(s.mods.derive||1)).toFixed(2);
  s.loans.push({id:s.loanSeq++, nm:l.nm, amt:l.amt, rate:l.rate, tier, left:l.months, bad:false, derive});
  API.gain("cash", -Math.round(l.amt*60));
  API.gain("dep", derive);
  API.gain("risk", l.tier);
  s.track.loanTotal = +((s.track.loanTotal||0)+l.amt).toFixed(2);
  s.offers = s.offers.filter(x=>x!==l);
}

// 开网点:机器人也得会扩张,否则零售流的目标永远测不到
export function tryOpen(API, s){
  const have = s.outlets.map(o=>o.name);
  const avail = API.OUTLET_POOL.filter(p=>!have.includes(p.name));
  if(!avail.length) return false;
  const p = avail.sort((a,b)=>a.cost-b.cost)[0];
  const cost = Math.round(p.cost*(s.mods.openCost||1));
  if(s.cash < cost+60) return false;
  API.gain("cash", -cost);
  s.outlets.push({name:p.name, star:p.star, rent:+(p.rent*Math.pow(1.12, Math.ceil(s.month/12)-1)).toFixed(1),
                  dep:0, mgr:null, ramp:0.5, closed:0, desc:p.desc});
  s.track.open++;
  return true;
}

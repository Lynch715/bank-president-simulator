// P1:宏观周期 / 把柄 / 站队 / 黑天鹅 / 净息差
const {load, runner} = require("./lib");
const {G} = load();
const g = globalThis;
const r = runner("P1 周期·把柄·站队·黑天鹅");
const ok = r.ok;


// 1. 周期节点抖动 & 三段覆盖
const cs=[]; for(let i=0;i<200;i++) cs.push(G.makeCycle());
ok("周期节点有抖动 t1∈"+Math.min(...cs.map(c=>c.t1))+"~"+Math.max(...cs.map(c=>c.t1))+" t2∈"+Math.min(...cs.map(c=>c.t2))+"~"+Math.max(...cs.map(c=>c.t2)),
   new Set(cs.map(c=>c.t1)).size>1 && new Set(cs.map(c=>c.t2)).size>1);
const st=G.initialState(); st.cycle={t1:11,t2:23,told:{}}; G.setState(st);
const ph=m=>{ st.month=m; return G.cyclePhase(m); };
ok("三段划分正确", ph(1)==="loose"&&ph(10)==="loose"&&ph(11)==="tight"&&ph(22)==="tight"&&ph(23)==="loose2"&&ph(36)==="loose2");

// 2. 提前两个月吹风,且只吹一次
st.month=9; st.log=[]; st.track.keyEvents=[];
const n1=G.cycleNews(); const n1b=G.cycleNews();
st.month=21; const n2=G.cycleNews();
ok("收紧提前2个月预告", !!n1 && /行业风声/.test(n1[0]));
ok("同一个节点不重复吹风", !n1b);
ok("再宽松也有预告", !!n2);
ok("风声进了传记大事记", st.track.keyEvents.length===2);

// 3. dirt=0 时巡视组永不爆
let clean=0;
for(let i=0;i<300;i++){
  const s=G.initialState(); s.cycle=G.makeCycle(); s.month=10; s.dirt=0; G.setState(s);
  const f=G.patrolBeat(); if(f){ f(); if(!G.getState().over) clean++; }
}
ok("dirt=0 巡视 300 次零出局", clean===300);
// dirt=6 的爆雷率
let boom=0, tries=600;
for(let i=0;i<tries;i++){
  const s=G.initialState(); s.cycle=G.makeCycle(); s.month=10; s.dirt=6;
  s.npcs.forEach(n=>n.fav=30); G.setState(s);
  const f=G.patrolBeat(); if(f){ f(); if(G.getState().over) boom++; }
}
const rate=boom/tries;
ok("dirt=6 爆雷率 "+(rate*100).toFixed(1)+"% (>40%)", rate>0.40);

// 4. 顾清越≥80 挡一次
let guarded=0, died=0;
for(let i=0;i<300;i++){
  const s=G.initialState(); s.month=10; s.dirt=12; s.cycle=G.makeCycle();
  s.npcs.find(n=>n.id==="gu").fav=85; G.setState(s);
  const f=G.patrolBeat(); if(f){ f(); const S=G.getState(); if(S.flags.guDirtUsed) guarded++; if(S.over) died++; }
}
ok("顾清越好感80:dirt=12 也一次都没出局(挡了 "+guarded+" 次)", died===0 && guarded>200);
// 挡过一次之后就不再管用
{
  const s=G.initialState(); s.month=10; s.dirt=12; s.cycle=G.makeCycle();
  s.npcs.find(n=>n.id==="gu").fav=85; s.flags.guDirtUsed=true; G.setState(s);
  let over=0; for(let i=0;i<200;i++){ const t=G.initialState(); t.month=10; t.dirt=12; t.cycle=G.makeCycle();
    t.npcs.find(n=>n.id==="gu").fav=85; t.flags.guDirtUsed=true; G.setState(t);
    const f=G.patrolBeat(); if(f){ f(); if(G.getState().over) over++; } }
  ok("这个人情只有一次:用过之后 dirt=12 出局 "+over+"/200", over>140);
}

// 5. 三套黑天鹅各自走通三幕
const seen={};
for(const id of G.BLACKSWANS){
  const s=G.initialState(); s.cycle=G.makeCycle(); s.month=8; G.setState(s);
  let acts=0;
  const fa=G.fireEventById("bs_"+id+"_a"); if(fa){ fa(); acts++; }
  // a 的选项已自动选一个并 schedule 了 b
  for(let step=0; step<2; step++){
    const S=G.getState();
    if(!S.chain.length) break;
    S.month = S.chain[0].at;
    const fb=G.fireChain(); if(fb){ fb(); acts++; }
  }
  seen[id]=acts;
  ok("黑天鹅 "+id+" 走通 "+acts+" 幕", acts===3);
}

// 6. 三幕分支差异化:同一套跑多次,结局文案不止一种
const bodies=new Set();
for(let i=0;i<60;i++){
  const s=G.initialState(); s.cycle=G.makeCycle(); s.month=8; G.setState(s);
  const fa=G.fireEventById("bs_fang_a"); if(fa) fa();
  for(let step=0;step<2;step++){ const S=G.getState(); if(!S.chain.length) break; S.month=S.chain[0].at; const fb=G.fireChain(); if(fb) fb(); }
  const S=G.getState(); bodies.add((S.log[0]||{}).txt);
}
ok("房企暴雷结算分支有 "+bodies.size+" 种不同结果", bodies.size>=3);

// 7. 站队:三个选项都写得进 flags,专属事件只对本派开放
const facs=new Set();
for(let i=0;i<60;i++){
  const s=G.initialState(); s.month=24; s.cycle=G.makeCycle(); G.setState(s);
  const f=G.factionBeat(); if(f){ f(); facs.add(G.getState().flags.faction); }
}
ok("站队三种结果都出现:"+[...facs].join("/"), facs.size===3);
{
  const s=G.initialState(); s.month=24; s.cycle=G.makeCycle(); s.flags.faction="lu"; G.setState(s);
  let luSeen=false, guSeen=false;
  for(let i=0;i<400;i++){ const e=G.pickEvent(); if(!e) continue; if(e.faction==="lu") luSeen=true; if(e.faction==="gu") guSeen=true; }
  ok("站陆:能抽到业务派专属事件", luSeen);
  ok("站陆:抽不到合规派专属事件", !guSeen);
}
// 站队后另一派主线弧仍能推进
{
  const s=G.initialState(); s.month=24; s.cycle=G.makeCycle(); s.flags.faction="lu"; G.setState(s);
  const gu=s.npcs.find(n=>n.id==="gu"); gu.fav=60; gu.arc=0;
  let got=false;
  for(let i=0;i<40 && !got;i++){ const f=G.pickArcBeat(); if(f){ const before=gu.arc; f(); if(gu.arc>before) got=true; } }
  ok("站队后另一派的主线弧仍能推进", got);
}

// 8. 净息差:高息揽储把成本挂上 6 个月后自动归零
{
  const s=G.initialState(); s.cycle=G.makeCycle(); G.setState(s);
  s.depCostRate=G.BALANCE.nim.hiCostAdd; s.depCostLeft=G.BALANCE.nim.hiCostMonths;
  let months=0;
  while(s.depCostLeft>0 && months<12){ G.settleCore(); G.nextMonth(); months++; }
  ok("付息成本 "+months+" 个月后归零", months===G.BALANCE.nim.hiCostMonths && s.depCostRate===0);
}
// 9. 收紧期存款外流 + 派生打折
{
  const s=G.initialState(); s.cycle={t1:11,t2:23,told:{}}; s.month=15; s.dep=40; G.setState(s);
  const d1=G.deriveOf({amt:1});
  s.month=5; const d2=G.deriveOf({amt:1});
  ok("宽松期派生高于收紧期 "+d2+" > "+d1, d2>d1);
}
r.done();

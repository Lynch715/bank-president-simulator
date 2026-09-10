// P2:种子复现 / 挑战模式 / 对手剧本 / 同业群
const {load, runner} = require("./lib");
const {G} = load();
const g = globalThis;
const r = runner("P2 种子·挑战·对手剧本");
const ok = r.ok;


// 1. 种子:同种子必然复现
function fingerprint(seed, chal){
  G.newGame(chal||null, seed||null);
  const S=G.getState();
  const rid=["corp","retail","guanxi","compliance"][Math.floor(999*1)%4];
  S.route="corp"; G.ROUTES.corp.apply(S);
  let guard=0;
  while(!S.over && S.month<=(S.maxMonth||36) && guard++<80){
    while(S.energy>0){ S.energy--; }
    G.endMonth();
  }
  const T=G.getState();
  return [T.dep.toFixed(3), T.cash|0, T.risk|0, T.month, T.endTitle, (T.track.keyEvents||[]).length,
          JSON.stringify(T.cycle), JSON.stringify((T.rivalScripts||[]).map(x=>x.id+"@"+x.at))].join("|");
}
const f1=fingerprint("观音桥"), f2=fingerprint("观音桥"), f3=fingerprint("解放碑");
ok("同一个种子跑出同一局", f1===f2);
ok("不同种子跑出不同局", f1!==f3);
ok("种子局有内容:"+f1.slice(0,60)+"…", f1.split("|")[3]>1);
// 不注种子时仍然是随机的
const r1=fingerprint(null), r2=fingerprint(null);
ok("不注种子时每局不同", r1!==r2);

// 2. 挑战模式:初始状态
G.newGame("xiuluo","x");
{ const S=G.getState(); ok("修罗开局:存款5亿/现金150万/垫底 第"+G.myRank()+"名", S.dep===5&&S.cash===150&&G.myRank()>=8); }
G.newGame("sutong","x");
{ const S=G.getState(); ok("速通:任期24个月", S.maxMonth===24 && G.endM()===24); }
G.newGame("lianzheng","x");
{ const S=G.getState(); ok("廉政风暴:标记写进存档", S.chal==="lianzheng"); }

// 3. 廉政风暴禁用灰色选项
{
  G.newGame("lianzheng","x"); const S=G.getState(); S.route="corp";
  const withGrey=[{t:"干净的做法",fn:()=>{gain("rep",1);}},{t:"灰的做法",fn:()=>{dirt(2);gain("dep",1);}}];
  const out=G.applyLianzheng(withGrey);
  ok("灰色选项被禁用", out[1].disabled===true && !out[0].disabled && /廉政风暴/.test(out[1].s));
  const allGrey=[{t:"甲",fn:()=>{dirt(1);}},{t:"乙",fn:()=>{dirt(2);}}];
  ok("全是灰色时不禁用(避免卡死)", G.applyLianzheng(allGrey).every(o=>!o.disabled));
  G.newGame(null,"x");
  ok("普通模式不禁用", G.applyLianzheng(withGrey).every(o=>!o.disabled));
}
// 廉政风暴实跑:把柄应该基本涨不起来
{
  let maxDirt=0, ends={};
  for(let i=0;i<60;i++){
    G.newGame("lianzheng"); const S=G.getState(); S.route="compliance"; G.ROUTES.compliance.apply(S);
    let guard=0;
    while(!S.over && S.month<=36 && guard++<80){ while(S.energy>0){ if(S.risk>=55) G.gain("risk",-15); S.energy--; } G.endMonth(); }
    const T=G.getState(); maxDirt=Math.max(maxDirt,T.dirt||0); ends[T.endTitle]=(ends[T.endTitle]||0)+1;
  }
  ok("廉政风暴 60 局最高把柄 "+maxDirt+"(灰色被禁,应该很低)", maxDirt<=4);
}
// 巡视组月份
{
  G.newGame("lianzheng","x"); ok("廉政风暴巡视组每半年:"+G.patrolMonths().join(","), G.patrolMonths().length===6);
  G.newGame("sutong","x");    ok("速通巡视组压缩到两年:"+G.patrolMonths().join(","), G.patrolMonths().every(m=>m<=24));
  G.newGame(null,"x");        ok("普通模式巡视组:"+G.patrolMonths().join(","), G.patrolMonths().join(",")==="10,22,34");
}

// 4. 速通完整跑通并出结局
{
  let done=0;
  for(let i=0;i<30;i++){
    G.newGame("sutong"); const S=G.getState(); S.route="retail"; G.ROUTES.retail.apply(S);
    let guard=0;
    while(!S.over && S.month<=24 && guard++<60){ while(S.energy>0){ if(S.risk>=55) G.gain("risk",-15); S.energy--; } G.endMonth(); }
    const T=G.getState(); if(T.endTitle && T.month<=24) done++;
  }
  ok("速通 30 局全部在24个月内出结局", done===30);
}

// 5. 对手剧本
{
  const cnts=new Set(), ids=new Set();
  for(let i=0;i<200;i++){ const l=G.makeRivalScripts(); cnts.add(l.length); l.forEach(x=>ids.add(x.id)); }
  ok("每局激活 1~2 个对手剧本", [...cnts].every(n=>n>=1&&n<=2) && cnts.size===2);
  ok("四套剧本都会出现:"+[...ids].join("/"), ids.size===4);
}
for(const sc of G.RIVAL_SCRIPTS){
  G.newGame(null,"x"); const S=G.getState(); S.month=sc.win[1];
  S.cash=500;
  const snap=()=>JSON.stringify(S.rivals.map(r=>[r.dep,r.g,r.move]))+"|"+S.dep.toFixed(2)+"|"+S.rep+"|"+S.morale;
  const before=snap();
  const f=G.fireEventById(sc.ev,null,"📮 ");
  ok("对手剧本 "+sc.id+" 可触发", !!f);
  if(f){ f(); ok("  剧本 "+sc.id+" 改变了局面(对手或自己)", before!==snap()); }
}
// 南岸被查:存款应该腰斩
{
  G.newGame(null,"x"); const S=G.getState(); S.cash=500;
  const b=S.rivals.find(r=>r.boss==="黄世海").dep;
  const f=G.fireEventById("rs_cha"); f();
  const a=G.getState().rivals.find(r=>r.boss==="黄世海").dep;
  ok("南岸被查后存款腰斩 "+b+" → "+a, a<=b*0.65);
}

// 6. 同业群消息
{
  G.newGame(null,"x"); const S=G.getState(); S.month=12;
  const msgs=G.groupChat();
  ok("同业群一次 2~3 条:"+msgs.length, msgs.length>=2 && msgs.length<=3);
  const uniq=new Set(); for(let i=0;i<50;i++) G.groupChat().forEach(m=>uniq.add(m));
  ok("消息池够用,50次抽出 "+uniq.size+" 种不同消息", uniq.size>=8);
  ok("每条消息都不为空", msgs.every(m=>typeof m==="string"&&m.length>4));
}

// 7. 老档(无 chal/seed/rivalScripts)迁移
{
  const old=G.initialState(); old.ver=5;
  delete old.chal; delete old.seed; delete old.maxMonth; delete old.rivalScripts;
  const m=G.migrate(old);
  ok("老档补齐 maxMonth/chal/seed/rivalScripts", m.maxMonth===36 && m.chal===null && m.seed===null && Array.isArray(m.rivalScripts));
}
r.done();

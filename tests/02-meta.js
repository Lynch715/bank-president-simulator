// P0:存档迁移 / 图鉴成就 / 天赋 / 传记绘制
const {load, runner} = require("./lib");
const {G, store} = load({dpr:2});
const r = runner("P0 图鉴·传记·天赋");

// v5 老档迁移
const v5 = JSON.parse(JSON.stringify(G.initialState()));
v5.ver = 5;
["talents","dirt","cycle","failed","depCostRate","depCostLeft","bs","maxMonth","chal","seed","rivalScripts"].forEach(k=>delete v5[k]);
v5.track = {social:2,hire:1,open:0,train:0,events:5,maxRisk:31,arcs:3,loanTotal:1.2,badLoans:0,rivalMoves:1,rest:0};
v5.month = 20; v5.dep = 28.5; v5.route = "corp";
v5.mods = {derive:1.4,npl:1.3,output:1,socialCost:1,favGain:1,riskDrift:0,openCost:1};
const m = G.migrate(v5);
r.ok("v5 老档补齐全部新字段", Array.isArray(m.talents) && m.dirt===0 && !!m.cycle && m.maxMonth===36 &&
   Array.isArray(m.track.keyEvents) && Array.isArray(m.rivalScripts) && m.ver===6);

G.setState(m);
let guard = 0;
while(!G.getState().over && G.getState().month<=36 && guard++<60){
  const S = G.getState();
  while(S.energy>0){ if(S.risk>=55) G.gain("risk",-15); S.energy--; }
  G.endMonth();
}
const S = G.getState();
r.ok("老档接着玩到终局:" + S.endTitle, !!S.endTitle);
r.ok("趋势数据有累积:" + S.track.depHistory.length + " 个月", S.track.depHistory.length>1);

const META = G.getMeta();
r.ok("结局图鉴点亮 " + Object.keys(META.endings).length + " 个", Object.keys(META.endings).length>=1);
r.ok("成就解锁 " + Object.keys(META.achs).length + " 项", Object.keys(META.achs).length>=1);
r.ok("阅历点累计 " + META.exp, META.exp>0);
r.ok("META 独立落盘、局内存档已清", !!store["jbzh_meta"] && !store["jbzh_save6"]);

const ids = G.ENDINGS.map(e=>G.endIdOf(e.t()));
r.ok("结局标题→id 全部命中且不重复(" + ids.length + " 个)", ids.every(Boolean) && new Set(ids).size===ids.length);

for(const t of G.TALENTS){
  const st = G.initialState(); G.setState(st);
  let bad = false;
  try{ t.apply(st); }catch(e){ bad = true; }
  bad = bad || [st.cash,st.dep,st.rep,st.morale,st.risk].some(v=>typeof v!=="number"||isNaN(v))
      || Object.values(st.mods).some(v=>isNaN(v));
  r.ok("天赋「" + t.nm + "」生效无 NaN", !bad);
}

// 传记:用录制式 mock canvas 走一遍
const calls = [];
const ctx = new Proxy({}, {get:(t,k)=>{
  if(k==="measureText") return s=>({width:String(s).length*7});
  if(k==="createLinearGradient") return ()=>({addColorStop(){}});
  if(["fillStyle","strokeStyle","font","lineWidth","textAlign"].includes(k)) return t[k];
  return ()=>calls.push(k);
}, set:(t,k,v)=>{t[k]=v; return true}});
global.document = {createElement:()=>({getContext:()=>ctx, style:{}, width:0, height:0}), querySelector:()=>null};
global.Image = function(){ setTimeout(()=>this.onerror&&this.onerror(), 0); };
G.setState(S);
let crashed = null;
try{ (0,eval)("renderBiography")(false, ()=>{}); }catch(e){ crashed = e; }
r.ok("传记绘制不报错(" + calls.length + " 次 canvas 调用)" + (crashed?" —— "+crashed.message:""), !crashed && calls.length>50);
r.ok("大事记 " + G.bioBeats().length + " 条,不超过 12", G.bioBeats().length<=12);
const rd = G.radarData();
r.ok("五维雷达数值合法", rd.length===5 && rd.every(([n,v])=>typeof v==="number" && !isNaN(v) && v>=0 && v<=100));
r.done();

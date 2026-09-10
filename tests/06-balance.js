// 数值校准:同一套外部策略跑当前版和基线版,比三年难度带 + 按周期统计不良
// 用法:node 06-balance.js [局数] [基线文件]
const path = require("path");
const {GAME, readCode, shim, runner} = require("./lib");

const N = +(process.argv[2] || 300);
const BASE = process.argv[3] || path.join(__dirname, "..", "index.P0前备份.html");

// 在独立作用域里加载一份游戏,并给不良发生埋点
function boot(file){
  const bucket = {npl:{}, mo:{}};
  let code = shim(readCode(file));
  code = code.replace('l.bad = true; l.badLeft = 6;',
    'l.bad = true; l.badLeft = 6; { const ph=(typeof cyclePhase==="function"&&S.cycle)?cyclePhase(S.month):"na"; globalThis.__B.npl[ph]=(globalThis.__B.npl[ph]||0)+1; }');
  code = code.replace('interest += interestOf(l);',
    'interest += interestOf(l); { const ph=(typeof cyclePhase==="function"&&S.cycle)?cyclePhase(S.month):"na"; globalThis.__B.mo[ph]=(globalThis.__B.mo[ph]||0)+1; }');
  globalThis.__B = bucket;
  global.devicePixelRatio = 1;
  const store = {};
  global.localStorage = {getItem:k=>k in store?store[k]:null, setItem:(k,v)=>{store[k]=String(v)}, removeItem:k=>{delete store[k]}};
  (0, eval)(code);
  return {G: globalThis.BankGame, newGame: globalThis.newGame, bucket};
}

// 统一策略:随机花精力,风险过 55 先去排查。事件选项由无头 showModal 随机选。
function playOnce(env){
  const {G, newGame} = env;
  newGame();
  const S0 = G.getState();
  const rid = ["corp","retail","guanxi","compliance"][Math.floor(Math.random()*4)];
  S0.route = rid; G.ROUTES[rid].apply(S0);
  let guard = 0;
  const cap = () => (G.getState().maxMonth || 36);
  while(!G.getState().over && G.getState().month <= cap() && guard++ < 400){
    const S = G.getState();
    while(S.energy > 0){
      if(S.risk >= 55){ G.gain("risk", -15); S.energy--; continue; }
      const a = ["market","loan","team","social","rest"][Math.floor(Math.random()*5)];
      if(a === "market") S.marketing = true;
      else if(a === "rest"){ S.restMonth = true; S.track.rest++; }
      else if(a === "loan" && S.offers && S.offers.length && G.loanOutstanding() < G.loanCapAmt()){
        const o = S.offers[Math.floor(Math.random()*S.offers.length)];
        const prov = Math.round(o.amt * 60);
        if(S.cash >= prov){
          const der = +(o.amt * 0.55 * (S.mods.derive||1)).toFixed(2);
          G.gain("cash", -prov);
          S.loans.push({id:S.loanSeq++, nm:o.nm, amt:o.amt, rate:o.rate,
            tier:(o.hidden?Math.min(3,o.tier+1):o.tier), left:o.months, bad:false, derive:der});
          G.gain("dep", der); G.gain("risk", o.tier);
          S.track.loanTotal = +((S.track.loanTotal||0) + o.amt).toFixed(2);
          S.offers = S.offers.filter(x => x !== o);
        }
      }
      else if(a === "social"){
        const n = S.npcs[Math.floor(Math.random()*S.npcs.length)];
        n.fav = Math.min(100, n.fav + 4*(S.mods.favGain||1));
        G.gain("cash", -12*(S.mods.socialCost||1)); S.track.social++;
      }
      else { G.gain("morale", 3); G.gain("cash", -15); }
      S.energy--;
    }
    G.endMonth();
  }
  const S = G.getState();
  return {dep:+S.dep.toFixed(2), month:S.month, ending:S.endTitle||"未结束",
          bust: S.month < (S.maxMonth||36) && S.over, dirt:S.dirt||0};
}

function survey(file, n){
  const env = boot(file);
  const all = [], fin = [], dirts = [], ends = {};
  for(let i=0;i<n;i++){
    const r = playOnce(env);
    all.push(r.dep); dirts.push(r.dirt);
    ends[r.ending] = (ends[r.ending]||0) + 1;
    if(!r.bust) fin.push(r.dep);
  }
  const med = a => { const b = a.slice().sort((x,y)=>x-y); return b.length ? b[b.length>>1] : 0; };
  const rate = ph => env.bucket.mo[ph] ? (env.bucket.npl[ph]||0)/env.bucket.mo[ph] : null;
  return {
    medAll: med(all), medFin: med(fin), finRate: fin.length/n, medDirt: med(dirts),
    loose: rate("loose"), tight: rate("tight"), loose2: rate("loose2"), na: rate("na"), ends,
    // 样本量:不良是低频事件,局数少的时候这个比值抖得厉害
    nBad: (env.bucket.npl.loose||0) + (env.bucket.npl.tight||0),
  };
}

const r = runner("数值校准");
const now = survey(GAME, N);
console.log(`  当前版 (${N} 局):全部局中位存款 ${now.medAll} · 完赛局中位存款 ${now.medFin} · 完赛率 ${(now.finRate*100).toFixed(1)}% · 中位把柄 ${now.medDirt}`);
if(now.tight !== null){
  console.log(`  不良发生率:宽松 ${(now.loose*100).toFixed(2)}% · 收紧 ${(now.tight*100).toFixed(2)}% · 再宽松 ${(now.loose2*100).toFixed(2)}%(不良样本 ${now.nBad} 起)`);
  const lift = now.tight / now.loose - 1;
  // 不良是低频事件,样本不够时这个比值能在 30%~60% 之间抖。少于 250 起就只报数,不判定。
  if(now.nBad < 250){
    console.log(`  ⚠ 不良样本只有 ${now.nBad} 起,比值不稳,本轮不判定。想要结论请加大局数:node 06-balance.js 800`);
    r.ok(`收紧期不良高于宽松期(本轮实测 +${(lift*100).toFixed(0)}%,样本不足未判定)`, lift > 0);
  } else {
    r.ok(`收紧期不良比宽松期高 ${(lift*100).toFixed(0)}%(要求 ≥40%)`, lift >= 0.40);
  }
}

let base = null;
try{ base = survey(BASE, N); }catch(e){ console.log("  (没找到基线文件,跳过对比:" + BASE + ")"); }
if(base){
  const drift = now.medFin / base.medFin - 1;
  console.log(`  基线版 (${path.basename(BASE)}):完赛局中位存款 ${base.medFin} · 完赛率 ${(base.finRate*100).toFixed(1)}%`);
  r.ok(`完赛局中位存款偏差 ${(drift*100).toFixed(1)}%(要求 ≤±10%)`, Math.abs(drift) <= 0.10);
}
r.ok("结局分布不止一种:" + Object.keys(now.ends).length + " 种", Object.keys(now.ends).length >= 4);
console.log("  结局:" + JSON.stringify(now.ends));
r.done();

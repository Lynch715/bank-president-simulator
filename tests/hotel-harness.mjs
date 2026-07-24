import fs from "node:fs";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import path from "node:path";
const HTML = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "模拟酒店.html");

// 种子 LCG:让 Math.random 可复现
export function mkRng(seed){ let x=(seed>>>0)||1; return ()=>((x=(x*1664525+1013904223)>>>0)/4294967296); }

// 载入游戏脚本到隔离沙箱,注入种子随机;返回 HotelGame API
export function loadHotel(seed=1){
  const html = fs.readFileSync(HTML, "utf8");
  const code = html.match(/<script>([\s\S]*)<\/script>/)[1];
  const seededMath = Object.create(Math);   // 继承 Math.floor 等,仅覆写 random
  seededMath.random = mkRng(seed);
  const sandbox = { Math: seededMath, JSON, console, globalThis:null };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);            // document undefined → init() 不跑
  return sandbox.HotelGame;
}

// 放置流经济模拟:不接单/不花钱/不做操作,只跑月结。返回逐月轨迹。
// 说明:idle 下我方现金/评分/士气/风险由 settleCore+calculateForecast 决定,均无 Math.random,故完全确定。
export function runIdle(API){
  const s = API.initialState();
  const trace = [];
  for(let m=1; m<=24; m++){
    s.month = m;
    API.settleCore(s);
    const risks = Object.values(s.risks);
    trace.push({ m, cash: s.cash, rating: s.rating, morale: s.morale, maxRisk: Math.max(...risks) });
  }
  return { s, trace, ending: API.endingFor(s) };
}

// 数值健全性:无 NaN、各值在界内
export function assertSane(s){
  if(!Number.isFinite(s.cash)) throw new Error("cash NaN");
  if(!(s.rating>=1 && s.rating<=5)) throw new Error("rating 越界 "+s.rating);
  if(!(s.morale>=0 && s.morale<=100)) throw new Error("morale 越界 "+s.morale);
  for(const [k,v] of Object.entries(s.risks)) if(!(v>=0 && v<=120)) throw new Error("risk "+k+" 越界 "+v);
}

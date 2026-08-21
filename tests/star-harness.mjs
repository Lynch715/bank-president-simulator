import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

// 确定性 RNG(与足球/球员 tests 同款线性同余)
export function seeded(seed) {
  let x = seed >>> 0;
  return () => ((x = (x * 1664525 + 1013904223) >>> 0) / 4294967296);
}

// 载入《模拟明星》唯一 <script> 到无 DOM 沙箱。
// showModal / render* 都被 typeof document 守卫,headless 下自动空转。
// Math.random 用种子接管 → 单局可复现。
export function loadGame(seed = 1) {
  const candidates = ["模拟明星.html", "index.html"];
  const file = candidates.map(f => path.join(root, f)).find(p => fs.existsSync(p));
  if (!file) throw new Error("未找到游戏 HTML(模拟明星.html)");
  const html = fs.readFileSync(file, "utf8");
  const m = html.match(/<script>([\s\S]*)<\/script>/); // 文件只有 1 个 <script>
  if (!m) throw new Error("未找到 <script> 块");
  const rng = seeded(seed);
  const M = Object.create(Math);
  M.random = () => rng();
  const store = {};
  // 极简 DOM 桩:所有 UI 绘制写进一次性节点,数值逻辑照跑。
  const makeEl = () => {
    const set = new Set();
    const el = {
      textContent: "", innerHTML: "", value: "", className: "", title: "",
      style: {}, dataset: {}, children: [], parentNode: null,
      get firstChild() { return this._fc || (this._fc = makeEl()); },
      get lastChild() { return this._lc || (this._lc = makeEl()); },
      classList: {
        add: (...c) => c.forEach(x => set.add(x)),
        remove: (...c) => c.forEach(x => set.delete(x)),
        contains: x => set.has(x),
        toggle: (x, f) => { const on = f === undefined ? !set.has(x) : f; on ? set.add(x) : set.delete(x); return on; },
      },
      appendChild: c => (el.children.push(c), c),
      append: (...cs) => el.children.push(...cs),
      prepend: (...cs) => el.children.unshift(...cs),
      removeChild: c => { const i = el.children.indexOf(c); if (i >= 0) el.children.splice(i, 1); return c; },
      remove: () => {}, setAttribute: () => {}, getAttribute: () => null, removeAttribute: () => {},
      addEventListener: () => {}, removeEventListener: () => {},
      querySelector: () => makeEl(), querySelectorAll: () => [], closest: () => null,
      focus: () => {}, blur: () => {}, click: () => {},
      insertAdjacentHTML: () => {}, cloneNode: () => makeEl(),
      getBoundingClientRect: () => ({ top: 0, left: 0, width: 0, height: 0, bottom: 0, right: 0 }),
      scrollIntoView: () => {}, set onclick(_v) {}, get onclick() { return null; },
    };
    return el;
  };
  const document = {
    querySelector: () => makeEl(), querySelectorAll: () => [],
    createElement: () => makeEl(), createDocumentFragment: () => makeEl(),
    getElementById: () => makeEl(), body: makeEl(), documentElement: makeEl(),
    addEventListener: () => {}, removeEventListener: () => {},
  };
  const sandbox = {
    console, Math: M, Date, JSON, setTimeout: () => 0, clearTimeout: () => {},
    document, window: {},
    localStorage: {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: k => { delete store[k]; },
    },
  };
  sandbox.window.document = document;
  vm.createContext(sandbox);
  vm.runInContext(m[1], sandbox);
  return sandbox; // 顶层 function 声明 + let S 都挂在 context 上
}

const CONFIG = {
  name: "测试", gender: "female", orientation: "straight",
  background: "academy", company: "shengguang", talents: [],
};

// 用 runInContext 把顶层 let S 赋成新开局,返回状态对象引用
export function newGame(g, cfg = {}) {
  g.__cfg = { ...CONFIG, ...cfg };
  return vm.runInContext("S = initialState(__cfg)", g);
}

export const getS = g => vm.runInContext("S", g);

// 结束当前月:清空行动力直接结算,再"点穿"月末所有弹窗(结算卡/事件/风险征兆/进入下月)。
// flushQueue 是点击驱动的(一次只弹一个,靠按钮 onclick 续弹),headless 必须手动排空,
// 否则 doEndMonth 会被反复调用、settleCore 一个月结算多次。事件选项的 fn 只在点击时触发,
// 排空只跑弹窗本体不选项 → 等价"纯放置流:不做任何主动选择"。
export function endMonth(g) {
  vm.runInContext("if(S&&!S.over){S.energy=0;doEndMonth();var __g=0;while(modalQueue.length&&__g++<80)flushQueue();}", g);
}

// 跑一整局放置流,返回终局状态 + 存活月;检测软锁(月份不前进)。
export function runPlacement(g, cfg = {}, maxMonths = 40) {
  newGame(g, cfg);
  let last = -1, stuck = 0;
  for (let i = 0; i < maxMonths; i++) {
    const s = getS(g);
    if (s.over || s.month > 36) break;
    if (s.month === last) { if (++stuck > 2) throw new Error(`软锁:第${s.month}月无法前进`); }
    else stuck = 0;
    last = s.month;
    endMonth(g);
  }
  return getS(g);
}

// 直接立人设(模拟第1幕定调的选择),robot 用
export function establishPersona(g, tag) {
  g.__tag = tag;
  vm.runInContext("establishImage(__tag)", g);
}

// 按契合偏好签一个当月开放项目,返回签下的类型(或 null)。prefer: "fit"|"against"|"any"
export function robotSign(g, prefer = "any") {
  g.__pref = prefer;
  return vm.runInContext(`(function(){
    var open=S.projects.filter(p=>p.status==="open");if(!open.length)return null;
    var a=S.image.tag?IMAGE_ARCHETYPES[S.image.tag]:null,pick=null;
    if(a&&__pref==="fit")pick=open.find(p=>a.fit.includes(p.type));
    else if(a&&__pref==="against"){var srt=open.slice().sort((x,y)=>y.fee-x.fee);pick=srt.find(p=>a.against.includes(p.type))||srt[0];}
    if(!pick)pick=open[0];
    // 会玩的艺人:档期快满就歇一个月,不硬接到过劳。放置流不受影响(它不调 robotSign)。
    if(typeof projectedMaxLoad==="function"&&projectedMaxLoad(S,pick)>0.9)return "rest";
    signProject(pick);return pick.type;
  })()`, g);
}

// 一整局人设流:开局立 tag,每月按 prefer 签 1 个项目,再结算。
export function runPersona(g, { background = "academy", company = "shengguang", tag = "purist", prefer = "fit", onMonth } = {}, maxMonths = 40) {
  newGame(g, { background, company });
  establishPersona(g, tag);
  for (let i = 0; i < maxMonths; i++) {
    const s = getS(g);
    if (s.over || s.month > 36) break;
    robotSign(g, prefer);
    if (onMonth) onMonth(getS(g));
    endMonth(g);
  }
  return getS(g);
}

// 递归找 NaN / undefined 数值泄漏(只查数字字段)
export function findNaN(obj, pathStr = "S", seen = new Set()) {
  if (obj == null || typeof obj !== "object" || seen.has(obj)) return null;
  seen.add(obj);
  for (const [k, v] of Object.entries(obj)) {
    const p = `${pathStr}.${k}`;
    if (typeof v === "number" && !Number.isFinite(v)) return p;
    if (v && typeof v === "object") { const hit = findNaN(v, p, seen); if (hit) return hit; }
  }
  return null;
}

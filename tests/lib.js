// 公共加载器:把 index.html 里的 <script> 抠出来,在 Node 里当普通脚本跑
const fs = require("fs"), path = require("path");
const GAME = path.join(__dirname, "..", "index.html");

function readCode(file){
  const html = fs.readFileSync(file || GAME, "utf8");
  const m = html.match(/<script>([\s\S]*)<\/script>/);
  if(!m) throw new Error("没找到 <script> 块:" + (file||GAME));
  return m[1].replace('"use strict";', "");
}

// 老版本(P0 之前)缺无头守卫,这里补上,好让新旧两版能用同一套策略对比
function shim(code){
  return code
    .replace(/\n\s*askName\(\);/, "\n")
    .replace('fns[0] = ()=>{', 'fns[0] = ()=>{ if(typeof document==="undefined"){ flushMQ(); return; }')
    .replace('if(ok.length && ok[0].fn) ok[0].fn();\n    return;',
             'const c=ok.length?ok[Math.floor(Math.random()*ok.length)]:null; if(c&&c.fn) c.fn(); if(!(S&&S.over)) flushMQ();\n    return;');
}

function fakeStorage(){
  const store = {};
  return {store, api:{getItem:k=>k in store?store[k]:null, setItem:(k,v)=>{store[k]=String(v)}, removeItem:k=>{delete store[k]}}};
}

// 在当前进程里加载一份游戏,返回 BankGame API
function load(opts){
  opts = opts || {};
  const st = fakeStorage();
  global.localStorage = st.api;
  global.devicePixelRatio = opts.dpr || 1;
  let code = readCode(opts.file);
  if(opts.shim) code = shim(code);
  if(opts.patch) code = opts.patch(code);
  (0, eval)(code);
  return {G: globalThis.BankGame, store: st.store};
}

// 极简断言器
function runner(name){
  let fail = 0, n = 0;
  const ok = (label, cond) => { n++; console.log((cond?"  ✓ ":"  ✗ ") + label); if(!cond) fail++; };
  const done = () => {
    console.log(fail ? `\n❌ ${name}:${fail}/${n} 项未通过` : `\n✅ ${name}:${n} 项全部通过`);
    process.exitCode = fail ? 1 : 0;
    return fail;
  };
  return {ok, done, count:()=>n};
}

// 有没有装可选依赖
function has(mod){ try{ require.resolve(mod); return true; }catch(e){ return false; } }
function skip(name, why){ console.log(`⏭  跳过 ${name}:${why}`); process.exitCode = 0; }

module.exports = {GAME, readCode, shim, load, runner, has, skip};

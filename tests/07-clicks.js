// 点击数:用 jsdom 真点按钮跑满一届任期,数玩家一共点了多少下
// 用法:node 07-clicks.js [文件]  —— 不传就是当前版
const path = require("path");
const {GAME, runner, has, skip} = require("./lib");
if(!has("jsdom")){ skip("点击数统计", "没装 jsdom,跑 `npm i` 就有了"); return; }

const fs = require("fs");
const {JSDOM} = require("jsdom");
const file = process.argv[2] || GAME;
const dom = new JSDOM(fs.readFileSync(file, "utf8"),
  {runScripts:"dangerously", pretendToBeVisual:true, url:"http://localhost/"});
const w = dom.window;
const errs = [];
w.addEventListener("error", e => errs.push(e.message));
w.console.error = (...a) => errs.push(a.join(" "));
// jsdom 没有 canvas,给个哑实现
w.HTMLCanvasElement.prototype.getContext = function(){
  return new Proxy({}, {get:(t,k)=>{
    if(k==="measureText") return s=>({width:String(s).length*7});
    if(k==="createLinearGradient") return ()=>({addColorStop(){}});
    if(k in t) return t[k];
    return ()=>{};
  }, set:(t,k,v)=>{t[k]=v; return true}});
};
w.HTMLCanvasElement.prototype.toBlob = function(cb){ cb(null); };
const $ = s => w.document.querySelector(s);

setTimeout(() => {
  const r = runner("点击数");
  w.startBankFromGuide();
  if($("#nameInput")){ $("#nameInput").value = "测"; $("#mOpts").querySelector("button").click(); }
  $("#mOpts").children[0].click();
  if(/开局天赋/.test($("#mTitle").textContent)) $("#mOpts").children[0].click();
  $("#mOpts").querySelector("button").click();

  const G = w.BankGame;
  let total = 0, months = 0, qTotal = 0, qm = 0, one = 0;
  for(let i=0;i<40;i++){
    const S = G.getState();
    if(S.over) break;
    // 只量弹窗流程,不量玩家怎么花精力:把状态托住,免得早早出局
    S.energy = 0; S.morale = Math.max(S.morale, 55); S.cash = Math.max(S.cash, 400);
    S.risk = Math.min(S.risk, 45); S.dirt = 0; S.npl = Math.min(S.npl, 1);
    const mo = ((S.month - 1) % 12) + 1;
    $("#btnEnd").click();
    let c = 0, guard = 0;
    while($("#mask").classList.contains("show") && guard++ < 20){
      const b = $("#mOpts").querySelector("button:not([disabled])");
      if(!b) break;
      b.click(); c++;
    }
    total += c; months++;
    if(c <= 1) one++;
    if(mo % 3 === 0){ qTotal += c; qm++; }
  }
  const avg = total / months, qAvg = qTotal / Math.max(1, qm);
  console.log(`  ${path.basename(file)}:${months} 个月 · 共 ${total} 次点击 · 月均 ${avg.toFixed(2)} · 季末月均 ${qAvg.toFixed(2)} · 一次点完的月份 ${one}`);
  r.ok("跑满一届任期:" + months + " 个月", months >= 20);
  r.ok("月均点击 " + avg.toFixed(2) + " 次,不高于原版的 3.44", avg <= 3.44);
  r.ok("季末月均点击 " + qAvg.toFixed(2) + " 次,低于原版的 5.4", qAvg < 5.4);
  r.ok("全程零 console 报错" + (errs.length ? "\n     " + errs.join("\n     ") : ""), errs.length === 0);
  r.done();
}, 300);

(function(){
// UI:用 jsdom 真点按钮走一遍完整流程(需要 jsdom,没装就跳过)
const {GAME, runner, has, skip} = require("./lib");
if(!has("jsdom")){ skip("UI 测试", "没装 jsdom,跑 `npm i` 就有了"); return; }
const fs=require("fs");
const {JSDOM}=require("jsdom");
const html=fs.readFileSync(GAME,"utf8");

const errs=[];
const dom=new JSDOM(html,{runScripts:"dangerously",pretendToBeVisual:true,url:"http://localhost/"});
const w=dom.window;
w.addEventListener("error",e=>errs.push("window.onerror: "+e.message));
const oldErr=w.console.error; w.console.error=(...a)=>{errs.push("console.error: "+a.join(" "));};
// canvas 在 jsdom 里没有 getContext,给个哑实现,别让它炸
w.HTMLCanvasElement.prototype.getContext=function(){ const noop=()=>({addColorStop(){}});
  return new Proxy({},{get:(t,k)=>{ if(k==="measureText") return s=>({width:String(s).length*7});
    if(k==="createLinearGradient") return noop; if(k in t) return t[k]; return ()=>{}; },set:(t,k,v)=>{t[k]=v;return true}}); };
w.HTMLCanvasElement.prototype.toBlob=function(cb){ cb(null); };
const $=s=>w.document.querySelector(s);
const r=runner("UI 全流程"); const ok=r.ok;

setTimeout(()=>{
  ok("首屏是玩法说明页", $("#gameGuide").classList.contains("show"));
  ok("首周目不显示图鉴入口", $("#guideGallery").style.display==="none");
  w.startBankFromGuide();
  // 取名 → 选路线
  ok("弹出取名框", !!$("#nameInput"));
  $("#nameInput").value="李维安";
  $("#mOpts").querySelector("button").click();
  ok("进入选路线", $("#mTitle").textContent.indexOf("打法")>=0);
  const before=$("#mOpts").children.length;
  $("#mOpts").children[0].click();     // 对公猛攻
  ok("四条路线可选:"+before, before===4);
  ok("首周目直接进上任说明(跳过天赋)", $("#mTitle").textContent.indexOf("上任第一天")>=0);
  $("#mOpts").querySelector("button").click();

  // 连点若干个月
  // 开局之后:图鉴和重开的入口都得在
  ok("游戏中有图鉴入口", !!$("#btnGallery"));
  ok("游戏中有重开入口", !!$("#btnRestart"));
  {
    const G0=w.BankGame;
    $("#btnGallery").click();
    ok("游戏中能打开图鉴", /图鉴/.test($("#mTitle").textContent));
    $("#mOpts").querySelector("button").click();
    ok("关掉图鉴后回到游戏,状态没丢", !$("#mask").classList.contains("show") && G0.getState().month>=1 && !G0.getState().over);
    // 重开:先确认,选「算了」应该什么都不变
    const before = G0.getState();
    before.dep = 42.5; before.month = 7;
    $("#btnRestart").click();
    ok("重开会先确认", /重开一局/.test($("#mTitle").textContent) && $("#mOpts").children.length===2);
    ok("确认框里报了当前进度", /42\.5/.test($("#mBody").textContent));
    $("#mOpts").children[1].click();
    ok("选『算了』这一局原封不动", G0.getState().month===7 && G0.getState().dep===42.5);
    // 真重开
    $("#btnRestart").click();
    $("#mOpts").children[0].click();
    $("#nameInput") && ($("#nameInput").value="李", $("#mOpts").querySelector("button").click());
    $("#mOpts").children[0].click();
    if(/开局天赋/.test($("#mTitle").textContent)) $("#mOpts").children[0].click();
    $("#mOpts").querySelector("button").click();
    ok("重开后回到第1年1月、存款10亿", G0.getState().month===1 && G0.getState().dep===10);
  }
  const G=w.BankGame; let clicks=0, quietClicks=0;
  for(let m=0;m<36;m++){
    const S=G.getState(); if(S.over) break;
    S.energy=0;
    $("#btnEnd").click();
    let guard=0;
    while($("#mask").classList.contains("show") && guard++<20){
      const b=$("#mOpts").querySelector("button:not([disabled])");
      if(!b) break;
      if(guard===1 && /进入第/.test(b.textContent)) quietClicks++;
      b.click(); clicks++;
    }
  }
  const S=G.getState();
  ok("36个月跑完,结局:"+(S.endTitle||"无"), !!S.endTitle);
  ok("平静月合并按钮 "+quietClicks+" 次(中期留白概率触发,可为0)", true);
  ok("结局页显示", $("#endScreen").classList.contains("show"));
  ok("结局页有传记按钮", /生成传记长图/.test($("#endCard").innerHTML));
  ok("结局页有阅历点", /阅历点/.test($("#endCard").innerHTML));
  // 图鉴
  w.showGallery();
  ok("图鉴打开", /图鉴/.test($("#mTitle").textContent) && /结局/.test($("#mBody").innerHTML));
  w.galTab("ach"); ok("成就页可切", /成就/.test($("#mBody").innerHTML));
  w.galTab("tal"); ok("天赋页可切", /阅历点/.test($("#mBody").innerHTML));
  const cnt=($("#mBody").innerHTML.match(/unlockTalent/g)||[]).length;
  ok("天赋页有可解锁项 "+cnt, cnt>=1);
  // 传记
  w.makeBio();
  // 二周目:图鉴入口出现 + 天赋三选一
  ok("META runs 已+1:"+G.getMeta().runs, G.getMeta().runs>=1);
  w.restartGame();
  $("#nameInput").value="李维安"; $("#mOpts").querySelector("button").click();
  $("#mOpts").children[0].click();
  ok("二周目出现天赋三选一", /开局天赋/.test($("#mTitle").textContent) && $("#mOpts").children.length===3);
  $("#mOpts").children[0].click();
  ok("选完天赋进入上任说明", /上任第一天/.test($("#mTitle").textContent));
  ok("天赋记进存档", (G.getState().talents||[]).length===1);
  // 挑战模式入口(二周目起)
  w.showGallery(); w.galTab("chal");
  ok("图鉴出现挑战页", /挑战/.test($("#mBody").innerHTML) && !!$("#seedInput"));
  $("#seedInput").value = "观音桥";
  w.startChallenge("sutong");
  $("#nameInput").value="李"; $("#mOpts").querySelector("button").click();
  $("#mOpts").children[0].click();
  if(/开局天赋/.test($("#mTitle").textContent)) $("#mOpts").children[0].click();
  ok("速通挑战开局:任期24个月 · 种子写进存档", G.getState().maxMonth===24 && G.getState().seed==="观音桥");
  ok("上任说明里写了挑战和种子", /两年/.test($("#mBody").textContent) && /观音桥/.test($("#mBody").textContent));
  $("#mOpts").querySelector("button").click();
  ok("头部剩余月数按24算:"+$("#hLeft").textContent, $("#hLeft").textContent==="24");
  setTimeout(()=>{
  ok("传记 canvas 已插入", !!$("#bioBox canvas"));
  ok("传记提示文案在", !!$("#bioBox .biotip"));
  ok("全程零 console 报错"+(errs.length?"\n     "+errs.join("\n     "):""), errs.length===0);
  r.done();
  },1600);
},300);

})();

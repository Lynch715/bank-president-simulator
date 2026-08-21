// 《模拟明星》DOM 冒烟测试：真实 DOM 下跑通开局→各标签页→粉圈→擂台→狗仔→演出层→通关→名人堂
// 运行：npm i -D jsdom && node tests/star-dom.test.mjs
import fs from 'node:fs';
import { JSDOM, VirtualConsole } from 'jsdom'; // 需要 npm i -D jsdom
const html = fs.readFileSync(new URL('../模拟明星.html',import.meta.url),'utf8');
const errs=[];
const dom = new JSDOM(html, { runScripts:'dangerously', pretendToBeVisual:true, url:'https://local.test/',
  virtualConsole: new VirtualConsole()
    .on('jsdomError',e=>errs.push('jsdomError: '+e.message))
    .on('error',(...a)=>errs.push('console.error: '+a.join(' ')))
});
const w = dom.window;
await new Promise(r=>w.addEventListener('load',r));
const d = w.document;
const $ = q=>d.querySelector(q);
const SS = ()=>w.eval('typeof S!=="undefined"?S:null');
const log=[];
function ok(c,m){log.push((c?'✓ ':'✗ ')+m); if(!c)errs.push(m);}

ok(!!$('#ticker'),'热搜飘屏容器存在');
ok(!!$('#toastBox')&&!!$('#fxBox')&&!!$('#splash'),'演出层容器存在');
ok(d.querySelectorAll('#tabs button').length===8,'标签页 8 个');
ok(!!$('#diffChoices')&&$('#diffChoices').children.length===3,'难度选择渲染 3 项');
ok(!!$('#hallBox'),'名人堂容器存在');
ok($('#talentChoices').children.length===4,'天赋池 4 张');

// 开局
w.chooseDifficulty('hard');
w.chooseBackground('talent');
$('#nameInput').value='测试星';
w.startCareer();
ok(SS() && SS().month===1,'开局成功');
ok(SS().difficulty==='hard','难度写入存档');
ok(!!SS().fandom && !!SS().duel && !!SS().arcs,'扩展状态已初始化');

// 关掉开场弹窗
const firstBtn=$('#modalOptions button'); if(firstBtn)firstBtn.click();

// 逐个标签页渲染
for(const t of ['schedule','projects','team','relations','fandom','trends','rank','log']){
  try{ w.switchTab(t); ok($('#panel').innerHTML.length>20, `标签「${t}」渲染成功`);}catch(e){errs.push(`标签 ${t} 渲染异常: `+e.message)}
}

// 粉圈面板按钮全部有对应函数
w.switchTab('fandom');
const fanBtns=[...d.querySelectorAll('.fan-btn')];
ok(fanBtns.length===7,'粉圈操作 7 个');
SS().cash=500;
for(const b of fanBtns){ const k=b.getAttribute('onclick').match(/'(\w+)'/)[1];
  try{ SS().energy=4; w.fanAct(k);}catch(e){errs.push('fanAct '+k+' 异常: '+e.message)} }
ok(true,'粉圈 7 个操作全部可执行');

// 擂台完整跑一场
try{
  SS().energy=4; SS().duel.next=SS().month; w.actChallenge();
  let guard=0;
  while(d.querySelector('#modalOptions button') && guard++<40){
    const bs=[...d.querySelectorAll('#modalOptions button')].filter(b=>!b.disabled);
    if(!bs.length)break; bs[0].click();
  }
  ok(SS().duel.wins+SS().duel.losses>=1,'宿敌擂台完整跑通一场');
}catch(e){errs.push('擂台异常: '+e.message)}

// 狗仔潜行
try{ w.paparazziChase('测试');
  let guard=0;
  while(d.querySelector('#modalOptions button') && guard++<20){
    const bs=[...d.querySelectorAll('#modalOptions button')].filter(b=>!b.disabled);
    if(!bs.length)break; bs[0].click(); }
  ok(SS().paparazzi.caught+SS().paparazzi.escaped>=1,'狗仔潜行小游戏跑通');
}catch(e){errs.push('狗仔异常: '+e.message)}

// 演出函数
try{ w.toast('测试','good'); w.splash('测试','子标题','good'); w.starfall(6); w.tickerPush('#测试#','gold'); w.shake(2);
  ok(d.querySelectorAll('#toastBox .toast').length>=1,'Toast 生效');
  ok(d.querySelectorAll('#fxBox .fx-star').length>=6,'星光粒子生效');
  ok(d.querySelectorAll('#tickerTrack .tick').length>=1,'热搜飘屏生效');
  ok($('#splash').className.includes('show'),'全屏闪卡生效');
}catch(e){errs.push('演出层异常: '+e.message)}

// 跑 36 个月（自动点第一个可用选项）
try{
  let guard=0;
  while(!SS().over && SS().month<=36 && guard++<400){
    SS().energy=0; w.endMonth();
    let g2=0;
    while(d.querySelector('#mask.show') && g2++<60){
      const bs=[...d.querySelectorAll('#modalOptions button')].filter(b=>!b.disabled);
      if(!bs.length)break; bs[Math.floor(Math.random()*bs.length)].click();
    }
    if(d.querySelector('#ending.show'))break;
  }
  ok(SS().over||SS().month>36,`跑到终局（第${SS().month}月，${SS().endData?SS().endData.title:'-'}）`);
  ok($('#endCard').innerHTML.includes('生涯名人堂'),'结算卡含名人堂');
  ok($('#endCard').innerHTML.includes('宿敌战绩'),'结算卡含擂台战绩');
}catch(e){errs.push('通关流程异常: '+e.message)}

// 名人堂写入 localStorage
try{ const meta=JSON.parse(w.localStorage.getItem('celebrity_sim_meta_v1'));
  ok(meta&&meta.hall&&meta.hall.length>=1,'名人堂已写入本地存档');
  ok(!!meta.legacy,'传承数据已生成');
}catch(e){errs.push('meta 异常: '+e.message)}

console.log(log.join('\n'));
console.log('\n未捕获错误:', errs.length?('\n  - '+errs.join('\n  - ')):'无');
process.exit(errs.length?1:0);

console.log('star dom test passed');

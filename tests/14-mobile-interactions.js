const fs=require('fs'),path=require('path'),{JSDOM,VirtualConsole}=require('jsdom');
const {ok,done}=require('./lib').runner('手机页面与重开导航');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
for(const legacy of [false,true]){
 const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
 const dom=new JSDOM(html,{runScripts:'dangerously',url:'http://localhost/',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){
  w.matchMedia=()=>({matches:true});w.HTMLElement.prototype.scrollIntoView=function(){};w.HTMLCanvasElement.prototype.getContext=()=>null;
  w.localStorage.setItem('jbzh_meta',JSON.stringify({runs:1,exp:600}));if(legacy)w.MutationObserver=undefined;
 }}),w=dom.window,G=w.BankGame,$=s=>w.document.querySelector(s),tag=legacy?'兼容模式':'标准模式';
 const close=()=>$('#mOpts button').click();
 $('#guideGallery').click();
 ok(tag+'首页图鉴位于开屏上层',Number(w.getComputedStyle($('#mask')).zIndex)>Number(w.getComputedStyle($('#gameGuide')).zIndex)&&$('#gameGuide').inert);
 w.galTab('ach');ok(tag+'长图鉴只使用弹窗一层滚动',w.getComputedStyle($('.gallist')).maxHeight==='none'&&w.getComputedStyle($('.gallist')).overflow==='visible');
 close();ok(tag+'关闭图鉴回开屏且无存档生成',$('#gameGuide').classList.contains('show')&&!$('#gameGuide').inert&&!$('#mask').classList.contains('show')&&!w.localStorage.getItem('jbzh_save6'));
 $('.guide-start').click();$('#nameInput').value='手机回归';close();$('#mOpts button').click();
 while(/经营方向已确定|天赋已生效/.test($('#mTitle').textContent))close();
 if(/开局天赋/.test($('#mTitle').textContent)){close();close();}close();
 for(const [tab,label] of [['outlets','网点'],['team','团队'],['npc','关系'],['strategy','经营'],['loans','贷款'],['rank','排行'],['log','日志']]){
  w.switchTab(tab);ok(tag+label+'页切换后没有图标占位文字',!$('#panel').textContent.includes('[icon:'));
 }
 let s=G.getState();s.cash=2000;s.month=7;s.dep=42.5;w.renderAll();
 $('#btnRestart').click();$('#mOpts button:last-child').click();ok(tag+'取消重开保留原年限与进度',G.getState()===s&&s.month===7&&s.dep===42.5&&!$('#gameGuide').classList.contains('show'));
 $('#btnRestart').click();close();
 ok(tag+'确认重开回开屏,清除旧局与旧队列',G.getState()===null&&$('#gameGuide').classList.contains('show')&&!$('#mask').classList.contains('show')&&!w.localStorage.getItem('jbzh_save6'));
 $('#guideGallery').click();close();ok(tag+'重开后查看图鉴不复活旧存档',G.getState()===null&&!w.localStorage.getItem('jbzh_save6'));
 $('#termSelect').value='72';$('.guide-start').click();
 ok(tag+'重选六年再进入取名路线流程',G.endM()===72&&$('#nameInput')&&$('#mTitle').textContent==='上任报到');
 $('#nameInput').value='六年新局';close();ok(tag+'取名后仍有四条路线',$('#mTitle').textContent==='定个打法'&&$('#mOpts').children.length===4);
 $('#mOpts button').click();while(/经营方向已确定|天赋已生效/.test($('#mTitle').textContent))close();
 if(/开局天赋/.test($('#mTitle').textContent)){close();close();}close();
 s=G.getState();s.month=72;w.showEnd('稳字当头','验收结局。',true);
 ok(tag+'结局与成就提示无需等待观察器转换图标',!$('#endCard').textContent.includes('[icon:')&&!$('#toastBox').textContent.includes('[icon:'));
 ok(tag+'结局同步锁定背景',$('#app').inert&&w.document.documentElement.classList.contains('bank-overlay-open'));
 $('#endCard button[onclick="showGallery()"]').click();
 ok(tag+'结局图鉴位于结局上层',Number(w.getComputedStyle($('#mask')).zIndex)>Number(w.getComputedStyle($('#endScreen')).zIndex)&&$('#endScreen').inert);
 w.galTab('tal');const unlock=$('#mBody button[onclick^="unlockTalent"]');unlock.click();close();close();
 ok(tag+'天赋解锁可返回图鉴再回结局',$('#endScreen').classList.contains('show')&&!$('#endScreen').inert&&!$('#mask').classList.contains('show'));
 $('#endCard button[onclick="restartGame()"]').click();ok(tag+'结局重开也回开屏',G.getState()===null&&$('#gameGuide').classList.contains('show'));
 $('#guideGallery').click();w.galTab('chal');$('#seedInput').value='手机验收';$('#mBody button[onclick="startChallenge(\'sutong\')"]').click();
 ok(tag+'开屏挑战入口隐藏开屏并保留挑战规则',!$('#gameGuide').classList.contains('show')&&$('#mask').classList.contains('show')&&G.endM()===24&&G.getState().seed==='手机验收');
 ok(tag+'全程零运行异常',errors.length===0);dom.window.close();
}
done();

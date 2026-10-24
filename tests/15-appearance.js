const fs=require('fs'),path=require('path'),assert=require('assert'),{JSDOM,VirtualConsole}=require('jsdom');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8'),css=fs.readFileSync(path.join(__dirname,'../styles/grand-banking.css'),'utf8');
const {ok,done}=require('./lib').runner('多主题外观与偏好保存');
function boot(saved={},blocked=false,writeDenied=false){
 const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
 const dom=new JSDOM(html,{url:'http://localhost/',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){
  w.matchMedia=()=>({matches:false});w.HTMLElement.prototype.scrollIntoView=()=>{};
  for(const [key,value]of Object.entries(saved))w.localStorage.setItem(key,value);
  if(blocked)Object.defineProperty(w,'localStorage',{get(){throw new Error('Storage denied');}});
  if(writeDenied)w.Storage.prototype.setItem=function(){throw new Error('Quota exceeded');};
 }});return {dom,w:dom.window,d:dom.window.document,errors};
}
const ids=['emerald','sapphire','burgundy','plum','obsidian','paper'];
const meta=JSON.stringify({runs:0,exp:321,achs:{a_dep20:123},talents:['laoling','beishui','jiubu']});
const b=boot({jbzh_meta:meta,jbzh_name:'原有名字'}),{w,d}=b,G=w.BankGame,$=s=>d.querySelector(s);
ok('首次打开默认翡翠鎏金',d.documentElement.getAttribute('data-bank-theme')==='emerald');
$('#guideThemeButton').click();ok('开屏无需开始新局也能选择六套外观',d.querySelectorAll('.theme-option').length===6&&$('#mask').classList.contains('show'));
$('#mOpts button').click();ok('外观设置关闭后回开屏',!$('#mask').classList.contains('show')&&$('#gameGuide').classList.contains('show'));
const state=G.initialState();G.setState(state);$('#gameGuide').classList.remove('show');w.renderAll();w.showSettings();
const snapshot=JSON.stringify(G.getState()),save=w.localStorage.getItem('jbzh_save6');
G.setSeed('appearance-rng');const expected=G.genCandidates();G.setSeed('appearance-rng');
for(const id of ids){
 $('.modal').scrollTop=120;d.querySelector('[data-bank-theme-option="'+id+'"]').click();
 ok(id+'即时切换并独立保存',d.documentElement.getAttribute('data-bank-theme')===id&&w.localStorage.getItem('jbzh_theme')===id);
 ok(id+'选中态唯一且设置保持打开',d.querySelectorAll('.theme-option[aria-pressed="true"]').length===1&&$('#mask').classList.contains('show')&&$('.modal').scrollTop===120);
 ok(id+'不修改经营状态、存档或图鉴',JSON.stringify(G.getState())===snapshot&&w.localStorage.getItem('jbzh_save6')===save&&w.localStorage.getItem('jbzh_meta')===meta&&w.localStorage.getItem('jbzh_name')==='原有名字');
}
ok('外观切换不消耗经营随机数',JSON.stringify(G.genCandidates())===JSON.stringify(expected));
ok('非法主题不能改变当前外观',w.setBankTheme('__proto__')===false&&d.documentElement.getAttribute('data-bank-theme')==='paper');
w.setBankTheme('obsidian');w.restartGame();ok('重开后外观仍保留',w.localStorage.getItem('jbzh_theme')==='obsidian'&&d.documentElement.getAttribute('data-bank-theme')==='obsidian'&&$('#guideThemeButton').textContent.includes('曜石黑金'));
ok('原有制作人和推广文案仍在',Array.from(d.querySelectorAll('.creator-contact')).every(e=>e.textContent.includes('制作人 大老师 · 微信：lynchrrr')&&e.textContent.includes('模拟游戏大全')));
ok('标准环境无运行错误',b.errors.length===0);b.dom.window.close();
for(const id of ids){const x=boot({jbzh_theme:id});ok(id+'刷新后在启动前恢复外观',x.d.documentElement.getAttribute('data-bank-theme')===id&&x.d.querySelector('#guideThemeButton').textContent.includes(id==='paper'?'经典纸墨':({emerald:'翡翠鎏金',sapphire:'深海藏蓝',burgundy:'绯红典藏',plum:'紫檀夜宴',obsidian:'曜石黑金'})[id])&&x.errors.length===0);x.dom.window.close();}
const invalid=boot({jbzh_theme:'removed-theme'});ok('失效偏好安全回退默认主题',invalid.d.documentElement.getAttribute('data-bank-theme')==='emerald'&&invalid.errors.length===0);invalid.dom.window.close();
for(const [blocked,writeDenied]of [[true,false],[false,true]]){const x=boot({},blocked,writeDenied);x.w.showSettings();x.d.querySelector('[data-bank-theme-option="burgundy"]').click();ok('存储'+(blocked?'被禁止':'写入失败')+'时仍可换肤',x.d.documentElement.getAttribute('data-bank-theme')==='burgundy'&&x.d.querySelector('#bankThemeStatus').textContent.includes('无法记住外观')&&x.errors.length===0);x.dom.window.close();}
function luminance(hex){const v=hex.slice(1).match(/../g).map(x=>parseInt(x,16)/255).map(x=>x<=0.04045?x/12.92:((x+0.055)/1.055)**2.4);return v[0]*0.2126+v[1]*0.7152+v[2]*0.0722;}
function contrast(a,b){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05);}
for(const id of ids.filter(x=>x!=='paper')){const block=css.match(new RegExp('html\\[data-bank-theme="'+id+'"\\] \\.pm-ui\\{([\\s\\S]*?)\\}'))[1],colors=Object.fromEntries(Array.from(block.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{6})/g),m=>[m[1],m[2]]));const ratios=[contrast(colors.txt,colors.card),contrast(colors.dim,colors.card),contrast(colors['on-ink'],colors.ink),contrast(colors['ink-muted'],colors.ink2)];ok(id+'正文和深色按钮文字对比度达标',ratios.every(n=>n>=4.5));}
ok('外观样式与独立源同步',html.match(/<style id="bankAppearanceTheme">([\s\S]*?)<\/style>/)[1].trim()===css.trim());
ok('两个单文件入口同步',html===fs.readFileSync(path.join(__dirname,'../模拟银行.html'),'utf8'));
done();

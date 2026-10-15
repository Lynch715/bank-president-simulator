const fs=require('fs'),path=require('path'),assert=require('assert'),acorn=require('acorn');
const {JSDOM,VirtualConsole}=require('jsdom');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
let count=0;
function test(name,fn){fn();count++;console.log('  ✓ '+name);}
function boot({source=html,env={},saved={},blocked=false,writeBlocked=false}={}){
 const errors=[],console=new VirtualConsole();console.on('jsdomError',e=>{if(!/navigation.*not implemented/i.test(e.message))errors.push(e.message);});
 const dom=new JSDOM(source,{url:'http://localhost/',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:console,beforeParse(w){
  w.matchMedia=()=>({matches:false});w.HTMLElement.prototype.scrollIntoView=()=>{};
  w.HTMLCanvasElement.prototype.getContext=()=>null;
  for(const key of Object.keys(saved))w.localStorage.setItem(key,saved[key]);
  if(blocked)Object.defineProperty(w,'localStorage',{get(){throw new w.DOMException('Storage denied','SecurityError');}});
  else if(writeBlocked)w.Storage.prototype.setItem=function(){throw new w.DOMException('Quota exceeded','QuotaExceededError');};
  if(env.legacy){w.matchMedia=undefined;w.MutationObserver=undefined;w.Text.prototype.replaceWith=undefined;w.document.createTreeWalker=undefined;w.requestAnimationFrame=undefined;}
  if(env.noSVG)w.document.createElementNS=function(){throw new Error('SVG DOM unavailable');};
  if(env.noGlobal)w.globalThis=undefined;
  if(env.noFocusOptions){const focus=w.HTMLElement.prototype.focus;w.HTMLElement.prototype.focus=function(options){if(options)throw new Error('focus options unavailable');return focus.call(this);};}
 }});
 const w=dom.window,d=w.document;
 return {dom,w,d,errors,close:()=>dom.window.close()};
}
function start(b){const {w,d}=b;d.querySelector('.guide-start').click();d.querySelector('#nameInput').value='安卓测试';d.querySelector('#mOpts button').click();d.querySelector('#mOpts button').click();while(/经营方向已确定|天赋已生效/.test(d.querySelector('#mTitle').textContent))d.querySelector('#mOpts button').click();if(/上任第一天/.test(d.querySelector('#mTitle').textContent))d.querySelector('#mOpts button').click();return w.BankGame.getState();}
function playable(b){assert.equal(b.d.documentElement.getAttribute('data-boot'),'ready');assert.equal(b.d.querySelectorAll('#statBar .stat').length,6);assert.equal(b.d.querySelectorAll('#actionBar .act').length,6);assert(!b.d.querySelector('#app').textContent.includes('[icon:'));assert.deepEqual(b.errors,[]);}
test('启动保护可按 ES5、游戏主脚本可按 ES2019 解析',()=>{for(const m of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))acorn.parse(m[1],{ecmaVersion:m[0].startsWith('<script id="bankBootGuard"')?5:2019});});
test('首次打开显示引导，启动遮罩正确关闭',()=>{const b=boot();assert(b.d.querySelector('#gameGuide').classList.contains('show'));assert(b.d.querySelector('#bankBootStatus').hidden);assert.equal(b.d.documentElement.getAttribute('data-boot'),'ready');assert.deepEqual(b.errors,[]);b.close();});
let legacy;
test('缺少可选浏览器接口仍能开局、招聘、拜访和月结',()=>{
 const b=boot({env:{legacy:true,noGlobal:true}}),s=start(b);playable(b);
 b.w.switchTab('npc');assert.equal(b.d.querySelectorAll('#panel .person-portrait').length,6);
 b.w.doSocial('wei','drink');assert(b.d.querySelector('.decision-receipt'));assert.equal(b.d.querySelector('#app').inert,true);b.d.querySelector('#mOpts button').click();assert.equal(b.d.querySelector('#app').inert,false);
 b.w.actHire();assert.equal(b.d.querySelectorAll('#mOpts img').length,3);b.d.querySelector('#mOpts button').click();b.d.querySelector('#mOpts button').click();
 b.w.switchTab('team');assert.equal(b.d.querySelectorAll('#panel .person-portrait').length,3);
 b.w.BankGame.getState().energy=0;b.d.querySelector('#btnEnd').click();let n=0;while(b.d.querySelector('#mask').classList.contains('show')&&n++<30){const button=b.d.querySelector('#mOpts button:not(:disabled)');assert(button);button.click();}
 assert.equal(s.month,2);playable(b);legacy=JSON.parse(JSON.stringify(s));b.close();
});
test('SVG DOM 失败只降级图标，经营台账仍正常启动',()=>{const b=boot({env:{noSVG:true}});start(b);playable(b);assert(b.d.querySelector('#actionBar').textContent.includes('跑业务'));b.close();});
test('旧浏览器不接受 focus 选项时仍能操作弹窗',()=>{const b=boot({env:{noFocusOptions:true}});start(b);b.w.focusBankElement(b.d.querySelector('#btnGallery'));playable(b);b.close();});
test('localStorage getter 被禁止时仍可开始经营并显示保存提示',()=>{const b=boot({blocked:true});const s=start(b);b.d.querySelector('#actionBar button').click();assert.equal(s.energy,2);assert(!b.d.querySelector('#bankStorageNotice').hidden);playable(b);b.close();});
test('存储额度耗尽时不阻断开局与决策',()=>{const b=boot({writeBlocked:true});const s=start(b);b.d.querySelector('#actionBar button').click();assert.equal(s.energy,2);assert(!b.d.querySelector('#bankStorageNotice').hidden);playable(b);b.close();});
test('后期旧档缺少非关键界面字段且无 Canvas 时仍能恢复',()=>{const s=JSON.parse(JSON.stringify(legacy));s.ver=5;s.month=90;s.career=null;s.tab='team';delete s.lastDelta;delete s.socialed;delete s.log;const b=boot({saved:{jbzh_save5:JSON.stringify(s)},env:{legacy:true}});assert.equal(b.w.BankGame.getState().month,90);assert.equal(b.w.BankGame.getState().cash,s.cash);playable(b);b.w.drawTrend(b.d.createElement('canvas'));b.close();});
for(const [name,raw] of [['损坏 JSON','{broken-save'],['无效结构','{"ver":6,"month":1}'],['错误存档类型','[]']])test(name+'显示恢复入口且不覆盖存档',()=>{const b=boot({saved:{jbzh_save6:raw}});assert.equal(b.d.documentElement.getAttribute('data-boot'),'error');assert(!b.d.querySelector('#bankBootStatus').hidden);assert(!b.d.querySelector('#gameGuide').classList.contains('show'));assert.equal(b.w.BankGame.getState(),null);assert.equal(b.w.localStorage.getItem('jbzh_save6'),raw);b.w.save();assert.equal(b.w.localStorage.getItem('jbzh_save6'),raw);b.w.BANK_BOOT.exportSaves();assert.equal(JSON.parse(b.d.querySelector('#bankBootBackupText').value).storage.jbzh_save6,raw);assert.deepEqual(b.errors,[]);b.close();});
test('主脚本发生语法错误时独立错误界面仍可导出原始存档',()=>{const raw=JSON.stringify(legacy),source=html.replace(/<script>[\s\S]*?<\/script>/,'<script>function {</script>'),b=boot({source,saved:{jbzh_save6:raw}});assert.equal(b.d.documentElement.getAttribute('data-boot'),'error');assert(b.d.querySelector('#bankBootDiagnostic').value.includes('SyntaxError'));assert(!b.d.querySelector('#bankBootStatus').hidden);b.w.BANK_BOOT.exportSaves();assert.equal(JSON.parse(b.d.querySelector('#bankBootBackupText').value).storage.jbzh_save6,raw);assert.equal(b.w.localStorage.getItem('jbzh_save6'),raw);b.close();});
test('主脚本运行时异常也显示具体错误，不留下空白台账',()=>{const source=html.replace('<script>\n"use strict";','<script>\nthrow new Error("startup-fixture-failure");\n"use strict";'),b=boot({source});assert.equal(b.d.documentElement.getAttribute('data-boot'),'error');assert(b.d.querySelector('#bankBootDiagnostic').value.includes('startup-fixture-failure'));b.close();});
test('暂时禁用 Canvas 时传记显示可读提示而不崩溃',()=>{const b=boot();start(b);b.d.querySelector('#endCard').innerHTML='<div id="bioBox"></div>';b.w.makeBio();assert(b.d.querySelector('#bioBox').textContent.includes('经营进度不受影响'));assert.deepEqual(b.errors,[]);b.close();});
test('两个入口和样式源保持同步',()=>{assert.equal(html,fs.readFileSync(path.join(__dirname,'../模拟银行.html'),'utf8'));assert.equal(html.match(/<style id="paperLedgerTheme">([\s\S]*?)<\/style>/)[1].trim(),fs.readFileSync(path.join(__dirname,'../styles/paper-ledger.css'),'utf8').trim());});
console.log('\n✅ 安卓启动兼容:'+count+' 项全部通过');

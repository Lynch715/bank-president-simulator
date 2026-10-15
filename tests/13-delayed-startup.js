const fs=require('fs'),path=require('path'),assert=require('assert');
const {JSDOM,VirtualConsole}=require('jsdom');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const engine=html.match(/<script id="bankGameCode">([\s\S]*?)<\/script>/),art=html.match(/<script type="application\/json" id="bankPortraitData">([\s\S]*?)<\/script>/);
let total=0;const test=(name,fn)=>{fn();total++;console.log('  ✓ '+name);};
function fixture({lateMain=false,raw=null}={}){
 const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));let timeout;
 let source=html.replace(art[0],'').replace(/<script id="bankPortraitReady">[\s\S]*?<\/script>/,'');
 if(lateMain)source=source.replace(engine[0],'<script type="text/plain" id="bankGameCode">'+engine[1]+'</script>');
 const dom=new JSDOM(source,{url:'http://localhost/',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){
  const set=w.setTimeout.bind(w),clear=w.clearTimeout.bind(w);w.setTimeout=(fn,ms)=>ms===15000?(timeout=fn,1000000):set(fn,ms);w.clearTimeout=id=>id===1000000?undefined:clear(id);
  w.matchMedia=()=>({matches:false});w.HTMLElement.prototype.scrollIntoView=()=>{};w.HTMLCanvasElement.prototype.getContext=()=>null;
  if(raw!==null)w.localStorage.setItem('jbzh_save6',raw);
 }}),w=dom.window,d=w.document;
 function runMain(){const pending=d.querySelector('#bankGameCode'),node=d.createElement('script');node.id='bankGameCode';node.textContent=pending.textContent;pending.parentNode.replaceChild(node,pending);}
 function sendArt(text=art[1]){const node=d.createElement('script');node.type='application/json';node.id='bankPortraitData';node.textContent=text;d.body.appendChild(node);w.hydrateBankPortraits();}
 return {dom,w,d,errors,expire:()=>timeout(),runMain,sendArt,close:()=>dom.window.close()};
}
function start(b){const {d}=b;d.querySelector('.guide-start').click();d.querySelector('#nameInput').value='慢速验收';d.querySelector('#mOpts button').click();d.querySelector('#mOpts button').click();while(/经营方向已确定|天赋已生效/.test(d.querySelector('#mTitle').textContent))d.querySelector('#mOpts button').click();d.querySelector('#mOpts button').click();}
test('约800KB立绘数据不在可执行主脚本中，主脚本小于300KB',()=>{assert(Buffer.byteLength(engine[1])<300000);assert(!engine[1].includes('UklGRpRa'));assert(html.indexOf(engine[0])+engine[0].length<html.indexOf(art[0]));assert.equal(Object.keys(JSON.parse(art[1])).length,23);});
test('15秒等待提示不锁死，稍后主脚本到达自动启动',()=>{const b=fixture({lateMain:true});assert(!b.w.BankGame);b.expire();assert.equal(b.d.documentElement.dataset.boot,'waiting');assert.equal(b.w.BANK_BOOT.failed(),false);assert(b.d.querySelector('#bankBootDiagnostic').value.includes('等待主脚本'));b.runMain();assert.equal(b.d.documentElement.dataset.boot,'ready');assert.equal(b.d.documentElement.dataset.bootRecovered,'true');assert(b.d.querySelector('#gameGuide').classList.contains('show'));assert(b.d.querySelector('#bankBootStatus').hidden);assert.deepEqual(b.errors,[]);b.close();});
let saved;
test('主脚本可在立绘数据尚未收到时完成上任与经营',()=>{const b=fixture();assert.equal(b.d.documentElement.dataset.boot,'ready');start(b);b.w.switchTab('npc');assert.equal(b.d.querySelectorAll('#panel img[data-portrait-key]').length,6);assert([...b.d.querySelectorAll('#panel img')].every(img=>img.getAttribute('src').startsWith('assets/portraits/web/')));b.w.doSocial('wei','drink');assert(b.d.querySelector('.decision-receipt'));saved=JSON.stringify(b.w.BankGame.getState());assert.deepEqual(b.errors,[]);b.close();});
test('主脚本延后收到时仍恢复原进度，不转入新局',()=>{const b=fixture({lateMain:true,raw:saved});b.expire();assert.equal(b.w.localStorage.getItem('jbzh_save6'),saved);b.runMain();const old=JSON.parse(saved),now=b.w.BankGame.getState();assert.equal(now.playerName,old.playerName);assert.equal(now.dep,old.dep);assert.equal(now.energy,old.energy);assert.equal(b.d.documentElement.dataset.boot,'ready');assert.equal(b.d.querySelectorAll('#statBar .stat').length,6);assert(!b.d.querySelector('#gameGuide').classList.contains('show'));b.close();});
test('立绘数据延迟不触发启动超时，稍后到达自动补图',()=>{const b=fixture();start(b);b.w.switchTab('team');const before=JSON.stringify(b.w.BankGame.getState());b.expire();assert.equal(b.d.documentElement.dataset.boot,'ready');b.sendArt();assert.equal(b.d.documentElement.dataset.portraits,'ready');assert([...b.d.querySelectorAll('#panel img')].every(img=>img.getAttribute('src').startsWith('data:image/webp;base64,')));assert.equal(JSON.stringify(b.w.BankGame.getState()),before);assert.deepEqual(b.errors,[]);b.close();});
test('嵌入数据不完整时继续使用独立图片，经营仍可操作',()=>{const b=fixture();start(b);b.sendArt('{incomplete');assert.equal(b.d.documentElement.dataset.portraits,'external');assert.equal(b.d.documentElement.dataset.boot,'ready');b.d.querySelector('#actionBar button').click();assert(b.d.querySelector('.decision-receipt'));assert.deepEqual(b.errors,[]);b.close();});
test('图片请求先失败时能使用稍后到达的内嵌数据',()=>{const b=fixture();start(b);b.w.switchTab('team');const img=b.d.querySelector('#panel img');b.w.useEmbeddedPortrait(img);b.sendArt();assert(img.getAttribute('src').startsWith('data:image/webp;base64,'));assert.equal(b.d.documentElement.dataset.boot,'ready');b.close();});
test('真实存档错误仍保持阻断，迟到与ready不能掩盖错误',()=>{const raw='{broken-save',b=fixture({lateMain:true,raw});b.expire();b.runMain();b.w.BANK_BOOT.ready();assert.equal(b.d.documentElement.dataset.boot,'error');assert.equal(b.w.BANK_BOOT.failed(),true);assert.equal(b.w.localStorage.getItem('jbzh_save6'),raw);assert(!b.d.querySelector('#bankBootStatus').hidden);b.close();});
test('脱网单文件包含完整内嵌图，源WebP逐字节一致',()=>{const portraits=JSON.parse(art[1]);for(const [key,value]of Object.entries(portraits))assert.deepEqual(Buffer.from(value.split(',')[1],'base64'),fs.readFileSync(path.join(__dirname,'../assets/portraits/web',key+'.webp')));});
console.log('\n✅ 延迟启动与立绘分离:'+total+' 项全部通过');

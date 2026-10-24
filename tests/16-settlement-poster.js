// Real PNG rendering plus ending/retry/download/share lifecycle, using isolated storage only.
const fs=require('fs'),path=require('path'),assert=require('assert');
const {JSDOM,VirtualConsole}=require('jsdom'),{createCanvas,Image,GlobalFonts}=require('@napi-rs/canvas');
const {ok,done}=require('./lib').runner('结算分享海报');
const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
if(fs.existsSync('/System/Library/Fonts/STHeiti Medium.ttc'))GlobalFonts.registerFromPath('/System/Library/Fonts/STHeiti Medium.ttc','PingFang SC');
const out=path.join(__dirname,'out');fs.mkdirSync(out,{recursive:true});
function boot(options={}){
  const errors=[],texts=[],downloads=[],blobs=new Map(),revoked=[],shares=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
  let canvasEnabled=options.canvas!==false,serial=0;
  const dom=new JSDOM(html,{url:'http://localhost/',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){
    w.matchMedia=()=>({matches:false});w.HTMLElement.prototype.scrollIntoView=()=>{};
    w.Image=options.brokenImages?function(){Object.defineProperty(this,'src',{set:()=>w.setTimeout(()=>this.onerror&&this.onerror(),0)});}:Image;
    w.HTMLCanvasElement.prototype.getContext=function(){
      if(!canvasEnabled)return null;
      if(!this._native){this._native=createCanvas(this.width,this.height);const c=this._native.getContext('2d'),raw=c.fillText.bind(c);c.fillText=(s,...args)=>{texts.push(String(s));return raw(s,...args);};}
      return this._native.getContext('2d');
    };
    w.HTMLCanvasElement.prototype.toBlob=function(callback){
      if(options.encoder==='throw')throw new Error('encoder unavailable');
      if(options.encoder==='null'){callback(null);return;}
      if(options.encoder==='hang')return;
      const blob=new w.Blob([this._native.toBuffer('image/png')],{type:'image/png'});w.setTimeout(()=>callback(blob),5);
    };
    if(options.encoder==='missing')w.HTMLCanvasElement.prototype.toBlob=undefined;
    w.HTMLCanvasElement.prototype.toDataURL=function(){return this._native.toDataURL('image/png');};
    w.URL.createObjectURL=blob=>{if(options.url==='throw')throw new Error('Object URL unavailable');const id='blob:test-'+(++serial);blobs.set(id,blob);return id;};w.URL.revokeObjectURL=id=>revoked.push(id);
    if(options.url==='missing')w.URL.createObjectURL=undefined;
    w.HTMLAnchorElement.prototype.click=function(){if(options.downloadThrows)throw new Error('download unavailable');downloads.push({href:this.href,name:this.download});};
    if(options.noDownload)delete w.HTMLAnchorElement.prototype.download;
    if(options.share){w.navigator.canShare=()=>{if(options.share==='capabilityThrows')throw new Error('not permitted');return options.share!=='unsupported';};w.navigator.share=data=>{shares.push(data);return options.share==='abort'?Promise.reject({name:'AbortError'}):options.share==='error'?Promise.reject(new Error('share failed')):Promise.resolve();};}
    if(options.noFile)w.File=undefined;
    if(options.noReader)w.FileReader=undefined;
    if(options.noBlob)w.Blob=undefined;
    if(options.fastTimeout){const set=w.setTimeout.bind(w);w.setTimeout=(fn,ms)=>set(fn,ms===2500?50:ms);}
    w.localStorage.setItem('jbzh_name','原名');w.localStorage.setItem('jbzh_theme','sapphire');
  }}),w=dom.window,d=w.document,G=w.BankGame;
  function end({months=120,term=120,title='北疆之王',failed=false,name='林知远'}={}){
    const s=G.initialState();s.month=months;s.maxMonth=term;s.playerName=name;s.route='retail';s.dep=88.8;s.failed=failed;s.track.loanTotal=16.7;
    G.setState(s);d.querySelector('#gameGuide').classList.remove('show');w.showEnd(title,'这一局的江北故事。',!failed);return s;
  }
  return {dom,w,d,G,end,errors,texts,downloads,blobs,revoked,shares,enableCanvas:()=>{canvasEnabled=true;},close:()=>dom.window.close()};
}
async function until(fn){for(let i=0;i<100;i++){if(fn())return;await new Promise(r=>setTimeout(r,25));}throw new Error('timed out waiting for poster');}
const ready=b=>until(()=>!b.d.querySelector('#posterSave').disabled);
async function saveBlob(b,file){const src=b.d.querySelector('#posterPreview').src,bytes=Buffer.from(src.split(',')[1],'base64');fs.writeFileSync(path.join(out,file),bytes);return bytes;}
module.exports={boot,ready,until};
if(require.main===module)(async()=>{
  ok('两个单文件入口同步',html===fs.readFileSync(path.join(root,'模拟银行.html'),'utf8'));
  ok('独立海报脚本与内嵌源同步',html.match(/<script id="bankSettlementCode">([\s\S]*?)<\/script>/)[1].trim()===fs.readFileSync(path.join(root,'scripts/settlement-poster.js'),'utf8').trim());
  const payload=JSON.parse(html.match(/<script type="application\/json" id="bankSettlementData">([\s\S]*?)<\/script>/)[1]);
  for(const [key,name]of [['background','background.jpg'],['qr','game-qr.png']])ok(key+'单文件离线图片与素材字节一致',Buffer.from(payload[key].split(',')[1],'base64').equals(fs.readFileSync(path.join(root,'assets/settlement',name))));
  const main=html.match(/<script id="bankGameCode">([\s\S]*?)<\/script>/)[1];
  ok('主脚本仍小于300KB，图片数据位于启动代码之后',Buffer.byteLength(main)<300000&&html.indexOf('id="bankSettlementData"')>html.indexOf('id="bankPortraitReady"'));
  const b=boot(),s=b.end(),state=JSON.stringify(s),meta=b.w.localStorage.getItem('jbzh_meta');
  b.G.setSeed('poster-pure');const expected=b.w.eval('RNG()');b.G.setSeed('poster-pure');
  await ready(b);
  ok('真正结局自动生成IMG预览和保存按钮',!b.d.querySelector('#posterPreview').hidden&&b.d.querySelector('#posterPreview').tagName==='IMG');
  ok('海报按本局真实结局、姓名、任期和成绩绘制',b.texts.includes('北疆之王')&&b.texts.includes('行长 林知远')&&b.texts.includes('88.8 亿')&&b.texts.includes('120个月')&&b.texts.includes('累计放贷 16.7 亿'));
  ok('不支持图片分享时提供分享方法入口',!b.d.querySelector('#posterShare').hidden&&b.d.querySelector('#posterShare').textContent==='分享方法');
  const png=await saveBlob(b,'settlement-ten-year.png');
  ok('实际编码为1080×1440的PNG',png.subarray(1,4).toString()==='PNG'&&png.readUInt32BE(16)===1080&&png.readUInt32BE(20)===1440);
  b.d.querySelector('#posterSave').click();
  ok('点击保存复用已生成图片，文件名为本局姓名和结局',b.downloads.length===1&&b.downloads[0].name==='林知远的行长结算·北疆之王.png'&&b.blobs.has(b.downloads[0].href));
  ok('提示发起下载而非声称写入手机相册',b.d.querySelector('#posterStatus').textContent.includes('已发起图片下载'));
  await b.w.BankSettlementPoster.show(b.w.settlementSnapshot());await ready(b);
  ok('重复生成回收旧图片URL',b.revoked.length===1);
  ok('生成和下载不修改状态、存档、阅历、图鉴或偏好',JSON.stringify(s)===state&&b.w.localStorage.getItem('jbzh_meta')===meta&&b.w.localStorage.getItem('jbzh_save6')===null&&b.w.localStorage.getItem('jbzh_name')==='原名'&&b.w.localStorage.getItem('jbzh_theme')==='sapphire');
  ok('生成和下载不消耗经营随机数',b.w.eval('RNG()')===expected);
  b.w.restartGame();ok('重开回开屏且回收上一局图片',b.G.getState()===null&&b.d.querySelector('#gameGuide').classList.contains('show')&&b.revoked.length===2);
  b.close();
  for(const term of [24,36,72,120]){
    const x=boot();x.end({months:term,term});await ready(x);const shot=x.w.settlementSnapshot();
    ok(term+'个月结算使用真实任期且标记完成',shot.term===term/12&&shot.months===term&&shot.completed&&x.texts.includes('零售深耕 · '+term/12+'年任期'));
    x.close();
  }
  const early=boot();early.end({months:7,term:72,title:'现金断流',failed:true,name:'很长的行长姓名林知远和他的江北故事'});await ready(early);
  await saveBlob(early,'settlement-early-ending.png');
  ok('失败局如实写实际7个月、6年计划与提前结束',early.w.settlementSnapshot().completed===false&&early.texts.includes('7个月')&&early.texts.includes('零售深耕 · 6年任期')&&early.texts.some(t=>t.startsWith('任期提前结束')));
  ok('长姓名仍保留完整文字，不带HTML或图标标记',early.texts.includes('行长 很长的行长姓名林知远和他的江北故事')&&early.texts.every(t=>!t.includes('[icon:')));early.close();
  const political=boot();political.end({months:36,term:36,title:'组织处理'});await ready(political);ok('组织处理即使到任期末也不写任期完成',!political.w.settlementSnapshot().completed);political.close();
  for(const share of ['ok','abort','error','unsupported']){
    const x=boot({share});x.end();await ready(x);const button=x.d.querySelector('#posterShare');
    ok(share+'分享入口按能力显示对应操作',!button.hidden&&button.textContent===(share==='unsupported'?'分享方法':'系统分享'));
    if(share!=='unsupported'){
      const before=x.w.localStorage.getItem('jbzh_meta');button.click();await until(()=>!button.disabled);
      ok(share+'分享传递真实PNG文件，取消和失败仍可保存',x.shares[0].files[0].type==='image/png'&&x.shares[0].files[0].size>10000&&!x.d.querySelector('#posterSave').disabled&&x.w.localStorage.getItem('jbzh_meta')===before);
      if(share==='abort')ok('取消系统分享不自动下载或声称分享成功',x.downloads.length===0&&x.d.querySelector('#posterStatus').textContent.includes('已取消分享'));
    }x.close();
  }
  const broken=boot({brokenImages:true});broken.end();await ready(broken);ok('底图或二维码不可用时仍能生成文字结算海报',broken.texts.includes('北疆之王')&&broken.errors.length===0);broken.close();
  const none=boot({canvas:false});none.end();await until(()=>!none.d.querySelector('#posterRetry').hidden);
  ok('Canvas不可用时显示重试且原成绩、图鉴和重开仍可达',none.d.querySelector('.egrid').textContent.includes('88.8亿')&&none.d.querySelector('.endbtns button')&&none.errors.length===0);
  const settled=none.w.localStorage.getItem('jbzh_meta');none.enableCanvas();none.d.querySelector('#posterRetry').click();await ready(none);
  ok('失败后重试成功且不重复结算或加阅历',none.w.localStorage.getItem('jbzh_meta')===settled);none.close();
  const stale=boot();stale.end();stale.w.restartGame();await new Promise(r=>setTimeout(r,100));
  ok('异步生成途中重开不插入旧海报、不泄漏Blob URL',stale.G.getState()===null&&stale.blobs.size===0&&stale.d.querySelector('#posterPreview').hidden&&stale.errors.length===0);stale.close();
  done();
})().catch(e=>{console.error(e);process.exitCode=1;});

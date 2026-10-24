const assert=require('assert');
const {boot,ready,until}=require('./16-settlement-poster');
const {ok,done}=require('./lib').runner('手机海报保存与分享兼容');
function imageBytes(b){return Buffer.from(b.d.querySelector('#posterPreview').src.split(',')[1],'base64');}
function checkPNG(bytes){return bytes.readUInt32BE(16)===1080&&bytes.readUInt32BE(20)===1440;}
(async()=>{
 for(const options of [{encoder:'missing'},{encoder:'throw'},{encoder:'null'},{encoder:'hang',fastTimeout:true},{url:'throw'},{url:'missing'},{noReader:true},{noBlob:true},{noDownload:true}]){
   const b=boot(options);b.end();await ready(b);
   ok(JSON.stringify(options)+'仍能生成真实PNG、预览和下载',checkPNG(imageBytes(b))&&!b.d.querySelector('#posterOpen').disabled);
   b.d.querySelector('#posterSave').click();
   const nativeDownload=options.url!=='throw'&&options.url!=='missing'&&!options.noBlob&&!options.noDownload;
   ok('有临时地址时直接下载；受限时直接打开原图保存，预览均可用',(nativeDownload?b.downloads.length===1&&b.downloads[0].href.startsWith('blob:'):b.downloads.length===0&&!!b.d.querySelector('#posterSaveSheet')&&!Array.from(b.d.querySelectorAll('#posterSaveSheet button')).some(e=>e.textContent==='下载图片'))&&b.d.querySelector('#posterPreview').src.startsWith('data:image/png;base64,'));
   b.close();
 }
 for(const options of [{},{share:'unsupported'},{share:'capabilityThrows'},{share:'ok',noFile:true}]){
   const b=boot(options);const state=b.end(),before=JSON.stringify(state),meta=b.w.localStorage.getItem('jbzh_meta');await ready(b);
   const button=b.d.querySelector('#posterShare');ok('不支持文件分享时入口可见且标为分享方法',!button.hidden&&button.textContent==='分享方法');button.click();
   ok('打开实际原图与保存后发布指引',b.d.querySelector('#mask').classList.contains('show')&&b.d.querySelector('.poster-save-image').src===b.d.querySelector('#posterPreview').src&&b.d.querySelector('#posterViewerStatus').textContent.includes('朋友圈或小红书'));
   b.d.querySelector('#mOpts button').click();
   ok('返回结算不重新结算、不消耗资源、清理原图页面',!b.d.querySelector('#posterSaveSheet')&&!b.d.querySelector('#mask').classList.contains('show')&&JSON.stringify(state)===before&&b.w.localStorage.getItem('jbzh_meta')===meta&&b.errors.length===0);
   b.close();
 }
 const download=boot({downloadThrows:true});download.end();await ready(download);download.d.querySelector('#posterSave').click();
 ok('下载抛错自动打开长按保存页面',download.d.querySelector('#posterSaveSheet')&&download.d.querySelector('#posterViewerStatus').textContent.includes('未能发起下载'));download.close();
 const denied=boot({share:'error'});denied.end();await ready(denied);denied.d.querySelector('#posterShare').click();await until(()=>!!denied.d.querySelector('#posterSaveSheet'));
 ok('系统分享失败转入可保存的原图页面，按钮恢复',denied.d.querySelector('#posterViewerStatus').textContent.includes('系统分享未能完成')&&!denied.d.querySelector('[data-poster-share]').disabled&&!denied.d.querySelector('#posterShare').disabled);denied.close();
 const cancelled=boot({share:'abort'});cancelled.end();await ready(cancelled);cancelled.d.querySelector('#posterShare').click();await until(()=>!cancelled.d.querySelector('#posterShare').disabled);
 ok('取消分享不弹新页面、不下载，可立即再次操作',!cancelled.d.querySelector('#posterSaveSheet')&&cancelled.downloads.length===0&&cancelled.d.querySelector('#posterStatus').textContent.includes('已取消分享'));cancelled.close();
 const preview=boot();preview.end();await ready(preview);preview.d.querySelector('#posterPreview').dispatchEvent(new preview.w.Event('error'));
 ok('预览加载失败有明确说明和重试，下载仍可用',!preview.d.querySelector('#posterRetry').hidden&&preview.d.querySelector('#posterStatus').textContent.includes('预览未能打开')&&!preview.d.querySelector('#posterSave').disabled);
 preview.d.querySelector('#posterRetry').click();await ready(preview);ok('预览失败后可以重新生成',preview.d.querySelector('#posterRetry').hidden);preview.close();
 const busy=boot({share:'ok'});let resolveShare;
 busy.w.navigator.share=data=>{busy.shares.push(data);return new Promise(resolve=>{resolveShare=resolve;});};busy.end();await ready(busy);
 busy.d.querySelector('#posterShare').click();ok('点击处理期间同步调用系统分享，保留用户手势',busy.shares.length===1);
 busy.d.querySelector('#posterOpen').click();const second=busy.d.querySelector('[data-poster-share]');second.click();
 ok('原图页和结算页共用分享忙碌状态，防止重复调起',second.disabled&&busy.shares.length===1);
 busy.w.restartGame();ok('原图页打开时重开清理图片并解除遮罩',!busy.d.querySelector('#posterSaveSheet')&&!busy.d.querySelector('#mask').classList.contains('show')&&!busy.d.querySelector('#posterPreview').hasAttribute('src'));
 busy.end({name:'新一局'});await ready(busy);resolveShare();await new Promise(r=>setTimeout(r,10));
 ok('旧分享结束不会覆盖新一局提示或禁用新按钮',busy.d.querySelector('#posterStatus').textContent.includes('海报已生成')&&!busy.d.querySelector('#posterShare').disabled&&busy.d.querySelector('#posterPreview').alt.includes('新一局')&&busy.errors.length===0);busy.close();
 done();
})().catch(e=>{console.error(e);process.exitCode=1;});

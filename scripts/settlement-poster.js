/* Ending-only renderer. Rendering, retry, download and share never settle the game again. */
(function(){
  'use strict';
  const W=1080,H=1440,INK='#193e35',GOLD='#946b35',DIM='#62685d';
  let generation=0,current=null;
  const byId=id=>document.getElementById(id);
  const clean=value=>String(value==null?'':value).replace(/\[icon:[a-z]+\]|<[^>]*>/g,'').replace(/[\x00-\x1f]/g,' ').trim();
  const font=(size,weight)=>`${weight||400} ${size}px "PingFang SC","Microsoft YaHei",sans-serif`;
  function markup(){
    return `<section id="settlementPoster" class="settlement-poster" aria-label="本局结算海报">
      <div class="poster-heading"><b>把这一局，留作纪念</b><small>专属结算海报 · 竖版高清</small></div>
      <p id="posterStatus" class="poster-status" role="status" aria-live="polite">正在绘制本局海报…</p>
      <div class="poster-actions"><button id="posterSave" class="main" disabled>保存海报图片</button><button id="posterOpen" disabled>长按保存原图</button><button id="posterShare" hidden>系统分享</button><button id="posterRetry" hidden>重新生成海报</button></div>
      <img id="posterPreview" class="poster-preview" width="1080" height="1440" alt="本局结算海报" hidden>
      <p class="poster-help">手机可长按海报保存图片，再发朋友圈或小红书。下载的图片也可能位于浏览器下载目录或「文件」中。</p>
    </section>`;
  }
  function dispose(){
    generation++;
    if(current&&current.objectURL)try{URL.revokeObjectURL(current.url);}catch(e){}
    const preview=byId('posterPreview');if(preview){preview.onload=preview.onerror=null;preview.removeAttribute('src');preview.hidden=true;}
    const sheet=byId('posterSaveSheet');if(sheet){
      sheet.remove();
      const mask=byId('mask');if(mask)mask.classList.remove('show');
      if(typeof window.syncBankInert==='function')window.syncBankInert();
    }
    current=null;
  }
  function loadImage(src){
    return new Promise(resolve=>{
      if(!src){resolve(null);return;}
      const img=new Image();let ended=false;
      const finish=value=>{if(ended)return;ended=true;clearTimeout(timer);img.onload=img.onerror=null;resolve(value);};
      const timer=setTimeout(()=>finish(null),4500);
      img.onload=()=>finish(img);img.onerror=()=>finish(null);img.src=src;
    });
  }
  function assets(){
    try{return JSON.parse(byId('bankSettlementData').textContent);}catch(e){return {};}
  }
  function fit(c,value,x,y,max,size,color,weight){
    const text=clean(value);let px=size;
    c.font=font(px,weight);while(px>16&&c.measureText(text).width>max){px--;c.font=font(px,weight);}
    c.fillStyle=color;c.fillText(text,x,y,max);
  }
  function draw(data,art,qr){
    const cv=document.createElement('canvas');cv.width=W;cv.height=H;
    const c=cv.getContext('2d');if(!c)throw new Error('canvas-unavailable');
    c.fillStyle='#f6efde';c.fillRect(0,0,W,H);
    if(art)c.drawImage(art,0,0,W,H);
    else{
      c.fillStyle=INK;c.fillRect(0,0,W,410);
      c.strokeStyle=GOLD;c.lineWidth=8;c.strokeRect(20,20,W-40,H-40);
      c.lineWidth=1;c.strokeRect(34,34,W-68,H-68);
    }
    c.fillStyle='rgba(12,42,34,.88)';c.fillRect(270,50,540,62);
    c.textAlign='center';fit(c,'模拟银行行长 · 江北支行',540,91,490,30,'#f6e7bd',600);
    fit(c,'我的行长任期',540,482,880,28,GOLD,600);
    fit(c,data.title,540,578,884,76,INK,700);
    fit(c,'行长 '+data.name,540,639,870,34,INK,600);
    fit(c,data.route+' · '+data.term+'年任期',540,688,864,27,DIM);
    fit(c,data.completed?'任期完成 · 江北留下了我的故事':'任期提前结束 · 这一局也值得记录',540,734,870,27,GOLD,600);
    c.fillStyle=INK;c.fillRect(84,774,912,152);
    c.strokeStyle='#b69359';c.lineWidth=2;c.strokeRect(91,781,898,138);
    c.beginPath();c.moveTo(540,804);c.lineTo(540,897);c.stroke();
    fit(c,'最终存款',312,820,400,25,'#e5d5b4');
    fit(c,data.deposits+' 亿',312,886,402,51,'#fff6e3',700);
    fit(c,'全区排名',768,820,400,25,'#e5d5b4');
    fit(c,'第 '+data.rank+' 名',768,886,402,51,'#fff6e3',700);
    const stats=[['实际在任',data.months+'个月'],['营业网点',data.outlets+'家'],['员工团队',data.employees+'人']];
    stats.forEach((item,i)=>{const x=236+i*304;fit(c,item[0],x,975,270,24,DIM);fit(c,item[1],x,1025,270,37,INK,600);});
    fit(c,'累计放贷 '+data.loans+' 亿'+(data.challenge?' · '+data.challenge:''),540,1080,864,25,DIM);
    c.strokeStyle='#c7b48e';c.lineWidth=1;c.beginPath();c.moveTo(96,1113);c.lineTo(984,1113);c.stroke();
    c.fillStyle='rgba(250,244,229,.95)';c.fillRect(84,1124,916,266);
    c.textAlign='left';
    fit(c,'一间支行，一段属于我的江北故事。',100,1163,650,29,INK,600);
    fit(c,'制作人 大老师 · 微信 lynchrrr',100,1211,650,24,DIM);
    fit(c,'发现更多游戏，请在小红书、闲鱼',100,1253,650,24,DIM);
    fit(c,'搜索原创作者“模拟游戏大全”',100,1292,650,24,INK,600);
    if(qr){
      c.imageSmoothingEnabled=false;c.drawImage(qr,780,1128,215,215);c.imageSmoothingEnabled=true;
      c.textAlign='center';fit(c,'扫码接任行长',888.5,1370,220,22,INK,600);
    }else{
      c.textAlign='center';fit(c,'江北支行',888,1208,190,26,INK,600);fit(c,'行长模拟器',888,1252,190,25,GOLD);
    }
    c.textAlign='left';fit(c,'游戏虚构剧情 · 成绩来自本局结算',100,1354,650,19,DIM);
    return cv;
  }
  function encode(cv){
    return new Promise((resolve,reject)=>{
      let finished=false,reading=false,timer;
      const done=(blob,dataURL)=>{
        if(finished)return;finished=true;clearTimeout(timer);
        if(!/^data:image\/png;base64,[a-z\d+/]+=*$/i.test(dataURL||'')){reject(new Error('encode-failed'));return;}
        resolve({blob,dataURL});
      };
      const fallback=()=>{
        if(finished)return;
        try{
          const dataURL=cv.toDataURL('image/png');let blob=null;
          try{
            const bytes=atob(dataURL.split(',')[1]),array=new Uint8Array(bytes.length);
            for(let i=0;i<bytes.length;i++)array[i]=bytes.charCodeAt(i);
            blob=new Blob([array],{type:'image/png'});
          }catch(e){}
          done(blob,dataURL);
        }catch(e){finished=true;clearTimeout(timer);reject(e);}
      };
      timer=setTimeout(fallback,2500);
      if(typeof cv.toBlob!=='function'){fallback();return;}
      try{cv.toBlob(blob=>{
        if(finished||reading)return;
        if(!blob||typeof FileReader!=='function'){fallback();return;}
        reading=true;
        try{const reader=new FileReader();reader.onload=()=>done(blob,reader.result);reader.onerror=fallback;reader.onabort=fallback;reader.readAsDataURL(blob);}catch(e){fallback();}
      },'image/png');}catch(e){fallback();}
    });
  }
  function filename(data){return (clean(data.name)+'的行长结算·'+clean(data.title)).replace(/[\\/:*?"<>|]/g,'_').slice(0,72)+'.png';}
  async function render(data){
    const source=assets();
    const images=await Promise.all([loadImage(source.background),loadImage(source.qr)]);
    // System fonts are local; waiting is bounded so a broken font cannot block saving.
    if(document.fonts&&document.fonts.ready)await Promise.race([document.fonts.ready,new Promise(resolve=>setTimeout(resolve,1200))]);
    return draw(data,images[0],images[1]);
  }
  function status(message){for(const id of ['posterStatus','posterViewerStatus']){const el=byId(id);if(el)el.textContent=message;}}
  function openSaveView(message){
    if(!current||typeof window.showModal!=='function')return;
    const item=current;
    window.showModal('保存与分享海报','',[{t:'返回结算',feedback:false,fn:()=>{const old=byId('posterSaveSheet');if(old)old.remove();}}]);
    const sheet=document.createElement('div');sheet.id='posterSaveSheet';sheet.className='poster-save-sheet';
    const tip=document.createElement('p');tip.id='posterViewerStatus';tip.setAttribute('role','status');tip.setAttribute('aria-live','polite');
    tip.textContent=message||'长按下方海报，选择保存图片。保存后，去朋友圈或小红书选择这张照片发布。';sheet.appendChild(tip);
    const actions=document.createElement('div');actions.className='poster-viewer-actions';
    if(item.canDownload){const download=document.createElement('button');download.textContent='下载图片';download.onclick=save;actions.appendChild(download);}
    if(item.file){const button=document.createElement('button');button.textContent='系统分享';button.dataset.posterShare='true';button.disabled=!!item.sharing;button.onclick=()=>share(button);actions.appendChild(button);}
    sheet.appendChild(actions);
    const img=document.createElement('img');img.className='poster-save-image';img.width=W;img.height=H;img.alt=byId('posterPreview').alt;img.src=item.dataURL;
    img.onerror=()=>{if(current===item)status('图片预览未能打开，请尝试下载图片，或返回结算重新生成。');};sheet.appendChild(img);
    byId('mBody').appendChild(sheet);
    if(typeof window.syncScrollHint==='function')window.syncScrollHint();
  }
  function save(){
    if(!current)return;
    if(!current.canDownload){openSaveView('请长按下方海报，选择保存图片。保存后可到朋友圈或小红书选择这张照片发布。');return;}
    try{
      const a=document.createElement('a');a.href=current.url;a.download=current.filename;a.hidden=true;
      document.body.appendChild(a);a.click();a.remove();
      status('已发起图片下载。若没有弹出下载，点“长按保存原图”后保存。');
    }catch(e){openSaveView('当前浏览器未能发起下载，请长按下方海报保存图片。');}
  }
  function shareBusy(value){for(const button of document.querySelectorAll('#posterShare,[data-poster-share]'))button.disabled=value;}
  async function share(button){
    const item=current;if(!item)return;
    if(!item.file){openSaveView('当前浏览器不支持直接分享图片。长按下方海报保存后，再到朋友圈或小红书选择照片发布。');return;}
    if(item.sharing)return;
    const token=generation;item.sharing=true;shareBusy(true);
    try{
      await navigator.share({title:'我的行长任期 · '+item.data.title,files:[item.file]});
      if(token===generation)status('已交给系统分享面板。');
    }catch(e){
      if(token===generation){
        if(e&&e.name==='AbortError')status('已取消分享，仍可保存下方海报。');
        else openSaveView('系统分享未能完成。长按下方海报保存后，再到朋友圈或小红书选择照片发布。');
      }
    }finally{item.sharing=false;if(token===generation)shareBusy(false);}
  }
  async function show(data){
    dispose();const token=generation,box=byId('settlementPoster');if(!box)return;
    const retry=byId('posterRetry'),saveButton=byId('posterSave'),openButton=byId('posterOpen'),shareButton=byId('posterShare'),preview=byId('posterPreview');
    status('正在绘制本局海报…');retry.hidden=true;saveButton.disabled=true;saveButton.textContent='保存海报图片';openButton.disabled=true;openButton.hidden=false;shareButton.disabled=false;shareButton.hidden=true;preview.hidden=true;
    preview.onload=preview.onerror=null;preview.removeAttribute('src');saveButton.onclick=save;openButton.onclick=()=>openSaveView();shareButton.onclick=()=>share(shareButton);retry.onclick=()=>show(data);
    try{
      const cv=await render(data);if(token!==generation||!box.isConnected)return;
      const encoded=await encode(cv);if(token!==generation||!box.isConnected)return;
      const {blob,dataURL}=encoded;let objectURL=false,url=dataURL;
      try{if(blob&&window.URL&&URL.createObjectURL){url=URL.createObjectURL(blob);objectURL=true;}}catch(e){}
      const canDownload=objectURL&&'download' in document.createElement('a');
      current={data,blob,url,dataURL,objectURL,canDownload,filename:filename(data),file:null,sharing:false};
      // Preview and long-press image remain usable without a temporary blob: address.
      preview.onerror=()=>{if(token===generation){status('图片预览未能打开，可尝试下载，或重新生成海报。');retry.hidden=false;}};
      preview.alt=clean(data.name)+'的行长结算海报：'+clean(data.title)+'，最终存款'+data.deposits+'亿，全区第'+data.rank+'名';preview.src=dataURL;preview.hidden=false;
      saveButton.disabled=false;saveButton.textContent=canDownload?'保存海报图片':'保存海报（长按）';openButton.disabled=false;openButton.hidden=!canDownload;shareButton.textContent='分享方法';shareButton.hidden=false;status('海报已生成，点击保存，或长按海报保存图片。');
      try{
        if(blob&&typeof File==='function'&&typeof navigator.share==='function'&&typeof navigator.canShare==='function'){
          const file=new File([blob],current.filename,{type:'image/png'});
          if(navigator.canShare({files:[file]})){current.file=file;shareButton.textContent='系统分享';}
        }
      }catch(e){}
    }catch(e){
      if(token!==generation||!box.isConnected)return;
      status('当前环境未能生成海报，可点击重试。本局成绩仍可在下方查看。');retry.hidden=false;
    }
  }
  window.BankSettlementPoster={markup,show,dispose,render};
})();

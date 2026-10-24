// In-memory mobile QA profiles. Never read or overwrite a player's browser saves.
const fs=require('fs'),path=require('path');
const source=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const storage=`<script id="mobile-fixture-storage">
(function(){
 const values={jbzh_meta:JSON.stringify({runs:1,exp:600,endings:{},achs:{},talents:['laoling','beishui','jiubu'],routesDone:{},bioMade:0,chals:{}})};
 Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>Object.prototype.hasOwnProperty.call(values,k)?values[k]:null,setItem:(k,v)=>{values[k]=String(v);},removeItem:k=>{delete values[k];}}});
 if(location.search.includes('legacy'))window.MutationObserver=undefined;
 const params=new URLSearchParams(location.search),posterEnv=params.get('posterEnv');
 if(posterEnv){
   Object.defineProperty(navigator,'canShare',{configurable:true,value:posterEnv==='manual'?undefined:()=>true});
   Object.defineProperty(navigator,'share',{configurable:true,value:posterEnv==='manual'?undefined:data=>{
     const file=data.files[0],root=document.documentElement;
     root.dataset.qaShareCalls=String(Number(root.dataset.qaShareCalls||0)+1);root.dataset.qaShareFileType=file.type;root.dataset.qaShareFileBytes=String(file.size);
     return posterEnv==='denied'?Promise.reject(Object.assign(new Error('Blocked by test profile'),{name:'NotAllowedError'})):posterEnv==='cancel'?Promise.reject(Object.assign(new Error('Cancelled by test profile'),{name:'AbortError'})):Promise.resolve();
   }});
 }
 if(params.get('posterEncoder')==='missing')HTMLCanvasElement.prototype.toBlob=undefined;
 if(params.get('posterURL')==='blocked')URL.createObjectURL=()=>{throw new Error('Object URL blocked by test profile');};
 if(params.get('posterDownload')==='blocked'){const click=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){if(this.download)throw new Error('Download blocked by test profile');return click.call(this);};}
})();
</script>`;
const profile=`<script id="mobile-fixture-profile">
(function(){
 const mode=new URLSearchParams(location.search).get('mode')||'game';
 const theme=new URLSearchParams(location.search).get('theme');if(theme)setBankTheme(theme);
 if(mode==='home')return;
 const G=window.BankGame,s=G.initialState();G.setState(s);G.setSeed('mobile-audit');
 s.playerName='手机滚动按钮验收';s.month=80;s.maxMonth=120;s.cash=50000;s.dep=200;s.route='retail';
 if(mode==='warning'){s.cash=-50;s.risk=88;s.morale=20;}
 s.cycle=G.makeCycle();s.rivalScripts=G.makeRivalScripts();
 const team=G.genCandidates().concat(G.genCandidates());
 for(const e of team.slice(0,mode==='fullteam'?6:4)){e.id=s.empSeq++;s.emps.push(e);}
 for(const o of G.OUTLET_POOL.filter(o=>!s.outlets.some(x=>x.name===o.name)).slice(0,4))s.outlets.push({...o,mgr:null,ramp:1,closed:0,dep:4});
 s.loans=G.LOAN_POOL.slice(0,8).map((p,i)=>({...p,id:i+1,left:12,derive:0.2,bad:false,hidden:0}));s.loanSeq=9;
 s.candidates=G.genCandidates();s.log=Array.from({length:60},(_,i)=>({cls:i%2?'good':'month',txt:'第'+(80-i)+'月经营记录：客户走访、团队安排与月末结算，核对长列表滚动和底部按钮。'}));
 document.querySelector('#gameGuide').classList.remove('show');renderAll();
 if(mode==='end'){
   const early=new URLSearchParams(location.search).get('result')==='early';
   if(early){s.month=7;s.failed=true;s.playerName='林知远和他的江北经营故事';}
   else{s.month=120;s.playerName='林知远';s.track.loanTotal=16.7;}
   showEnd(early?'现金断流':'北疆之王',early?'本局提前结束，仍可保存这段行长生涯。':'十年任期结束，检查结局、图鉴、挑战与传记长图的滚动和按钮。',!early);
 }
})();
</script>`;
const html=source.replace('<head>','<head>\n<base href="/">'+storage).replace('</body>',profile+'\n</body>');
fs.mkdirSync(path.join(__dirname,'out'),{recursive:true});
fs.writeFileSync(path.join(__dirname,'out/mobile-interactions.html'),html);
console.log('Generated mobile-interactions.html: ?mode=home / game / end / fullteam; add &legacy for no MutationObserver.');

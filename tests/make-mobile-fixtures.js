// In-memory mobile QA profiles. Never read or overwrite a player's browser saves.
const fs=require('fs'),path=require('path');
const source=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const storage=`<script id="mobile-fixture-storage">
(function(){
 const values={jbzh_meta:JSON.stringify({runs:1,exp:600,endings:{},achs:{},talents:['laoling','beishui','jiubu'],routesDone:{},bioMade:0,chals:{}})};
 Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>Object.prototype.hasOwnProperty.call(values,k)?values[k]:null,setItem:(k,v)=>{values[k]=String(v);},removeItem:k=>{delete values[k];}}});
 if(location.search.includes('legacy'))window.MutationObserver=undefined;
})();
</script>`;
const profile=`<script id="mobile-fixture-profile">
(function(){
 const mode=new URLSearchParams(location.search).get('mode')||'game';
 if(mode==='home')return;
 const G=window.BankGame,s=G.initialState();G.setState(s);G.setSeed('mobile-audit');
 s.playerName='手机滚动按钮验收';s.month=80;s.maxMonth=120;s.cash=50000;s.dep=200;s.route='retail';
 s.cycle=G.makeCycle();s.rivalScripts=G.makeRivalScripts();
 const team=G.genCandidates().concat(G.genCandidates());
 for(const e of team.slice(0,mode==='fullteam'?6:4)){e.id=s.empSeq++;s.emps.push(e);}
 for(const o of G.OUTLET_POOL.filter(o=>!s.outlets.some(x=>x.name===o.name)).slice(0,4))s.outlets.push({...o,mgr:null,ramp:1,closed:0,dep:4});
 s.loans=G.LOAN_POOL.slice(0,8).map((p,i)=>({...p,id:i+1,left:12,derive:0.2,bad:false,hidden:0}));s.loanSeq=9;
 s.candidates=G.genCandidates();s.log=Array.from({length:60},(_,i)=>({cls:i%2?'good':'month',txt:'第'+(80-i)+'月经营记录：客户走访、团队安排与月末结算，核对长列表滚动和底部按钮。'}));
 document.querySelector('#gameGuide').classList.remove('show');renderAll();
 if(mode==='end'){s.month=120;showEnd('稳字当头','十年任期结束，检查结局、图鉴、挑战与传记长图的滚动和按钮。',true);}
})();
</script>`;
const html=source.replace('<head>','<head>\n<base href="/">').replace('<script id="bankBootGuard">',storage+'\n<script id="bankBootGuard">').replace('</body>',profile+'\n</body>');
fs.mkdirSync(path.join(__dirname,'out'),{recursive:true});
fs.writeFileSync(path.join(__dirname,'out/mobile-interactions.html'),html);
console.log('Generated mobile-interactions.html: ?mode=home / game / end / fullteam; add &legacy for no MutationObserver.');

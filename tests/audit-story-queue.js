const fs=require('fs'),{JSDOM}=require('jsdom'),{GAME}=require('./lib');
const dom=new JSDOM(fs.readFileSync(GAME,'utf8'),{runScripts:'dangerously',url:'http://localhost/',pretendToBeVisual:true});const w=dom.window,G=w.BankGame,$=s=>w.document.querySelector(s);
w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({},{get:(_,k)=>k==='measureText'?()=>({width:10}):()=>{}});
G.newGame(null,'queue-audit');const s=G.getState();s.month=48;s.cash=100000;s.dep=300;s.morale=100;s.risk=0;s.dirt=0;s.energy=0;s.flags.factionDone=true;
s.rivalScripts=[{id:'cha',ev:'rs_cha',at:48,done:false}];s.chain=[{id:'chain_letter_b',at:48,data:{fixed:true}}];
G.endMonth();const titles=[];let guard=0;
while($('#mask').classList.contains('show')&&guard++<40){titles.push($('#mTitle').textContent);$('#mOpts button:not([disabled])')?.click();}
console.log(JSON.stringify({consumedRival:s.rivalScripts[0].done,chainRemaining:s.chain.length,shownRival:titles.some(t=>t.includes('南岸出事')),shownChain:titles.some(t=>t.includes('写材料的人')),titles},null,2));setTimeout(()=>process.exit(0),50);

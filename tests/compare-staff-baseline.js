// Usage: node tests/compare-staff-baseline.js /absolute/path/to/pre-change.html
// Isolated seeded engines prove optional education does not change untouched games.
const vm=require('vm'),fs=require('fs'),{readCode,GAME}=require('./lib');
const baseline=process.argv[2];if(!baseline||!fs.existsSync(baseline))throw new Error('Pass the pre-change HTML path.');
function boot(file){const ctx=vm.createContext({console:{log(){},warn(){},error(){}},devicePixelRatio:1,localStorage:{getItem:()=>null,setItem(){},removeItem(){}}});vm.runInContext(readCode(file),ctx);return ctx.BankGame;}
const before=boot(baseline),after=boot(GAME);let failures=0;
function play(G,index){
 G.newGame(null,'staff-parity-'+index,36);const s=G.getState();s.route=['corp','retail','guanxi','compliance'][index%4];G.ROUTES[s.route].apply(s);
 while(!s.over&&s.month<=36){
  if(s.risk>=55)G.gain('risk',-15);
  if(s.morale<40){G.gain('cash',-20);s.restMonth=true;G.gain('morale',6);}
  s.energy=0;G.endMonth();
 }
 const copy=JSON.parse(JSON.stringify(s));delete copy.staffEducationMonth;
 for(const k of ['studyStarted','studyCompleted','seminars'])delete copy.track[k];
 return JSON.stringify(copy);
}
for(let i=0;i<200;i++)if(play(before,i)!==play(after,i))failures++;
console.log(`200 seeded games / 4 routes: ${200-failures} identical complete states, ${failures} differences (education unused).`);
process.exitCode=failures?1:0;

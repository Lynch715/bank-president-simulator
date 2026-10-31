// Isolate six months of normal work from random story events and reputation drift.
// Usage: node tests/audit-team-tempo.js /absolute/path/to/pre-adjustment.html
const vm=require('vm'),{readCode,GAME}=require('./lib');
function run(file){
 const ctx=vm.createContext({console:{log(){},warn(){},error(){}},devicePixelRatio:1,localStorage:{getItem:()=>null,setItem(){},removeItem(){}}});
 vm.runInContext(readCode(file),ctx);const G=ctx.BankGame;G.newGame(null,'tempo-audit',36);
 const s=G.getState();s.cash=10000;s.morale=80;s.rep=60;s.emps.forEach(e=>{e.trait=null;e.fatigue=20;});
 const rows=[{month:0,morale:s.morale,director:s.emps[0].fatigue,roamer:s.emps[1].fatigue}];
 for(let m=1;m<=6;m++){
  s.rep=60;G.settleCore();rows.push({month:m,morale:s.morale,director:s.emps[0].fatigue,roamer:s.emps[1].fatigue});if(m<6)G.nextMonth();
 }
 return rows;
}
const report={scenario:'2 ordinary staff; morale 80; fatigue 20; reputation held at 60; no education, rest, loans or story events',before:process.argv[2]?run(process.argv[2]):null,after:run(GAME)};
console.log(JSON.stringify(report,null,2));

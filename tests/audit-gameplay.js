// Read-only probes of existing gameplay defects. Does not alter game source.
const {load}=require('./lib');const {G}=load();
G.newGame(null,'audit');let s=G.getState();
const result={};
s.month=48;s.cash=10000;s.risk=0;s.morale=100;s.npl=1;s.loans=[{id:1,nm:'审计样本',amt:1,tier:1,bad:true,badLeft:6,left:10,rate:.5,derive:.55}];
// Capture rather than execute the yearly options in the headless modal.
let opts;const original=global.showModal;global.showModal=(title,body,o)=>{opts=o;};G.careerBeat()();opts[2].fn();
result.nplAfterCleanup={ledger:s.npl,loanRows:s.loans.filter(x=>x.bad).reduce((n,x)=>n+x.amt,0)};
const lines=[];for(let i=0;i<6;i++)G.settleLoans(lines);result.nplAfterSixCharges={ledger:s.npl,loans:s.loans.length};global.showModal=original;
G.newGame(null,'same-effects');s=G.getState();s.cash=1000;s.energy=3;
global.showModal=(title,body,o)=>{opts=o;};global.actManage();opts[2].fn();const first=G.outletOutput(s.outlets[0]);global.actManage();opts[2].fn();result.repeatMarketing={cashSpent:1000-s.cash,energySpent:3-s.energy,firstOutput:first,secondOutput:G.outletOutput(s.outlets[0])};global.showModal=original;
const fs=require('fs');const source=fs.readFileSync(require('./lib').GAME,'utf8');result.writeOnlyFlags=['insider','checkup','hanDebt','megadeal','nanan','maBeef'].map(k=>({key:k,occurrences:(source.match(new RegExp('\\bflags\\.'+k+'\\b','g'))||[]).length}));
result.loanInterest={oneBillionRatePointFive:G.interestOf({amt:1,rate:.5}),warningFormula:1*.5*100};
console.log(JSON.stringify(result,null,2));

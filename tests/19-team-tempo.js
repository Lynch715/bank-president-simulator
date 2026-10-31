const {load,runner}=require('./lib'),{G}=load(),{ok,done}=runner('士气与倦怠节奏');
function init(){G.newGame(null,'team-tempo',36);const s=G.getState();s.cash=3000;s.route='retail';s.emps.forEach(e=>{e.trait=null;e.fatigue=0;});return s;}
let s=init(),director=s.emps[0],roamer=s.emps[1];
let result=G.settleCore();
ok('普通主任每月增加5倦怠，机动队增加3',director.fatigue===5&&roamer.fatigue===3);
ok('普通开局士气自然回落小于1点',s.morale<50&&s.morale>49);
ok('月报列出士气调整与平均倦怠',result.lines.some(x=>x[0]==='士气自然调整')&&result.lines.some(x=>x[0]==='在编平均倦怠'));
s=init();director=s.emps[0];director.trait='juanwang';s.marketing=true;director.study={id:'risk',left:3,total:3,lastMonth:0};
ok('主任、卷王、营销和进修负担同时计入',G.fatigueChange(director)===12);
G.settleCore();ok('叠加高负荷月结按预计值累积',director.fatigue===12);
s=init();s.restMonth=true;ok('轮休月主任和机动队均可恢复',G.fatigueChange(s.emps[0])===-1&&G.fatigueChange(s.emps[1])===-3);
G.settleCore();ok('低倦怠轮休后不变成负数',s.emps.every(e=>e.fatigue===0));
s=init();director=s.emps[0];director.trait='laoyoutiao';director.fatigue=10;s.marketing=true;
ok('老油条保留自然恢复特质',G.fatigueChange(director)===-2);
G.startStudy(director.id,'market');ok('老油条在进修期间负担抵消自然恢复',G.fatigueChange(director)===0);
ok('较高士气自然回落每月最多3点',G.moraleDrift(30,95)===-3);
ok('低士气仍可逐月回升',G.moraleDrift(60,30)===3.6);
ok('接近基准时士气小幅自然变化',G.moraleDrift(49,50)===-0.12);
s=init();s.morale=95;G.settleCore();ok('实际月结保持高士气至少92',s.morale===92);
s=init();s.cash=-10000;s.morale=50;G.settleCore();ok('欠薪惩罚不被自然回落上限吞掉',s.morale<41&&s.negMonths===1);
s=init();s.morale=50;G.gain('morale',-15);ok('事件与决策的士气损失仍按原数值生效',s.morale===35);
s=init();director=s.emps[0];director.fatigue=99;director.protectedEmp=true;G.settleCore();ok('高倦怠不超过100',director.fatigue===100);
s=init();s.outlets[0].mgr=1;s.emps[0].trait='laoyoutiao';
for(let month=0;month<6;month++){G.settleCore();if(month<5)G.nextMonth();}
ok('普通主任连续工作半年倦怠为30',s.emps[1].fatigue===30);
ok('连续工作仍逐月累积，并未免费消除倦怠',s.emps[1].fatigue>0&&s.morale<50);
const before={morale:s.morale,fatigue:s.emps.map(e=>e.fatigue),cash:s.cash};
s=G.migrate(JSON.parse(JSON.stringify(s)));G.setState(s);
ok('旧档或中途读档不重置士气、倦怠与资产',s.morale===before.morale&&s.cash===before.cash&&s.emps.every((e,i)=>e.fatigue===before.fatigue[i]));

// Execute the existing rest decision rather than approximating its immediate effects.
const fs=require('fs'),path=require('path'),{JSDOM,VirtualConsole}=require('jsdom'),errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
const dom=new JSDOM(fs.readFileSync(path.join(__dirname,'../index.html'),'utf8'),{url:'http://localhost/',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){w.matchMedia=()=>({matches:false});w.HTMLCanvasElement.prototype.getContext=()=>null;}});
const w=dom.window,U=w.BankGame,$=sel=>w.document.querySelector(sel);s=U.initialState();s.cash=3000;s.tab='team';s.emps.forEach(e=>{e.trait=null;e.fatigue=60;});U.setState(s);$('#gameGuide').classList.remove('show');w.renderAll();
ok('员工卡片直接展示本月倦怠预计', $('#panel').textContent.includes('本月工作倦怠预计 +5')&&$('#panel').textContent.includes('本月工作倦怠预计 +3'));
w.actManage();Array.from($('#mOpts').children).find(e=>e.textContent.includes('批假轮休')).click();
ok('既有轮休仍减30倦怠并加6士气',s.emps.every(e=>e.fatigue===30)&&s.morale===56&&s.cash===2980);
$('#mOpts button').click();ok('轮休后预期变成恢复1点和3点',$('#panel').textContent.includes('本月工作倦怠预计 -1')&&$('#panel').textContent.includes('本月工作倦怠预计 -3'));
const lines=U.settleCore().lines;ok('轮休月末疲劳与界面预期一致',s.emps[0].fatigue===29&&s.emps[1].fatigue===27);
ok('轮休后士气改善不会马上掉光',s.morale>54);
ok('月报使用实际在编平均倦怠',lines.some(x=>x[0]==='在编平均倦怠'&&x[1].includes('30.0 → 28.0')));
ok('月结与渲染全程无异常',errors.length===0);dom.window.close();done();

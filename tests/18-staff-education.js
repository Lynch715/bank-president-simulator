// Real curriculum, monthly accounting, save recovery and UI controls; no player storage.
const fs=require('fs'),path=require('path'),{load,runner}=require('./lib');
const {ok,done}=runner('员工培训与进修'),{G}=load(),b=G.BALANCE.staff;
const near=(a,c)=>Math.abs(a-c)<1e-8;
function init(){G.newGame(null,'staff-education',36);const s=G.getState();s.route='compliance';s.cash=3000;return s;}
let s=init(),e=s.emps[1],cash=s.cash,energy=s.energy;
ok('愣头青专项培训半价',G.trainCost(e)===50);
ok('专项培训提升能力、调薪和降倦怠',G.trainSkill(1,'mk')&&e.mk===4&&e.salary===1.8&&s.cash===cash-50&&e.fatigue===0);
ok('专项培训不花行长精力',s.energy===energy);
ok('每人每月一次且不能篡改科目',!G.trainSkill(1,'rk')&&!G.trainSkill(0,'cash')&&s.track.train===1);
ok('专项培训当月不能报名进修',!G.startStudy(1,'market'));
G.nextMonth();ok('次月可以继续专项培训',G.trainSkill(1,'mk')&&e.mk===5);
G.nextMonth();cash=s.cash;ok('五星不能继续花钱提升',!G.trainSkill(1,'mk')&&s.cash===cash);
s.cash=49;ok('现金不足不能培训',!G.trainSkill(1,'rk'));

s=init();e=s.emps[0];e.fatigue=20;const beforeOutput=G.outletOutput(s.outlets[0]),beforeRk=G.rkPower(e),salary=e.salary;
ok('在职进修扣学费与精力，不提前升星',G.startStudy(0,'market')&&s.cash===2860&&s.energy===2&&e.mk===2&&e.study.left===2);
ok('进修期间主任和贷款风控折扣真实生效',near(G.outletOutput(s.outlets[0]),beforeOutput*b.studyCapacity)&&near(G.rkPower(e),beforeRk*b.studyCapacity));
cash=s.cash;energy=s.energy;
ok('同人重复报名、多人并行和未知课程均被拦截',!G.startStudy(0,'risk')&&!G.startStudy(1,'leader')&&!G.startStudy(1,'unknown')&&s.cash===cash&&s.energy===energy);
ok('进修期间不能专项培训',!G.trainSkill(0,'rk'));
let lines=G.settleCore().lines;
ok('第一月只推进课时且工资保持原额',e.study.left===1&&e.salary===salary&&lines.some(x=>x[0].includes('客户经营研修班')));
ok('进修额外倦怠叠加老油条自然恢复',e.fatigue===20-G.BALANCE.team.veteranRecovery+b.studyFatigue);
const saved=JSON.stringify(s);G.setState(G.migrate(JSON.parse(saved)));s=G.getState();e=s.emps[0];
ok('中途读档保留课程、剩余课时和学费',e.study.left===1&&e.study.id==='market'&&s.track.studyStarted===1);
G.nextMonth();lines=G.settleCore().lines;
ok('结业两项升星、专长及薪资一次到账',!e.study&&e.mk===3&&e.mg===4&&e.certificates.includes('market')&&e.salary===salary+b.studySalary&&s.track.studyCompleted===1);
ok('结业当月专长不提前产出，月报有完整奖励',!lines.some(x=>x[0]==='客户经营专长')&&lines.some(x=>x[0].includes('进修结业')&&x[1].includes('月薪+0.6')));
ok('结业恢复在岗产能',G.staffCapacity(e)===1);
ok('已取得专长不能重复缴费',!G.startStudy(0,'market'));
G.nextMonth();lines=G.settleCore().lines;
ok('结业次月专长进入真实月度账本',lines.some(x=>x[0]==='客户经营专长'&&x[1]==='+0.03亿'));
cash=s.cash;const completed=s.track.studyCompleted,priorDep=s.dep;G.settleStaffEducation([]);
ok('再次调用不会重复毕业、调薪或专长收益',s.track.studyCompleted===completed&&e.salary===salary+b.studySalary&&s.cash===cash&&s.dep===priorDep);
ok('新专长成就可正常点亮',G.ACHIEVEMENTS.find(x=>x.id==='a_study').chk(s));
G.nextMonth();ok('其他进修期间已有专长也按产能折扣',G.startStudy(0,'leader')&&G.staffCapacity(e)===b.studyCapacity);
lines=[];const depBefore=s.dep;G.settleStaffEducation(lines);ok('进修中专长产出为65%',lines.some(x=>x[0]==='客户经营专长'&&x[1]==='+0.0195亿')&&near(s.dep-depBefore,0.0195));

for(const course of G.STUDY_COURSES){
 s=init();e=s.emps[1];e.mk=e.mg=e.rk=5;
 ok(course.name+'允许五星继续学专长且享新人折扣',G.startStudy(1,course.id)&&s.cash===3000-course.cost/2);
 for(let m=0;m<course.months;m++){G.settleCore();if(m<course.months-1)G.nextMonth();}
 ok(course.name+'按课时结业且星级不越界',!e.study&&e.mk===5&&e.mg===5&&e.rk===5&&s.track.studyCompleted===1&&e.certificates.includes(course.id));
 G.nextMonth();lines=G.settleCore().lines;
 ok(course.cert+'参与结算',lines.some(x=>x[0]===course.cert));
}
s=init();e=s.emps[0];s.month=36;cash=s.cash;
ok('任期剩余不足不会收学费',!G.startStudy(0,'market')&&s.cash===cash);
s.month=35;ok('刚好两月可以完成',G.startStudy(0,'market'));
s.emps=s.emps.filter(x=>x.id!==e.id);s.outlets[0].mgr=null;
ok('员工离职自动释放进修名额',G.startStudy(1,'market'));
G.nextMonth();G.settleCore();G.nextMonth();G.settleCore();
ok('离职员工没有结业或专长收益',!s.log.some(x=>x.txt.includes('老张</b>结业'))&&!s.emps.some(x=>x.id===0));
s=init();s.emps[0].certificates=['risk'];s.emps[1].certificates=['leader','market'];
ok('三种专长组成梯队成就',G.ACHIEVEMENTS.find(x=>x.id==='a_academy').chk(s));
s.emps=[];lines=[];G.settleStaffEducation(lines);ok('空团队不会取得已离职的专长收益',lines.length===0&&!G.canSeminar());

for(const id of ['service','compliance','team']){
 s=init();const before={dep:s.dep,rep:s.rep,morale:s.morale,risk:s.risk,fatigue:s.emps[0].fatigue};
 ok(id+'内训扣费扣精力且全员倦怠增加',G.holdSeminar(id)&&s.cash===2975&&s.energy===2&&s.emps[0].fatigue===before.fatigue+b.seminarFatigue);
 ok(id+'即时经营收益正确',id==='service'?near(s.dep,before.dep+b.seminarDep)&&s.rep===before.rep+b.seminarRep:id==='compliance'?s.risk===before.risk-b.seminarRisk:s.morale===before.morale+b.seminarMorale);
 ok(id+'当月不可切换主题重复举办',!G.holdSeminar('service')&&s.track.seminars===1);
 s=G.migrate(JSON.parse(JSON.stringify(s)));G.setState(s);ok(id+'读档保留月度限次',!G.holdSeminar('team'));
 G.nextMonth();ok(id+'下月恢复可办',G.holdSeminar(id));
}
s=init();s.energy=0;ok('精力用完不能进修或内训',!G.startStudy(0,'market')&&!G.holdSeminar('team'));
s.energy=3;s.cash=24;ok('现金不足不能进修或内训',!G.startStudy(0,'market')&&!G.holdSeminar('team'));
s=init();s.over=true;ok('终局后不能继续培养',!G.startStudy(0,'market')&&!G.holdSeminar('team')&&!G.trainSkill(0,'mk'));
s=init();delete s.track.studyStarted;delete s.track.studyCompleted;delete s.track.seminars;const oldStats=s.emps.map(x=>[x.mk,x.mg,x.rk,x.salary,x.fatigue]);
G.migrate(s);G.migrate(s);
ok('旧档补缺可重复迁移且保留能力薪资',s.track.studyCompleted===0&&s.track.seminars===0&&JSON.stringify(oldStats)===JSON.stringify(s.emps.map(x=>[x.mk,x.mg,x.rk,x.salary,x.fatigue])));
s.emps[0].study={id:'unknown',left:2};s.emps[1].certificates=['market','market','unknown'];G.migrate(s);
ok('无效课程安全清理，专长去重',!s.emps[0].study&&s.emps[1].certificates.join(',')==='market');

for(const term of [36,72,120]){
 G.newGame(null,'education-tenure-'+term,term);s=G.getState();s.route='compliance';G.ROUTES.compliance.apply(s);
 for(let month=1;month<=term&&!s.over;month++){
  // Control unrelated loss gates; exercise real month/event queues with education active.
  s.cash=100000;s.dep=300;s.risk=0;s.morale=95;s.dirt=0;s.npl=0;s.energy=3;s.emps.forEach(x=>x.fatigue=0);
  if(!s.emps.some(x=>x.study)){
   const student=s.emps.find(x=>G.STUDY_COURSES.some(c=>!G.staffCertificates(x).includes(c.id)));
   const course=student&&G.STUDY_COURSES.find(c=>!G.staffCertificates(student).includes(c.id));
   if(course)G.startStudy(student.id,course.id);
  }
  G.holdSeminar('compliance');G.endMonth();
 }
 ok(term+'月真实剧情队列可带进修走至任期结束',s.over&&s.month===term&&!s.failed&&(s.track.studyCompleted||0)>=3);
 ok(term+'月账目与员工能力保持有效',['cash','dep','morale','risk'].every(k=>Number.isFinite(s[k]))&&s.emps.every(x=>['mk','mg','rk'].every(k=>x[k]>=1&&x[k]<=5)));
}

// UI uses genuine clicks and serialized localStorage round trips.
const {JSDOM,VirtualConsole}=require('jsdom'),errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
function ui(raw){return new JSDOM(html,{url:'http://localhost/',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){
 w.matchMedia=()=>({matches:false});w.HTMLCanvasElement.prototype.getContext=()=>null;
 if(raw)w.localStorage.setItem('jbzh_save6',raw);
}});}
let dom=ui(),w=dom.window,U=w.BankGame,$=sel=>w.document.querySelector(sel);
s=U.initialState();s.cash=2000;s.tab='team';U.setState(s);$('#gameGuide').classList.remove('show');w.renderAll();
const pick=text=>Array.from($('#mOpts').children).find(x=>x.textContent.includes(text));
ok('团队页可发现人才培养、员工进修和内训',$('.staff-academy').textContent.includes('人才培养')&&$('#panel button[onclick="studyEmp(0)"]')&&$('#panel button[onclick="staffSeminar()"]'));
$('#panel button[onclick="studyEmp(0)"]').click();const beforeCancel=JSON.stringify(s);pick('先看看排班').click();
ok('取消选课不扣钱不占课时',JSON.stringify(s)===beforeCancel&&!$('#mask').classList.contains('show'));
$('#panel button[onclick="studyEmp(0)"]').click();const enroll=pick('客户经营研修班');enroll.click();
ok('报名显示实际费用、精力及进修回执',$('.decision-receipt').textContent.includes('现金 -140')&&$('.decision-receipt').textContent.includes('精力 -1')&&$('.decision-receipt').textContent.includes('开始客户经营研修班'));
enroll.click();ok('双击报名不会重复扣费',s.cash===1860&&s.energy===2);
pick('知道了').click();ok('团队卡片显示进度与在岗代价',$('#panel [role="progressbar"]').getAttribute('aria-valuenow')==='0'&&$('#panel').textContent.includes('在岗贡献保留65%'));
$('#panel button[onclick="studyEmp(1)"]').click();ok('其他员工课程显示名额占用原因',pick('客户经营研修班').disabled&&pick('客户经营研修班').textContent.includes('仅有1个进修名额'));pick('先看看排班').click();
const raw=w.localStorage.getItem('jbzh_save6');dom.window.close();dom=ui(raw);w=dom.window;U=w.BankGame;$=sel=>w.document.querySelector(sel);s=U.getState();
ok('真实存储读档后恢复进修UI',s.emps[0].study.left===2&&$('#panel [role="progressbar"]')&&!$('#gameGuide').classList.contains('show'));
$('#panel button[onclick="staffSeminar()"]').click();pick('合规案例内训').click();
ok('内训回执与月度按钮同步更新',s.risk===16&&$('.decision-receipt').textContent.includes('风险 -4'));pick('知道了').click();
ok('内训完成后按钮锁定',$('#panel button[onclick="staffSeminar()"]').disabled&&$('#panel').textContent.includes('本月内训已完成'));
U.settleCore();U.nextMonth();w.renderAll();
ok('月结后读数推进到1/2月',$('#panel [role="progressbar"]').getAttribute('aria-valuenow')==='1');
U.settleCore();U.nextMonth();w.renderAll();
ok('结业卡片展示长期专长并移除进度条',$('#panel').textContent.includes('客户经营专长')&&!$('#panel [role="progressbar"]'));
ok('新增界面图标均已渲染',!$('#panel').textContent.includes('[icon:'));
ok('全程无UI异常',errors.length===0);dom.window.close();
done();

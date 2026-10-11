const {load,runner}=require('./lib');const {G}=load();const {ok,done}=runner('长期经营');
G.newGame(null,'career');let s=G.getState();ok('普通新局120个月',G.endM()===120);
G.newGame(null,'classic',36);ok('三年可选',G.endM()===36);G.newGame(null,'six',72);ok('六年可选',G.endM()===72);
G.newGame(null,'career');s=G.getState();s.cash=2000;
ok('未到第四年不得建设供应链',!G.startProject('supply'));
ok('启动项目扣现金与精力',G.startProject('payroll')&&s.cash===1880&&s.energy===2);
ok('不能并行建设',!G.startProject('digital'));
let before=s.cash;for(let i=0;i<3;i++)G.settleCareer([]);
ok('三次结算建成且建设期不产收益',s.career.projects.payroll===1&&s.cash===before&&!s.career.active);
G.settleCareer([]);ok('投产现金为收入减维护',s.cash===before+10);
ok('升级扣两倍建设费',G.startProject('payroll')&&s.cash===before+10-240);
for(let i=0;i<3;i++)G.settleCareer([]);ok('升级时旧产能继续产生收益',s.cash===before+10-240+30&&s.career.projects.payroll===2);
s.month=120;s.career.active=null;ok('任期不足以建成时不接受投入',!G.startProject('risklab'));
s.month=50;s.rep=50;const wealth=G.PROJECTS.find(p=>p.id==='wealth');ok('口碑影响收入但照付维护',G.projectReturn(wealth,1).cash===5.5);
s.cycle={t1:11,t2:23,told:{}};ok('第四年后周期继续变化',G.cyclePhase(47)==='tight'&&G.cyclePhase(59)==='loose2');s.month=45;ok('第二轮收紧提前预告',!!G.cycleNews());ok('同节点不重复',!G.cycleNews());
ok('巡视覆盖第十年',G.patrolMonths().includes(118));
const old=G.initialState();delete old.career;old.maxMonth=36;ok('旧档保留三年并补齐项目状态',G.migrate(old).maxMonth===36&&old.career.projects);
// Directed full-tenure integration: neutralize unrelated loss gates, exercise the actual end-month queue.
G.newGame(null,'full-tenure');s=G.getState();s.route='compliance';G.ROUTES.compliance.apply(s);s.cash=100000;s.dep=300;
for(let m=1;m<=120&&!s.over;m++){s.risk=0;s.morale=100;s.dirt=0;s.npl=0;s.emps.forEach(e=>e.fatigue=0);s.energy=3;const p=G.PROJECTS.find(p=>p.month<=s.month&&!s.career.projects[p.id]);if(p)G.startProject(p.id);G.endMonth();}
ok('实际结算队列走至120月结束',s.over&&s.month===120&&!s.failed);
ok('六个项目均可完成',Object.keys(s.career.projects).length===6);
ok('长期账本无非有限数值',['cash','dep','morale','risk','npl'].every(k=>Number.isFinite(s[k])));
done();

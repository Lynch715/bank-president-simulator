// 无头 200 局:硬门槛是零报错
const {load, runner} = require("./lib");
const {G} = load();
const r = runner("无头回归");
let err = null;
const t0 = Date.now();
let res = null;
try{ res = G.simBatch(+(process.argv[2]||200)); }catch(e){ err = e; }
r.ok("simBatch 跑完不报错" + (err?" —— "+err.message:""), !err);
if(res){
  r.ok("中位存款 " + res["中位存款"] + " 在合理区间(15~40)", res["中位存款"]>=15 && res["中位存款"]<=40);
  r.ok("结局分布不止一种:" + Object.keys(res["结局分布"]).length + " 种", Object.keys(res["结局分布"]).length>=3);
  r.ok("四条路线都跑到了", Object.keys(res["路线分布"]).length===4);
}
console.log("  (耗时 " + (Date.now()-t0) + "ms)");
r.done();

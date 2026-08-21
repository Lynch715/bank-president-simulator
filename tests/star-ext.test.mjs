import assert from "node:assert/strict";
import vm from "node:vm";
import { loadGame, newGame, getS, findNaN } from "./star-harness.mjs";

/* 扩展包 v3 冒烟测试：宿敌擂台 / 粉圈 / 剧情线 / 狗仔 / 难度 / 结局
   做法：把 showModal 换成「自动随机点一个可用选项」的机器人，
   让每一条事件分支的 fn 都真的被执行一次，抓 NaN 与运行时异常。 */

function robotize(g) {
  vm.runInContext(`
    __depth=0; __picked=[];
    showModal=function(title,body,options){
      if(!options||!options.length)return;
      if(__depth>60)return;
      __depth++;
      try{
        var avail=options.filter(function(o){return !o.disabled});
        var o=avail.length?avail[Math.floor(Math.random()*avail.length)]:options[0];
        __picked.push(title);
        if(o&&o.fn)o.fn();
        flushQueue();
      } finally { __depth--; }
    };
  `, g);
}

function step(g) {
  vm.runInContext(`
    if(S&&!S.over){
      // 随机一个主动动作
      var r=Math.random();
      if(r<0.42){var open=S.projects.filter(function(p){return p.status==="open"});
        if(open.length){var p=open[Math.floor(Math.random()*open.length)];
          if(projectedMaxLoad(S,p)<1.05) signProject(p);}}
      else if(r<0.6){ fanAct(["meet","data","anti","raise","charity","purge","calm"][Math.floor(Math.random()*7)]); }
      else if(r<0.72){ actChallenge(); }
      else if(r<0.86){ actTrain(); }
      else { actRest(); }
      S.energy=0; doEndMonth();
      var gg=0; while(modalQueue.length&&gg++<120) flushQueue();
    }
  `, g);
}

const seen = { duels: 0, arcs: new Set(), endings: new Set(), feats: new Set(), splashOK: true };

for (const diff of ["easy", "normal", "hard"]) {
  for (let seed = 1; seed <= 8; seed++) {
    const g = loadGame(seed * 31 + 7);
    const s = newGame(g, { difficulty: diff, background: ["academy", "talent", "influencer", "child"][seed % 4] });
    robotize(g);
    let last = -1, stuck = 0;
    for (let i = 0; i < 60; i++) {
      const cur = getS(g);
      if (cur.over || cur.month > 36) break;
      if (cur.month === last) { if (++stuck > 3) throw new Error(`软锁：${diff}/seed${seed} 第${cur.month}月`); } else stuck = 0;
      last = cur.month;
      step(g);
    }
    const fin = getS(g);
    assert.equal(findNaN(fin), null, `${diff}/seed${seed}: NaN 泄漏 ${findNaN(fin)}`);
    assert.ok(fin.over || fin.month > 36, `${diff}/seed${seed}: 未走到终局(第${fin.month}月)`);
    // 不变式
    assert.ok(fin.fandom.data >= 0 && fin.fandom.data <= 5, "数据组等级越界");
    assert.ok(fin.fandom.anti >= 0 && fin.fandom.anti <= 100, "黑粉热度越界");
    assert.ok(fin.fandom.cohesion >= 0 && fin.fandom.cohesion <= 100, "凝聚力越界");
    assert.ok(fin.duel.wins + fin.duel.losses >= 0, "擂台战绩异常");
    assert.ok(fin.image.believers <= fin.fans + 1e-6, "信仰粉超过总粉");
    Object.keys(fin.risks).forEach(k => assert.ok(fin.risks[k] >= 0 && fin.risks[k] <= 120, `风险 ${k} 越界`));
    seen.duels += fin.duel.wins + fin.duel.losses;
    Object.keys(fin.arcs || {}).forEach(a => seen.arcs.add(a));
    (fin.feats || []).forEach(f => seen.feats.add(f));
    if (fin.endData) seen.endings.add(fin.endData.title);
  }
}

// 覆盖度：24 局里应该打过擂台、跑过剧情线、见过多种结局
assert.ok(seen.duels >= 10, `擂台触发过少：${seen.duels}`);
assert.ok(seen.arcs.size >= 2, `剧情线覆盖过少：${[...seen.arcs]}`);
assert.ok(seen.endings.size >= 3, `结局多样性不足：${[...seen.endings]}`);

// 难度确实改变风险速率
{
  const mk = d => { const g = loadGame(99); const s = newGame(g, { difficulty: d }); vm.runInContext('for(var i=0;i<10;i++)risk(S,"health",10)', g); return getS(g).risks.health; };
  const e = mk("easy"), n = mk("normal"), h = mk("hard");
  assert.ok(e < n && n <= h, `难度未生效 easy=${e} normal=${n} hard=${h}`);
}

// 扩展结局函数不炸
{
  const g = loadGame(5); const s = newGame(g);
  vm.runInContext('S.arcs.rivalry={stage:99,ending:"together"}', g);
  const e = vm.runInContext('endingFor(S)', g);
  assert.equal(e[0], "双星并耀", "扩展结局未优先命中");
}

console.log("=== 扩展包冒烟(24局) ===");
console.log("  擂台总场次:", seen.duels);
console.log("  触发过的剧情线:", [...seen.arcs].join("、") || "无");
console.log("  出现过的结局:", [...seen.endings].join("、"));
console.log("  生涯里程碑:", [...seen.feats].slice(0, 8).join("、") || "无");
console.log("star ext test passed");

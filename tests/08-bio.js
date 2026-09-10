// 传记长图:用真 canvas 出一张 PNG 到 tests/out/,方便肉眼核对版式
// 需要 @napi-rs/canvas;没装就跳过。中文字形要靠系统字体,沙箱里没有中文字体会显示成方框,不影响版式检查。
const path = require("path"), fs = require("fs");
const {load, runner, has, skip} = require("./lib");
if(!has("@napi-rs/canvas")){ skip("传记出图", "没装 @napi-rs/canvas,跑 `npm i` 就有了"); return; }

const {createCanvas} = require("@napi-rs/canvas");
const {G} = load({dpr:2, patch:c => c.replace('c.drawImage(img,', 'c.drawImage(img._img||img,')});
const r = runner("传记出图");

// 跑到一局结束,尽量跑出一局有内容的
let S = null;
for(let i=0;i<40;i++){
  G.simRun(); S = G.getState();
  if(S.endTitle && (S.track.keyEvents||[]).length >= 6) break;
}
S.playerName = "李维安";

global.document = {createElement:()=>{ const c = createCanvas(10,10); c.style = {}; return c; }, querySelector:()=>null};
const {loadImage} = require("@napi-rs/canvas");
global.Image = function(){
  const self = this;
  Object.defineProperty(self, "src", {set(v){
    loadImage(path.join(__dirname, "..", v))
      .then(i => { self._img = i; self.onload && self.onload(); })
      .catch(() => self.onerror && self.onerror());
  }});
};

const outDir = path.join(__dirname, "out");
try{ fs.mkdirSync(outDir, {recursive:true}); }catch(e){}

let cv = null, crashed = null;
try{ (0,eval)("renderBiography")(true, c => { cv = c; }); }catch(e){ crashed = e; }

setTimeout(() => {
  r.ok("绘制不报错" + (crashed ? " —— " + crashed.message : ""), !crashed);
  r.ok("拿到 canvas", !!cv);
  if(cv){
    const dpr = 2, W = G.BALANCE.bio.w;
    r.ok(`宽度按 ${W}px @${dpr}x 出图:${cv.width}×${cv.height}`, cv.width === W*dpr);
    r.ok("高度按内容伸缩,不是写死的:" + cv.height, cv.height > 800 && cv.height < 6000);
    const file = path.join(outDir, "传记.png");
    fs.writeFileSync(file, cv.toBuffer("image/png"));
    r.ok("已写出 tests/out/传记.png(" + Math.round(fs.statSync(file).size/1024) + "KB),自己开来看一眼版式", true);
  }
  r.ok("大事记 " + G.bioBeats().length + " 条不超过 " + G.BALANCE.bio.maxBeats, G.bioBeats().length <= G.BALANCE.bio.maxBeats);
  r.done();
}, 1500);

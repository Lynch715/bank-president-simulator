// Isolated browser fixtures: use in-memory saves and never read player storage.
const fs=require('fs'),path=require('path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const out=path.join(__dirname,'out');fs.mkdirSync(out,{recursive:true});
const profile=`<script id="android-fixture-profile">
(function(){
 var mode=location.search.indexOf('storage')>=0?'storage':location.search.indexOf('corrupt')>=0?'corrupt':'legacy';
 var values=mode==='corrupt'?{jbzh_save6:'{android-fixture-broken-save'}:{};
 Object.defineProperty(window,'localStorage',{configurable:true,get:function(){if(mode==='storage')throw new DOMException('Storage denied','SecurityError');return {getItem:function(k){return Object.prototype.hasOwnProperty.call(values,k)?values[k]:null;},setItem:function(k,v){values[k]=String(v);},removeItem:function(k){delete values[k];}};}});
 window.matchMedia=undefined;window.MutationObserver=undefined;window.Text.prototype.replaceWith=undefined;document.createTreeWalker=undefined;
 HTMLCanvasElement.prototype.getContext=function(){return null;};
 if(window.URL)window.URL.createObjectURL=undefined;
})();
</script>\n`;
fs.writeFileSync(path.join(out,'android-compat-fixture.html'),html.replace('<script id="bankBootGuard">',profile+'<script id="bankBootGuard">'));
fs.writeFileSync(path.join(out,'android-syntax-fixture.html'),html.replace('<script id="bankBootGuard">',profile+'<script id="bankBootGuard">').replace(/<script id="bankGameCode">[\s\S]*?<\/script>/,'<script id="bankGameCode">function {</script>'));
console.log('Generated isolated Android compatibility and startup-error browser fixtures.');

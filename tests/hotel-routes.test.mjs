import assert from "node:assert/strict";
import { loadHotel } from "./hotel-harness.mjs";
const API = loadHotel(1);
const R = API.ROUTES;
assert.deepEqual(Object.keys(R).sort(), ["business","service","viral","wedding"]);
for(const id of Object.keys(R)){
  const s = API.initialState(); const before = JSON.stringify({f:s.facilities,b:s.brand,m:s.morale,c:s.cash});
  R[id].apply(s);
  assert.notEqual(JSON.stringify({f:s.facilities,b:s.brand,m:s.morale,c:s.cash}), before, `${id} apply 未改变起步状态`);
  assert.ok(typeof R[id].target.label(s)==="string", `${id} target.label 非字符串`);
}
console.log("routes: 4 条流派 apply 各有差异 ✔");

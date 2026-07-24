import assert from "node:assert/strict";
import { loadHotel } from "./hotel-harness.mjs";
function acceptedZhou(API){ const s=API.initialState();
  s.orders=[{id:"t1",type:"企业协议",client:"zhou",roomRevenue:10,eventRevenue:0,fbRevenue:2,roomNights:80,load:.5,delayed:0,status:"accepted"}];
  return s; }
{ const API=loadHotel(1); const s=acceptedZhou(API); s.route=null;
  assert.equal(Math.round(API.orderTotals(s).roomRevenue), 10, "无流派应不加成"); }
{ const API=loadHotel(1); const s=acceptedZhou(API); s.route="business";
  assert.equal(Math.round(API.orderTotals(s).roomRevenue*100), 1150, "商务应 ×1.15"); }
console.log("orderbonus: 流派订单加成生效 ✔");

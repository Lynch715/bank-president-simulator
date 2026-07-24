import assert from "node:assert/strict";
import { loadHotel } from "./hotel-harness.mjs";
{ const API=loadHotel(1); const s=API.initialState(); API.setState(s);
  const zhou=s.npcs.find(n=>n.id==="zhou"); const a0=zhou.account;
  s.orders=[{id:"o",type:"企业协议",client:"zhou",roomRevenue:4,eventRevenue:0,fbRevenue:1,roomNights:80,load:.5,delayed:0,status:"accepted"}];
  API.settleCore(s);
  assert.ok(zhou.account > a0, `账户应上涨(${a0}→${zhou.account})`);
  assert.ok(zhou.account <= 100, "账户封顶100"); }
console.log("patron: 接单涨账户 ✔");

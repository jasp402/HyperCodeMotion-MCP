/**
 * Production MCP smoke test. Read-only requests; does not mutate projects.
 * Run: MCP_URL=https://mcp.hypercodemotion.com/mcp npm run test:live
 */
import assert from "node:assert/strict";
const url = process.env.MCP_URL || "https://mcp.hypercodemotion.com/mcp";
async function rpc(method, params, id=1) {
  const response=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json","Accept":"application/json, text/event-stream","MCP-Protocol-Version":"2025-03-26"},body:JSON.stringify({jsonrpc:"2.0",id,method,params}),signal:AbortSignal.timeout(15000)});
  assert.equal(response.status,200,`${method}: HTTP ${response.status}`);
  const text=await response.text();
  const payload=response.headers.get("content-type")?.includes("text/event-stream")
    ? JSON.parse(text.split("\n").find(x=>x.startsWith("data: "))?.slice(6)||"null")
    : JSON.parse(text);
  assert.equal(payload.id,id);
  assert.ok(!payload.error,`${method}: ${JSON.stringify(payload.error)}`);
  return payload.result;
}
const init=await rpc("initialize",{protocolVersion:"2025-03-26",capabilities:{},clientInfo:{name:"hcm-smoke-test",version:"0.1.0"}});
assert.equal(init.serverInfo.name,"hypercodemotion-mcp");
const tools=await rpc("tools/list",{});
assert.ok(tools.tools.some(x=>x.name==="validate_json"));
const call=await rpc("tools/call",{name:"validate_json",arguments:{json:{add:[{id:"smoke",name:"Smoke",type:"rect",start:0,end:1,z:"frente",props:{w:100,h:100}}]}}});
const result=JSON.parse(call.content.find(x=>x.type==="text").text);
assert.equal(result.format,"improvement");
assert.equal(result.valid,true);
assert.equal(result.fullyValidated,false);
console.log("MCP production smoke test passed:",url);

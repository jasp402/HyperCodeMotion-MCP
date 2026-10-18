import test from "node:test";
import assert from "node:assert/strict";
import {getCapabilities,validateJson} from "../src/contract.js";
import handler from "../api/mcp.js";
const json={version:1,name:"Test",width:1080,height:1920,fps:30,duration:6,background:"#111",params:{},layers:[{id:"a",name:"A",type:"text",start:0,end:6,props:{text:"Hello"}}]};
test("catalog is derived from Studio schema",()=>{const c=getCapabilities();assert.ok(c.layerProperties.text.includes("tracking"));assert.ok(c.layerProperties.rect.includes("opacity"));assert.ok(c.presetSlots.fade.includes("in"));});
test("improvement patches use correct format",()=>{const r=validateJson({add:[{id:"b",name:"B",type:"svg",z:"fondo",start:0,end:3,props:{icon:"martini"}}],sfx:[{t:0.5,sound:"whoosh"}]}, {composition:json});assert.equal(r.valid,true);assert.equal(r.format,"improvement");});
test("unsupported effect is reported, without claiming full validation",()=>{const r=validateJson({...json,layers:[{...json.layers[0],fx:{loop:{id:"flicker",dur:1}}}]});assert.ok(r.warnings.some(w=>w.code==="UNKNOWN_EFFECT"));assert.equal(r.fullyValidated,false);});
test("MCP initialize, tools/list and validation",async()=>{
  const call=async(method,params)=>{
    let body;const res={setHeader(){},end(x){body=x},get statusCode(){return this._status},set statusCode(x){this._status=x}};
    await handler({method:"POST",headers:{},body:{jsonrpc:"2.0",id:1,method,params}},res);
    return JSON.parse(body);
  };
  assert.equal((await call("initialize")).result.serverInfo.name,"hypercodemotion-mcp");
  const listed=await call("tools/list");assert.equal(listed.result.tools.length,4);
  const output=await call("tools/call",{name:"validate_json",arguments:{json}});
  assert.equal(JSON.parse(output.result.content[0].text).valid,true);
});

test("Smithery metadata includes descriptions, annotations and output schemas",async()=>{
 const call=async(method)=>{
   let raw; const response={statusCode:200,setHeader(){},end(x){raw=x}};
   await handler({method:"POST",headers:{},body:{jsonrpc:"2.0",id:1,method}},response);
   return JSON.parse(raw).result;
 };
 const init=await call("initialize");
 assert.ok(init.serverInfo.description);
 assert.ok(init.serverInfo.websiteUrl.startsWith("https://"));
 const listed=await call("tools/list");
 for(const tool of listed.tools){
   assert.equal(tool.annotations.readOnlyHint,tool.name!=="create_hcmotion");
   assert.equal(tool.annotations.destructiveHint,false);
   assert.ok(tool.outputSchema);
   assert.ok(tool.title);
 }
});

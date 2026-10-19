import test from "node:test";
import assert from "node:assert/strict";
import handler from "../api/mcp.js";
import { validateComposition } from "../src/validator.js";
import { validateJson, getCapabilities } from "../src/contract.js";

const composition = () => ({
  version: 1, name: "Demo", width: 1080, height: 1920, duration: 6, fps: 30,
  background: "#101018", params: {},
  layers: [{ id: "title", name: "Title", type: "text", start: 0, end: 6,
    props: { text: "Pisco Sour", x: 540, y: 400 }}]
});

async function request(method, body, headers = {}) {
  let payload;
  const response = {
    headers: {}, statusCode: 200,
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
    end(v) { payload = v; }
  };
  await handler({ method, body, headers }, response);
  return { status: response.statusCode, headers: response.headers,
    body: payload === undefined ? undefined : JSON.parse(payload) };
}
const rpc = (method, params, id = 7) => ({jsonrpc: "2.0", id, method, params});
const tool = (name, args) => rpc("tools/call", {name, arguments: args});

test("POST initialize replies with server metadata and protocol version", async () => {
  const r = await request("POST", rpc("initialize", {protocolVersion:"2025-03-26"}));
  assert.equal(r.status, 200);
  assert.equal(r.body.id, 7);
  assert.equal(r.body.result.protocolVersion, "2025-03-26");
  assert.ok(r.body.result.capabilities.tools);
});
test("GET explicitly refuses MCP calls, not a web UI", async () => {
  const r = await request("GET");
  assert.equal(r.status, 405);
  assert.match(r.body.error, /^POST required/);
});
test("OPTIONS preflight responds with CORS headers", async () => {
  const r = await request("OPTIONS");
  assert.equal(r.status, 204);
  assert.ok(r.headers["access-control-allow-methods"].includes("POST"));
});
test("notifications/initialized returns 202 and empty body", async () => {
  const r = await request("POST", {jsonrpc:"2.0",method:"notifications/initialized"});
  assert.equal(r.status, 202);
  assert.equal(r.body, undefined);
});
test("MCP ping is available", async () => {
  const r = await request("POST", rpc("ping"));
  assert.deepEqual(r.body.result, {});
});
test("tools/list includes catalog, file creator and validator", async () => {
  const r = await request("POST", rpc("tools/list"));
  assert.deepEqual(r.body.result.tools.map(x=>x.name),["get_capabilities","create_hcmotion","get_template","validate_json","get_recreation_brief","propose_template","get_proposal_status"]);
});
test("get_capabilities returns recognized layer types and fx", async () => {
  const r = await request("POST", tool("get_capabilities",{}));
  assert.equal(r.status,200);
  const out = JSON.parse(r.body.result.content[0].text);
  assert.ok(out.layerProperties.particles.includes("speedVar"));
  assert.ok(out.presetSlots.draw.includes("in"));
  assert.equal(out.fullyValidated,false);
});
test("validate_json accepts JSON object and JSON string", async () => {
  for(const value of [composition(),JSON.stringify(composition())]) {
    const r = await request("POST",tool("validate_json",{json:value}));
    const out = JSON.parse(r.body.result.content[0].text);
    assert.equal(out.valid,true);
    assert.equal(out.format,"composition");
    assert.equal(out.fullyValidated,false);
  }
});
test("improvement patches with add/sfx are not misclassified as invalid compositions", async () => {
  const patch = {add:[{id:"orb",name:"Orb",type:"ellipse",z:"frente",start:0,end:4,props:{w:200,h:200,x:540,y:960}}],change:[],remove:[],sfx:[{t:2,sound:"whoosh"}]};
  const r = await request("POST",tool("validate_json",{json:patch,composition:composition()}));
  const out=JSON.parse(r.body.result.content[0].text);
  assert.equal(out.valid,true);
  assert.equal(out.format,"improvement");
});
test("unknown effects are flagged without rejecting Studio-compatible structure", () => {
  const c=composition();c.layers[0].fx={loop:{id:"flicker",dur:1}};
  const out=validateJson(c);
  assert.equal(out.valid,true);
  assert.ok(out.warnings.some(w=>w.code==="UNKNOWN_EFFECT"));
});
test("unknown properties and layer types are disclosed",()=>{
  const c=composition();c.layers[0].props.unknownOption=123;
  c.layers.push({id:"other",type:"alien",start:0,end:2,props:{}});
  const out=validateJson(c);
  assert.ok(out.warnings.some(w=>w.code==="UNKNOWN_PROPERTY"));
  assert.ok(out.warnings.some(w=>w.code==="UNKNOWN_LAYER_TYPE"));
});
test("unknown RPC method returns -32601",async()=>{
  const r=await request("POST",rpc("not-a-method"));
  assert.equal(r.body.error.code,-32601);
});
test("unknown tool returns -32602",async()=>{
  const r=await request("POST",tool("erase_everything",{}));
  assert.equal(r.body.error.code,-32602);
});
test("missing JSON argument returns -32602",async()=>{
  const r=await request("POST",tool("validate_json",{}));
  assert.equal(r.body.error.code,-32602);
});
test("invalid JSON string yields isError tool response",async()=>{
  const r=await request("POST",tool("validate_json",{json:"{not-json"}));
  assert.equal(r.body.result.isError,true);
});
test("invalid JSON-RPC envelope fails with -32600",async()=>{
  const r=await request("POST",{jsonrpc:"1.0",id:1,method:"ping"});
  assert.equal(r.status,400);
  assert.equal(r.body.error.code,-32600);
});
test("explicit oversized content-length is rejected",async()=>{
  const r=await request("POST",rpc("ping"),{"content-length":String(4*1024*1024+1)});
  assert.equal(r.status,413);
});
test("structural root and empty operation errors remain distinct",()=>{
  assert.equal(validateComposition(null).errors[0].code,"INVALID_ROOT");
  assert.equal(validateComposition({add:[]}).errors[0].code,"EMPTY_OPERATIONS");
});
test("project context catches unknown changes and clamped layer durations",()=>{
  const patch={add:[{id:"new",type:"rect",start:0,end:99,props:{}}],change:[{id:"missing",props:{x:0}}]};
  const out=validateJson(patch,{composition:composition()});
  assert.ok(out.warnings.some(w=>w.code==="UNKNOWN_CHANGE"));
  assert.ok(out.warnings.some(w=>w.code==="CLAMPED_DURATION"));
});
test("expression text is never evaluated during validation",()=>{
  const c=composition();
  c.layers[0].props.x={expr:"process.exit(1)"};
  assert.equal(validateJson(c).valid,true);
  assert.equal(getCapabilities().fullyValidated,false);
});

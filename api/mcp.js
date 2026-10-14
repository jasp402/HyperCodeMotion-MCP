import {getCapabilities,validateJson} from "../src/contract.js";
const tools=[
{name:"get_capabilities",title:"HyperCodeMotion Capabilities",description:"List HyperCodeMotion JSON formats, supported layer properties, effects, and Studio contract revisions before creating animations.",annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false},inputSchema:{type:"object",properties:{},additionalProperties:false},outputSchema:{type:"object",properties:{contractVersion:{type:"string"},source:{type:"string"},sourceSchemaSha:{type:"string"},sourcePresetsSha:{type:"string"},formats:{type:"array",items:{type:"string"}},layerProperties:{type:"object",additionalProperties:{type:"array",items:{type:"string"}}},presetSlots:{type:"object",additionalProperties:{type:"array",items:{type:"string"}}},fullyValidated:{type:"boolean"}},required:["contractVersion","formats","layerProperties","presetSlots","fullyValidated"]}},
{name:"validate_json",title:"Validate HyperCodeMotion JSON",description:"Check a composition (layers), design (elements), or improvement patch (add/change/remove/sfx) and return actionable errors and warnings. This is preliminary validation, not proof of a successful render.",annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false},inputSchema:{type:"object",properties:{json:{description:"HyperCodeMotion JSON object or JSON-encoded string to validate.",anyOf:[{type:"object"},{type:"string"}]},composition:{type:"object",description:"Optional original composition used to resolve patch references and timings."}},required:["json"],additionalProperties:false},outputSchema:{type:"object",properties:{valid:{type:"boolean"},format:{type:"string"},fullyValidated:{type:"boolean"},mode:{type:"string"},contractVersion:{type:"string"},errors:{type:"array",items:{type:"object",properties:{path:{type:"string"},code:{type:"string"},message:{type:"string"}}}},warnings:{type:"array",items:{type:"object",properties:{path:{type:"string"},code:{type:"string"},message:{type:"string"}}}}},required:["valid","format","fullyValidated","mode","errors","warnings","contractVersion"]}}
];
const reply=(res,status,payload)=>{res.statusCode=status;res.setHeader("Content-Type","application/json");res.setHeader("Cache-Control","no-store");res.end(JSON.stringify(payload));};
const ok=(id,value)=>({jsonrpc:"2.0",id,result:value});
const err=(id,code,message)=>({jsonrpc:"2.0",id,error:{code,message}});
export default async function handler(req,res){
 res.setHeader("Access-Control-Allow-Origin","*");
 res.setHeader("Access-Control-Allow-Methods","POST,OPTIONS");
 res.setHeader("Access-Control-Allow-Headers","Content-Type,Accept,MCP-Protocol-Version");
 if(req.method==="OPTIONS"){res.statusCode=204;return res.end();}
 if(req.method!=="POST")return reply(res,405,{error:"POST required"});
 if(Number(req.headers["content-length"]||0)>1048576)return reply(res,413,{error:"Too large"});
 let data=req.body;
 try{if(typeof data==="string")data=JSON.parse(data);
 if(!data){let chunks=[],len=0;for await(const part of req){len+=part.length;if(len>1048576)return reply(res,413,{error:"Too large"});chunks.push(part);}data=JSON.parse(Buffer.concat(chunks).toString());}}
 catch{return reply(res,400,err(null,-32700,"Invalid JSON"));}
 const id=data?.id??null;
 if(data?.jsonrpc!=="2.0"||typeof data.method!=="string")return reply(res,400,err(id,-32600,"Invalid request"));
 if(data.method.startsWith("notifications/")){res.statusCode=202;return res.end();}
 if(data.method==="initialize")return reply(res,200,ok(id,{protocolVersion:"2025-03-26",capabilities:{tools:{}},serverInfo:{name:"hypercodemotion-mcp",title:"HyperCodeMotion MCP",version:"0.2.0",description:"Read-only HyperCodeMotion JSON validation and layer, effect and format discovery for AI animation workflows.",websiteUrl:"https://github.com/jasp402/HyperCodeMotion-MCP"},instructions:"Call get_capabilities before generating animations; then call validate_json. The check is preliminary (fullyValidated=false), not a render guarantee."}));
 if(data.method==="ping")return reply(res,200,ok(id,{}));
 if(data.method==="tools/list")return reply(res,200,ok(id,{tools}));
 if(data.method==="tools/call"){
  const name=data.params?.name,args=data.params?.arguments||{};
  if(!tools.some(t=>t.name===name))return reply(res,200,err(id,-32602,"Unknown tool"));
  try{
   if(name==="validate_json"&&!Object.hasOwn(args,"json"))return reply(res,200,err(id,-32602,"Missing json"));
   const output=name==="get_capabilities"?getCapabilities():validateJson(typeof args.json==="string"?JSON.parse(args.json):args.json,{composition:args.composition});
   return reply(res,200,ok(id,{content:[{type:"text",text:JSON.stringify(output)}],structuredContent:output,isError:false}));
  }catch(e){return reply(res,200,ok(id,{content:[{type:"text",text:String(e.message||e)}],isError:true}));}
 }
 return reply(res,200,err(id,-32601,"Method not found"));
}
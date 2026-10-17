import {getCapabilities,validateJson} from "../src/contract.js";
import {checkComposition,encodeHcmotion} from "../src/hcmotion.js";
import {saveFile} from "../src/files.js";
const MAX=4*1024*1024;
/** create_hcmotion: Claude's composition JSON → validated .hcmotion file with a 24 h download link. */
async function createHcmotion(args){
 let json=args.json;
 if(typeof json==="string"){try{json=JSON.parse(json);}catch{return {created:false,errors:[{path:"$",code:"INVALID_JSON",message:"The JSON string does not parse. Send the composition object itself."}],warnings:[]};}}
 const report=validateJson(json);
 const errors=report.format!=="composition"?[{path:"$",code:"NOT_A_COMPOSITION",message:"create_hcmotion needs a full composition (version, width, height, fps, duration, layers)."}]:[...report.errors,...checkComposition(json)];
 if(errors.length)return {created:false,errors,warnings:report.warnings};
 if(typeof args.name==="string"&&args.name.trim())json={...json,name:args.name.trim().slice(0,120)};
 const bytes=await encodeHcmotion(json);
 const file=await saveFile(bytes);
 const slug=String(json.name||"proyecto").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,60)||"proyecto";
 const download=`${file.download}/${slug}.hcmotion`;
 return {created:true,download,open:file.open.replace(encodeURIComponent(file.download),encodeURIComponent(download)),expiresAt:file.expiresAt,bytes:bytes.length,errors:[],warnings:report.warnings};
}
const tools=[
{name:"get_capabilities",title:"HyperCodeMotion Capabilities",description:"List the HyperCodeMotion JSON formats, layer types and properties, and effect presets that HyperCodeMotion Studio supports, with the Studio contract revision they come from.",annotations:{title:"HyperCodeMotion Capabilities",readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false},inputSchema:{type:"object",properties:{},additionalProperties:false},outputSchema:{type:"object",properties:{contractVersion:{type:"string"},source:{type:"string"},sourceSchemaSha:{type:"string"},sourcePresetsSha:{type:"string"},formats:{type:"array",items:{type:"string"}},layerProperties:{type:"object",additionalProperties:{type:"array",items:{type:"string"}}},presetSlots:{type:"object",additionalProperties:{type:"array",items:{type:"string"}}},fullyValidated:{type:"boolean"}},required:["contractVersion","formats","layerProperties","presetSlots","fullyValidated"]}},
{name:"create_hcmotion",title:"Create HyperCodeMotion project file",description:"Validate a finished HyperCodeMotion composition and package it as a .hcmotion project file, the format HyperCodeMotion Studio opens. If the composition has problems, returns created: false with the errors to fix and stores nothing. On success, stores the file temporarily and returns an `open` link (opens the project in HyperCodeMotion Studio) and a `download` link; both expire 24 hours after creation. It does not render video or generate media.",annotations:{title:"Create HyperCodeMotion project file",readOnlyHint:false,destructiveHint:false,idempotentHint:false,openWorldHint:false},inputSchema:{type:"object",properties:{json:{description:"The full composition (version, name, width, height, fps, duration, background, layers…), as an object or JSON-encoded string.",anyOf:[{type:"object"},{type:"string"}]},name:{type:"string",description:"Optional project name."}},required:["json"],additionalProperties:false},outputSchema:{type:"object",properties:{created:{type:"boolean"},download:{type:"string"},open:{type:"string"},expiresAt:{type:"string"},bytes:{type:"number"},errors:{type:"array",items:{type:"object",properties:{path:{type:"string"},code:{type:"string"},message:{type:"string"}}}},warnings:{type:"array",items:{type:"object",properties:{path:{type:"string"},code:{type:"string"},message:{type:"string"}}}}},required:["created","errors","warnings"]}},
{name:"validate_json",title:"Validate HyperCodeMotion JSON",description:"Check a composition (layers), design (elements), or improvement patch (add/change/remove/sfx) and return actionable errors and warnings. This is preliminary validation, not proof of a successful render.",annotations:{title:"Validate HyperCodeMotion JSON",readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false},inputSchema:{type:"object",properties:{json:{description:"HyperCodeMotion JSON object or JSON-encoded string to validate.",anyOf:[{type:"object"},{type:"string"}]},composition:{type:"object",description:"Optional original composition used to resolve patch references and timings."}},required:["json"],additionalProperties:false},outputSchema:{type:"object",properties:{valid:{type:"boolean"},format:{type:"string"},fullyValidated:{type:"boolean"},mode:{type:"string"},contractVersion:{type:"string"},errors:{type:"array",items:{type:"object",properties:{path:{type:"string"},code:{type:"string"},message:{type:"string"}}}},warnings:{type:"array",items:{type:"object",properties:{path:{type:"string"},code:{type:"string"},message:{type:"string"}}}}},required:["valid","format","fullyValidated","mode","errors","warnings","contractVersion"]}}
];
const reply=(res,status,payload)=>{res.statusCode=status;res.setHeader("Content-Type","application/json");res.setHeader("Cache-Control","no-store");res.end(JSON.stringify(payload));};
const ok=(id,value)=>({jsonrpc:"2.0",id,result:value});
const err=(id,code,message)=>({jsonrpc:"2.0",id,error:{code,message}});
export default async function handler(req,res){
 res.setHeader("Access-Control-Allow-Origin","*");
 res.setHeader("Access-Control-Allow-Methods","POST,OPTIONS");
 res.setHeader("Access-Control-Allow-Headers","Content-Type,Accept,MCP-Protocol-Version");
 if(req.method==="OPTIONS"){res.statusCode=204;return res.end();}
 if(req.method!=="POST")return reply(res,405,{error:"POST required: this is an MCP endpoint (JSON-RPC 2.0 over HTTP POST). Add https://mcp.hypercodemotion.com/mcp to your MCP client as a remote server."});
 if(Number(req.headers["content-length"]||0)>MAX)return reply(res,413,{error:"Request body is larger than 4 MB."});
 let data=req.body;
 try{if(typeof data==="string")data=JSON.parse(data);
 if(!data){let chunks=[],len=0;for await(const part of req){len+=part.length;if(len>MAX)return reply(res,413,{error:"Request body is larger than 4 MB."});chunks.push(part);}data=JSON.parse(Buffer.concat(chunks).toString());}}
 catch{return reply(res,400,err(null,-32700,"Request body is not valid JSON."));}
 const id=data?.id??null;
 if(data?.jsonrpc!=="2.0"||typeof data.method!=="string")return reply(res,400,err(id,-32600,"Expected a JSON-RPC 2.0 request with jsonrpc: \"2.0\" and a method."));
 if(data.method.startsWith("notifications/")){res.statusCode=202;return res.end();}
 if(data.method==="initialize")return reply(res,200,ok(id,{protocolVersion:"2025-03-26",capabilities:{tools:{}},serverInfo:{name:"hypercodemotion-mcp",title:"HyperCodeMotion MCP",version:"0.3.0",description:"Creates HyperCodeMotion .hcmotion project files from AI-generated composition JSON, with validation and layer, effect and format discovery.",websiteUrl:"https://github.com/jasp402/HyperCodeMotion-MCP"},instructions:"HyperCodeMotion Studio opens .hcmotion project files. get_capabilities lists the supported formats, layers and effects. create_hcmotion validates a finished composition and returns open and download links to its .hcmotion file (valid 24 hours); when created is false, its errors say what to fix. validate_json checks drafts; its check is preliminary, not a render guarantee."}));
 if(data.method==="ping")return reply(res,200,ok(id,{}));
 if(data.method==="tools/list")return reply(res,200,ok(id,{tools}));
 if(data.method==="tools/call"){
  const name=data.params?.name,args=data.params?.arguments||{};
  if(!tools.some(t=>t.name===name))return reply(res,200,err(id,-32602,`Unknown tool ${JSON.stringify(name)}. Available tools: ${tools.map(t=>t.name).join(", ")}.`));
  try{
   if(name==="validate_json"&&!Object.hasOwn(args,"json"))return reply(res,200,err(id,-32602,"Missing required argument json: the HyperCodeMotion JSON to validate."));
   if(name==="create_hcmotion"&&!Object.hasOwn(args,"json"))return reply(res,200,err(id,-32602,"Missing required argument json: the full composition to package."));
   if(name==="create_hcmotion"){const output=await createHcmotion(args);return reply(res,200,ok(id,{content:[{type:"text",text:JSON.stringify(output)}],structuredContent:output,isError:!output.created}));}
   const output=name==="get_capabilities"?getCapabilities():validateJson(typeof args.json==="string"?JSON.parse(args.json):args.json,{composition:args.composition});
   return reply(res,200,ok(id,{content:[{type:"text",text:JSON.stringify(output)}],structuredContent:output,isError:false}));
  }catch(e){return reply(res,200,ok(id,{content:[{type:"text",text:String(e.message||e)}],isError:true}));}
 }
 return reply(res,200,err(id,-32601,`Method ${JSON.stringify(data.method)} is not supported. Supported: initialize, ping, tools/list, tools/call.`));
}
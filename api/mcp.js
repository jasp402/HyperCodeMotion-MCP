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
{name:"get_capabilities",title:"HyperCodeMotion Capabilities",description:"List HyperCodeMotion JSON formats, supported layer properties, effects, and Studio contract revisions before creating animations.",annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false},inputSchema:{type:"object",properties:{},additionalProperties:false},outputSchema:{type:"object",properties:{contractVersion:{type:"string"},source:{type:"string"},sourceSchemaSha:{type:"string"},sourcePresetsSha:{type:"string"},formats:{type:"array",items:{type:"string"}},layerProperties:{type:"object",additionalProperties:{type:"array",items:{type:"string"}}},presetSlots:{type:"object",additionalProperties:{type:"array",items:{type:"string"}}},fullyValidated:{type:"boolean"}},required:["contractVersion","formats","layerProperties","presetSlots","fullyValidated"]}},
{name:"create_hcmotion",title:"Create HyperCodeMotion project file",description:"REQUIRED final step. Turn a finished HyperCodeMotion composition JSON into a .hcmotion project file (the only format HyperCodeMotion Studio opens). Validates it first: if created is false, fix every error and call again. On success give the user the `open` link (opens it in Studio) and the `download` link; both expire after 24 hours. Never paste the JSON to the user instead.",annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:false,openWorldHint:false},inputSchema:{type:"object",properties:{json:{description:"The full composition (version, name, width, height, fps, duration, background, layers…), as an object or JSON-encoded string.",anyOf:[{type:"object"},{type:"string"}]},name:{type:"string",description:"Optional project name."}},required:["json"],additionalProperties:false},outputSchema:{type:"object",properties:{created:{type:"boolean"},download:{type:"string"},open:{type:"string"},expiresAt:{type:"string"},bytes:{type:"number"},errors:{type:"array",items:{type:"object",properties:{path:{type:"string"},code:{type:"string"},message:{type:"string"}}}},warnings:{type:"array",items:{type:"object",properties:{path:{type:"string"},code:{type:"string"},message:{type:"string"}}}}},required:["created","errors","warnings"]}},
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
 if(Number(req.headers["content-length"]||0)>MAX)return reply(res,413,{error:"Too large"});
 let data=req.body;
 try{if(typeof data==="string")data=JSON.parse(data);
 if(!data){let chunks=[],len=0;for await(const part of req){len+=part.length;if(len>MAX)return reply(res,413,{error:"Too large"});chunks.push(part);}data=JSON.parse(Buffer.concat(chunks).toString());}}
 catch{return reply(res,400,err(null,-32700,"Invalid JSON"));}
 const id=data?.id??null;
 if(data?.jsonrpc!=="2.0"||typeof data.method!=="string")return reply(res,400,err(id,-32600,"Invalid request"));
 if(data.method.startsWith("notifications/")){res.statusCode=202;return res.end();}
 if(data.method==="initialize")return reply(res,200,ok(id,{protocolVersion:"2025-03-26",capabilities:{tools:{}},serverInfo:{name:"hypercodemotion-mcp",title:"HyperCodeMotion MCP",version:"0.3.0",description:"Creates HyperCodeMotion .hcmotion project files from AI-generated composition JSON, with validation and layer, effect and format discovery.",websiteUrl:"https://github.com/jasp402/HyperCodeMotion-MCP"},instructions:"Call get_capabilities before generating animations. When the composition is finished, ALWAYS call create_hcmotion: HyperCodeMotion Studio only opens .hcmotion files, never pasted JSON. If created is false, fix the errors and call it again. Give the user the open and download links (valid 24 hours). validate_json is optional for drafts; its check is preliminary, not a render guarantee."}));
 if(data.method==="ping")return reply(res,200,ok(id,{}));
 if(data.method==="tools/list")return reply(res,200,ok(id,{tools}));
 if(data.method==="tools/call"){
  const name=data.params?.name,args=data.params?.arguments||{};
  if(!tools.some(t=>t.name===name))return reply(res,200,err(id,-32602,"Unknown tool"));
  try{
   if(name==="validate_json"&&!Object.hasOwn(args,"json"))return reply(res,200,err(id,-32602,"Missing json"));
   if(name==="create_hcmotion"&&!Object.hasOwn(args,"json"))return reply(res,200,err(id,-32602,"Missing json"));
   if(name==="create_hcmotion"){const output=await createHcmotion(args);return reply(res,200,ok(id,{content:[{type:"text",text:JSON.stringify(output)}],structuredContent:output,isError:!output.created}));}
   const output=name==="get_capabilities"?getCapabilities():validateJson(typeof args.json==="string"?JSON.parse(args.json):args.json,{composition:args.composition});
   return reply(res,200,ok(id,{content:[{type:"text",text:JSON.stringify(output)}],structuredContent:output,isError:false}));
  }catch(e){return reply(res,200,ok(id,{content:[{type:"text",text:String(e.message||e)}],isError:true}));}
 }
 return reply(res,200,err(id,-32601,"Method not found"));
}
import {getCapabilities,validateJson} from "../src/contract.js";
const tools=[
{name:"get_capabilities",description:"List supported HyperCodeMotion formats and source-pinned layer/effect rules.",inputSchema:{type:"object",properties:{}}},
{name:"validate_json",description:"Preflight HyperCodeMotion composition, design or improvement JSON. This does not guarantee render success.",inputSchema:{type:"object",properties:{json:{description:"JSON object or JSON string"},composition:{type:"object",description:"Optional original project for improvement validation"}},required:["json"]}}
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
 if(data.method==="initialize")return reply(res,200,ok(id,{protocolVersion:"2025-03-26",capabilities:{tools:{}},serverInfo:{name:"hypercodemotion-mcp",version:"0.2.0"}}));
 if(data.method==="ping")return reply(res,200,ok(id,{}));
 if(data.method==="tools/list")return reply(res,200,ok(id,{tools}));
 if(data.method==="tools/call"){
  const name=data.params?.name,args=data.params?.arguments||{};
  if(!tools.some(t=>t.name===name))return reply(res,200,err(id,-32602,"Unknown tool"));
  try{
   if(name==="validate_json"&&!Object.hasOwn(args,"json"))return reply(res,200,err(id,-32602,"Missing json"));
   const output=name==="get_capabilities"?getCapabilities():validateJson(typeof args.json==="string"?JSON.parse(args.json):args.json,{composition:args.composition});
   return reply(res,200,ok(id,{content:[{type:"text",text:JSON.stringify(output)}],isError:false}));
  }catch(e){return reply(res,200,ok(id,{content:[{type:"text",text:String(e.message||e)}],isError:true}));}
 }
 return reply(res,200,err(id,-32601,"Method not found"));
}
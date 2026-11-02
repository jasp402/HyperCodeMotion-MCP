// Templates from HyperCodeMotion Studio's Explore gallery. Each one is published by the Studio in
// three variants (square for 1:1, 3:4 and 4:3; vertical; horizontal), so new templates need no change here.
const BASE=process.env.HCM_TEMPLATES_URL||"https://app.hypercodemotion.com/plantillas";
const FORMATS=["16:9","9:16","1:1","4:3","3:4"];
const SIZES={"16:9":[1920,1080],"9:16":[1080,1920],"1:1":[1080,1080],"4:3":[1440,1080],"3:4":[1080,1440]};
const variant=f=>f==="16:9"?"horizontal":f==="9:16"?"vertical":"cuadrado";
import {readTemplate} from "./community.js";
const cache=new Map();
/** A template's replaceable slots: layers named «Hueco · …» (the user's photo, clips and texts). */
const SLOT=/^Hueco · /;
export function slotsOf(comp){
 return (comp.layers??[]).filter(l=>SLOT.test(String(l.name??""))).map(l=>({id:l.id,type:l.type,name:String(l.name).replace(SLOT,""),...(l.type==="text"?{text:String(l.props?.text??"")}:{}),...(l.type==="image"||l.type==="video"?{asset:l.props?.asset}:{})}));
}
// Embedded files above this size (the demo photo and clips of a slot template) never go to the model: they would cost
// hundreds of thousands of tokens and the user replaces them in the Studio anyway.
const HEAVY=8000;
async function load(args,fetcher,community){
 const slug=String(args.template??"").trim().toLowerCase(),format=args.format??"16:9";
 if(!/^[a-z0-9][a-z0-9-]{0,63}$/.test(slug))return {error:"template must be a template id such as \"mix-promo-editorial\"."};
 if(!FORMATS.includes(format))return {error:`format must be one of ${FORMATS.join(", ")}.`};
 const url=`${BASE}/${slug}-${variant(format)}.json`;
 // «Community» templates (ids c-…) live in this server's own store, not in the Studio's files
 const src=slug.startsWith("c-")?await community(slug,variant(format)).catch(()=>null):await (cache.has(url)?cache:cache.set(url,fetcher(url).then(r=>r.ok?r.json():null).catch(()=>null))).get(url);
 if(!src||typeof src!=="object"||!Array.isArray(src.layers)){cache.delete(url);return {error:`No template with id ${JSON.stringify(slug)}.`};}
 return {slug,format,src};
}
/** get_template: a gallery template's full design (HTML scenes, layers, brief) in the requested format. */
export async function getTemplate(args,fetcher=fetch,community=readTemplate){
 const t=await load(args,fetcher,community);
 if(t.error)return {found:false,error:t.error};
 const {slug,format,src}=t;
 const {audio,community:_,...composition}=structuredClone(src);
 [composition.width,composition.height]=SIZES[format];
 const omitted=Object.keys(composition.assets??{}).filter(k=>typeof composition.assets[k]==="string"&&composition.assets[k].length>HEAVY);
 for(const k of omitted)composition.assets[k]=composition.assets[k].slice(0,composition.assets[k].indexOf(",")+1)+"omitted";
 const name=String(src.name||slug).replace(/\s*\((horizontal|vertical|cuadrado)\)$/,"");
 const slots=slotsOf(src);
 return {found:true,template:slug,name,format,brief:src.brief??"",scenes:(src.scenes??[]).map(s=>({name:s.name,start:s.start,end:s.end,transition:s.transition?.type??null})),
  ...(slots.length?{slots,fill:"This is a slot template: do not redesign or re-animate it. Call fill_template with the template id, the format and the new text of each text slot (by layer id); the user replaces the photo and clips in the Studio, where the animation stays as it is."}:{}),
  ...(omitted.length?{assetsOmitted:omitted}:{}),composition};
}
/** fill_template: a slot template with new texts, kept whole (design, motion, music and demo files). */
export async function fillTemplate(args,fetcher=fetch,community=readTemplate){
 const t=await load(args,fetcher,community);
 if(t.error)return {error:t.error};
 const {slug,format,src}=t;
 const slots=slotsOf(src);
 if(!slots.length)return {error:`${slug} has no slots: follow it with get_template and create_hcmotion instead.`};
 const texts=args.texts??{};
 if(typeof texts!=="object"||Array.isArray(texts))return {error:"texts must be an object: {\"<layer id>\": \"new text\"}."};
 const {community:_,...comp}=structuredClone(src);
 [comp.width,comp.height]=SIZES[format];
 const errors=[];
 for(const [id,value] of Object.entries(texts)){
  const slot=slots.find(s=>s.id===id);
  if(!slot){errors.push(`${id}: not a slot of ${slug}. Slots: ${slots.map(s=>s.id).join(", ")}.`);continue;}
  if(slot.type!=="text"){errors.push(`${id} (${slot.name}) is a ${slot.type} slot: the user replaces it in the Studio.`);continue;}
  if(typeof value!=="string"||!value.trim()||value.length>200){errors.push(`${id}: the text must be a non-empty string of at most 200 characters.`);continue;}
  comp.layers.find(l=>l.id===id).props.text=value;
 }
 if(errors.length)return {error:errors.join(" ")};
 if(typeof args.name==="string"&&args.name.trim())comp.name=args.name.trim().slice(0,120);
 return {composition:comp,slots:slotsOf(comp)};
}
export const TEMPLATE_FORMATS=FORMATS;

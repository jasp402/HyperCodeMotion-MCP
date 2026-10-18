// Templates from HyperCodeMotion Studio's Explore gallery. Each one is published by the Studio in
// three variants (square for 1:1, 3:4 and 4:3; vertical; horizontal), so new templates need no change here.
const BASE=process.env.HCM_TEMPLATES_URL||"https://app.hypercodemotion.com/plantillas";
const FORMATS=["16:9","9:16","1:1","4:3","3:4"];
const SIZES={"16:9":[1920,1080],"9:16":[1080,1920],"1:1":[1080,1080],"4:3":[1440,1080],"3:4":[1080,1440]};
const variant=f=>f==="16:9"?"horizontal":f==="9:16"?"vertical":"cuadrado";
const cache=new Map();
/** get_template: a gallery template's full design (HTML scenes, layers, brief) in the requested format. */
export async function getTemplate(args,fetcher=fetch){
 const slug=String(args.template??"").trim().toLowerCase(),format=args.format??"16:9";
 if(!/^[a-z0-9][a-z0-9-]{0,63}$/.test(slug))return {found:false,error:"template must be a template id such as \"mix-promo-editorial\"."};
 if(!FORMATS.includes(format))return {found:false,error:`format must be one of ${FORMATS.join(", ")}.`};
 const url=`${BASE}/${slug}-${variant(format)}.json`;
 if(!cache.has(url))cache.set(url,fetcher(url).then(r=>r.ok?r.json():null).catch(()=>null));
 const src=await cache.get(url);
 if(!src||typeof src!=="object"||!Array.isArray(src.layers)){cache.delete(url);return {found:false,error:`No template with id ${JSON.stringify(slug)}.`};}
 const {audio,...composition}=structuredClone(src);
 [composition.width,composition.height]=SIZES[format];
 const name=String(src.name||slug).replace(/\s*\((horizontal|vertical|cuadrado)\)$/,"");
 return {found:true,template:slug,name,format,brief:src.brief??"",scenes:(src.scenes??[]).map(s=>({name:s.name,start:s.start,end:s.end,transition:s.transition?.type??null})),composition};
}
export const TEMPLATE_FORMATS=FORMATS;

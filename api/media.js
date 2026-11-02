import { putPart, finishFile, uploadStatus, PART_BYTES, MAX_ONE } from "../src/media.js";

const json = (res, status, payload) => { res.statusCode = status; res.setHeader("Content-Type", "application/json"); res.setHeader("Cache-Control", "no-store"); res.end(JSON.stringify(payload)); };
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
async function body(req) {
  if (Buffer.isBuffer(req.body)) return req.body;
  if (req.body instanceof Uint8Array) return Buffer.from(req.body);
  const chunks = []; let len = 0;
  for await (const part of req) { len += part.length; if (len > PART_BYTES) throw new Error("too large"); chunks.push(part); }
  return Buffer.concat(chunks);
}

/**
 * The user's files for a project (see src/media.js).
 *   GET  /m/<upload>/<key>                                     drop page for the user
 *   GET  /api/media?upload=&key=&op=status                     which files arrived
 *   POST /api/media?upload=&key=&op=part&file=<id>&part=<n>    one part (≤ 3 MB, raw bytes)
 *   POST /api/media?upload=&key=&op=done&file=<id>&parts=<n>   all parts of that file sent
 */
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const url = new URL(req.url || "/", "http://x");
  const q = k => String(req.query?.[k] ?? url.searchParams.get(k) ?? "");
  const upload = q("upload"), key = q("key"), op = q("op");
  if (req.method === "OPTIONS") { res.statusCode = 204; return res.end(); }
  if (req.method === "GET" && op === "status") {
    const s = await uploadStatus(upload, key);
    return s ? json(res, 200, s) : json(res, 404, { error: "No upload session with that key (they last 24 h)." });
  }
  if (req.method === "GET") return page(res, upload, key);
  if (req.method !== "POST") { res.statusCode = 405; return res.end(); }
  if (op === "part") {
    let bytes;
    try { bytes = await body(req); } catch { return json(res, 413, { ok: false, error: `Each part must have at most ${PART_BYTES} bytes.` }); }
    const r = await putPart(upload, key, q("file"), q("part"), new Uint8Array(bytes));
    return json(res, r.ok ? 200 : 400, r);
  }
  if (op === "done") {
    const r = await finishFile(upload, key, q("file"), q("parts"));
    return json(res, r.ok ? 200 : 400, r);
  }
  return json(res, 400, { ok: false, error: "op must be part, done or status." });
}

async function page(res, upload, key) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  const s = await uploadStatus(upload, key);
  if (!s) { res.statusCode = 404; return res.end("<p>Enlace de subida no válido o caducado (duran 24 h).</p>"); }
  const base = `/api/media?upload=${encodeURIComponent(upload)}&key=${encodeURIComponent(key)}`;
  res.statusCode = 200;
  res.end(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sube tus archivos · HyperCodeMotion</title>
<style>:root{color-scheme:dark}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0d0e14;color:#eceaf4;font:15px/1.5 system-ui,sans-serif}main{width:min(620px,92vw);padding:32px 0}h1{font-size:22px;margin:0 0 6px}p{color:#a9a7b8;margin:0 0 18px}ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}li{display:flex;align-items:center;gap:12px;padding:12px 14px;border:2px dashed #4b4d68;border-radius:12px;cursor:pointer;transition:.15s}li.on{border-color:#9b5cf6;background:#9b5cf611}li.ok{border-style:solid;border-color:#3c7a57}li b{font-family:ui-monospace,monospace}li span{flex:1;color:#a9a7b8;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}li i{font-style:normal;font-size:13px}.ok i{color:#7be0a3}.err{color:#ff8a8a}#all{margin-top:14px;border:2px dashed #4b4d68;border-radius:14px;padding:26px;text-align:center;cursor:pointer}</style></head><body><main>
<h1>Sube los archivos del proyecto</h1>
<p>Suelta cada archivo en su casilla (o todos juntos abajo: se reparten en orden). Van dentro del .hcmotion; máx. ${Math.round(MAX_ONE / 1048576)} MB por archivo y 200 MB en total. Cuando estén todos en verde, vuelve al chat y escribe «listo».</p>
<ul id="list">${s.files.map(f => `<li data-id="${esc(f.id)}" class="${f.received ? "ok" : ""}"><b>${esc(f.id)}</b><span>${esc(f.name || "")}</span><i>${f.received ? "recibido" : "soltar aquí"}</i><input type="file" hidden></li>`).join("")}</ul>
<label id="all"><input type="file" multiple hidden><b>Soltar varios a la vez</b></label>
<p id="msg"></p>
<script>
const base=${JSON.stringify(base)},P=${PART_BYTES},MAX=${MAX_ONE};
const msg=document.getElementById('msg');
async function send(li,file){
  const id=li.dataset.id,st=li.querySelector('i');
  if(file.size>MAX){st.textContent='pesa demasiado';st.className='err';return;}
  const n=Math.max(1,Math.ceil(file.size/P));
  try{
    for(let i=0;i<n;i++){
      st.textContent='enviando '+Math.round(i/n*100)+'%';st.className='';
      const r=await fetch(base+'&op=part&file='+encodeURIComponent(id)+'&part='+i,{method:'POST',body:new Blob([await file.slice(i*P,(i+1)*P).arrayBuffer()])});
      const j=await r.json().catch(()=>({}));if(!r.ok||!j.ok)throw new Error(j.error||('respuesta '+r.status));
    }
    const d=await fetch(base+'&op=done&file='+encodeURIComponent(id)+'&parts='+n,{method:'POST'});const j=await d.json().catch(()=>({}));
    if(!d.ok||!j.ok)throw new Error(j.error||('respuesta '+d.status));
    li.classList.add('ok');st.textContent='recibido';
    if(!document.querySelector('#list li:not(.ok)'))msg.textContent='Listo. Vuelve al chat y escribe «listo».';
  }catch(e){st.textContent=e.message;st.className='err';}
}
for(const li of document.querySelectorAll('#list li')){
  const inp=li.querySelector('input');li.onclick=()=>inp.click();inp.onchange=()=>inp.files[0]&&send(li,inp.files[0]);
  li.addEventListener('dragover',e=>{e.preventDefault();li.classList.add('on')});li.addEventListener('dragleave',()=>li.classList.remove('on'));
  li.addEventListener('drop',e=>{e.preventDefault();li.classList.remove('on');e.dataTransfer.files[0]&&send(li,e.dataTransfer.files[0]);});
}
const all=document.getElementById('all'),ai=all.querySelector('input');
const many=fs=>{const free=[...document.querySelectorAll('#list li:not(.ok)')];[...fs].forEach((f,i)=>free[i]&&send(free[i],f));};
ai.onchange=()=>many(ai.files);all.addEventListener('dragover',e=>e.preventDefault());all.addEventListener('drop',e=>{e.preventDefault();many(e.dataTransfer.files);});
</script></main></body></html>`);
}

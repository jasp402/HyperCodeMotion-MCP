/**
 * GET /subir/<id>/<key>: page where a moderator drops the original video when neither the server nor their
 * Claude can download it (prompt-motion.com refuses both). It sends the file in parts to the same upload
 * endpoints the caller's script uses (op=upload, op=upload-done), so nothing else changes.
 */
const PART = 3_000_000, MAX_PARTS = 20;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
export default function handler(req, res) {
  const url = new URL(req.url || "/", "http://x");
  const id = String(req.query?.id ?? url.searchParams.get("id") ?? ""), key = String(req.query?.key ?? url.searchParams.get("key") ?? "");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  if (!/^c-[a-z0-9-]{3,62}$/.test(id) || !/^[0-9a-f]{32}$/.test(key)) { res.statusCode = 404; return res.end("<p>Enlace de subida no válido.</p>"); }
  res.statusCode = 200;
  res.end(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Subir video · HyperCodeMotion</title>
<style>:root{color-scheme:dark}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0d0e14;color:#eceaf4;font:15px/1.5 system-ui,sans-serif}main{width:min(560px,92vw)}h1{font-size:22px;margin:0 0 6px}p{color:#a9a7b8;margin:0 0 18px}#drop{border:2px dashed #4b4d68;border-radius:14px;padding:44px 20px;text-align:center;cursor:pointer;transition:.15s}#drop.on{border-color:#9b5cf6;background:#9b5cf611}#bar{height:6px;border-radius:3px;background:#24263a;margin-top:18px;overflow:hidden}#bar i{display:block;height:100%;width:0;background:linear-gradient(90deg,#9b5cf6,#ff7a45);transition:width .2s}#msg{margin-top:12px;min-height:22px}.ok{color:#7be0a3}.err{color:#ff8a8a}code{color:#c9c6ff}</style></head><body><main>
<h1>Sube el video original</h1>
<p>Plantilla <code>${esc(id)}</code>. Descárgalo desde su página (clic derecho sobre el video → «Guardar video como…») y suéltalo aquí. Luego vuelve al chat y escribe «listo».</p>
<label id="drop"><input id="f" type="file" accept="video/mp4" hidden><b>Suelta aquí el .mp4</b><br><span style="color:#a9a7b8">o haz clic para elegirlo</span></label>
<div id="bar"><i></i></div><div id="msg"></div>
<script>
const base=${JSON.stringify(`/api/community?id=${id}&key=${key}`)},P=${PART},MAX=${MAX_PARTS};
const drop=document.getElementById('drop'),inp=document.getElementById('f'),bar=document.querySelector('#bar i'),msg=document.getElementById('msg');
const say=(t,c='')=>{msg.textContent=t;msg.className=c;};
async function send(file){
  if(!file)return;
  if(!/\\.mp4$/i.test(file.name)&&file.type!=='video/mp4')return say('Tiene que ser el .mp4 del video.','err');
  const n=Math.ceil(file.size/P);
  if(n>MAX)return say('El video pesa más de '+Math.round(P*MAX/1e6)+' MB.','err');
  drop.style.pointerEvents='none';
  try{
    for(let i=0;i<n;i++){
      say('Enviando parte '+(i+1)+' de '+n+'…');
      const r=await fetch(base+'&op=upload&part='+i,{method:'POST',body:new Blob([await file.slice(i*P,(i+1)*P).arrayBuffer()])});
      const j=await r.json().catch(()=>({}));
      if(!r.ok||!j.ok)throw new Error(j.error||('respuesta '+r.status));
      bar.style.width=((i+1)/n*100)+'%';
    }
    const d=await fetch(base+'&op=upload-done&parts='+n,{method:'POST'});const j=await d.json().catch(()=>({}));
    if(!d.ok||!j.ok)throw new Error(j.error||('respuesta '+d.status));
    say('Listo. Vuelve al chat y escribe «listo».','ok');
  }catch(e){say('No se pudo enviar: '+e.message,'err');drop.style.pointerEvents='';}
}
inp.onchange=()=>send(inp.files[0]);
['dragover','dragenter'].forEach(e=>drop.addEventListener(e,ev=>{ev.preventDefault();drop.classList.add('on');}));
['dragleave','drop'].forEach(e=>drop.addEventListener(e,ev=>{ev.preventDefault();drop.classList.remove('on');}));
drop.addEventListener('drop',ev=>send(ev.dataTransfer.files[0]));
</script></main></body></html>`);
}

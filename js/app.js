/* =========================================================
   APLICACIÓN
   ========================================================= */
const $ = s => document.querySelector(s);
const panel = $('#panel'), preview = $('#preview'), inpNombre = $('#proj-name');
const listaTpl = $('#tpl-list'), listaProj = $('#proj-list'), notaAlmacen = $('#store-note');

let TPL = RUBROS[0];
let D = clonar(TPL.d);
let proyectoId = null;
let cap = { db:null, downloads:null };

function clonar(o){ return JSON.parse(JSON.stringify(o)); }
function aviso(txt){
  const t = $('#toast'); t.textContent = txt; t.classList.add('on');
  clearTimeout(aviso._t); aviso._t = setTimeout(()=>t.classList.remove('on'), 2400);
}
function leerLocal(k, alt){ try{ return JSON.parse(localStorage.getItem(k)) ?? alt; }catch(e){ return alt; } }
function escribirLocal(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }

/* ---------- borradores: nunca se pierde lo que estabas editando ---------- */
const BORRADORES = 'taller.borradores';
function guardarBorrador(){ const b = leerLocal(BORRADORES,{}); b[TPL.id] = D; escribirLocal(BORRADORES,b); }
function leerBorrador(id){ return leerLocal(BORRADORES,{})[id] || null; }

/* ---------- rutas dentro del objeto de datos ---------- */
function fijar(obj, ruta, valor){
  const seg = ruta.split('.'); let cur = obj;
  for(let i=0;i<seg.length-1;i++) cur = cur[seg[i]];
  cur[seg[seg.length-1]] = valor;
}
function obtener(obj, ruta){
  return ruta.split('.').reduce((o,k)=> (o==null?o:o[k]), obj);
}

/* =========================================================
   PANEL DE CAMPOS
   ========================================================= */
function idDe(ruta){ return 'f-' + ruta.replace(/\./g,'-'); }

function campoHTML(c, ruta, esCabecera){
  const v = obtener(D, ruta) ?? '';
  const id = idDe(ruta);
  const head = esCabecera ? ' data-head="1"' : '';
  switch(c.t){
    case 'textarea':
      return `<div class="fld"><label for="${id}">${esc(c.l)}</label>
        <textarea id="${id}" data-path="${esc(ruta)}"${head}>${esc(v)}</textarea></div>`;
    case 'color':
      return `<div class="fld"><label for="${id}">${esc(c.l)}</label>
        <div class="color-row"><input type="color" id="${id}" data-path="${esc(ruta)}" value="${esc(v)}">
        <code data-eco="${esc(ruta)}">${esc(v)}</code></div></div>`;
    case 'select':
      return `<div class="fld"><label for="${id}">${esc(c.l)}</label>
        <select id="${id}" data-path="${esc(ruta)}">
        ${c.opts.map(o=>`<option value="${esc(o.v)}"${o.v===v?' selected':''}>${esc(o.l)}</option>`).join('')}
        </select></div>`;
    case 'img':
      return `<div class="fld"><label for="${id}">${esc(c.l)}</label>
        <input type="text" id="${id}" data-path="${esc(ruta)}" value="${esc(v)}" placeholder="https://…">
        <span class="hint">Vacío = se dibuja un fondo de color. La vista previa no carga imágenes externas, pero sí se ven en la página exportada.</span></div>`;
    case 'lista':
      return listaHTML(c, ruta);
    default:
      return `<div class="fld"><label for="${id}">${esc(c.l)}</label>
        <input type="text" id="${id}" data-path="${esc(ruta)}" value="${esc(v)}"${head}></div>`;
  }
}

function listaHTML(c, ruta){
  const arr = obtener(D, ruta) || [];
  return `<div class="fld"><label>${esc(c.l)}</label>
    <div class="list-stack" data-list="${esc(ruta)}">${arr.map((_,i)=>itemHTML(c,ruta,i)).join('')}</div>
    <button class="add" type="button" data-act="add" data-key="${esc(ruta)}">${esc(c.add||'Agregar')}</button>
  </div>`;
}

function itemHTML(c, ruta, i){
  const it = obtener(D, ruta)[i] || {};
  const primero = c.item[0].k;
  const rotulo = String(it[primero] || '').trim() || `Ítem ${i+1}`;
  return `<div class="item" data-i="${i}">
    <div class="item-h">
      <b>${esc(rotulo)}</b>
      <button type="button" data-act="up"   data-key="${esc(ruta)}" data-i="${i}" title="Subir" aria-label="Subir">↑</button>
      <button type="button" data-act="down" data-key="${esc(ruta)}" data-i="${i}" title="Bajar" aria-label="Bajar">↓</button>
      <button type="button" class="rm" data-act="rm" data-key="${esc(ruta)}" data-i="${i}" title="Quitar" aria-label="Quitar">✕</button>
    </div>
    <div class="item-b">
      ${c.item.map((sc,j)=> campoHTML(sc, `${ruta}.${i}.${sc.k}`, j===0)).join('')}
    </div>
  </div>`;
}

function camposVisibles(){
  return camposDe(TPL).filter(c => c.k !== '_cardStyle' || TPL.secciones.includes('cards'));
}

function pintarPanel(){
  const grupos = [];
  camposVisibles().forEach(c=>{
    let g = grupos.find(x=>x.n===c.g);
    if(!g){ g = {n:c.g, cs:[]}; grupos.push(g); }
    g.cs.push(c);
  });
  panel.innerHTML = grupos.map((g,i)=>`
    <details class="grp"${i<2?' open':''}>
      <summary>${esc(g.n)}</summary>
      <div class="grp-body">${g.cs.map(c=>campoHTML(c, c.k)).join('')}</div>
    </details>`).join('');
}

panel.addEventListener('input', e=>{
  const el = e.target, ruta = el.dataset.path;
  if(!ruta) return;
  fijar(D, ruta, el.value);
  const eco = panel.querySelector(`[data-eco="${CSS.escape(ruta)}"]`);
  if(eco) eco.textContent = el.value;
  if(el.dataset.head){
    const item = el.closest('.item');
    if(item) item.querySelector('.item-h b').textContent = el.value.trim() || 'Sin título';
  }
  tocar();
});

panel.addEventListener('click', e=>{
  const b = e.target.closest('button[data-act]');
  if(!b) return;
  const ruta = b.dataset.key, acto = b.dataset.act;
  const c = camposVisibles().find(x=>x.k===ruta.split('.')[0]);
  const arr = obtener(D, ruta);
  const i = Number(b.dataset.i);
  if(acto==='add')  arr.push(clonar(c.nuevo));
  if(acto==='rm')   arr.splice(i,1);
  if(acto==='up'   && i>0)            arr.splice(i-1,0,arr.splice(i,1)[0]);
  if(acto==='down' && i<arr.length-1) arr.splice(i+1,0,arr.splice(i,1)[0]);
  const cont = panel.querySelector(`[data-list="${CSS.escape(ruta)}"]`);
  if(cont) cont.innerHTML = arr.map((_,k)=>itemHTML(c,ruta,k)).join('');
  tocar();
});

/* =========================================================
   VISTA PREVIA
   ========================================================= */
let tPrev, tGuard;
function tocar(){
  clearTimeout(tPrev); tPrev = setTimeout(pintarVista, 200);
  guardarBorrador();
  if(proyectoId){ clearTimeout(tGuard); tGuard = setTimeout(()=>guardar(true), 1400); }
}
function pintarVista(){
  let y = 0;
  try{ y = preview.contentWindow.scrollY || 0; }catch(e){}
  preview.onload = ()=>{ try{ preview.contentWindow.scrollTo(0,y); }catch(e){} };
  preview.srcdoc = renderDoc(TPL, D);
}

/* =========================================================
   RUBROS Y PROYECTOS
   ========================================================= */
function pintarRubros(){
  $('#rubro-count').textContent = RUBROS.length;
  listaTpl.innerHTML = RUBROS.map(r=>`
    <button class="tpl" type="button" data-rubro="${r.id}" aria-current="${r.id===TPL.id}">
      <span class="chip">${esc(r.ini)}</span>
      <span><b>${esc(r.rubro)}</b><span>${esc(r.sub)}</span></span>
    </button>`).join('');
}
listaTpl.addEventListener('click', e=>{
  const b = e.target.closest('[data-rubro]'); if(!b) return;
  abrirRubro(b.dataset.rubro);
  if(innerWidth<=1040) irA('editar');
});

function abrirRubro(id, datos, pid, nombre){
  TPL = RUBROS.find(r=>r.id===id) || RUBROS[0];
  D = clonar(datos || leerBorrador(TPL.id) || TPL.d);
  camposVisibles().forEach(c=>{ if(D[c.k]===undefined) D[c.k] = clonar(TPL.d[c.k] ?? (c.t==='lista'?[]:'')); });
  proyectoId = pid || null;
  inpNombre.value = nombre || (TPL.d.marca + ' — ' + TPL.rubro);
  pintarRubros(); pintarPanel(); pintarVista(); pintarProyectos();
}

function pintarProyectos(items){
  const arr = items || almacen.cache || [];
  almacen.cache = arr;
  listaProj.innerHTML = arr.length
    ? arr.map(p=>`<button class="proj" type="button" data-proj="${esc(p.id)}" aria-current="${p.id===proyectoId}">
        <b>${esc(p.nombre)}</b>
        <span class="del" data-del="${esc(p.id)}" role="button" tabindex="0" title="Borrar" aria-label="Borrar proyecto">✕</span>
      </button>`).join('')
    : `<p class="empty">Todavía no guardaste ninguna página. Editá una plantilla y tocá <b>Guardar</b>.</p>`;
}
listaProj.addEventListener('click', async e=>{
  const del = e.target.closest('[data-del]');
  if(del){ e.stopPropagation(); await borrar(del.dataset.del); return; }
  const b = e.target.closest('[data-proj]'); if(!b) return;
  const p = (almacen.cache||[]).find(x=>x.id===b.dataset.proj); if(!p) return;
  abrirRubro(p.rubro, p.datos, p.id, p.nombre);
  if(innerWidth<=1040) irA('editar');
});

/* =========================================================
   ALMACENAMIENTO — nube del artefacto, o este navegador
   ========================================================= */
const CLAVE_LOCAL = 'taller.proyectos';
const almacen = {
  cache: [],
  async init(){
    try{ cap.db = window.claude?.use ? await claude.use('db') : null; }catch(e){ cap.db = null; }
    try{ cap.downloads = window.claude?.use ? await claude.use('downloads') : null; }catch(e){ cap.downloads = null; }
    if(cap.db){
      notaAlmacen.textContent = 'En la nube de esta página: tus proyectos te siguen a cualquier dispositivo donde abras este enlace.';
      cap.db.collection('proyectos').orderBy('fecha','desc').limit(100).onSnapshot(
        snap => {
          const arr = snap.docs.map(d=>({id:d.id, ...d.data()}));
          if(!arr.length){
            const locales = leerLocal(CLAVE_LOCAL, []);
            if(locales.length) locales.forEach(p => cap.db.doc('proyectos/'+p.id).set({
              nombre:p.nombre, rubro:p.rubro, datos:p.datos, fecha:p.fecha
            }).catch(()=>{}));
          }
          pintarProyectos(arr);
        },
        err => {
          notaAlmacen.textContent = 'En este navegador. La nube no está disponible ahora mismo.';
          cap.db = null; pintarProyectos(leerLocal(CLAVE_LOCAL, []));
        }
      );
    }else{
      notaAlmacen.textContent = 'En este navegador. Exportá el HTML para tener una copia que no dependa de acá.';
      pintarProyectos(leerLocal(CLAVE_LOCAL, []));
    }
  }
};

async function guardar(silencioso){
  const nombre = inpNombre.value.trim() || 'Página sin título';
  if(!proyectoId) proyectoId = 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2,6);
  const cuerpo = { nombre, rubro:TPL.id, datos:clonar(D), fecha:Date.now() };
  if(cap.db){
    try{ await cap.db.doc('proyectos/'+proyectoId).set(cuerpo); }
    catch(err){
      const c = err && err.code;
      aviso(c==='quota_exceeded' ? 'Se llenó el espacio: borrá algún proyecto viejo.'
          : c==='invalid_argument' ? 'No tenés permiso para guardar en esta página.'
          : 'No se pudo guardar. Probá de nuevo.');
      return;
    }
  }else{
    const arr = leerLocal(CLAVE_LOCAL, []).filter(p=>p.id!==proyectoId);
    arr.unshift({id:proyectoId, ...cuerpo});
    escribirLocal(CLAVE_LOCAL, arr);
    pintarProyectos(arr);
  }
  if(!silencioso) aviso('Proyecto guardado');
}

async function borrar(id){
  if(cap.db){ try{ await cap.db.doc('proyectos/'+id).delete(); }catch(e){} }
  else{
    const arr = leerLocal(CLAVE_LOCAL, []).filter(p=>p.id!==id);
    escribirLocal(CLAVE_LOCAL, arr); pintarProyectos(arr);
  }
  if(id===proyectoId) proyectoId = null;
  aviso('Proyecto borrado');
}

/* =========================================================
   EXPORTAR Y VER EL CÓDIGO
   ========================================================= */
/* Descarga directa del navegador: es la vía normal en el sitio publicado. */
function descargarBlob(nombre, html){
  try{
    const url = URL.createObjectURL(new Blob([html], {type:'text/html;charset=utf-8'}));
    const a = document.createElement('a');
    a.href = url; a.download = nombre; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url), 4000);
    return true;
  }catch(e){ return false; }
}

async function exportar(){
  const html = renderDoc(TPL, D);
  const nombre = slug(D.marca || TPL.rubro) + '.html';
  // Dentro del visor de Artifacts la descarga pasa por la capacidad del anfitrión.
  if(cap.downloads){
    try{
      await cap.downloads.save({ filename:nombre, data:html });
      aviso('Descargado ' + nombre); return;
    }catch(err){
      const c = err && err.code;
      if(c==='declined') return;
      if(c==='rate_limited'){ verCodigo(html, 'Hay otra descarga esperando respuesta. Mientras tanto, copiá el código.'); return; }
    }
  }
  if(descargarBlob(nombre, html)){ aviso('Descargado ' + nombre); return; }
  verCodigo(html, 'No se pudo descargar. Copiá el código y pegalo en un archivo .html');
}

function verCodigo(html, nota){
  const codigo = html || renderDoc(TPL, D);
  const veil = document.createElement('div');
  veil.className = 'veil';
  veil.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="Código de la página">
    <div class="sheet-h"><h2>El HTML de tu página</h2>
      <button class="btn" type="button" data-copiar>Copiar</button>
      <button class="btn ghost" type="button" data-cerrar aria-label="Cerrar">✕</button></div>
    <div class="sheet-b">
      ${nota?`<p class="hint" style="margin:0 0 10px">${esc(nota)}</p>`:
        `<p class="hint" style="margin:0 0 10px">Un solo archivo, sin dependencias. Guardalo como <b>index.html</b> y subilo a cualquier hosting.</p>`}
      <textarea readonly spellcheck="false"></textarea>
    </div></div>`;
  veil.querySelector('textarea').value = codigo;
  document.body.appendChild(veil);
  const cerrar = ()=>{ veil.remove(); document.removeEventListener('keydown', tecla); };
  const tecla = e => { if(e.key==='Escape') cerrar(); };
  document.addEventListener('keydown', tecla);
  veil.addEventListener('click', async e=>{
    if(e.target===veil || e.target.closest('[data-cerrar]')) return cerrar();
    if(e.target.closest('[data-copiar]')){
      const ta = veil.querySelector('textarea');
      try{ await navigator.clipboard.writeText(codigo); aviso('Código copiado'); }
      catch(err){ ta.focus(); ta.select(); aviso('Seleccionado: copiá con Ctrl/Cmd + C'); }
    }
  });
}

/* =========================================================
   CONTROLES
   ========================================================= */
$('#btn-save').addEventListener('click', ()=>guardar());
$('#btn-export').addEventListener('click', exportar);
$('#btn-code').addEventListener('click', ()=>verCodigo());
$('#btn-new').addEventListener('click', ()=>{
  proyectoId = null;
  D = clonar(TPL.d);
  inpNombre.value = TPL.d.marca + ' — ' + TPL.rubro;
  pintarPanel(); pintarVista(); pintarProyectos();
  aviso('Plantilla reiniciada');
});
inpNombre.addEventListener('input', ()=>{ if(proyectoId){ clearTimeout(tGuard); tGuard = setTimeout(()=>guardar(true),1400); } });

const CLAVE_TEMA = 'taller.tema';
function aplicarTema(t){
  if(t) document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
}
$('#btn-tema').addEventListener('click', ()=>{
  const actual = document.documentElement.dataset.theme
    || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  const nuevo = actual === 'dark' ? 'light' : 'dark';
  aplicarTema(nuevo);
  escribirLocal(CLAVE_TEMA, nuevo);
  aviso(nuevo === 'dark' ? 'Tema oscuro' : 'Tema claro');
});

document.querySelectorAll('[data-device]').forEach(b=>{
  b.addEventListener('click', ()=>{
    document.querySelectorAll('[data-device]').forEach(x=>x.setAttribute('aria-pressed', String(x===b)));
    const d = b.dataset.device;
    $('#canvas').dataset.device = d;
    $('#dims').textContent = d==='movil' ? '390 px' : d==='tablet' ? '820 px' : '100%';
  });
});

function irA(tab){
  document.body.dataset.tab = tab;
  document.querySelectorAll('.tabbar button').forEach(b=>b.setAttribute('aria-pressed', String(b.dataset.tab===tab)));
}
document.querySelectorAll('.tabbar button').forEach(b=> b.addEventListener('click', ()=>irA(b.dataset.tab)));

/* ---------- arranque: abre con un rubro cargado y la vista lista ---------- */
irA('vista');
abrirRubro(RUBROS[0].id);
almacen.init();

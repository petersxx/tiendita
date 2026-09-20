/* =========================================================
   APLICACIÓN
   ========================================================= */
const $ = s => document.querySelector(s);
const panel = $('#panel'), preview = $('#preview'), inpNombre = $('#proj-name');
const listaTpl = $('#tpl-list'), listaProj = $('#proj-list'), notaAlmacen = $('#store-note');
const canvas = $('#canvas'), marco = $('#marco'), envoltorio = $('#marco-wrap'), barra = $('#barra-lienzo');

let TPL = RUBROS[0];
let D = clonar(TPL.d);
let proyectoId = null;
let cap = { db:null, downloads:null };

let modo = 'editar';              // 'editar' escribe sobre la página · 'ver' la usa como el visitante
let dispositivo = 'escritorio';
let zoom = 1, zoomAuto = true;
let seleccion = null;             // ruta del campo seleccionado en la página
let itemActual = null;            // ítem repetible que lo contiene, ej. "cards.2"
let tPrev, tGuard;

const ANCHOS = { escritorio:1280, tablet:820, movil:390 };

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
function obtener(obj, ruta){ return ruta.split('.').reduce((o,k)=> (o==null?o:o[k]), obj); }

function camposVisibles(){
  return camposDe(TPL).filter(c => c.k !== '_cardStyle' || TPL.secciones.includes('cards'));
}
function defCampo(ruta){
  const seg = ruta.split('.');
  const c = camposVisibles().find(x => x.k === seg[0]);
  if(!c) return null;
  return (c.t === 'lista' && seg[2]) ? c.item.find(x => x.k === seg[2]) : c;
}

/* =========================================================
   PANEL DE CAMPOS
   ========================================================= */
function idDe(ruta){ return 'f-' + ruta.replace(/\./g,'-'); }
function pistaHTML(c){ return c.pista ? `<span class="hint">${esc(c.pista)}</span>` : ''; }

function cajaImagen(ruta, v){
  return `<div class="img-caja">
    ${v ? `<img class="img-mini" src="${esc(v)}" alt="">`
        : `<div class="img-mini vacia" aria-hidden="true">sin imagen</div>`}
    <div class="img-acciones">
      <button class="btn tiny" type="button" data-subir="${esc(ruta)}">Subir</button>
      ${v ? `<button class="btn tiny" type="button" data-quitar-img="${esc(ruta)}">Quitar</button>` : ''}
    </div>
  </div>`;
}

function campoHTML(c, ruta, esCabecera){
  const v = obtener(D, ruta) ?? '';
  const id = idDe(ruta);
  const head = esCabecera ? ' data-head="1"' : '';
  switch(c.t){
    case 'textarea':
      return `<div class="fld" data-fld="${esc(ruta)}"><label for="${id}">${esc(c.l)}</label>
        <textarea id="${id}" data-path="${esc(ruta)}"${head}>${esc(v)}</textarea></div>`;
    case 'color':
      return `<div class="fld" data-fld="${esc(ruta)}"><label for="${id}">${esc(c.l)}</label>
        <div class="color-row"><input type="color" id="${id}" data-path="${esc(ruta)}" value="${esc(v)}">
        <code data-eco="${esc(ruta)}">${esc(v)}</code></div></div>`;
    case 'rango':
      return `<div class="fld" data-fld="${esc(ruta)}">
        <label for="${id}">${esc(c.l)} <b class="eco" data-eco="${esc(ruta)}">${esc(c.formato ? c.formato(Number(v)) : v)}</b></label>
        <input type="range" id="${id}" data-path="${esc(ruta)}" data-vivo="${esc(c.vivo||'')}" data-unidad="${esc(c.unidad||'')}"
          min="${c.min}" max="${c.max}" step="${c.paso}" value="${esc(v)}"></div>`;
    case 'select':
      return `<div class="fld" data-fld="${esc(ruta)}"><label for="${id}">${esc(c.l)}</label>
        <select id="${id}" data-path="${esc(ruta)}">
        ${c.opts.map(o=>`<option value="${esc(o.v)}"${o.v===v?' selected':''}>${esc(o.l)}</option>`).join('')}
        </select></div>`;
    case 'check':
      return `<div class="fld" data-fld="${esc(ruta)}">
        <label class="check"><input type="checkbox" id="${id}" data-path="${esc(ruta)}"${v?' checked':''}>
        <span>${esc(c.l)}</span></label>${pistaHTML(c)}</div>`;
    case 'accion':
      return `<div class="fld" data-fld="${esc(ruta)}">
        <button class="btn accion" type="button" data-accion="${esc(c.accion)}">${esc(c.texto)}</button>
        ${pistaHTML(c)}</div>`;
    case 'img':
      return `<div class="fld imgfld" data-fld="${esc(ruta)}" data-drop="${esc(ruta)}">
        <label for="${id}">${esc(c.l)}</label>
        ${cajaImagen(ruta, v)}
        <input type="text" id="${id}" data-path="${esc(ruta)}" value="${esc(v)}" placeholder="https://… o arrastrá un archivo acá">
        <span class="hint">Arrastrá una imagen sobre este campo o tocá <b>Subir</b>: va a tu bucket R2. Vacío = fondo generado.</span></div>`;
    case 'lista':
      return listaHTML(c, ruta);
    default:
      return `<div class="fld" data-fld="${esc(ruta)}"><label for="${id}">${esc(c.l)}</label>
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
  const rotulo = String(it[c.item[0].k] || '').trim() || `Ítem ${i+1}`;
  return `<div class="item" data-i="${i}">
    <div class="item-h">
      <b>${esc(rotulo)}</b>
      <button type="button" data-act="up"   data-key="${esc(ruta)}" data-i="${i}" title="Subir" aria-label="Subir">↑</button>
      <button type="button" data-act="down" data-key="${esc(ruta)}" data-i="${i}" title="Bajar" aria-label="Bajar">↓</button>
      <button type="button" data-act="dup"  data-key="${esc(ruta)}" data-i="${i}" title="Duplicar" aria-label="Duplicar">⧉</button>
      <button type="button" class="rm" data-act="rm" data-key="${esc(ruta)}" data-i="${i}" title="Quitar" aria-label="Quitar">✕</button>
    </div>
    <div class="item-b">
      ${c.item.map((sc,j)=> campoHTML(sc, `${ruta}.${i}.${sc.k}`, j===0)).join('')}
    </div>
  </div>`;
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

/* ---------- el panel escribe en los datos ---------- */
panel.addEventListener('input', e=>{
  const el = e.target, ruta = el.dataset.path;
  if(!ruta) return;
  const def = defCampo(ruta);

  if(el.type === 'checkbox'){ fijar(D, ruta, el.checked); tocar(); return; }

  if(el.type === 'range'){
    const num = Number(el.value);
    fijar(D, ruta, num);
    const eco = panel.querySelector(`[data-eco="${ruta}"]`);
    if(eco) eco.textContent = def && def.formato ? def.formato(num) : num;
    // las variables vivas se aplican al instante, sin rehacer la página
    const doc = docVista();
    if(doc && el.dataset.vivo) doc.documentElement.style.setProperty(el.dataset.vivo, num + (el.dataset.unidad||''));
    apuntarGuardado();
    return;
  }

  fijar(D, ruta, el.value);
  const eco = panel.querySelector(`[data-eco="${ruta}"]`);
  if(eco) eco.textContent = el.value;
  if(el.dataset.head){
    const item = el.closest('.item');
    if(item) item.querySelector('.item-h b').textContent = el.value.trim() || 'Sin título';
  }
  tocar();
});

/* ---------- el panel enfoca lo que corresponde en la página ---------- */
panel.addEventListener('focusin', e=>{
  const ruta = e.target.dataset && e.target.dataset.path;
  if(!ruta || modo !== 'editar') return;
  const doc = docVista(); if(!doc) return;
  const el = doc.querySelector(`[data-campo="${ruta}"]`) || doc.querySelector(`[data-campo-img="${ruta}"]`);
  panel.querySelectorAll('.fld.activo').forEach(x=>x.classList.remove('activo'));
  const fld = e.target.closest('.fld'); if(fld) fld.classList.add('activo');
  if(!el) { ocultarBarra(); return; }
  doc.querySelectorAll('.tp-sel').forEach(x=>x.classList.remove('tp-sel'));
  el.classList.add('tp-sel');
  seleccion = ruta;
  const w = doc.defaultView, r = el.getBoundingClientRect();
  if(w) w.scrollTo({ top: w.scrollY + r.top - (w.innerHeight - r.height)/2, behavior:'smooth' });
  mostrarBarra(el);
});

panel.addEventListener('click', e=>{
  const subir = e.target.closest('[data-subir]');
  if(subir){ pedirArchivo(subir.dataset.subir); return; }

  const quitar = e.target.closest('[data-quitar-img]');
  if(quitar){
    fijar(D, quitar.dataset.quitarImg, '');
    refrescarCampoImagen(quitar.dataset.quitarImg);
    tocar(); aviso('Vuelve el fondo generado'); return;
  }

  const accion = e.target.closest('[data-accion]');
  if(accion){ if(accion.dataset.accion === 'importarNotion') importarNotion(); return; }

  const b = e.target.closest('button[data-act]');
  if(!b) return;
  accionLista(b.dataset.key, b.dataset.act, Number(b.dataset.i));
});

/* ---------- arrastrar y soltar una imagen sobre su campo ---------- */
panel.addEventListener('dragover', e=>{
  const f = e.target.closest && e.target.closest('[data-drop]');
  if(!f) return;
  e.preventDefault(); f.classList.add('encima');
});
panel.addEventListener('dragleave', e=>{
  const f = e.target.closest && e.target.closest('[data-drop]');
  if(f) f.classList.remove('encima');
});
panel.addEventListener('drop', e=>{
  const f = e.target.closest && e.target.closest('[data-drop]');
  if(!f) return;
  e.preventDefault(); f.classList.remove('encima');
  const archivo = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
  if(archivo) subirImagen(archivo, f.dataset.drop);
});

function accionLista(ruta, acto, i){
  const c = camposVisibles().find(x=>x.k===ruta.split('.')[0]);
  const arr = obtener(D, ruta);
  if(acto==='add')  arr.push(clonar(c.nuevo));
  if(acto==='dup')  arr.splice(i+1,0,clonar(arr[i]));
  if(acto==='rm')   arr.splice(i,1);
  if(acto==='up'   && i>0)            arr.splice(i-1,0,arr.splice(i,1)[0]);
  if(acto==='down' && i<arr.length-1) arr.splice(i+1,0,arr.splice(i,1)[0]);
  const cont = panel.querySelector(`[data-list="${ruta}"]`);
  if(cont) cont.innerHTML = arr.map((_,k)=>itemHTML(c,ruta,k)).join('');
  limpiarSeleccion();
  tocar();
}

/* =========================================================
   VISTA PREVIA Y EDICIÓN DIRECTA SOBRE LA PÁGINA
   ========================================================= */
function docVista(){ try{ return preview.contentDocument; }catch(e){ return null; } }

function apuntarGuardado(){
  guardarBorrador();
  if(proyectoId){ clearTimeout(tGuard); tGuard = setTimeout(()=>guardar(true), 1400); }
}
function tocar(){
  clearTimeout(tPrev); tPrev = setTimeout(pintarVista, 200);
  apuntarGuardado();
}

function pintarVista(){
  let y = 0;
  try{ y = preview.contentWindow.scrollY || 0; }catch(e){}
  preview.onload = ()=>{
    try{ preview.contentWindow.scrollTo(0,y); }catch(e){}
    conectarLienzo();
    if(seleccion) restaurarSeleccion();
  };
  preview.srcdoc = renderDoc(TPL, D, modo === 'editar');
}

/* campos cuyo cambio afecta a otras partes de la página (enlaces, agrupaciones) */
const REHACER = /^(marca|whatsapp|telefono|email|mapaUrl|instagram|ciudad|heroCtaUrl)$|\.seccion$|^navLinks\.\d+\.url$/;

function conectarLienzo(){
  const doc = docVista(); if(!doc || modo !== 'editar') return;

  // habilitar la escritura en el mismo mousedown deja el cursor donde se hizo clic
  doc.addEventListener('mousedown', ev=>{
    const el = ev.target.closest && ev.target.closest('[data-campo]');
    if(el && el.contentEditable !== 'true'){ el.contentEditable = 'true'; el.spellcheck = false; }
  }, true);

  doc.addEventListener('click', ev=>{
    const enlace = ev.target.closest && ev.target.closest('a');
    const resumen = ev.target.closest && ev.target.closest('summary');
    if(enlace || resumen) ev.preventDefault();      // en edición nada navega ni se despliega
    const txt = ev.target.closest && ev.target.closest('[data-campo]');
    const img = ev.target.closest && ev.target.closest('[data-campo-img]');
    if(txt){ elegir(txt, txt.dataset.campo); return; }
    if(img){ elegir(img, img.dataset.campoImg); return; }
    limpiarSeleccion();
  }, true);

  doc.addEventListener('input', ev=>{
    const el = ev.target.closest && ev.target.closest('[data-campo]');
    if(!el) return;
    const ruta = el.dataset.campo;
    const crudo = el.innerText.replace(/ /g,' ');
    const valor = el.dataset.multi
      ? crudo.replace(/\n{3,}/g,'\n\n').replace(/[ \t]+\n/g,'\n').trim()
      : crudo.replace(/\s*\n+\s*/g,' ').trim();
    fijar(D, ruta, valor);
    sincronizarPanel(ruta, valor);
    gemelos(ruta, valor, el);
    apuntarGuardado();
    // no repintamos: lo que se escribe ya está en pantalla
  }, true);

  doc.addEventListener('keydown', ev=>{
    const el = ev.target.closest && ev.target.closest('[data-campo]');
    if(!el) return;
    if(ev.key === 'Escape'){ ev.preventDefault(); el.blur(); limpiarSeleccion(); }
    if(ev.key === 'Enter' && !el.dataset.multi){ ev.preventDefault(); el.blur(); }
  }, true);

  doc.addEventListener('blur', ev=>{
    const el = ev.target.closest && ev.target.closest('[data-campo]');
    if(!el) return;
    el.contentEditable = 'false';
    if(REHACER.test(el.dataset.campo)){ clearTimeout(tPrev); tPrev = setTimeout(pintarVista, 120); }
  }, true);

  const w = doc.defaultView;
  if(w) w.addEventListener('scroll', colocarBarra, {passive:true});
}

function elegir(el, ruta){
  const doc = docVista(); if(!doc) return;
  doc.querySelectorAll('.tp-sel').forEach(x=>x.classList.remove('tp-sel'));
  el.classList.add('tp-sel');
  seleccion = ruta;
  resaltarCampoPanel(ruta);
  mostrarBarra(el);
}

function limpiarSeleccion(){
  const doc = docVista();
  if(doc) doc.querySelectorAll('.tp-sel').forEach(x=>x.classList.remove('tp-sel'));
  panel.querySelectorAll('.fld.activo').forEach(x=>x.classList.remove('activo'));
  seleccion = null; ocultarBarra();
}

function restaurarSeleccion(){
  const doc = docVista(); if(!doc || !seleccion) return;
  const el = doc.querySelector(`[data-campo="${seleccion}"]`) || doc.querySelector(`[data-campo-img="${seleccion}"]`);
  if(!el){ seleccion = null; ocultarBarra(); return; }
  el.classList.add('tp-sel');
  mostrarBarra(el);
}

/* mismo dato mostrado en dos lugares (la marca sale en la barra y en el pie) */
function gemelos(ruta, valor, origen){
  const doc = docVista(); if(!doc) return;
  doc.querySelectorAll(`[data-campo="${ruta}"]`).forEach(el=>{
    if(el !== origen && el.innerText !== valor) el.textContent = valor;
  });
}

function sincronizarPanel(ruta, valor){
  const inp = panel.querySelector(`[data-path="${ruta}"]`);
  if(inp && inp.value !== valor) inp.value = valor;
  if(inp && inp.dataset.head){
    const item = inp.closest('.item');
    if(item) item.querySelector('.item-h b').textContent = valor.trim() || 'Sin título';
  }
}

function resaltarCampoPanel(ruta){
  const inp = panel.querySelector(`[data-path="${ruta}"]`);
  panel.querySelectorAll('.fld.activo').forEach(x=>x.classList.remove('activo'));
  if(!inp) return;
  const det = inp.closest('details'); if(det && !det.open) det.open = true;
  const fld = inp.closest('.fld');
  if(!fld) return;
  fld.classList.add('activo');
  // el cálculo a mano es fiable dentro de un contenedor con su propio scroll;
  // esperamos un cuadro por si acabamos de abrir el grupo
  requestAnimationFrame(()=>{
    const rp = panel.getBoundingClientRect(), rf = fld.getBoundingClientRect();
    if(rf.top < rp.top + 8 || rf.bottom > rp.bottom - 8){
      panel.scrollTo({ top: panel.scrollTop + (rf.top - rp.top) - (rp.height - rf.height)/2, behavior:'smooth' });
    }
  });
}

/* ---------- barra flotante del ítem seleccionado ---------- */
function mostrarBarra(el){
  const item = el.closest('[data-item]');
  const esImg = !!el.dataset.campoImg;
  itemActual = item ? item.dataset.item : null;
  if(!item && !esImg){ ocultarBarra(); return; }
  barra.hidden = false;
  barra.style.visibility = 'visible';
  const deImagen = new Set(['img','imgq']);
  barra.querySelectorAll('[data-bact]').forEach(b=>{
    if(deImagen.has(b.dataset.bact)){
      b.hidden = !esImg || (b.dataset.bact === 'imgq' && !obtener(D, el.dataset.campoImg));
    } else {
      b.hidden = !item;
    }
  });
  colocarBarra();
}
function ocultarBarra(){ barra.hidden = true; itemActual = null; }

function colocarBarra(){
  if(barra.hidden) return;
  const doc = docVista(); if(!doc){ ocultarBarra(); return; }
  const el = doc.querySelector('.tp-sel'); if(!el){ ocultarBarra(); return; }
  const rc = canvas.getBoundingClientRect();
  const rm = marco.getBoundingClientRect();
  const re = el.getBoundingClientRect();
  const x  = rm.left + re.left * zoom;
  const y  = rm.top  + re.top  * zoom;
  const alto = re.height * zoom;

  // si el elemento se fue del área visible del lienzo, la barra se esconde
  if(y > rc.bottom - 6 || y + alto < rc.top + 6){ barra.style.visibility = 'hidden'; return; }
  barra.style.visibility = 'visible';

  const h = barra.offsetHeight || 30, w = barra.offsetWidth || 170;
  // arriba del elemento; si no entra, se pasa abajo
  const arriba = y - h - 8;
  const top = arriba < rc.top + 4 ? y + alto + 8 : arriba;
  barra.style.left = Math.round(Math.max(rc.left + 4, Math.min(rc.right - w - 4, x))) + 'px';
  barra.style.top  = Math.round(Math.max(rc.top + 4, Math.min(rc.bottom - h - 4, top))) + 'px';
}

barra.addEventListener('click', e=>{
  const b = e.target.closest('[data-bact]'); if(!b) return;
  const acto = b.dataset.bact;
  if(acto === 'img'){ pedirArchivo(seleccion); return; }
  if(acto === 'imgq'){
    fijar(D, seleccion, '');
    refrescarCampoImagen(seleccion);
    pintarVista(); apuntarGuardado();
    aviso('Vuelve el fondo generado'); return;
  }
  if(!itemActual) return;
  const p = itemActual.lastIndexOf('.');
  accionLista(itemActual.slice(0,p), acto, Number(itemActual.slice(p+1)));
  pintarPanel(); pintarVista();
});

/* =========================================================
   ZOOM Y TAMAÑO DE PANTALLA
   ========================================================= */
function aplicarZoom(){
  const W = ANCHOS[dispositivo];
  const cw = Math.max(240, canvas.clientWidth - 36);
  const ch = Math.max(360, canvas.clientHeight - 36);
  if(zoomAuto) zoom = Math.min(1, cw / W);
  zoom = Math.min(1.5, Math.max(0.25, zoom));
  const H = Math.max(520, Math.round(ch / zoom));
  marco.style.width = W + 'px';
  marco.style.height = H + 'px';
  marco.style.transform = `scale(${zoom})`;
  envoltorio.style.width = Math.round(W * zoom) + 'px';
  envoltorio.style.height = Math.round(H * zoom) + 'px';
  $('#zoom-val').textContent = Math.round(zoom * 100) + '%';
  $('#dims').textContent = W + ' px de ancho';
  colocarBarra();
}
function fijarZoom(z, auto){ zoomAuto = !!auto; if(!auto) zoom = z; aplicarZoom(); }

$('#zoom-menos').addEventListener('click', ()=> fijarZoom(Math.round((zoom - .1)*100)/100, false));
$('#zoom-mas').addEventListener('click',   ()=> fijarZoom(Math.round((zoom + .1)*100)/100, false));
$('#zoom-ajustar').addEventListener('click', ()=> fijarZoom(0, true));
addEventListener('resize', ()=>{ aplicarZoom(); });
canvas.addEventListener('scroll', colocarBarra, {passive:true});

document.querySelectorAll('[data-device]').forEach(b=>{
  b.addEventListener('click', ()=>{
    document.querySelectorAll('[data-device]').forEach(x=>x.setAttribute('aria-pressed', String(x===b)));
    dispositivo = b.dataset.device;
    zoomAuto = true;
    aplicarZoom();
  });
});

document.querySelectorAll('[data-modo]').forEach(b=>{
  b.addEventListener('click', ()=>{
    document.querySelectorAll('[data-modo]').forEach(x=>x.setAttribute('aria-pressed', String(x===b)));
    modo = b.dataset.modo;
    limpiarSeleccion();
    pintarVista();
    aviso(modo === 'editar' ? 'Tocá cualquier texto de la página para escribir' : 'Modo visitante: los enlaces y las preguntas funcionan');
  });
});

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
  if(innerWidth<=1040) irA('vista');
});

function abrirRubro(id, datos, pid, nombre){
  TPL = RUBROS.find(r=>r.id===id) || RUBROS[0];
  D = Object.assign({}, ESTILO_POR_DEFECTO, clonar(datos || leerBorrador(TPL.id) || TPL.d));
  camposVisibles().forEach(c=>{
    if(D[c.k] === undefined) D[c.k] = clonar(TPL.d[c.k] ?? ESTILO_POR_DEFECTO[c.k] ?? (c.t==='lista'?[]:''));
  });
  proyectoId = pid || null;
  seleccion = null; ocultarBarra();
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
  if(innerWidth<=1040) irA('vista');
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
   EXPORTAR Y VER EL CÓDIGO  (sin marcas de edición)
   ========================================================= */
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
   CONTROLES GENERALES
   ========================================================= */
$('#btn-save').addEventListener('click', ()=>guardar());
$('#btn-export').addEventListener('click', exportar);
$('#btn-code').addEventListener('click', ()=>verCodigo());
$('#btn-new').addEventListener('click', ()=>{
  proyectoId = null;
  D = Object.assign({}, ESTILO_POR_DEFECTO, clonar(TPL.d));
  inpNombre.value = TPL.d.marca + ' — ' + TPL.rubro;
  limpiarSeleccion();
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

function irA(tab){
  document.body.dataset.tab = tab;
  document.querySelectorAll('.tabbar button').forEach(b=>b.setAttribute('aria-pressed', String(b.dataset.tab===tab)));
  aplicarZoom();
}
document.querySelectorAll('.tabbar button').forEach(b=> b.addEventListener('click', ()=>irA(b.dataset.tab)));

/* =========================================================
   IMÁGENES EN R2 Y CATÁLOGO EN NOTION
   El navegador nunca ve las claves: le pide a /api/subir una URL
   firmada y manda el archivo derecho a Cloudflare.
   ========================================================= */
const CLAVE_SUBIDA = 'taller.claveSubida';
/* Dentro del visor de Artifacts de Claude la CSP bloquea cualquier fetch
   externo, así que subir a R2 o consultar Notion no puede funcionar ahí. */
const EN_VISOR = !!(window.claude && window.claude.use);

function explicarFalloDeRed(err){
  if(err instanceof TypeError){
    return EN_VISOR
      ? 'El visor de Claude bloquea las conexiones externas. Esto funciona en el sitio publicado.'
      : 'No se pudo conectar con la API. Revisá la dirección en «Catálogo desde Notion».';
  }
  return String(err.message || err);
}
const inputArchivo = $('#archivo-img');
let rutaSubida = null;

function apiBase(){ return String(D._apiBase || '').replace(/\/+$/, ''); }
function pedirArchivo(ruta){ rutaSubida = ruta; inputArchivo.click(); }

inputArchivo.addEventListener('change', ()=>{
  const archivo = inputArchivo.files && inputArchivo.files[0];
  inputArchivo.value = '';
  if(archivo && rutaSubida) subirImagen(archivo, rutaSubida);
});

function refrescarCampoImagen(ruta){
  const fld = panel.querySelector(`[data-fld="${ruta}"]`);
  if(!fld) return;
  const v = obtener(D, ruta) || '';
  const inp = fld.querySelector('input[type=text]');
  if(inp) inp.value = v;
  const caja = fld.querySelector('.img-caja');
  if(caja) caja.outerHTML = cajaImagen(ruta, v);
}

async function subirImagen(archivo, ruta){
  const base = apiBase();
  if(!base){ aviso('Falta la dirección de la API, en «Catálogo desde Notion».'); return; }
  if(!/^image\//.test(archivo.type)){ aviso('Eso no es una imagen.'); return; }
  if(archivo.size > 10 * 1024 * 1024){ aviso('La imagen pasa de 10 MB. Achicala antes.'); return; }

  const fld = panel.querySelector(`[data-fld="${ruta}"]`);
  if(fld) fld.classList.add('subiendo');
  aviso('Subiendo ' + archivo.name + '…');

  try{
    const clave = leerLocal(CLAVE_SUBIDA, '') || '';
    const cab = { 'Content-Type':'application/json' };
    if(clave) cab['x-subida-token'] = clave;

    const permiso = await fetch(base + '/api/subir', {
      method:'POST', headers:cab,
      body: JSON.stringify({ nombre:archivo.name, tipo:archivo.type, tamano:archivo.size })
    });
    const datos = await permiso.json().catch(()=>({}));
    if(!permiso.ok) throw new Error(datos.error || 'La API no autorizó la subida.');

    const puesta = await fetch(datos.urlSubida, {
      method:'PUT', headers:{ 'Content-Type':archivo.type }, body:archivo
    });
    if(!puesta.ok) throw new Error('R2 rechazó el archivo. Revisá la regla CORS del bucket.');

    fijar(D, ruta, datos.urlPublica);
    refrescarCampoImagen(ruta);
    pintarVista();
    apuntarGuardado();
    aviso('Imagen subida');
  }catch(err){
    aviso(explicarFalloDeRed(err));
  }finally{
    const f2 = panel.querySelector(`[data-fld="${ruta}"]`);
    if(f2) f2.classList.remove('subiendo');
  }
}

async function importarNotion(){
  const base = apiBase();
  const db = String(D._notionDb || '').trim().replace(/-/g, '');
  if(!base){ aviso('Falta la dirección de la API.'); return; }
  if(!/^[0-9a-f]{32}$/i.test(db)){ aviso('El ID de la base de Notion tiene que ser de 32 caracteres.'); return; }

  aviso('Consultando Notion…');
  try{
    const r = await fetch(`${base}/api/catalogo?db=${encodeURIComponent(db)}&moneda=${encodeURIComponent(D._moneda || '')}`);
    const j = await r.json().catch(()=>({}));
    if(!r.ok) throw new Error(j.error || 'Notion no respondió.');
    if(!j.productos || !j.productos.length) throw new Error('La base no devolvió productos visibles.');

    D.cards = j.productos.map(p => ({
      titulo: p.titulo || '', meta: p.meta || '', texto: p.texto || '', img: p.img || ''
    }));
    limpiarSeleccion();
    pintarPanel(); pintarVista(); apuntarGuardado();
    aviso(`Importados ${j.productos.length} productos de Notion`);
  }catch(err){
    aviso(explicarFalloDeRed(err));
  }
}

if(EN_VISOR){
  const nota = document.createElement('p');
  nota.className = 'empty';
  nota.innerHTML = 'Estás en el visor de Claude, que bloquea las conexiones externas: '
    + 'subir imágenes e importar de Notion funcionan en el <b>sitio publicado</b>.';
  const ancla = $('#clave-subida');
  if(ancla) ancla.closest('.rail-campo').before(nota);
}

/* clave opcional de subida: vive sólo en este navegador, nunca se exporta */
const inputClave = $('#clave-subida');
if(inputClave){
  inputClave.value = leerLocal(CLAVE_SUBIDA, '') || '';
  inputClave.addEventListener('change', ()=>{
    escribirLocal(CLAVE_SUBIDA, inputClave.value.trim());
    aviso(inputClave.value.trim() ? 'Clave de subida guardada en este navegador' : 'Clave de subida borrada');
  });
}

/* ---------- arranque ---------- */
irA('vista');
abrirRubro(RUBROS[0].id);
aplicarZoom();
almacen.init();

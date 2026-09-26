/* =========================================================
   APLICACIÓN
   ========================================================= */
const $ = s => document.querySelector(s);
const panel = $('#panel'), preview = $('#preview'), inpNombre = $('#proj-name');
const listaTpl = $('#tpl-list'), listaProj = $('#proj-list'), notaAlmacen = $('#store-note');
const canvas = $('#canvas'), marco = $('#marco'), envoltorio = $('#marco-wrap'), barra = $('#barra-lienzo');
const pop = $('#pop'), barraSec = $('#barra-seccion'), masSec = $('#mas-seccion'), guia = $('#guia-arrastre');
const btnDeshacer = $('#btn-deshacer');

let TPL = RUBROS[0];
let D = clonar(TPL.d);
let proyectoId = null;
let cap = { db:null, downloads:null };

let modo = 'editar';              // 'editar' escribe sobre la página · 'ver' la usa como el visitante
let dispositivo = 'escritorio';
let zoom = 1, zoomAuto = true;
let seleccion = null;             // ruta del campo seleccionado en la página
let itemActual = null;            // ítem repetible que lo contiene, ej. "cards.2"
let secActual = null;             // índice de la sección bajo el mouse
let popCampos = null;             // lo que muestra la hoja flotante; null = cerrada
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

function camposVisibles(){ return camposDe(seccionesDe(TPL, D)); }

/* completa los datos que una sección necesita y todavía no están:
   primero el contenido del rubro, si no el genérico de la sección */
function completarDatos(nombre){
  const s = SEC[nombre]; if(!s) return;
  const base = (s.familia === 'hero' ? SEC.heroSplit.nuevo : s.nuevo) || {};
  camposSeccion(nombre).forEach(c=>{
    if(D[c.k] === undefined) D[c.k] = clonar(TPL.d[c.k] ?? base[c.k] ?? ESTILO_POR_DEFECTO[c.k] ?? (c.t==='lista' ? [] : c.t==='check' ? false : ''));
  });
}
function prepararDatos(datos){
  D = Object.assign({}, ESTILO_POR_DEFECTO, clonar(datos));
  if(!Array.isArray(D._secciones)) D._secciones = [...TPL.secciones];
  D._secciones.forEach(completarDatos);
  CAMPOS_ESTILO.forEach(c=>{ if(D[c.k] === undefined) D[c.k] = clonar(TPL.d[c.k] ?? ESTILO_POR_DEFECTO[c.k] ?? ''); });
  historial.length = 0; btnDeshacer.disabled = true;
}

/* ---------- deshacer: una foto de los datos antes de cada cambio ---------- */
const historial = [];
function recordar(){
  const foto = JSON.stringify(D);
  if(historial[historial.length-1] !== foto){ historial.push(foto); if(historial.length > 80) historial.shift(); }
  btnDeshacer.disabled = false;
}
function deshacer(){
  const foto = historial.pop();
  btnDeshacer.disabled = !historial.length;
  if(!foto){ aviso('No hay nada para deshacer'); return; }
  D = JSON.parse(foto);
  limpiarSeleccion();
  pintarPanel(); pintarVista(); apuntarGuardado();
  aviso('Deshecho');
}
function escribiendo(el){
  return !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
}
function teclaDeshacer(ev){
  if(!(ev.metaKey || ev.ctrlKey) || ev.shiftKey || ev.key.toLowerCase() !== 'z') return;
  if(escribiendo(ev.target)) return;           // dentro de un texto, deshace el navegador
  ev.preventDefault(); deshacer();
}
document.addEventListener('keydown', teclaDeshacer);
btnDeshacer.addEventListener('click', deshacer);
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
    ${v ? `<img class="img-mini" src="${esc(imagenes.vista(v))}" alt="">`
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
        <span class="hint">Arrastrá una imagen sobre este campo o tocá <b>Subir</b>: se achica y viaja con la demo al publicar. Vacío = fondo generado.</span></div>`;
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

/* =========================================================
   HOJA FLOTANTE — datos de una sección, estilo, enlaces
   ========================================================= */
function abrirPop(titulo, contenido){
  popCampos = contenido;
  $('#pop-t').textContent = titulo;
  pop.hidden = false;
  pintarPanel();
  panel.scrollTop = 0;
}
function cerrarPop(){ pop.hidden = true; popCampos = null; panel.innerHTML = ''; }
$('#pop-cerrar').addEventListener('click', cerrarPop);
document.addEventListener('keydown', e=>{ if(e.key === 'Escape' && !pop.hidden) cerrarPop(); });

function pintarPanel(){
  if(!popCampos) return;
  if(typeof popCampos === 'function'){ panel.innerHTML = popCampos(); return; }
  const grupos = [];
  popCampos.forEach(c=>{
    let g = grupos.find(x=>x.n===c.g);
    if(!g){ g = {n:c.g, cs:[]}; grupos.push(g); }
    g.cs.push(c);
  });
  const uno = grupos.length === 1;
  panel.innerHTML = grupos.map((g,i)=> uno
    ? `<div class="grp-body">${g.cs.map(c=>campoHTML(c, c.k)).join('')}</div>`
    : `<details class="grp"${i===0?' open':''}>
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
  if(ruta) recordar();
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

  const nueva = e.target.closest('[data-nueva-sec]');
  if(nueva){ agregarSeccion(nueva.dataset.nuevaSec, Number(nueva.dataset.pos)); return; }

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
  recordar();
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
    if(irASeccion != null){ enfocarSeccion(irASeccion); irASeccion = null; }
    else if(secActual != null) mostrarSeccion(secActual);
  };
  preview.srcdoc = renderDoc(TPL, conImagenesLocales(D), modo === 'editar');
}

/* campos cuyo cambio afecta a otras partes de la página (enlaces, agrupaciones) */
const REHACER = /^(marca|whatsapp|telefono|email|mapaUrl|instagram|ciudad|heroCtaUrl)$|\.seccion$|^navLinks\.\d+\.url$/;

function conectarLienzo(){
  const doc = docVista(); if(!doc || modo !== 'editar'){ ocultarSeccion(); return; }

  // lo que se ve en un campo vacío: el nombre del campo
  doc.querySelectorAll('[data-campo]').forEach(el=>{
    const c = defCampo(el.dataset.campo);
    el.dataset.vacio = c ? c.l : 'Escribí acá';
  });

  // habilitar la escritura en el mismo mousedown deja el cursor donde se hizo clic
  doc.addEventListener('mousedown', ev=>{
    const el = ev.target.closest && ev.target.closest('[data-campo]');
    if(el && el.contentEditable !== 'true'){ recordar(); el.contentEditable = 'true'; el.spellcheck = false; }
  }, true);

  doc.addEventListener('mousemove', ev=>{
    if(arrastre) return;
    const sec = ev.target.closest && ev.target.closest('[data-sec]');
    if(sec && Number(sec.dataset.sec) !== secActual) mostrarSeccion(Number(sec.dataset.sec));
  });

  // soltar una foto sobre una imagen la reemplaza; en cualquier otro lado no hace nada
  doc.addEventListener('dragover', ev=>{
    ev.preventDefault();
    doc.querySelectorAll('.tp-soltar').forEach(x=>x.classList.remove('tp-soltar'));
    const img = ev.target.closest && ev.target.closest('[data-campo-img]');
    if(img) img.classList.add('tp-soltar');
    ev.dataTransfer.dropEffect = img ? 'copy' : 'none';
  });
  doc.addEventListener('drop', ev=>{
    ev.preventDefault();
    doc.querySelectorAll('.tp-soltar').forEach(x=>x.classList.remove('tp-soltar'));
    const img = ev.target.closest && ev.target.closest('[data-campo-img]');
    const archivo = ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files[0];
    if(img && archivo) subirImagen(archivo, img.dataset.campoImg);
    else if(archivo) aviso('Soltala encima de una imagen de la página');
  });
  doc.addEventListener('keydown', teclaDeshacer);

  doc.addEventListener('click', ev=>{
    const enlace = ev.target.closest && ev.target.closest('a');
    const resumen = ev.target.closest && ev.target.closest('summary');
    if(enlace || resumen) ev.preventDefault();      // en edición nada navega ni se despliega
    const txt = ev.target.closest && ev.target.closest('[data-campo]');
    const img = ev.target.closest && ev.target.closest('[data-campo-img]');
    if(txt){ elegir(txt, txt.dataset.campo); return; }
    if(img){ elegir(img, img.dataset.campoImg); return; }
    limpiarSeleccion();
    // tocar el fondo de una sección la elige (en pantallas táctiles no hay mouse encima)
    const sec = ev.target.closest && ev.target.closest('[data-sec]');
    if(sec) mostrarSeccion(Number(sec.dataset.sec));
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
  if(w) w.addEventListener('scroll', ()=>{ colocarBarra(); colocarSeccion(); }, {passive:true});
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
  barra.hidden = false;
  barra.style.visibility = 'visible';
  const deImagen = new Set(['img','imgq']);
  const def = !esImg && defCampo(el.dataset.campo);
  if(!item && !esImg && !(def && def.enlace)){ ocultarBarra(); return; }
  barra.querySelectorAll('[data-bact]').forEach(b=>{
    if(deImagen.has(b.dataset.bact)){
      b.hidden = !esImg || (b.dataset.bact === 'imgq' && !obtener(D, el.dataset.campoImg));
    } else if(b.dataset.bact === 'link'){
      b.hidden = !(def && def.enlace);
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
  if(acto === 'mover') return;                   // se maneja con el arrastre
  if(acto === 'link'){ editarEnlace(seleccion); return; }
  if(acto === 'img'){ pedirArchivo(seleccion); return; }
  if(acto === 'imgq'){
    recordar();
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

/* ---------- destino de un botón o enlace ---------- */
function editarEnlace(ruta){
  const def = defCampo(ruta); if(!def || !def.enlace) return;
  const seg = ruta.split('.');
  const rutaUrl = seg.length > 1 ? [...seg.slice(0,-1), def.enlace].join('.') : def.enlace;
  abrirPop('Destino del enlace', [{
    k: rutaUrl, g:'Enlace', t:'text', l:'Adónde lleva',
    pista:'Una sección de la página (#contacto, #catalogo, #precios, #galeria) o una dirección web completa.',
  }]);
  const inp = panel.querySelector('input'); if(inp){ inp.focus(); inp.select(); }
}

/* =========================================================
   SECCIONES: barra, agregar, quitar, variantes
   ========================================================= */
let irASeccion = null;

function listaDeSeccion(nombre){ return camposSeccion(nombre).find(c => c.t === 'lista'); }

function mostrarSeccion(i){
  const doc = docVista(); if(!doc || modo !== 'editar'){ ocultarSeccion(); return; }
  const el = doc.querySelector(`[data-sec="${i}"]`);
  const nombre = D._secciones[i];
  if(!el || !SEC[nombre]){ ocultarSeccion(); return; }
  doc.querySelectorAll('.sec-hover').forEach(x=>x.classList.remove('sec-hover'));
  el.classList.add('sec-hover');
  secActual = i;
  const s = SEC[nombre];
  $('#sec-nombre').textContent = s.nombre;
  const sel = $('#sec-variante');
  if(s.familia === 'hero'){
    sel.innerHTML = VARIANTES_PORTADA.map(v=>`<option value="${v}"${v===nombre?' selected':''}>${esc(SEC[v].variante)}</option>`).join('');
    sel.hidden = false;
  }else if(s.variantes){
    const actual = D[s.variantes.campo];
    sel.innerHTML = s.variantes.opts.map(o=>`<option value="${esc(o.v)}"${o.v===actual?' selected':''}>${esc(o.l)}</option>`).join('');
    sel.hidden = false;
  }else sel.hidden = true;
  const lista = listaDeSeccion(nombre);
  barraSec.querySelector('[data-sact="item"]').hidden = !lista;
  if(lista) barraSec.querySelector('[data-sact="item"]').textContent = '＋ ' + lista.add.replace(/^Agregar /,'');
  barraSec.querySelector('[data-sact="datos"]').hidden = !camposSeccion(nombre).length;
  barraSec.querySelector('[data-sact="mover"]').hidden = !!s.fija;
  barraSec.hidden = false; masSec.hidden = false;
  colocarSeccion();
}
function ocultarSeccion(){
  barraSec.hidden = true; masSec.hidden = true; secActual = null;
  const doc = docVista();
  if(doc) doc.querySelectorAll('.sec-hover').forEach(x=>x.classList.remove('sec-hover'));
}
function colocarSeccion(){
  if(barraSec.hidden || secActual == null) return;
  const doc = docVista(); const el = doc && doc.querySelector(`[data-sec="${secActual}"]`);
  if(!el){ ocultarSeccion(); return; }
  const rc = canvas.getBoundingClientRect(), rm = marco.getBoundingClientRect(), re = el.getBoundingClientRect();
  const arriba = rm.top + re.top * zoom, abajo = rm.top + re.bottom * zoom;
  const izq = rm.left + re.left * zoom, der = rm.left + re.right * zoom;
  const visible = abajo > rc.top + 10 && arriba < rc.bottom - 10;
  barraSec.style.visibility = visible ? 'visible' : 'hidden';
  const w = barraSec.offsetWidth, h = barraSec.offsetHeight;
  // sobre el borde de arriba, a la derecha; si la sección ya subió, acompaña el borde del lienzo
  const top = Math.min(Math.max(arriba - h / 2, rc.top + 6), abajo - h - 8);
  barraSec.style.top = Math.round(top) + 'px';
  barraSec.style.left = Math.round(Math.max(rc.left + 6, Math.min(der - w - 8, rc.right - w - 6))) + 'px';
  // el ＋ va en el borde de abajo, al medio
  const mh = masSec.offsetHeight, mw = masSec.offsetWidth;
  const my = abajo - mh / 2;
  masSec.style.visibility = (my > rc.top + 4 && my + mh < rc.bottom - 4) ? 'visible' : 'hidden';
  masSec.style.top = Math.round(my) + 'px';
  masSec.style.left = Math.round((izq + der) / 2 - mw / 2) + 'px';
}
function enfocarSeccion(i){
  const doc = docVista(); const el = doc && doc.querySelector(`[data-sec="${i}"]`);
  if(!el) return;
  const w = doc.defaultView;
  w.scrollTo({ top: w.scrollY + el.getBoundingClientRect().top - 40, behavior:'smooth' });
  mostrarSeccion(i);
  setTimeout(colocarSeccion, 450);
}

/* fuera del lienzo y de sus barras, la barra de sección se va */
document.addEventListener('mousemove', e=>{
  if(arrastre || barraSec.hidden) return;
  if(!e.target.closest('#canvas,#barra-seccion,#mas-seccion,#barra-lienzo')) ocultarSeccion();
});

barraSec.addEventListener('click', e=>{
  const b = e.target.closest('[data-sact]'); if(!b || secActual == null) return;
  const i = secActual, nombre = D._secciones[i], acto = b.dataset.sact;
  if(acto === 'datos'){
    const campos = camposSeccion(nombre);
    abrirPop(SEC[nombre].nombre, campos);
    return;
  }
  if(acto === 'item'){
    const lista = listaDeSeccion(nombre);
    accionLista(lista.k, 'add');
    pintarPanel();
    aviso(lista.add.replace(/^Agregar /,'') + ' agregado al final');
    return;
  }
  if(acto === 'rm'){
    recordar();
    D._secciones.splice(i, 1);
    ocultarSeccion(); limpiarSeleccion();
    tocar();
    aviso(SEC[nombre].nombre + ' quitada · Ctrl/Cmd + Z para deshacer');
  }
});
$('#sec-variante').addEventListener('change', e=>{
  if(secActual == null) return;
  const nombre = D._secciones[secActual], s = SEC[nombre];
  recordar();
  if(s.familia === 'hero') D._secciones[secActual] = e.target.value;
  else if(s.variantes) D[s.variantes.campo] = e.target.value;
  tocar();
});

masSec.addEventListener('click', ()=>{
  if(secActual == null) return;
  menuSecciones(secActual + 1);
});

function menuSecciones(pos){
  const presentes = new Set(D._secciones.map(FAMILIA));
  const libres = CATALOGO_SECCIONES.filter(n => !presentes.has(FAMILIA(n)));
  const DESC = {
    nav:'Nombre del negocio, menú y botón de contacto', heroSplit:'Titular grande, texto y botón',
    tiras:'Tres o cuatro números que generan confianza', cards:'Productos o servicios con foto y precio',
    galeria:'Fotos del local, de trabajos, del equipo', precios:'Renglones con precio, agrupables',
    pasos:'Cómo se compra o se contrata, en orden', texto:'La historia del negocio con una foto',
    testimonios:'Comentarios de clientes', faq:'Preguntas frecuentes desplegables',
    contacto:'WhatsApp, dirección, horario y pagos', pie:'Cierre de la página',
  };
  abrirPop('Agregar sección', ()=> libres.length
    ? `<div class="menu-secciones">${libres.map(n=>`<button type="button" data-nueva-sec="${n}" data-pos="${pos}">
        <b>${esc(SEC[n].nombre)}</b><span>${esc(DESC[n]||'')}</span></button>`).join('')}</div>`
    : `<p class="empty" style="padding:14px 16px">Ya están todas las secciones en la página.</p>`);
}

function agregarSeccion(nombre, pos){
  recordar();
  completarDatos(nombre);
  if(SEC[nombre].fija === 'arriba') pos = 0;
  if(SEC[nombre].fija === 'abajo') pos = D._secciones.length;
  // nada entra antes de la barra ni después del pie
  if(SEC[D._secciones[0]]?.fija === 'arriba') pos = Math.max(pos, 1);
  const ult = D._secciones.length - 1;
  if(SEC[nombre].fija !== 'abajo' && SEC[D._secciones[ult]]?.fija === 'abajo') pos = Math.min(pos, ult);
  D._secciones.splice(pos, 0, nombre);
  cerrarPop();
  irASeccion = pos;
  tocar();
  aviso(SEC[nombre].nombre + ' agregada');
}

/* =========================================================
   ARRASTRAR PARA MOVER — secciones e ítems
   La manija vive fuera del iframe; con el puntero capturado,
   seguimos el movimiento aunque pase por encima de la página.
   ========================================================= */
let arrastre = null;

function empezarArrastre(tipo, ev){
  const doc = docVista(); if(!doc) return;
  let els, desde, lista;
  if(tipo === 'sec'){
    if(secActual == null) return;
    els = [...doc.querySelectorAll('[data-sec]')].filter(e => !SEC[D._secciones[+e.dataset.sec]]?.fija);
    desde = secActual;
  }else{
    if(!itemActual) return;
    const p = itemActual.lastIndexOf('.');
    lista = itemActual.slice(0, p); desde = Number(itemActual.slice(p + 1));
    const re = new RegExp('^' + lista.replace(/\./g,'\\.') + '\\.\\d+$');
    els = [...doc.querySelectorAll('[data-item]')].filter(e => re.test(e.dataset.item));
  }
  if(els.length < 2){ aviso('No hay con qué intercambiarlo'); return; }
  ev.preventDefault();
  ev.target.setPointerCapture(ev.pointerId);
  const origen = els.find(e => indice(e) === desde);
  if(origen) origen.setAttribute('data-arrastrando', '');
  arrastre = { tipo, desde, lista, els, destino:null, origen };
  document.body.style.cursor = 'grabbing';
}
function indice(el){
  return el.dataset.sec != null && el.dataset.item == null ? Number(el.dataset.sec) : Number(el.dataset.item.split('.').pop());
}
function moverArrastre(ev){
  if(!arrastre) return;
  const rm = marco.getBoundingClientRect(), rc = canvas.getBoundingClientRect();
  const x = (ev.clientX - rm.left) / zoom, y = (ev.clientY - rm.top) / zoom;
  // cerca de los bordes, la página se desplaza sola
  const w = preview.contentWindow;
  if(ev.clientY < rc.top + 50) w.scrollBy(0, -18);
  else if(ev.clientY > rc.bottom - 50) w.scrollBy(0, 18);

  let mejor = null, dmin = Infinity;
  const rects = arrastre.els.map(e => ({ e, r:e.getBoundingClientRect() }));
  rects.forEach(o=>{
    const cx = o.r.left + o.r.width/2, cy = o.r.top + o.r.height/2;
    const d = Math.hypot(Math.max(0, Math.abs(x - cx) - o.r.width/2), Math.max(0, Math.abs(y - cy) - o.r.height/2));
    if(d < dmin || (d === dmin && Math.hypot(x-cx, y-cy) < mejor.dc)){ dmin = d; mejor = { ...o, dc:Math.hypot(x-cx, y-cy) }; }
  });
  if(!mejor) return;
  const r = mejor.r;
  const enFila = rects.some(o => o.e !== mejor.e && Math.abs(o.r.top - r.top) < 4);
  const despues = enFila ? x > r.left + r.width/2 : y > r.top + r.height/2;
  arrastre.destino = indice(mejor.e) + (despues ? 1 : 0);

  guia.hidden = false;
  if(enFila){
    const gx = rm.left + (despues ? r.right : r.left) * zoom;
    Object.assign(guia.style, { left:(gx - 2)+'px', top:(rm.top + r.top*zoom)+'px', width:'4px', height:(r.height*zoom)+'px' });
  }else{
    const gy = rm.top + (despues ? r.bottom : r.top) * zoom;
    Object.assign(guia.style, { left:(rm.left + r.left*zoom)+'px', top:(gy - 2)+'px', width:(r.width*zoom)+'px', height:'4px' });
  }
}
function terminarArrastre(){
  if(!arrastre) return;
  const { tipo, desde, lista, destino, origen } = arrastre;
  arrastre = null; guia.hidden = true; document.body.style.cursor = '';
  if(origen) origen.removeAttribute('data-arrastrando');
  if(destino == null || destino === desde || destino === desde + 1) return;
  recordar();
  const arr = tipo === 'sec' ? D._secciones : obtener(D, lista);
  const [x] = arr.splice(desde, 1);
  const pos = destino > desde ? destino - 1 : destino;
  arr.splice(pos, 0, x);
  limpiarSeleccion();
  if(tipo === 'sec'){ secActual = pos; irASeccion = null; }
  pintarPanel(); tocar();
}
[barra, barraSec].forEach(b=>{
  b.addEventListener('pointerdown', ev=>{
    const asa = ev.target.closest('.asa'); if(!asa) return;
    empezarArrastre(b === barraSec ? 'sec' : 'item', ev);
  });
  b.addEventListener('pointermove', moverArrastre);
  b.addEventListener('pointerup', terminarArrastre);
  b.addEventListener('pointercancel', terminarArrastre);
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
  colocarBarra(); colocarSeccion();
}
function fijarZoom(z, auto){ zoomAuto = !!auto; if(!auto) zoom = z; aplicarZoom(); }

$('#zoom-menos').addEventListener('click', ()=> fijarZoom(Math.round((zoom - .1)*100)/100, false));
$('#zoom-mas').addEventListener('click',   ()=> fijarZoom(Math.round((zoom + .1)*100)/100, false));
$('#zoom-ajustar').addEventListener('click', ()=> fijarZoom(0, true));
addEventListener('resize', ()=>{ aplicarZoom(); });
canvas.addEventListener('scroll', ()=>{ colocarBarra(); colocarSeccion(); }, {passive:true});

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
    limpiarSeleccion(); ocultarSeccion(); cerrarPop();
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
  prepararDatos(datos || leerBorrador(TPL.id) || TPL.d);
  proyectoId = pid || null;
  seleccion = null; ocultarBarra(); ocultarSeccion(); cerrarPop();
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
  const html = await htmlAutonomo();
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

function verCodigo(codigo, nota){
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
$('#btn-estilo').addEventListener('click', ()=> pop.hidden || popCampos !== CAMPOS_ESTILO ? abrirPop('Estilo de la página', CAMPOS_ESTILO) : cerrarPop());
$('#btn-export').addEventListener('click', exportar);
$('#btn-code').addEventListener('click', async ()=>verCodigo(await htmlAutonomo()));
$('#btn-new').addEventListener('click', ()=>{
  proyectoId = null;
  prepararDatos(TPL.d);
  cerrarPop();
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
   IMÁGENES PROPIAS
   Se achican en el navegador, se guardan en IndexedDB y la demo las
   referencia como img/<hash>.<ext>. Al publicar viajan como archivos
   del deploy; al exportar se incrustan en el HTML.
   ========================================================= */
/* Dentro del visor de Artifacts de Claude la CSP bloquea cualquier fetch
   externo, así que publicar o consultar Notion no puede funcionar ahí. */
const EN_VISOR = !!(window.claude && window.claude.use);

function explicarFalloDeRed(err){
  if(err instanceof TypeError){
    return EN_VISOR
      ? 'El visor de Claude bloquea las conexiones externas. Esto funciona en el sitio publicado.'
      : 'No se pudo conectar con la API. Revisá la dirección en «Catálogo desde Notion».';
  }
  return String(err.message || err);
}

const LADO_MAX = 1920;                    // px del lado más largo
const IMG_MAX_BYTES = 3 * 1024 * 1024;    // ya achicada; en base64 entra en una función de Vercel
const ES_LOCAL = /^img\/[0-9a-f]{12}\.(webp|jpg|png|gif|svg)$/;
const EXT_IMG = { 'image/webp':'webp', 'image/jpeg':'jpg', 'image/png':'png', 'image/gif':'gif', 'image/svg+xml':'svg' };

/* recorre los datos y reemplaza cada texto con f() */
function mapearTextos(o, f){
  if(typeof o === 'string') return f(o);
  if(Array.isArray(o)) return o.map(x=>mapearTextos(x, f));
  if(o && typeof o === 'object'){ const r = {}; for(const k in o) r[k] = mapearTextos(o[k], f); return r; }
  return o;
}

const imagenes = {
  reg: {},            // nombre → { nombre, sha, blob }
  urls: {},           // nombre → blob: URL para la vista previa
  _db: null,

  abrir(){
    if(!this._db) this._db = new Promise((ok, mal)=>{
      const r = indexedDB.open('taller', 1);
      r.onupgradeneeded = ()=> r.result.createObjectStore('imagenes', { keyPath:'nombre' });
      r.onsuccess = ()=> ok(r.result);
      r.onerror = ()=> mal(r.error);
    });
    return this._db;
  },
  async tx(modo, fn){
    const db = await this.abrir();
    return new Promise((ok, mal)=>{
      const t = db.transaction('imagenes', modo);
      const pedido = fn(t.objectStore('imagenes'));
      t.oncomplete = ()=> ok(pedido && pedido.result);
      t.onerror = ()=> mal(t.error);
    });
  },
  recordar(r){
    this.reg[r.nombre] = r;
    if(!this.urls[r.nombre]) this.urls[r.nombre] = URL.createObjectURL(r.blob);
  },
  async cargar(){
    try{ (await this.tx('readonly', s=>s.getAll()) || []).forEach(r=>this.recordar(r)); }
    catch(e){ /* sin IndexedDB las imágenes viven sólo mientras la pestaña esté abierta */ }
  },
  async guardar(blob){
    const hash = await crypto.subtle.digest('SHA-1', await blob.arrayBuffer());
    const sha = [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join('');
    const nombre = `img/${sha.slice(0,12)}.${EXT_IMG[blob.type] || 'jpg'}`;
    if(!this.reg[nombre]){
      const r = { nombre, sha, blob };
      this.recordar(r);
      try{ await this.tx('readwrite', s=>s.put(r)); }catch(e){}
    }
    return nombre;
  },
  /* nombres img/… que usa la página, sin repetir */
  usadas(d){
    const set = new Set();
    mapearTextos(d, v=>{ if(ES_LOCAL.test(v)) set.add(v); return v; });
    return [...set];
  },
  vista(v){ return ES_LOCAL.test(v) ? (this.urls[v] || '') : v; },
};

/* los datos con las imágenes propias apuntando a blob: (para la vista previa) */
function conImagenesLocales(d){ return mapearTextos(d, v=>imagenes.vista(v)); }

function aDataURL(blob){
  return new Promise((ok, mal)=>{
    const f = new FileReader();
    f.onload = ()=> ok(f.result); f.onerror = ()=> mal(f.error);
    f.readAsDataURL(blob);
  });
}

/* el HTML de un solo archivo: las imágenes propias van incrustadas */
async function htmlAutonomo(){
  const datos = {};
  for(const n of imagenes.usadas(D)){ const r = imagenes.reg[n]; if(r) datos[n] = await aDataURL(r.blob); }
  return renderDoc(TPL, mapearTextos(D, v=> ES_LOCAL.test(v) ? (datos[v] || '') : v));
}

/* achica fotos grandes; SVG y GIF (vectores, animaciones) pasan tal cual */
async function achicar(archivo){
  if(/svg|gif/.test(archivo.type)) return archivo;
  let bmp;
  try{ bmp = await createImageBitmap(archivo); }
  catch(e){ throw new Error('Este navegador no puede leer esa imagen. Probá con JPG o PNG.'); }
  const k = Math.min(1, LADO_MAX / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  if(bmp.close) bmp.close();
  const aBlob = (tipo, q)=> new Promise(ok=>c.toBlob(ok, tipo, q));
  let b = await aBlob('image/webp', .82);
  if(!b || b.type !== 'image/webp') b = await aBlob(archivo.type === 'image/png' ? 'image/png' : 'image/jpeg', .85);
  // si ya venía chica y en un formato conocido, no la empeoramos
  return (k === 1 && EXT_IMG[archivo.type] && archivo.size <= b.size) ? archivo : b;
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
  if(!/^image\//.test(archivo.type)){ aviso('Eso no es una imagen.'); return; }
  if(archivo.size > 40 * 1024 * 1024){ aviso('La imagen pasa de 40 MB.'); return; }

  const fld = panel.querySelector(`[data-fld="${ruta}"]`);
  if(fld) fld.classList.add('subiendo');
  aviso('Preparando ' + archivo.name + '…');

  try{
    const blob = await achicar(archivo);
    if(blob.size > IMG_MAX_BYTES) throw new Error('La imagen sigue pasando de 3 MB. Probá con otra.');
    recordar();
    fijar(D, ruta, await imagenes.guardar(blob));
    refrescarCampoImagen(ruta);
    pintarVista();
    apuntarGuardado();
    aviso('Imagen lista');
  }catch(err){
    aviso(String(err.message || err));
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

/* =========================================================
   PUBLICAR DEMO EN VERCEL
   /api/publicar crea un proyecto demo-<nombre> por demo y le sube
   el mismo HTML que se exporta. El nombre queda en la demo, así
   volver a publicarla actualiza la dirección que ya tiene el cliente.
   ========================================================= */
const CLAVE_PUBLICAR = 'taller.clavePublicar';
const nombreDemo = s => slug(String(s || '').replace(/^demo-/, '')).slice(0, 47).replace(/-+$/, '');

function abrirPublicar(){
  const veil = document.createElement('div');
  veil.className = 'veil';
  veil.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="Publicar demo" style="width:min(520px,100%)">
    <div class="sheet-h"><h2>Publicar demo</h2>
      <button class="btn ghost" type="button" data-cerrar aria-label="Cerrar">✕</button></div>
    <div class="sheet-b publicar">
      <label class="rail-campo"><span>Dirección</span>
        <div class="dominio">demo-<input type="text" data-nombre spellcheck="false" autocomplete="off">.vercel.app</div></label>
      <label class="rail-campo"><span>Clave de publicación</span>
        <input type="password" data-clave autocomplete="off" spellcheck="false" placeholder="la de PUBLICAR_TOKEN"></label>
      <p class="hint" data-nota></p>
      <div class="fila"><button class="btn primary" type="button" data-publicar>Publicar</button></div>
      <div data-resultado hidden>
        <a class="enlace" data-enlace target="_blank" rel="noopener"></a>
        <div class="fila" style="margin-top:8px">
          <button class="btn" type="button" data-copiar>Copiar enlace</button>
          <a class="btn" data-wa target="_blank" rel="noopener">Mandar por WhatsApp</a>
        </div>
      </div>
    </div></div>`;
  const q = s => veil.querySelector(s);
  const inNombre = q('[data-nombre]'), inClave = q('[data-clave]'), nota = q('[data-nota]'), btn = q('[data-publicar]');
  inNombre.value = nombreDemo(D._demo || D.marca || TPL.rubro);
  inClave.value = leerLocal(CLAVE_PUBLICAR, '') || '';
  nota.textContent = D._demo
    ? 'Esta demo ya está publicada: volver a publicarla actualiza la misma dirección.'
    : 'Si el nombre ya lo usa otra cuenta, Vercel le agrega un sufijo. La dirección final aparece abajo.';

  const mostrar = url => {
    q('[data-resultado]').hidden = false;
    const a = q('[data-enlace]'); a.href = url; a.textContent = url;
    q('[data-wa]').href = 'https://wa.me/?text=' + encodeURIComponent('Te comparto la demo de tu página: ' + url);
  };
  if(D._demoUrl && D._demo === 'demo-' + inNombre.value) mostrar(D._demoUrl);

  document.body.appendChild(veil);
  inNombre.focus();
  const cerrar = ()=>{ veil.remove(); document.removeEventListener('keydown', tecla); };
  const tecla = e => { if(e.key==='Escape') cerrar(); };
  document.addEventListener('keydown', tecla);

  veil.addEventListener('click', async e=>{
    if(e.target===veil || e.target.closest('[data-cerrar]')) return cerrar();
    if(e.target.closest('[data-copiar]')){
      try{ await navigator.clipboard.writeText(D._demoUrl); aviso('Enlace copiado'); }
      catch(err){ aviso('No se pudo copiar: seleccioná el enlace'); }
      return;
    }
    if(!e.target.closest('[data-publicar]')) return;

    const nombre = nombreDemo(inNombre.value);
    const clave = inClave.value.trim();
    const base = apiBase();
    if(!nombre){ aviso('Poné un nombre para la dirección.'); return; }
    if(!clave){ aviso('Falta la clave de publicación.'); return; }
    if(!base){ aviso('Falta la dirección de la API, en «Catálogo desde Notion».'); return; }
    inNombre.value = nombre;
    escribirLocal(CLAVE_PUBLICAR, clave);

    btn.disabled = true; btn.textContent = 'Publicando…';
    try{
      const usadas = imagenes.usadas(D);
      const perdidas = usadas.filter(n=>!imagenes.reg[n]);
      if(perdidas.length) throw new Error(`Hay ${perdidas.length} imagen(es) que no están en este navegador. Volvé a subirlas o quitalas.`);
      const archivos = usadas.map(n=>({ file:n, sha:imagenes.reg[n].sha, size:imagenes.reg[n].blob.size }));

      const enviar = async cuerpo => {
        const r = await fetch(base + '/api/publicar', {
          method:'POST',
          headers:{ 'Content-Type':'application/json', 'x-publicar-token':clave },
          body: JSON.stringify(cuerpo)
        });
        return { r, j: await r.json().catch(()=>({})) };
      };
      const cuerpo = { proyecto:nombre, html:renderDoc(TPL, D), archivos };
      let { r, j } = await enviar(cuerpo);

      // Vercel pide sólo las imágenes que todavía no tiene; se suben de a una y se reintenta.
      if(r.status === 409 && Array.isArray(j.faltanArchivos)){
        const porSha = Object.fromEntries(archivos.map(a=>[a.sha, imagenes.reg[a.file]]));
        for(const [i, sha] of j.faltanArchivos.entries()){
          btn.textContent = `Subiendo imagen ${i + 1} de ${j.faltanArchivos.length}…`;
          const reg = porSha[sha];
          if(!reg) continue;
          const datos = (await aDataURL(reg.blob)).split(',')[1];
          const x = await enviar({ subir:{ sha, datos } });
          if(!x.r.ok) throw new Error(x.j.error || 'No se pudo subir una imagen.');
        }
        btn.textContent = 'Publicando…';
        ({ r, j } = await enviar(cuerpo));
      }
      if(!r.ok) throw new Error([j.error || 'Vercel no respondió.', j.vercel, j.faltan && j.faltan.join(', ')].filter(Boolean).join(' · '));
      D._demo = j.proyecto; D._demoUrl = j.url;
      apuntarGuardado();
      mostrar(j.url);
      nota.textContent = j.listo ? 'Listo. Ya se puede abrir.' : 'Publicada; Vercel todavía la está terminando, en unos segundos abre.';
      aviso('Demo publicada');
    }catch(err){
      nota.textContent = explicarFalloDeRed(err);
    }finally{
      btn.disabled = false; btn.textContent = 'Publicar de nuevo';
    }
  });
}
$('#btn-publicar').addEventListener('click', abrirPublicar);

/* ---------- arranque ---------- */
irA('vista');
abrirRubro(RUBROS[0].id);
aplicarZoom();
almacen.init();
imagenes.cargar().then(()=>{ pintarPanel(); pintarVista(); });

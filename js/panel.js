/* =========================================================
   PANEL — lo que ve cada cliente: su tienda, sus productos,
   sus pedidos y su plan. Todo pasa por la API con la sesión de
   Clerk; el servidor filtra por dueño y aplica los límites del plan.
   ========================================================= */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const EN_VISOR = false;                       // cuenta.js lo consulta; el panel nunca corre en el visor de Claude

const E = {
  tiendas: [], plan: null, planes: [], rubros: [], meses: [1], cobro: false,
  actual: null,                               // la tienda elegida
  productos: null, limite: null, pedidos: null, pagos: null,
  vista: 'inicio', mesesElegidos: 1,
};
const params = new URLSearchParams(location.search);
const VISTAS = { inicio:'Inicio', productos:'Productos', pedidos:'Pedidos', tienda:'Mi tienda', plan:'Plan' };
const ESTADOS = ['Nuevo', 'Confirmado', 'Enviado', 'Entregado', 'Cancelado'];

/* ---------- utilidades ---------- */
function aviso(txt){
  const t = $('#toast'); t.textContent = txt; t.classList.add('on');
  clearTimeout(aviso._t); aviso._t = setTimeout(()=>t.classList.remove('on'), 3200);
}
function leerLocal(k, alt){ try{ return JSON.parse(localStorage.getItem(k)) ?? alt; }catch(e){ return alt; } }
function escribirLocal(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }
const clave = k => 'panel.' + (cuenta.usuario ? cuenta.usuario.id : 'anonimo') + '.' + k;
const uid = () => cuenta.usuario ? cuenta.usuario.id : null;

const fecha = s => s ? new Intl.DateTimeFormat('es-PY', { day:'numeric', month:'short', year:'numeric' }).format(new Date(s)) : '';
function haceCuanto(s){
  const min = Math.round((Date.now() - new Date(s)) / 60000);
  if(min < 1) return 'recién';
  if(min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if(h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return d < 7 ? `hace ${d} día${d > 1 ? 's' : ''}` : fecha(s);
}
const moneda = () => (E.actual && E.actual.ajustes._moneda) || 'Gs.';
const dinero = n => moneda() + ' ' + String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
function normalizarSlug(s){
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/, '');
}
const urlTienda = t => location.origin + '/' + t.slug;
const direccionCorta = t => location.host + '/' + t.slug;
function errorDe(err){
  if(err instanceof TypeError) return 'No se pudo conectar. Revisá tu conexión.';
  if(err.status === 401) return 'Tu sesión venció. Volvé a ingresar.';
  return String(err.message || err);
}

/* ---------- modal ---------- */
let volverFoco = null;
function abrirModal(titulo, html, alAbrir){
  $('#modal-titulo').textContent = titulo;
  $('#modal-contenido').innerHTML = html;
  volverFoco = document.activeElement;
  $('#modal').hidden = false;
  document.body.classList.add('con-modal');
  if(alAbrir) alAbrir($('#modal-contenido'));
  const caja = $('#modal-contenido');
  const foco = caja.querySelector('[autofocus]') || caja.querySelector('input:not([type=hidden]), select, textarea, button');
  (foco || $('#modal [data-cerrar-modal].btn-s')).focus();
}
function cerrarModal(){
  $('#modal').hidden = true;
  $('#modal-contenido').innerHTML = '';
  document.body.classList.remove('con-modal');
  if(volverFoco && volverFoco.isConnected) volverFoco.focus();
}
document.addEventListener('click', e=>{ if(e.target.closest('[data-cerrar-modal]')) cerrarModal(); });
document.addEventListener('keydown', e=>{ if(e.key === 'Escape' && !$('#modal').hidden) cerrarModal(); });

/* confirmación propia (sin confirm() del navegador) */
function confirmar(titulo, texto, boton, peligro){
  return new Promise(ok=>{
    abrirModal(titulo, `<div class="modal-cuerpo"><p>${texto}</p></div>
      <div class="modal-pie"><button class="btn-s fantasma" type="button" data-no>Cancelar</button>
      <button class="btn-s ${peligro ? 'peligro' : 'primario'}" type="button" data-si>${esc(boton)}</button></div>`, caja=>{
      caja.querySelector('[data-no]').onclick = ()=>{ cerrarModal(); ok(false); };
      caja.querySelector('[data-si]').onclick = ()=>{ cerrarModal(); ok(true); };
    });
  });
}

/* ---------- pantallas ---------- */
function mostrar(id){
  ['#p-cargando', '#p-entrar', '#p-alta', '#p-app'].forEach(s => $(s).hidden = s !== id);
  $('#tabs-panel').hidden = id !== '#p-app';
  cuenta.pintar();
}

/* =========================================================
   CUENTA
   ========================================================= */
let pidioRegistro = false;
cuenta.alCambiar = async ()=>{
  E.tiendas = []; E.actual = null; E.productos = E.pedidos = E.pagos = null;
  if(cuenta.estado === 'sin-servicio'){
    mostrar('#p-entrar');
    $('#nota-entrar').textContent = 'No se pudo conectar con el servicio de cuentas. Probá de nuevo en unos minutos.';
    return;
  }
  if(!cuenta.usuario){
    mostrar('#p-entrar');
    // desde «Crear mi tienda gratis» se abre directo el registro
    if(!pidioRegistro && (params.has('nueva') || params.has('plan'))){ pidioRegistro = true; cuenta.registrarse(); }
    return;
  }
  mostrar('#p-cargando');
  await cargarTiendas();
};

async function cargarTiendas(){
  const yo = uid();
  try{
    const r = await api('/api/tiendas');
    if(uid() !== yo) return;
    Object.assign(E, { tiendas: r.tiendas, plan: r.plan, planes: r.planes, rubros: r.rubros });
    if(!E.tiendas.length){ mostrarAlta(); return; }
    const guardada = leerLocal(clave('tienda'), null);
    elegirTienda(E.tiendas.find(t => t.id === guardada) || E.tiendas[0]);
    mostrar('#p-app');
    const inicial = params.has('pago') || params.has('plan') ? 'plan' : (location.hash.slice(1) in VISTAS ? location.hash.slice(1) : 'inicio');
    irA(inicial);
    if(params.has('pago')) revisarPago(params.get('pago'));
  }catch(err){
    if(uid() !== yo) return;
    mostrar('#p-entrar');
    $('#nota-entrar').textContent = 'No pudimos cargar tus tiendas: ' + errorDe(err);
  }
}

/* =========================================================
   ALTA DE UNA TIENDA
   ========================================================= */
const formAlta = $('#form-alta');
let slugManual = false, pasoAlta = 1, tSlug, slugLibre = null, volverDeAlta = false;

function mostrarAlta(desdeElPanel){
  volverDeAlta = !!desdeElPanel;
  formAlta.reset();
  slugManual = false; slugLibre = null;
  $('[data-base]').textContent = location.host + '/';
  $('[data-slug-estado]').textContent = 'Sólo letras, números y guiones.';
  $('[data-slug-estado]').className = 'pista';
  $('#p-alta [data-error]').hidden = true;
  const elegido = params.get('rubro') || 'tienda';
  $('#alta-rubros').innerHTML = RUBROS.map(r => `
    <label class="rubro">
      <input type="radio" name="rubro" value="${r.id}"${r.id === elegido ? ' checked' : ''}>
      <span class="rubro-vista"><iframe class="mini" data-rubro="${r.id}" tabindex="-1" title="" sandbox loading="lazy"></iframe></span>
      <span class="rubro-pie"><b>${esc(r.rubro)}</b><small>${esc(r.sub)}</small></span>
    </label>`).join('');
  $('[data-volver-panel]').hidden = !volverDeAlta;
  pasoAlta = 1; pintarPaso();
  mostrar('#p-alta');
  formAlta.nombre.focus();
}

function pintarPaso(){
  $$('.alta-paso').forEach(f => f.hidden = Number(f.dataset.paso) !== pasoAlta);
  $$('.alta-pasos li').forEach((li, i) => { li.classList.toggle('on', i + 1 === pasoAlta); li.classList.toggle('hecho', i + 1 < pasoAlta); });
  if(pasoAlta === 2){
    // las miniaturas se arman al verlas, no todas juntas
    const mirar = new IntersectionObserver(es => es.forEach(e => {
      if(e.isIntersecting && !e.target.srcdoc){ mirar.unobserve(e.target); pintarMiniatura(e.target); }
    }), { rootMargin:'200px' });
    $$('#alta-rubros iframe.mini').forEach(f => mirar.observe(f));
  }
  window.scrollTo(0, 0);
}

formAlta.nombre.addEventListener('input', ()=>{
  if(!slugManual){ formAlta.slug.value = normalizarSlug(formAlta.nombre.value); revisarSlug(); }
});
formAlta.slug.addEventListener('input', ()=>{ slugManual = true; revisarSlug(); });
formAlta.slug.addEventListener('blur', ()=>{ formAlta.slug.value = normalizarSlug(formAlta.slug.value); });

function revisarSlug(){
  const est = $('[data-slug-estado]');
  const s = normalizarSlug(formAlta.slug.value);
  slugLibre = null;
  clearTimeout(tSlug);
  if(s.length < 3){ est.textContent = 'Usá al menos 3 letras o números.'; est.className = 'pista'; return; }
  est.textContent = 'Revisando…'; est.className = 'pista';
  tSlug = setTimeout(async ()=>{
    try{
      const r = await api('/api/tiendas?slug=' + encodeURIComponent(s));
      if(normalizarSlug(formAlta.slug.value) !== s) return;
      slugLibre = r.libre;
      est.textContent = r.libre ? `✓ ${location.host}/${r.slug} está libre` : r.motivo;
      est.className = 'pista ' + (r.libre ? 'bien' : 'mal');
    }catch(err){ est.textContent = errorDe(err); est.className = 'pista mal'; }
  }, 350);
}

formAlta.addEventListener('click', e=>{
  if(e.target.closest('[data-atras]')){ pasoAlta--; pintarPaso(); return; }
  if(!e.target.closest('[data-siguiente]')) return;
  if(pasoAlta === 1){
    if(!formAlta.nombre.value.trim()){ aviso('Poné el nombre de tu tienda.'); formAlta.nombre.focus(); return; }
    formAlta.slug.value = normalizarSlug(formAlta.slug.value || formAlta.nombre.value);
    if(formAlta.slug.value.length < 3){ aviso('La dirección necesita al menos 3 letras o números.'); formAlta.slug.focus(); return; }
    if(slugLibre === false){ aviso('Esa dirección ya está tomada. Probá con otra.'); formAlta.slug.focus(); return; }
  }
  pasoAlta++; pintarPaso();
  const primero = $(`.alta-paso[data-paso="${pasoAlta}"]`).querySelector('input:checked, input');
  if(primero) primero.focus();
});
formAlta.addEventListener('keydown', e=>{
  if(e.key === 'Enter' && pasoAlta < 3 && e.target.tagName === 'INPUT'){
    e.preventDefault();
    $(`.alta-paso[data-paso="${pasoAlta}"] [data-siguiente]`).click();
  }
});

formAlta.addEventListener('submit', async e=>{
  e.preventDefault();
  const btn = formAlta.querySelector('[type=submit]'), err = $('#p-alta [data-error]');
  err.hidden = true;
  btn.disabled = true; btn.textContent = 'Creando tu tienda…';
  const yo = uid();
  try{
    const { tienda } = await api('/api/tiendas', { method:'POST', body:{
      accion:'crear', nombre: formAlta.nombre.value.trim(), slug: formAlta.slug.value,
      rubro: (formAlta.querySelector('[name=rubro]:checked') || {}).value || 'tienda',
      whatsapp: formAlta.whatsapp.value,
    } });
    if(uid() !== yo) return;
    E.tiendas.push(tienda);
    elegirTienda(tienda);
    mostrar('#p-app');
    history.replaceState(null, '', '/panel#inicio');
    irA('inicio');
    celebrar(tienda);
  }catch(ex){
    err.textContent = errorDe(ex);
    err.hidden = false;
    if(ex.status === 409){ pasoAlta = 1; pintarPaso(); formAlta.slug.focus(); revisarSlug(); }
  }finally{
    btn.disabled = false; btn.textContent = 'Crear mi tienda';
  }
});

function celebrar(t){
  abrirModal('¡Tu tienda está en línea!', `<div class="modal-cuerpo celebrar">
      <div class="confeti" aria-hidden="true">🎉</div>
      <p>Ya la puede ver cualquiera en:</p>
      <p class="enlace-grande"><a href="${esc(urlTienda(t))}" target="_blank" rel="noopener">${esc(direccionCorta(t))}</a></p>
      <p class="nota">Arrancó con productos de ejemplo. Cambialos por los tuyos desde <b>Productos</b> y revisá los textos en <b>Editar el diseño</b>.</p>
    </div>
    <div class="modal-pie"><a class="btn-s borde" href="${esc(urlTienda(t))}" target="_blank" rel="noopener">Ver mi tienda</a>
      <button class="btn-s primario" type="button" data-ir="productos">Cargar mis productos</button></div>`);
}

/* =========================================================
   EL PANEL
   ========================================================= */
function elegirTienda(t){
  E.actual = t;
  E.productos = E.limite = E.pedidos = null;
  escribirLocal(clave('tienda'), t.id);
  const sel = $('#sel-tienda');
  sel.innerHTML = E.tiendas.map(x => `<option value="${x.id}"${x.id === t.id ? ' selected' : ''}>${esc(x.nombre)}</option>`).join('');
  $('[data-selector]').hidden = E.tiendas.length < 2;
  pintarMarco();
}
$('#sel-tienda').addEventListener('change', e=>{
  const t = E.tiendas.find(x => x.id === e.target.value);
  if(t){ elegirTienda(t); irA(E.vista); }
});

function pintarMarco(){
  const t = E.actual, p = E.plan;
  const ver = $('#ver-tienda');
  ver.href = urlTienda(t);
  ver.hidden = !t.publicada;
  $$('[data-editor]').forEach(a => a.href = '/editor?tienda=' + encodeURIComponent(t.id));
  if(p){
    $('[data-plan-nombre]').textContent = 'Plan ' + p.nombre;
    $('[data-plan-detalle]').textContent = p.fijo ? 'sin vencimiento' : p.hasta ? 'vence el ' + fecha(p.hasta) : 'Mejorar plan →';
  }
  const nuevos = (E.pedidos || []).filter(x => x.estado === 'Nuevo').length;
  $$('[data-nuevos]').forEach(b => { b.hidden = !nuevos; b.textContent = nuevos; });
}

function irA(vista){
  if(!(vista in VISTAS)) vista = 'inicio';
  E.vista = vista;
  if(location.hash.slice(1) !== vista) history.replaceState(null, '', location.pathname + location.search + '#' + vista);
  $$('[data-vista]').forEach(b => b.setAttribute('aria-current', String(b.dataset.vista === vista)));
  $('#titulo-vista').textContent = VISTAS[vista];
  $('#sub-vista').textContent = E.actual ? E.actual.nombre : '';
  document.title = VISTAS[vista] + ' — Tiendita';
  ({ inicio: vistaInicio, productos: vistaProductos, pedidos: vistaPedidos, tienda: vistaTienda, plan: vistaPlan })[vista]();
  $('#vista').scrollTop = 0; window.scrollTo(0, 0);
}
document.addEventListener('click', e=>{
  const b = e.target.closest('[data-vista], [data-ir], [data-vista-enlace]');
  if(!b) return;
  e.preventDefault();
  if(!$('#modal').hidden) cerrarModal();
  irA(b.dataset.vista || b.dataset.ir || b.dataset.vistaEnlace);
});
window.addEventListener('hashchange', ()=>{ const v = location.hash.slice(1); if(v in VISTAS && v !== E.vista && !$('#p-app').hidden) irA(v); });

const vista = $('#vista');
const cargando = txt => `<div class="cargando-vista"><div class="girador" aria-hidden="true"></div><p>${esc(txt || 'Cargando…')}</p></div>`;
const fallo = (err, reintentar) => `<div class="vacio"><p>${esc(errorDe(err))}</p><button class="btn-s borde" type="button" data-ir="${reintentar}">Reintentar</button></div>`;

/* datos de la tienda actual, pedidos una vez y reutilizados */
async function traerProductos(forzar){
  if(E.productos && !forzar) return;
  const t = E.actual;
  const r = await api('/api/productos?tienda=' + encodeURIComponent(t.id));
  if(E.actual !== t) throw Object.assign(new Error('cambió la tienda'), { viejo: true });
  E.productos = r.productos; E.limite = r.limite;
}
async function traerPedidos(forzar){
  if(E.pedidos && !forzar) return;
  const t = E.actual;
  const r = await api('/api/pedidos?tienda=' + encodeURIComponent(t.id));
  if(E.actual !== t) throw Object.assign(new Error('cambió la tienda'), { viejo: true });
  E.pedidos = r.pedidos;
  pintarMarco();
}
/* si mientras se cargaba el usuario cambió de vista o de tienda, no se pinta */
function sigue(v, t){ return E.vista === v && E.actual === t; }

/* ---------- INICIO ---------- */
async function vistaInicio(){
  const t = E.actual;
  vista.innerHTML = cargando();
  try{ await Promise.all([traerPedidos(), traerProductos()]); }
  catch(err){ if(!err.viejo && sigue('inicio', t)) vista.innerHTML = fallo(err, 'inicio'); return; }
  if(!sigue('inicio', t)) return;

  const ahora = new Date(), mes = p => { const d = new Date(p.creado); return d.getMonth() === ahora.getMonth() && d.getFullYear() === ahora.getFullYear(); };
  const validos = E.pedidos.filter(p => p.estado !== 'Cancelado' && mes(p));
  const ventas = validos.reduce((s, p) => s + p.total, 0);
  const nuevos = E.pedidos.filter(p => p.estado === 'Nuevo').length;
  const lim = E.limite.productos;
  const pasos = [
    { hecho: true, txt: 'Creaste tu tienda' },
    { hecho: !!String(t.ajustes.whatsapp || '').replace(/\D/g, ''), txt: 'Cargá el WhatsApp que recibe los pedidos', ir: 'tienda' },
    { hecho: E.productos.some(p => p.img), txt: 'Cargá tus productos con foto', ir: 'productos' },
    { hecho: !!leerLocal(clave('diseño.' + t.id), false), txt: 'Revisá los textos y colores de tu tienda', editor: true },
    { hecho: !!leerLocal(clave('compartida.' + t.id), false), txt: 'Compartí el enlace con tus clientes', compartir: true },
  ];
  const faltan = pasos.filter(p => !p.hecho).length;

  vista.innerHTML = `
    ${t.publicada ? `
    <section class="tarjeta enlace-tienda">
      <div><span class="estado-punto en-linea"></span><b>Tu tienda está en línea</b>
        <a class="enlace-grande" href="${esc(urlTienda(t))}" target="_blank" rel="noopener">${esc(direccionCorta(t))}</a></div>
      <div class="fila-botones">
        <button class="btn-s borde chico" type="button" data-copiar>Copiar enlace</button>
        <a class="btn-s wa chico" data-compartir href="#" target="_blank" rel="noopener">Compartir por WhatsApp</a>
      </div>
    </section>` : `
    <section class="tarjeta alerta">
      <div><b>Tu tienda no está publicada</b><p>Nadie la puede ver hasta que la publiques.</p></div>
      <button class="btn-s primario chico" type="button" data-publicar>Publicar ahora</button>
    </section>`}

    <section class="metricas">
      <div class="metrica"><small>Pedidos este mes</small><b>${validos.length}</b></div>
      <div class="metrica"><small>Ventas este mes</small><b>${dinero(ventas)}</b></div>
      <div class="metrica"><small>Ticket promedio</small><b>${validos.length ? dinero(ventas / validos.length) : '—'}</b></div>
      <div class="metrica${nuevos ? ' resalta' : ''}"><small>Por confirmar</small><b>${nuevos}</b></div>
    </section>

    <div class="columnas">
      <section class="tarjeta">
        <div class="tarjeta-cabeza"><h2>Últimos pedidos</h2><button class="btn-s fantasma chico" type="button" data-ir="pedidos">Ver todos</button></div>
        ${E.pedidos.length ? `<ul class="lista-simple">${E.pedidos.slice(0, 5).map(p => `
          <li><button type="button" data-ir="pedidos"><span><b>N° ${esc(p.numero)}</b> · ${esc(p.cliente)}<small>${haceCuanto(p.creado)}</small></span>
            <span class="der"><b>${dinero(p.total)}</b><span class="etq-estado e-${p.estado.toLowerCase()}">${esc(p.estado)}</span></span></button></li>`).join('')}</ul>`
          : `<div class="vacio chico"><p>Todavía no entró ningún pedido. Compartí tu enlace para recibir el primero.</p></div>`}
      </section>

      <section class="tarjeta">
        <div class="tarjeta-cabeza"><h2>${faltan ? 'Primeros pasos' : '¡Todo listo!'}</h2><small>${pasos.length - faltan} de ${pasos.length}</small></div>
        <div class="progreso"><span style="width:${(pasos.length - faltan) / pasos.length * 100}%"></span></div>
        <ul class="pasos-panel">${pasos.map(p => `
          <li class="${p.hecho ? 'hecho' : ''}"><span class="tilde" aria-hidden="true"></span>
            ${p.hecho ? esc(p.txt) : p.ir ? `<button class="enlace" type="button" data-ir="${p.ir}">${esc(p.txt)}</button>`
              : p.editor ? `<a class="enlace" data-editor href="/editor?tienda=${encodeURIComponent(t.id)}">${esc(p.txt)}</a>`
              : `<button class="enlace" type="button" data-copiar>${esc(p.txt)}</button>`}</li>`).join('')}</ul>
        <p class="nota">Productos: <b>${E.productos.length}</b>${lim ? ` de ${lim} en tu plan` : ''}.</p>
      </section>
    </div>`;
  const comp = vista.querySelector('[data-compartir]');
  if(comp) comp.href = 'https://wa.me/?text=' + encodeURIComponent(`¡Mirá mi tienda ${t.nombre}! Hacé tu pedido acá: ${urlTienda(t)}`);
}

document.addEventListener('click', async e=>{
  if(e.target.closest('[data-copiar]')){
    const t = E.actual;
    try{ await navigator.clipboard.writeText(urlTienda(t)); aviso('Enlace copiado'); }
    catch(_){ aviso(urlTienda(t)); }
    escribirLocal(clave('compartida.' + t.id), true);
    if(E.vista === 'inicio') vistaInicio();
  }
  if(e.target.closest('[data-compartir]')) escribirLocal(clave('compartida.' + E.actual.id), true);
  if(e.target.closest('[data-editor]') && E.actual) escribirLocal(clave('diseño.' + E.actual.id), true);
  if(e.target.closest('[data-publicar]')) guardarAjustes({ publicada: true }, 'Tienda publicada');
});

/* ---------- PRODUCTOS ---------- */
let filtroProd = '';
async function vistaProductos(){
  const t = E.actual;
  vista.innerHTML = cargando('Trayendo tus productos…');
  try{ await traerProductos(); }
  catch(err){ if(!err.viejo && sigue('productos', t)) vista.innerHTML = fallo(err, 'productos'); return; }
  if(!sigue('productos', t)) return;
  pintarProductos();
}

function pintarProductos(){
  const lim = E.limite.productos, n = E.productos.length;
  const lleno = lim !== null && n >= lim;
  const q = filtroProd.trim().toLowerCase();
  const lista = E.productos.filter(p => !q || (p.titulo + ' ' + p.categoria + ' ' + p.etiqueta).toLowerCase().includes(q));
  vista.innerHTML = `
    <div class="herramientas">
      <input class="buscar" type="search" placeholder="Buscar productos" value="${esc(filtroProd)}" aria-label="Buscar productos" data-buscar>
      <button class="btn-s primario" type="button" data-nuevo-prod ${lleno ? 'disabled' : ''}>＋ Nuevo producto</button>
    </div>
    <div class="cupo${lleno ? ' lleno' : ''}">
      ${lim !== null ? `<div class="progreso"><span style="width:${Math.min(100, n / lim * 100)}%"></span></div>
        <p><b>${n} de ${lim}</b> productos en tu plan ${esc(E.plan.nombre)}.${lleno ? ` <button class="enlace" type="button" data-ir="plan">Mejorá tu plan</button> para cargar más.` : ''}</p>`
        : `<p><b>${n}</b> productos · tu plan no tiene límite.</p>`}
    </div>
    ${lista.length ? `<ul class="productos">${lista.map(p => `
      <li class="producto${p.visible ? '' : ' apagado'}">
        <span class="producto-foto">${p.img ? `<img src="${esc(p.img)}" alt="" loading="lazy">` : '<span class="sin-foto" aria-hidden="true">📷</span>'}</span>
        <span class="producto-datos" data-editar-prod="${p._nid}">
          <b>${esc(p.titulo)}</b>
          <small>${[p.categoria, p.etiqueta].filter(Boolean).map(esc).join(' · ') || 'Sin categoría'}${p.visible ? '' : ' · <em>oculto</em>'}</small>
        </span>
        <span class="producto-precio">${esc(p.precio)}</span>
        <span class="producto-acciones">
          <label class="interruptor" title="${p.visible ? 'Visible en la tienda' : 'Oculto'}"><input type="checkbox" data-visible="${p._nid}" ${p.visible ? 'checked' : ''}><span></span><i class="oculto">Visible</i></label>
          <button class="btn-s fantasma chico" type="button" data-editar-prod="${p._nid}">Editar</button>
          <button class="btn-s fantasma chico icono" type="button" data-borrar-prod="${p._nid}" aria-label="Borrar ${esc(p.titulo)}">✕</button>
        </span>
      </li>`).join('')}</ul>`
      : `<div class="vacio"><p>${q ? 'Ningún producto coincide con la búsqueda.' : 'Todavía no cargaste productos.'}</p>
         ${q ? '' : '<button class="btn-s primario" type="button" data-nuevo-prod>Cargar el primero</button>'}</div>`}`;
}

vista.addEventListener('input', e=>{
  if(e.target.matches('[data-buscar]')){
    filtroProd = e.target.value;
    const pos = e.target.selectionStart;
    pintarProductos();
    const b = vista.querySelector('[data-buscar]'); b.focus(); b.setSelectionRange(pos, pos);
  }
});
vista.addEventListener('change', async e=>{
  const v = e.target.closest('[data-visible]');
  if(!v) return;
  const p = E.productos.find(x => x._nid === v.dataset.visible);
  if(!p) return;
  v.disabled = true;
  try{
    await guardarProducto({ ...p, visible: v.checked });
    aviso(v.checked ? 'Ahora se ve en la tienda' : 'Oculto de la tienda');
  }catch(err){ v.checked = !v.checked; aviso(errorDe(err)); }
  finally{ pintarProductos(); }
});
vista.addEventListener('click', async e=>{
  if(e.target.closest('[data-nuevo-prod]')){ formProducto(null); return; }
  const ed = e.target.closest('[data-editar-prod]');
  if(ed){ formProducto(E.productos.find(x => x._nid === ed.dataset.editarProd)); return; }
  const bo = e.target.closest('[data-borrar-prod]');
  if(bo){
    const p = E.productos.find(x => x._nid === bo.dataset.borrarProd);
    if(!p || !await confirmar('Borrar producto', `¿Borrar <b>${esc(p.titulo)}</b>? Deja de verse en tu tienda.`, 'Borrar', true)) return;
    try{
      await api(`/api/productos?tienda=${encodeURIComponent(E.actual.id)}&id=${encodeURIComponent(p._nid)}`, { method:'DELETE' });
      E.productos = E.productos.filter(x => x !== p);
      aviso('Producto borrado');
      pintarProductos();
    }catch(err){ aviso(errorDe(err)); }
  }
});

async function guardarProducto(p){
  const { producto } = await api('/api/productos', { method:'POST', body:{ tienda: E.actual.id, producto: p } });
  const i = E.productos.findIndex(x => x._nid === producto._nid);
  const limpio = (({ _orden, ...x }) => x)(producto);
  if(i >= 0) E.productos[i] = limpio; else E.productos.push(limpio);
  return limpio;
}

const ETIQUETAS = ['Nuevo', 'Oferta', 'Más vendido', 'Agotado'];
function formProducto(p){
  const cats = [...new Set(E.productos.map(x => x.categoria).filter(Boolean))];
  const v = p || { titulo:'', precio:'', texto:'', categoria:'', etiqueta:'', img:'', visible:true };
  abrirModal(p ? 'Editar producto' : 'Nuevo producto', `
    <form class="modal-cuerpo formulario" data-form-prod novalidate>
      <div class="foto-campo">
        <button type="button" class="foto-caja" data-subir-foto aria-label="Elegir foto">
          ${v.img ? `<img src="${esc(v.img)}" alt="">` : '<span>📷<b>Agregar foto</b><small>JPG, PNG o WebP</small></span>'}
        </button>
        <div class="foto-opciones">
          <button type="button" class="btn-s borde chico" data-subir-foto>${v.img ? 'Cambiar foto' : 'Subir foto'}</button>
          ${v.img ? '<button type="button" class="btn-s fantasma chico" data-quitar-foto>Quitar</button>' : ''}
          <details class="foto-url"><summary>o pegá un enlace</summary><input name="img" type="url" value="${esc(v.img)}" placeholder="https://…"></details>
        </div>
      </div>
      <label class="campo"><span>Nombre</span><input name="titulo" required maxlength="120" value="${esc(v.titulo)}" autofocus></label>
      <div class="dos">
        <label class="campo"><span>Precio</span><input name="precio" maxlength="40" inputmode="numeric" value="${esc(v.precio)}" placeholder="${esc(moneda())} 150.000">
          <small class="pista">Sin número (ej. «A consultar») el botón pasa a consultar por WhatsApp.</small></label>
        <label class="campo"><span>Categoría</span><input name="categoria" maxlength="60" list="lista-cats" value="${esc(v.categoria)}" placeholder="Remeras">
          <datalist id="lista-cats">${cats.map(c => `<option value="${esc(c)}">`).join('')}</datalist>
          ${E.limite.categorias !== null ? `<small class="pista">Tu plan permite ${E.limite.categorias} categorías.</small>` : ''}</label>
      </div>
      <label class="campo"><span>Descripción</span><textarea name="texto" rows="3" maxlength="600">${esc(v.texto)}</textarea></label>
      <div class="dos">
        <label class="campo"><span>Etiqueta</span><input name="etiqueta" maxlength="30" list="lista-etq" value="${esc(v.etiqueta)}" placeholder="Ninguna">
          <datalist id="lista-etq">${ETIQUETAS.map(c => `<option value="${c}">`).join('')}</datalist>
          <small class="pista">«Agotado» lo muestra sin botón de compra.</small></label>
        <label class="campo check"><input type="checkbox" name="visible" ${v.visible ? 'checked' : ''}><span>Visible en la tienda</span></label>
      </div>
      <p class="error" data-error hidden></p>
    </form>
    <div class="modal-pie"><button class="btn-s fantasma" type="button" data-cerrar-modal>Cancelar</button>
      <button class="btn-s primario" type="button" data-guardar-prod>${p ? 'Guardar cambios' : 'Agregar producto'}</button></div>`, caja=>{
    const f = caja.querySelector('[data-form-prod]');
    const pie = $('#modal-contenido .modal-pie');
    let img = v.img;
    const pintarFoto = ()=>{
      f.querySelector('.foto-caja').innerHTML = img ? `<img src="${esc(img)}" alt="">` : '<span>📷<b>Agregar foto</b><small>JPG, PNG o WebP</small></span>';
      f.img.value = img;
    };
    f.img.addEventListener('change', ()=>{ img = f.img.value.trim(); pintarFoto(); });
    f.addEventListener('click', ev=>{
      if(ev.target.closest('[data-subir-foto]')) elegirFoto(async archivo=>{
        const caja = f.querySelector('.foto-caja');
        caja.classList.add('subiendo');
        try{ img = await prepararYSubir(archivo); pintarFoto(); }
        catch(err){
          aviso(err.status === 503 ? 'La subida de fotos todavía no está configurada. Pegá el enlace de una imagen.' : errorDe(err));
          if(err.status === 503) f.querySelector('.foto-url').open = true;
        }
        finally{ caja.classList.remove('subiendo'); }
      });
      if(ev.target.closest('[data-quitar-foto]')){ img = ''; pintarFoto(); }
    });
    f.precio.addEventListener('blur', ()=>{
      // «150000» pasa a «Gs. 150.000»; un texto como «A consultar» queda igual
      const s = f.precio.value.trim();
      if(/^[\d.\s]+$/.test(s) && /\d/.test(s)) f.precio.value = moneda() + ' ' + s.replace(/\D/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    });
    const guardar = async ()=>{
      const err = f.querySelector('[data-error]');
      err.hidden = true;
      if(!f.titulo.value.trim()){ f.titulo.focus(); err.textContent = 'Poné el nombre del producto.'; err.hidden = false; return; }
      f.precio.dispatchEvent(new Event('blur'));
      const btn = pie.querySelector('[data-guardar-prod]');
      btn.disabled = true; btn.textContent = 'Guardando…';
      try{
        await guardarProducto({ ...(p || {}), titulo: f.titulo.value.trim(), precio: f.precio.value.trim(), texto: f.texto.value.trim(),
          categoria: f.categoria.value.trim(), etiqueta: f.etiqueta.value.trim(), img, visible: f.visible.checked });
        cerrarModal();
        aviso(p ? 'Producto guardado' : 'Producto agregado');
        if(E.vista === 'productos') pintarProductos();
      }catch(ex){
        err.innerHTML = esc(errorDe(ex)) + (ex.status === 403 ? ' <button class="enlace" type="button" data-ir="plan">Ver planes</button>' : '');
        err.hidden = false;
      }finally{ btn.disabled = false; btn.textContent = p ? 'Guardar cambios' : 'Agregar producto'; }
    };
    pie.querySelector('[data-guardar-prod]').addEventListener('click', guardar);
    f.addEventListener('submit', ev=>{ ev.preventDefault(); guardar(); });
  });
}

/* elegir una foto del dispositivo */
const inputFoto = $('#archivo-foto');
let alElegirFoto = null;
function elegirFoto(cb){ alElegirFoto = cb; inputFoto.click(); }
inputFoto.addEventListener('change', ()=>{
  const a = inputFoto.files && inputFoto.files[0];
  inputFoto.value = '';
  if(a && alElegirFoto) alElegirFoto(a);
});
async function prepararYSubir(archivo){
  if(!/^image\//.test(archivo.type)) throw new Error('Eso no es una imagen.');
  if(/svg/.test(archivo.type)) throw new Error('Usá una foto JPG, PNG o WebP.');
  if(archivo.size > 40 * 1024 * 1024) throw new Error('La foto pasa de 40 MB.');
  aviso('Subiendo foto…');
  const blob = await achicarFoto(archivo);
  if(blob.size > 5 * 1024 * 1024) throw new Error('La foto sigue pasando de 5 MB. Probá con otra.');
  const url = await subirFoto(blob);
  aviso('Foto lista');
  return url;
}

/* ---------- PEDIDOS ---------- */
let filtroPed = '';
async function vistaPedidos(forzar){
  const t = E.actual;
  if(!E.pedidos || forzar) vista.innerHTML = cargando('Trayendo tus pedidos…');
  try{ await traerPedidos(forzar === true); }
  catch(err){ if(!err.viejo && sigue('pedidos', t)) vista.innerHTML = fallo(err, 'pedidos'); return; }
  if(!sigue('pedidos', t)) return;
  pintarPedidos();
}

function pintarPedidos(){
  const cuantos = e => E.pedidos.filter(p => p.estado === e).length;
  const lista = E.pedidos.filter(p => !filtroPed || p.estado === filtroPed);
  const t = E.actual;
  vista.innerHTML = `
    <div class="herramientas">
      <div class="chips" role="group" aria-label="Filtrar por estado">
        <button type="button" class="chip-f${!filtroPed ? ' on' : ''}" data-filtro-ped="">Todos <b>${E.pedidos.length}</b></button>
        ${ESTADOS.map(e => `<button type="button" class="chip-f${filtroPed === e ? ' on' : ''}" data-filtro-ped="${e}">${e} <b>${cuantos(e)}</b></button>`).join('')}
      </div>
      <button class="btn-s borde chico" type="button" data-recargar-ped>↻ Actualizar</button>
    </div>
    ${lista.length ? `<ul class="pedidos">${lista.map(p => `
      <li class="pedido">
        <details>
          <summary>
            <span class="pedido-num"><b>N° ${esc(p.numero)}</b><small>${haceCuanto(p.creado)}</small></span>
            <span class="pedido-cliente">${esc(p.cliente)}<small>${p.detalle.reduce((s, l) => s + l.c, 0)} producto(s) · ${esc(p.entrega)}</small></span>
            <b class="pedido-total">${dinero(p.total)}</b>
            <span class="etq-estado e-${p.estado.toLowerCase()}">${esc(p.estado)}</span>
          </summary>
          <div class="pedido-detalle">
            <ul class="lineas">${p.detalle.map(l => `<li><span>${l.c} × ${esc(l.t)}</span><b>${dinero(l.p * l.c)}</b></li>`).join('')}
              <li class="sub"><span>Subtotal</span><b>${dinero(p.subtotal)}</b></li>
              ${p.entrega === 'Retiro en el local' ? '' : `<li class="sub"><span>Envío</span><b>${p.envio ? dinero(p.envio) : 'Gratis'}</b></li>`}
              <li class="tot"><span>Total</span><b>${dinero(p.total)}</b></li></ul>
            <dl class="datos-pedido">
              <div><dt>Entrega</dt><dd>${esc(p.entrega)}${p.direccion ? ' · ' + esc(p.direccion) : ''}</dd></div>
              ${p.pago ? `<div><dt>Pago</dt><dd>${esc(p.pago)}</dd></div>` : ''}
              ${p.telefono ? `<div><dt>Teléfono</dt><dd>${esc(p.telefono)}</dd></div>` : ''}
              ${p.notas ? `<div><dt>Notas</dt><dd>${esc(p.notas)}</dd></div>` : ''}
              <div><dt>Fecha</dt><dd>${new Date(p.creado).toLocaleString('es-PY')}</dd></div>
            </dl>
            <div class="fila-botones">
              <label class="campo en-linea"><span>Estado</span><select data-estado="${p.id}">${ESTADOS.map(e => `<option${e === p.estado ? ' selected' : ''}>${e}</option>`).join('')}</select></label>
              ${p.telefono ? `<a class="btn-s wa chico" target="_blank" rel="noopener" href="${esc(wa(p.telefono, `Hola ${p.cliente}, te escribimos de ${t.nombre} por tu pedido N° ${p.numero}.`))}">Escribirle por WhatsApp</a>` : ''}
            </div>
          </div>
        </details>
      </li>`).join('')}</ul>`
      : `<div class="vacio"><p>${filtroPed ? `No hay pedidos en «${esc(filtroPed)}».` : 'Todavía no entró ningún pedido.'}</p>
         ${!filtroPed && t.publicada ? '<button class="btn-s primario" type="button" data-copiar>Copiar el enlace de mi tienda</button>' : ''}</div>`}`;
}

vista.addEventListener('click', e=>{
  const f = e.target.closest('[data-filtro-ped]');
  if(f){ filtroPed = f.dataset.filtroPed; pintarPedidos(); return; }
  if(e.target.closest('[data-recargar-ped]')) vistaPedidos(true);
});
vista.addEventListener('change', async e=>{
  const s = e.target.closest('[data-estado]');
  if(!s) return;
  const p = E.pedidos.find(x => x.id === s.dataset.estado);
  const antes = p.estado;
  p.estado = s.value; s.disabled = true;
  try{
    await api('/api/pedidos', { method:'POST', body:{ accion:'estado', id: p.id, estado: p.estado } });
    aviso(`Pedido N° ${p.numero}: ${p.estado}`);
    const abierto = s.closest('details');
    pintarPedidos(); pintarMarco();
    // se mantiene abierto el pedido que se estaba mirando
    if(abierto){ const d = vista.querySelector(`[data-estado="${p.id}"]`); if(d) d.closest('details').open = true; }
  }catch(err){ p.estado = antes; s.value = antes; aviso(errorDe(err)); }
  finally{ s.disabled = false; }
});

/* ---------- MI TIENDA ---------- */
function vistaTienda(){
  const t = E.actual, a = t.ajustes;
  const puedeOtra = E.plan && E.tiendas.length < E.plan.tiendas;
  vista.innerHTML = `
    <form class="formulario pila" data-form-tienda novalidate>
      <section class="tarjeta">
        <div class="tarjeta-cabeza"><h2>Tu tienda</h2></div>
        <label class="campo"><span>Nombre</span><input name="nombre" required maxlength="80" value="${esc(t.nombre)}"></label>
        <label class="campo"><span>Dirección</span>
          <div class="slug"><span class="slug-base">${esc(location.host)}/</span><input name="slug" maxlength="40" value="${esc(t.slug)}" autocapitalize="off" spellcheck="false"></div>
          <small class="pista" data-slug-tienda>Si la cambiás, el enlace viejo deja de funcionar.</small></label>
        <label class="campo check"><input type="checkbox" name="publicada" ${t.publicada ? 'checked' : ''}><span><b>Publicada</b> — cualquiera con el enlace la puede ver y hacer pedidos</span></label>
      </section>

      <section class="tarjeta">
        <div class="tarjeta-cabeza"><h2>Pedidos</h2></div>
        <label class="campo"><span>WhatsApp que recibe los pedidos</span><input name="whatsapp" type="tel" maxlength="30" value="${esc(a.whatsapp)}" placeholder="0981 123 456"></label>
        <div class="dos">
          <label class="campo"><span>Costo de envío</span><input name="tiendaEnvio" maxlength="40" value="${esc(a.tiendaEnvio)}" placeholder="Gs. 20.000">
            <small class="pista">Vacío: sólo retiro en el local.</small></label>
          <label class="campo"><span>Envío gratis desde</span><input name="tiendaGratis" maxlength="40" value="${esc(a.tiendaGratis)}" placeholder="Gs. 300.000">
            <small class="pista">Vacío: el envío siempre se cobra.</small></label>
        </div>
        <label class="campo"><span>Formas de pago</span><input name="tiendaPagos" maxlength="300" value="${esc(a.tiendaPagos)}" placeholder="Efectivo, Transferencia, Tigo Money">
          <small class="pista">Separadas por coma. Tu cliente elige una en el carrito.</small></label>
        <label class="campo corto"><span>Moneda</span><input name="_moneda" maxlength="10" value="${esc(a._moneda || 'Gs.')}"></label>
      </section>

      <div class="barra-guardar"><button class="btn-s primario" type="submit">Guardar cambios</button></div>
    </form>

    <section class="tarjeta disenio">
      <div><h2>Diseño</h2><p>Textos, fotos, colores, tipografía y secciones: se editan directo sobre la página.</p></div>
      <a class="btn-s borde" data-editor href="/editor?tienda=${encodeURIComponent(t.id)}">Abrir el editor</a>
    </section>

    <section class="tarjeta disenio">
      <div><h2>Otra tienda</h2><p>${puedeOtra ? `Tu plan permite hasta ${E.plan.tiendas} tiendas.` : `Tu plan ${esc(E.plan ? E.plan.nombre : '')} permite ${E.plan ? E.plan.tiendas : 1} tienda. Con el plan Pro, hasta 3.`}</p></div>
      ${puedeOtra ? '<button class="btn-s borde" type="button" data-otra-tienda>Crear otra tienda</button>' : '<button class="btn-s borde" type="button" data-ir="plan">Ver planes</button>'}
    </section>`;

  const f = vista.querySelector('[data-form-tienda]');
  let tRev;
  f.slug.addEventListener('input', ()=>{
    const est = vista.querySelector('[data-slug-tienda]');
    const s = normalizarSlug(f.slug.value);
    clearTimeout(tRev);
    if(s === t.slug){ est.textContent = 'Si la cambiás, el enlace viejo deja de funcionar.'; est.className = 'pista'; return; }
    if(s.length < 3){ est.textContent = 'Usá al menos 3 letras o números.'; est.className = 'pista mal'; return; }
    tRev = setTimeout(async ()=>{
      try{
        const r = await api('/api/tiendas?slug=' + encodeURIComponent(s));
        est.textContent = r.libre ? `✓ ${location.host}/${r.slug} está libre` : r.motivo;
        est.className = 'pista ' + (r.libre ? 'bien' : 'mal');
      }catch(err){ est.textContent = errorDe(err); est.className = 'pista mal'; }
    }, 350);
  });
  f.addEventListener('submit', async e=>{
    e.preventDefault();
    const cambios = {}, datos = {};
    if(f.nombre.value.trim() !== t.nombre) cambios.nombre = f.nombre.value.trim();
    const s = normalizarSlug(f.slug.value);
    if(s !== t.slug) cambios.slug = s;
    if(f.publicada.checked !== t.publicada) cambios.publicada = f.publicada.checked;
    ['whatsapp', 'tiendaEnvio', 'tiendaGratis', 'tiendaPagos', '_moneda'].forEach(k => {
      if(f[k].value.trim() !== String(a[k] || '')) datos[k] = f[k].value.trim();
    });
    if(Object.keys(datos).length || cambios.nombre) cambios.datos = datos;
    if(!Object.keys(cambios).length){ aviso('No hay cambios para guardar.'); return; }
    const btn = f.querySelector('[type=submit]');
    btn.disabled = true; btn.textContent = 'Guardando…';
    await guardarAjustes(cambios, 'Cambios guardados');
    btn.disabled = false; btn.textContent = 'Guardar cambios';
  });
}
vista.addEventListener('click', e=>{
  if(e.target.closest('[data-otra-tienda]')) mostrarAlta(true);
});

async function guardarAjustes(cambios, ok){
  const t = E.actual;
  try{
    const { tienda } = await api('/api/tiendas', { method:'POST', body:{ accion:'ajustes', id: t.id, ...cambios } });
    const i = E.tiendas.findIndex(x => x.id === tienda.id);
    E.tiendas[i] = tienda;
    if(E.actual === t){ E.actual = tienda; }
    elegirTiendaSinBorrar(tienda);
    aviso(ok);
    irA(E.vista);
  }catch(err){ aviso(errorDe(err)); }
}
/* actualiza el marco sin descartar productos y pedidos ya traídos */
function elegirTiendaSinBorrar(t){
  const { productos, limite, pedidos } = E;
  elegirTienda(t);
  Object.assign(E, { productos, limite, pedidos });
  pintarMarco();
}

/* ---------- PLAN ---------- */
async function vistaPlan(){
  vista.innerHTML = cargando();
  const yo = uid();
  try{
    const r = await api('/api/planes');
    if(uid() !== yo || E.vista !== 'plan') return;
    Object.assign(E, { planes: r.planes, meses: r.meses, cobro: r.cobro, plan: r.plan, pagos: r.pagos });
    if(!E.meses.includes(E.mesesElegidos)) E.mesesElegidos = E.meses[0];
    pintarMarco();
    pintarPlan();
  }catch(err){ if(E.vista === 'plan') vista.innerHTML = fallo(err, 'plan'); }
}

function pintarPlan(){
  const p = E.plan, pedido = params.get('plan');
  const estado = p.fijo ? 'Sin vencimiento' : p.hasta ? `Vence el ${fecha(p.hasta)}` : p.vencido ? `Tu plan ${esc((E.planes.find(x => x.id === p.vencido) || {}).nombre || '')} venció` : 'Para siempre';
  vista.innerHTML = `
    <section class="tarjeta plan-actual">
      <div><small>Tu plan</small><h2>${esc(p.nombre)}</h2><p>${estado}</p></div>
      <ul class="usos">
        <li><b>${p.productos === null ? 'Ilimitados' : p.productos}</b><small>productos</small></li>
        <li><b>${p.categorias === null ? 'Ilimitadas' : p.categorias}</b><small>categorías</small></li>
        <li><b>${E.tiendas.length} de ${p.tiendas}</b><small>tiendas</small></li>
      </ul>
    </section>

    ${E.cobro ? '' : `<div class="tarjeta alerta"><p>El pago en línea todavía no está habilitado. Escribinos y activamos tu plan a mano.</p></div>`}

    <div class="herramientas">
      <h2 class="h-seccion">Planes</h2>
      <div class="chips" role="radiogroup" aria-label="Meses a pagar">
        ${E.meses.map(m => `<button type="button" class="chip-f${m === E.mesesElegidos ? ' on' : ''}" role="radio" aria-checked="${m === E.mesesElegidos}" data-meses="${m}">${m} ${m === 1 ? 'mes' : 'meses'}</button>`).join('')}
      </div>
    </div>
    <div class="rejilla-planes panel-planes">${E.planes.map(x => {
      const actual = x.id === p.id;
      const total = x.precio * E.mesesElegidos;
      return `
      <article class="plan${x.destacado ? ' destacado' : ''}${pedido === x.id ? ' pedido' : ''}">
        ${actual ? '<span class="plan-cinta">Tu plan</span>' : x.destacado ? '<span class="plan-cinta">El más elegido</span>' : ''}
        <h3>${esc(x.nombre)}</h3>
        <p class="plan-resumen">${esc(x.resumen)}</p>
        <p class="plan-precio">${x.precio ? `<b>${plata(x.precio)}</b><span>/mes</span>` : '<b>Gs. 0</b>'}</p>
        ${x.precio ? `<button class="btn-s ${x.destacado || pedido === x.id ? 'primario' : 'borde'}" type="button" data-pagar="${x.id}" ${E.cobro ? '' : 'disabled'}>
            ${actual ? 'Extender' : 'Elegir'} · ${plata(total)}</button>`
          : `<button class="btn-s borde" type="button" disabled>${actual ? 'Tu plan actual' : 'Incluido'}</button>`}
        <ul class="tildes">${x.incluye.map(i => `<li>${esc(i)}</li>`).join('')}</ul>
      </article>`; }).join('')}</div>
    ${p.id !== 'gratis' && !p.fijo ? '<p class="nota">Pagar el mismo plan lo extiende desde su vencimiento. Pagar otro plan lo reemplaza desde el día del pago.</p>' : ''}

    <section class="tarjeta">
      <div class="tarjeta-cabeza"><h2>Tus pagos</h2></div>
      ${E.pagos && E.pagos.length ? `<div class="tabla-envuelta"><table class="tabla">
        <thead><tr><th>Fecha</th><th>Plan</th><th>Meses</th><th>Monto</th><th>Estado</th></tr></thead>
        <tbody>${E.pagos.map(x => `<tr><td>${fecha(x.pagadoEl || x.creado)}</td><td>${esc((E.planes.find(y => y.id === x.plan) || {}).nombre || x.plan)}</td>
          <td>${x.meses}</td><td>${plata(x.monto)}</td><td><span class="etq-estado e-${x.estado.toLowerCase()}">${esc(x.estado)}</span></td></tr>`).join('')}</tbody>
      </table></div>` : '<p class="nota">Todavía no hiciste ningún pago.</p>'}
    </section>`;
}

vista.addEventListener('click', e=>{
  const m = e.target.closest('[data-meses]');
  if(m){ E.mesesElegidos = Number(m.dataset.meses); pintarPlan(); return; }
  const b = e.target.closest('[data-pagar]');
  if(b) formPago(E.planes.find(x => x.id === b.dataset.pagar));
});

function formPago(plan){
  const meses = E.mesesElegidos, total = plan.precio * meses;
  const previo = leerLocal(clave('comprador'), {});
  abrirModal(`Plan ${plan.nombre} · ${meses} ${meses === 1 ? 'mes' : 'meses'}`, `
    <form class="modal-cuerpo formulario" data-form-pago novalidate>
      <p class="resumen-pago"><span>Total a pagar</span><b>${plata(total)}</b></p>
      <p class="nota">Pagás en Pagopar con tarjeta, billetera o boca de cobranza. Tu plan se activa apenas se acredita.</p>
      <label class="campo"><span>Nombre y apellido</span><input name="nombre" required maxlength="120" autocomplete="name" value="${esc(previo.nombre || cuenta.usuario.fullName || '')}"></label>
      <div class="dos">
        <label class="campo"><span>Cédula</span><input name="documento" required maxlength="20" inputmode="numeric" value="${esc(previo.documento || '')}"></label>
        <label class="campo"><span>Teléfono</span><input name="telefono" required type="tel" maxlength="30" autocomplete="tel" value="${esc(previo.telefono || '')}"></label>
      </div>
      <details class="factura"${previo.ruc ? ' open' : ''}><summary>Quiero factura con RUC</summary>
        <div class="dos">
          <label class="campo"><span>RUC</span><input name="ruc" maxlength="20" value="${esc(previo.ruc || '')}" placeholder="1234567-8"></label>
          <label class="campo"><span>Razón social</span><input name="razonSocial" maxlength="120" value="${esc(previo.razonSocial || '')}"></label>
        </div>
      </details>
      <p class="error" data-error hidden></p>
    </form>
    <div class="modal-pie"><button class="btn-s fantasma" type="button" data-cerrar-modal>Cancelar</button>
      <button class="btn-s primario" type="button" data-ir-a-pagar>Ir a pagar ${plata(total)}</button></div>`, caja=>{
    const f = caja.querySelector('[data-form-pago]');
    const btn = $('#modal-contenido [data-ir-a-pagar]');
    const enviar = async ()=>{
      const err = f.querySelector('[data-error]');
      err.hidden = true;
      const c = { nombre: f.nombre.value.trim(), documento: f.documento.value.trim(), telefono: f.telefono.value.trim(),
                  ruc: f.ruc.value.trim(), razonSocial: f.razonSocial.value.trim() };
      if(!c.nombre || !c.documento || !c.telefono){ err.textContent = 'Completá tu nombre, tu cédula y tu teléfono.'; err.hidden = false; return; }
      escribirLocal(clave('comprador'), c);
      btn.disabled = true; btn.textContent = 'Abriendo Pagopar…';
      try{
        const { url } = await api('/api/planes', { method:'POST', body:{ plan: plan.id, meses, comprador: c } });
        location.href = url;
      }catch(ex){
        err.textContent = errorDe(ex); err.hidden = false;
        btn.disabled = false; btn.textContent = `Ir a pagar ${plata(total)}`;
      }
    };
    btn.addEventListener('click', enviar);
    f.addEventListener('submit', ev=>{ ev.preventDefault(); enviar(); });
  });
}

/* la vuelta desde Pagopar: /panel?pago=<hash> */
async function revisarPago(hash){
  history.replaceState(null, '', '/panel#plan');
  params.delete('pago');
  try{
    const r = await api('/api/planes?pago=' + encodeURIComponent(hash));
    const c = r.confirmado;
    Object.assign(E, { plan: r.plan, pagos: r.pagos });
    pintarMarco();
    if(E.vista === 'plan') pintarPlan();
    if(!c) return;
    if(c.estado === 'Pagado') abrirModal('¡Pago acreditado!', `<div class="modal-cuerpo celebrar"><div class="confeti" aria-hidden="true">🎉</div>
      <p>Tu plan <b>${esc(r.plan.nombre)}</b> ya está activo${r.plan.hasta ? ` hasta el ${fecha(r.plan.hasta)}` : ''}.</p></div>
      <div class="modal-pie"><button class="btn-s primario" type="button" data-cerrar-modal>Seguir</button></div>`);
    else if(c.estado === 'Cancelado') aviso('El pago se canceló. Podés intentar de nuevo.');
    else aviso('Tu pago todavía no se acreditó. Si pagaste en una boca de cobranza, puede tardar un rato.');
  }catch(err){ aviso(errorDe(err)); }
}

$('[data-volver-panel]').addEventListener('click', ()=>{ mostrar('#p-app'); irA(E.vista); });

/* ---------- arranque ---------- */
cuenta.iniciar();

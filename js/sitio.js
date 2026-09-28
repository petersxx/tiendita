/* =========================================================
   SITIO — portada y piezas que comparte con el panel
   Las miniaturas de plantillas son páginas reales, armadas con el
   mismo motor que el editor y que las tiendas publicadas.
   ========================================================= */

/* los datos de un rubro listos para renderDoc(), como prepararDatos() del editor */
function armarPlantilla(id){
  const TPL = RUBROS.find(r => r.id === id) || RUBROS[0];
  const copia = o => o === undefined ? o : JSON.parse(JSON.stringify(o));
  const D = Object.assign({}, ESTILO_POR_DEFECTO, copia(TPL.d));
  if(!Array.isArray(D._secciones)) D._secciones = [...TPL.secciones];
  D._secciones.forEach(n => {
    const s = SEC[n]; if(!s) return;
    const base = (s.familia === 'hero' ? SEC.heroSplit.nuevo : s.nuevo) || {};
    camposSeccion(n).forEach(c => {
      if(D[c.k] === undefined) D[c.k] = copia(TPL.d[c.k] ?? base[c.k] ?? ESTILO_POR_DEFECTO[c.k] ?? (c.t === 'lista' ? [] : ''));
    });
  });
  CAMPOS_ESTILO.forEach(c => { if(D[c.k] === undefined) D[c.k] = copia(TPL.d[c.k] ?? ESTILO_POR_DEFECTO[c.k] ?? ''); });
  return { TPL, D };
}

/* una página de 1280 px achicada al ancho de su caja */
function pintarMiniatura(iframe){
  const { TPL, D } = armarPlantilla(iframe.dataset.rubro);
  iframe.srcdoc = renderDoc(TPL, D, false);
  const escalar = () => {
    const caja = iframe.parentElement;
    const k = caja.clientWidth / 1280;
    iframe.style.transform = `scale(${k})`;
    iframe.style.height = (caja.clientHeight / k) + 'px';
  };
  escalar();
  new ResizeObserver(escalar).observe(iframe.parentElement);
}

const plata = n => 'Gs. ' + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

/* ---------- portada ---------- */
if(document.body.classList.contains('portada')){
  const DESTACADAS = ['tienda', 'moda', 'gastronomia', 'belleza', 'tecnologia', 'despensa'];
  const rejilla = document.getElementById('rejilla-plantillas');
  rejilla.innerHTML = DESTACADAS.map(id => RUBROS.find(r => r.id === id)).filter(Boolean).map(r => `
    <button class="plantilla" type="button" data-demo="${r.id}">
      <span class="plantilla-vista"><iframe class="mini" data-rubro="${r.id}" tabindex="-1" title="" sandbox loading="lazy"></iframe></span>
      <span class="plantilla-pie"><b>${esc(r.rubro)}</b><small>${esc(r.sub)}</small></span>
    </button>`).join('');

  // las miniaturas se arman recién cuando están por verse
  const mirar = new IntersectionObserver(entradas => entradas.forEach(e => {
    if(e.isIntersecting){ mirar.unobserve(e.target); pintarMiniatura(e.target); }
  }), { rootMargin: '300px' });
  document.querySelectorAll('iframe.mini').forEach(f => mirar.observe(f));

  /* vista completa de una plantilla */
  const modal = document.getElementById('modal-demo');
  let volverA = null;
  function abrirDemo(id){
    const { TPL, D } = armarPlantilla(id);
    document.getElementById('demo-titulo').textContent = TPL.rubro + ' · ' + TPL.sub;
    document.getElementById('demo-usar').href = '/panel?nueva=1&rubro=' + encodeURIComponent(TPL.id);
    document.getElementById('demo-marco').srcdoc = renderDoc(TPL, D, false);
    volverA = document.activeElement;
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    modal.querySelector('[data-cerrar].btn-s').focus();
  }
  function cerrarDemo(){
    modal.hidden = true;
    document.body.style.overflow = '';
    document.getElementById('demo-marco').srcdoc = '';
    if(volverA) volverA.focus();
  }
  document.addEventListener('click', e => {
    const d = e.target.closest('[data-demo]');
    if(d){ abrirDemo(d.dataset.demo); return; }
    if(e.target.closest('[data-cerrar]')) cerrarDemo();
  });
  document.addEventListener('keydown', e => { if(e.key === 'Escape' && !modal.hidden) cerrarDemo(); });

  /* planes: salen de la API, así el precio vive en un solo lugar */
  const planes = document.getElementById('rejilla-planes');
  fetch('/api/planes').then(r => r.ok ? r.json() : Promise.reject(r))
    .then(({ planes: lista }) => {
      planes.innerHTML = lista.map(p => `
        <article class="plan${p.destacado ? ' destacado' : ''}">
          ${p.destacado ? '<span class="plan-cinta">El más elegido</span>' : ''}
          <h3>${esc(p.nombre)}</h3>
          <p class="plan-resumen">${esc(p.resumen)}</p>
          <p class="plan-precio">${p.precio ? `<b>${plata(p.precio)}</b><span>/mes</span>` : '<b>Gs. 0</b><span>para siempre</span>'}</p>
          <a class="btn-s ${p.destacado ? 'primario' : 'borde'}" href="${p.precio ? '/panel?plan=' + p.id : '/panel?nueva=1'}">${p.precio ? 'Elegir ' + esc(p.nombre) : 'Crear mi tienda gratis'}</a>
          <ul class="tildes">${p.incluye.map(i => `<li>${esc(i)}</li>`).join('')}</ul>
        </article>`).join('');
    })
    .catch(() => { planes.innerHTML = '<p class="cargando">No pudimos cargar los precios. <a href="/panel">Entrá al panel</a> para verlos.</p>'; });
}

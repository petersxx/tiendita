/* Arma el HTML de una tienda en el servidor con el mismo motor del editor.
   js/motor.js, js/secciones.js y js/rubros.js son scripts de navegador que
   sólo arman texto: se cargan una vez en un contexto aislado de Node y se
   llama a renderDoc() como lo hace la vista previa. vercel.json incluye
   esos archivos en la función. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';

const ARCHIVOS = ['js/motor.js', 'js/secciones.js', 'js/rubros.js'];

/* lo mismo que prepararDatos() del editor: completa lo que falte con el rubro */
const ARMAR = `
function __armar(rubro, datos){
  const TPL = RUBROS.find(r => r.id === rubro) || RUBROS[0];
  const D = Object.assign({}, ESTILO_POR_DEFECTO, datos);
  if(!Array.isArray(D._secciones)) D._secciones = [...TPL.secciones];
  const copia = o => o === undefined ? o : JSON.parse(JSON.stringify(o));
  D._secciones.forEach(nombre => {
    const s = SEC[nombre]; if(!s) return;
    const base = (s.familia === 'hero' ? SEC.heroSplit.nuevo : s.nuevo) || {};
    camposSeccion(nombre).forEach(c => {
      if(D[c.k] === undefined) D[c.k] = copia(TPL.d[c.k] ?? base[c.k] ?? ESTILO_POR_DEFECTO[c.k] ?? (c.t==='lista' ? [] : c.t==='check' ? false : ''));
    });
  });
  CAMPOS_ESTILO.forEach(c => { if(D[c.k] === undefined) D[c.k] = copia(TPL.d[c.k] ?? ESTILO_POR_DEFECTO[c.k] ?? ''); });
  return { TPL, D };
}
function __render(rubro, datos){ const { TPL, D } = __armar(rubro, datos); return renderDoc(TPL, D, false); }
/* una tienda nueva: el contenido del rubro, siempre con carrito y sin
   testimonios de ejemplo, que en una tienda real parecerían reseñas verdaderas */
function __nuevaTienda(rubro){
  const TPL = RUBROS.find(r => r.id === rubro); if(!TPL) return null;
  const secciones = TPL.secciones.filter(n => n !== 'testimonios');
  if(!secciones.includes('tienda')){
    const hero = secciones.findIndex(n => FAMILIA(n) === 'hero');
    secciones.splice(hero >= 0 ? hero + 1 : Math.min(1, secciones.length), 0, 'tienda');
  }
  const { productos, ...d } = TPL.d;
  const tienda = SEC.tienda.nuevo;
  for(const k in tienda) if(k !== 'productos' && d[k] === undefined) d[k] = tienda[k];
  return { secciones, d, productos: productos || tienda.productos, rubro: TPL.rubro };
}
function __rubros(){ return RUBROS.map(r => ({ id: r.id, rubro: r.rubro, sub: r.sub })); }
`;

let ctx;
function motor() {
  if (ctx) return ctx;
  ctx = vm.createContext({ console });
  for (const f of ARCHIVOS) {
    vm.runInContext(readFileSync(join(process.cwd(), f), 'utf8'), ctx, { filename: f });
  }
  vm.runInContext(ARMAR, ctx, { filename: 'armar.js' });
  return ctx;
}

/* Un dueño de tienda escribe sus propios enlaces e imágenes. Todas las
   tiendas comparten dominio con el panel, así que sólo se aceptan
   direcciones web, de correo, de teléfono, anclas y rutas propias. */
const CLAVE_URL = /(url|Url|img|Img)$/;
const URL_SEGURA = /^(https?:\/\/|mailto:|tel:|#|\/(?!\/)|$)/i;
function limpiarUrls(o, clave) {
  if (typeof o === 'string') return clave && CLAVE_URL.test(clave) && !URL_SEGURA.test(o.trim()) ? '' : o;
  if (Array.isArray(o)) return o.map(x => limpiarUrls(x, clave));
  if (o && typeof o === 'object') {
    const r = {};
    for (const k in o) r[k] = limpiarUrls(o[k], k);
    return r;
  }
  return o;
}

/** El HTML de la tienda. `nonce` habilita el único script propio (el carrito). */
export function renderTienda({ rubro, datos, nonce, marca }) {
  const c = motor();
  const d = limpiarUrls(JSON.parse(JSON.stringify(datos)));
  let html = vm.runInContext('__render', c)(rubro, d);
  html = html.replace(/<script>/g, `<script nonce="${nonce}">`);
  if (marca) html = html.replace('</body>', `${marca}\n</body>`);
  return html;
}

/** Secciones, contenido y productos de arranque de un rubro, para crear una tienda. */
export function plantilla(rubro) {
  const r = vm.runInContext('__nuevaTienda', motor())(rubro);
  return r && JSON.parse(JSON.stringify(r));
}

export function rubros() {
  return JSON.parse(JSON.stringify(vm.runInContext('__rubros', motor())()));
}

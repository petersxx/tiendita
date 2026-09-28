/* /api/productos — los productos de una tienda, de a uno, desde el panel.

   GET    ?tienda=<id>                → { productos, limite: { productos, categorias } }
   POST   { tienda, producto }        → { producto }   con producto._nid actualiza; sin él, crea
   DELETE ?tienda=<id>&id=<producto>  → { ok: true }   lo archiva (30 días en la papelera de Notion)

   Los límites del plan (cantidad de productos y de categorías) se revisan
   acá, no en el navegador. Ocultar un producto no libera lugar: el límite
   cuenta todos los de la tienda. */
import { cors, faltantes, error } from './_comun.js';
import { usuarioDe } from './_sesion.js';
import { notion, limpiarId, proyectoDe, productosDe, aPropiedades, aProducto, DB_PRODUCTOS } from './_notion.js';
import { planDe } from './_planes.js';

const REQUERIDAS = ['CLERK_SECRET_KEY', 'NOTION_TOKEN', 'NOTION_DB_PROYECTOS', 'NOTION_DB_PRODUCTOS'];
const finito = n => Number.isFinite(n) ? n : null;
const cat = s => String(s || '').replace(/,/g, ' ').trim().toLowerCase();

/** El producto, si es de esa tienda y no está archivado. */
async function productoDe(id, tienda) {
  if (!id) return null;
  let fila;
  try { fila = await notion(`/pages/${id}`); } catch { return null; }
  const deLaBase = limpiarId(fila.parent?.database_id) === DB_PRODUCTOS();
  const deLaTienda = (fila.properties?.['Proyecto']?.relation || []).some(r => limpiarId(r.id) === tienda);
  return deLaBase && deLaTienda && !fila.archived ? fila : null;
}

async function guardar(req, res, usuario, tienda) {
  const p = req.body?.producto;
  if (!p || typeof p !== 'object') return error(res, 400, 'Faltan los datos del producto.');
  if (!String(p.titulo || '').trim()) return error(res, 400, 'El producto necesita un nombre.');

  const [plan, actuales] = await Promise.all([planDe(usuario), productosDe(tienda, { todos: true })]);
  const nid = limpiarId(p._nid);
  const previo = nid ? actuales.find(x => x._nid === nid) : null;
  if (nid && !previo) return error(res, 404, 'Ese producto no existe.');

  if (!previo && actuales.length >= plan.productos) {
    return error(res, 403, `Tu plan ${plan.nombre} permite ${plan.productos} productos. Mejorá tu plan para cargar más.`, { mejorar: true });
  }
  const nueva = cat(p.categoria);
  const otras = new Set(actuales.filter(x => x._nid !== nid).map(x => cat(x.categoria)).filter(Boolean));
  if (nueva && !otras.has(nueva) && otras.size >= plan.categorias) {
    return error(res, 403, `Tu plan ${plan.nombre} permite ${plan.categorias} categorías. Usá una que ya tengas o mejorá tu plan.`, { mejorar: true });
  }

  const orden = previo ? (previo._orden ?? actuales.indexOf(previo)) : Math.max(-1, ...actuales.map(x => x._orden ?? -1)) + 1;
  const props = { ...aPropiedades(p, orden), 'Visible': { checkbox: p.visible !== false } };
  const fila = previo
    ? await notion(`/pages/${nid}`, { method: 'PATCH', body: { properties: props } })
    : await notion('/pages', { method: 'POST', body: { parent: { database_id: DB_PRODUCTOS() }, properties: { ...props, 'Proyecto': { relation: [{ id: tienda }] } } } });
  return res.status(200).json({ producto: aProducto(fila) });
}

export default async function handler(req, res) {
  cors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  const faltan = faltantes(REQUERIDAS);
  if (faltan.length) return error(res, 500, 'Al proyecto le faltan variables en Vercel.', { faltan });

  const usuario = await usuarioDe(req);
  if (!usuario) return error(res, 401, 'Ingresá para ver tus productos.');
  const tienda = limpiarId(req.query.tienda || req.body?.tienda);
  if (!tienda || !(await proyectoDe(tienda, usuario))) return error(res, 404, 'Esa tienda no existe o no es tuya.');

  try {
    if (req.method === 'GET') {
      const plan = await planDe(usuario);
      const productos = (await productosDe(tienda, { todos: true })).map(({ _orden, ...p }) => p);
      return res.status(200).json({ productos, limite: { productos: finito(plan.productos), categorias: finito(plan.categorias) } });
    }
    if (req.method === 'POST') return await guardar(req, res, usuario, tienda);
    if (req.method === 'DELETE') {
      const id = limpiarId(req.query.id);
      if (!(await productoDe(id, tienda))) return error(res, 404, 'Ese producto no existe.');
      await notion(`/pages/${id}`, { method: 'PATCH', body: { archived: true } });
      return res.status(200).json({ ok: true });
    }
    return error(res, 405, 'Método no permitido.');
  } catch (e) {
    if (e.status === 413) return error(res, 413, e.message);
    console.error('[productos]', e);
    return error(res, 502, 'No se pudo hablar con Notion.');
  }
}

/* /api/tiendas — las tiendas de quien tiene la sesión abierta.

   GET                      → { tiendas, plan, rubros }
   GET  ?slug=…             → { slug, libre }   ¿esa dirección está libre?
   POST { accion: 'crear', nombre, slug, rubro, whatsapp }
                            → { tienda }        la crea publicada, con productos de ejemplo
   POST { accion: 'ajustes', id, nombre?, slug?, publicada?, datos? }
                            → { tienda }        datos: whatsapp, envío, formas de pago, moneda

   Una tienda es una fila de Proyectos con Slug: el diseño lo sigue
   guardando el editor por /api/proyectos. Cada dirección es de una sola
   tienda; si dos la piden a la vez, se la queda la que la tomó primero. */
import { cors, faltantes, error } from './_comun.js';
import { usuarioDe, nombreDeUsuario } from './_sesion.js';
import {
  notion, consultar, texto, leer, opcion, limpiarId, aPropiedades,
  proyectoDe, normalizarSlug, conSlug, DB_PROYECTOS, DB_PRODUCTOS,
} from './_notion.js';
import { planDe, planesPublicos } from './_planes.js';
import { plantilla, rubros } from './_render.js';

const REQUERIDAS = ['CLERK_SECRET_KEY', 'NOTION_TOKEN', 'NOTION_DB_PROYECTOS', 'NOTION_DB_PRODUCTOS'];
/* lo que el panel puede cambiar del diseño sin abrir el editor */
const AJUSTABLES = { whatsapp: 30, tiendaEnvio: 40, tiendaGratis: 40, tiendaPagos: 300, _moneda: 10 };

function aTienda(fila) {
  const p = fila.properties;
  let datos = {};
  try { datos = JSON.parse(leer(p['Datos']) || '{}'); } catch {}
  const ajustes = {};
  for (const k in AJUSTABLES) ajustes[k] = datos[k] ?? '';
  return {
    id: limpiarId(fila.id),
    nombre: leer(p['Nombre']),
    rubro: leer(p['Rubro']),
    slug: leer(p['Slug']),
    publicada: leer(p['Publicada']) === true,
    ajustes,
    actualizado: fila.last_edited_time,
  };
}

const misTiendas = usuario => consultar(DB_PROYECTOS(), {
  filter: { and: [
    { property: 'Usuario', rich_text: { equals: usuario } },
    { property: 'Slug', rich_text: { is_not_empty: true } },
  ] },
  sorts: [{ timestamp: 'created_time', direction: 'ascending' }],
  max: 50,
});

const fijarSlug = (id, slug) =>
  notion(`/pages/${id}`, { method: 'PATCH', body: { properties: { 'Slug': { rich_text: slug ? texto(slug) : [] } } } });

/** Deja la dirección a nombre de la tienda. null si quedó, o el motivo si no. */
async function reservar(id, slug, anterior) {
  if ((await conSlug(slug)).some(f => limpiarId(f.id) !== id)) return 'Esa dirección ya la usa otra tienda.';
  await fijarSlug(id, slug);
  const [primera] = await conSlug(slug);
  if (primera && limpiarId(primera.id) !== id) {
    await fijarSlug(id, anterior);
    return 'Esa dirección ya la usa otra tienda.';
  }
  return null;
}

async function listar(res, usuario) {
  const [filas, plan] = await Promise.all([misTiendas(usuario), planDe(usuario)]);
  return res.status(200).json({
    tiendas: filas.map(aTienda),
    plan: { ...plan, productos: Number.isFinite(plan.productos) ? plan.productos : null, categorias: Number.isFinite(plan.categorias) ? plan.categorias : null },
    planes: planesPublicos(),
    rubros: rubros(),
  });
}

async function disponible(res, slugPedido) {
  const slug = normalizarSlug(slugPedido);
  if (!slug) return res.status(200).json({ slug: '', libre: false, motivo: 'Usá al menos 3 letras o números.' });
  const libre = !(await conSlug(slug)).length;
  return res.status(200).json({ slug, libre, motivo: libre ? '' : 'Esa dirección ya está tomada.' });
}

async function crear(req, res, usuario) {
  const b = req.body || {};
  const nombre = String(b.nombre || '').trim().slice(0, 80);
  if (!nombre) return error(res, 400, 'Poné el nombre de tu tienda.');
  const slug = normalizarSlug(b.slug || nombre);
  if (!slug) return error(res, 400, 'La dirección necesita al menos 3 letras o números.');
  const base = plantilla(b.rubro);
  if (!base) return error(res, 400, 'Elegí un rubro.');

  const [plan, actuales] = await Promise.all([planDe(usuario), misTiendas(usuario)]);
  if (actuales.length >= plan.tiendas) {
    return error(res, 403, `Tu plan ${plan.nombre} permite ${plan.tiendas} tienda${plan.tiendas > 1 ? 's' : ''}. Mejorá tu plan para abrir otra.`, { mejorar: true });
  }
  if ((await conSlug(slug)).length) return error(res, 409, 'Esa dirección ya está tomada. Probá con otra.');

  const whatsapp = String(b.whatsapp || '').replace(/[^\d+]/g, '').slice(0, 20);
  const datos = { ...base.d, _secciones: base.secciones, marca: nombre, whatsapp };

  const fila = await notion('/pages', {
    method: 'POST',
    body: {
      parent: { database_id: DB_PROYECTOS() },
      properties: {
        'Nombre': { title: texto(nombre) },
        'Rubro': { select: opcion(b.rubro) },
        'Datos': { rich_text: texto(JSON.stringify(datos)) },
        'Usuario': { rich_text: texto(usuario) },
        'Nombre de usuario': { rich_text: texto(await nombreDeUsuario(usuario)) },
        'Publicada': { checkbox: true },
      },
    },
  });
  const id = limpiarId(fila.id);
  const motivo = await reservar(id, slug, '');
  if (motivo) {
    await notion(`/pages/${id}`, { method: 'PATCH', body: { archived: true } });
    return error(res, 409, 'Esa dirección se acaba de ocupar. Probá con otra.');
  }

  // productos de ejemplo del rubro, para que la tienda no arranque vacía
  const ejemplos = base.productos.slice(0, Number.isFinite(plan.productos) ? plan.productos : undefined);
  for (const [orden, prod] of ejemplos.entries()) {
    await notion('/pages', {
      method: 'POST',
      body: {
        parent: { database_id: DB_PRODUCTOS() },
        properties: { ...aPropiedades(prod, orden), 'Proyecto': { relation: [{ id }] }, 'Visible': { checkbox: true } },
      },
    });
  }
  return res.status(200).json({ tienda: aTienda(await notion(`/pages/${id}`)) });
}

async function ajustes(req, res, usuario) {
  const b = req.body || {};
  const id = limpiarId(b.id);
  const fila = await proyectoDe(id, usuario);
  if (!fila) return error(res, 404, 'Esa tienda no existe o no es tuya.');

  const props = {};
  if (b.nombre !== undefined) {
    const nombre = String(b.nombre).trim().slice(0, 80);
    if (!nombre) return error(res, 400, 'El nombre no puede quedar vacío.');
    props['Nombre'] = { title: texto(nombre) };
  }
  if (b.publicada !== undefined) props['Publicada'] = { checkbox: !!b.publicada };
  if (b.datos && typeof b.datos === 'object') {
    let datos = {};
    try { datos = JSON.parse(leer(fila.properties['Datos']) || '{}'); } catch {}
    for (const [k, max] of Object.entries(AJUSTABLES)) {
      if (b.datos[k] !== undefined) datos[k] = String(b.datos[k]).trim().slice(0, max);
    }
    if (b.nombre !== undefined) datos.marca = props['Nombre'].title.map(t => t.text.content).join('');
    props['Datos'] = { rich_text: texto(JSON.stringify(datos)) };
  }

  const anterior = leer(fila.properties['Slug']);
  if (b.slug !== undefined) {
    const slug = normalizarSlug(b.slug);
    if (!slug) return error(res, 400, 'La dirección necesita al menos 3 letras o números, y no puede ser una palabra reservada.');
    if (slug !== anterior) {
      if (!anterior) {
        // una página vieja que pasa a ser tienda cuenta para el límite del plan
        const [plan, actuales] = await Promise.all([planDe(usuario), misTiendas(usuario)]);
        if (actuales.length >= plan.tiendas) return error(res, 403, `Tu plan ${plan.nombre} permite ${plan.tiendas} tienda${plan.tiendas > 1 ? 's' : ''}.`, { mejorar: true });
      }
      const motivo = await reservar(id, slug, anterior);
      if (motivo) return error(res, 409, motivo);
    }
  }
  if (Object.keys(props).length) await notion(`/pages/${id}`, { method: 'PATCH', body: { properties: props } });
  return res.status(200).json({ tienda: aTienda(await notion(`/pages/${id}`)) });
}

export default async function handler(req, res) {
  cors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  const faltan = faltantes(REQUERIDAS);
  if (faltan.length) return error(res, 500, 'Al proyecto le faltan variables en Vercel.', { faltan });

  const usuario = await usuarioDe(req);
  if (!usuario) return error(res, 401, 'Ingresá para ver tus tiendas.');

  try {
    if (req.method === 'GET') return req.query.slug !== undefined ? await disponible(res, req.query.slug) : await listar(res, usuario);
    if (req.method === 'POST' && req.body?.accion === 'crear') return await crear(req, res, usuario);
    if (req.method === 'POST' && req.body?.accion === 'ajustes') return await ajustes(req, res, usuario);
    return error(res, 405, 'Método no permitido.');
  } catch (e) {
    console.error('[tiendas]', e);
    return error(res, 502, 'No se pudo hablar con Notion.');
  }
}

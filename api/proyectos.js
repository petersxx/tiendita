/* /api/proyectos — los proyectos de quien tiene la sesión abierta.

   GET                → { proyectos: [{ id, nombre, rubro, actualizado }] }
   GET    ?id=…       → { id, nombre, rubro, datos, productos, actualizado }
   POST   { id?, nombre, rubro, datos, productos }
                      → { id, actualizado, ids: { <_k>: <id del producto en Notion> } }
   DELETE ?id=…       → { ok: true }

   Cada pedido lleva `Authorization: Bearer <token de sesión de Clerk>`.
   El diseño va a la base Proyectos; los productos, a la base Productos,
   uno por fila con relación al proyecto. Un producto que el dueño ocultó
   en Notion (Visible apagado) no llega al editor y guardar no lo toca. */
import { cors, faltantes, error } from './_comun.js';
import { usuarioDe, nombreDeUsuario } from './_sesion.js';
import { planDe } from './_planes.js';
import {
  notion, consultar, texto, leer, opcion, limpiarId,
  aPropiedades, productosDe, proyectoDe, DB_PROYECTOS, DB_PRODUCTOS,
} from './_notion.js';

const REQUERIDAS = ['CLERK_SECRET_KEY', 'NOTION_TOKEN', 'NOTION_DB_PROYECTOS', 'NOTION_DB_PRODUCTOS'];
const MAX_PRODUCTOS = 300;
const cat = s => String(s || '').replace(/,/g, ' ').trim().toLowerCase();

/** En una tienda (una página con dirección), el motivo por el que esos
 *  productos pasan el límite del plan, o null. Sólo se frena lo que suma:
 *  si un plan venció, se puede seguir guardando lo que ya había. */
async function excedePlan(fila, usuario, id, productos) {
  if (!leer(fila.properties['Slug'])) return null;
  const plan = await planDe(usuario);
  const antes = await productosDe(id, { todos: true });
  const ocultos = antes.filter(p => !p.visible);
  const total = productos.length + ocultos.length;
  if (total > plan.productos && total > antes.length) {
    return `Tu plan ${plan.nombre} permite ${plan.productos} productos. Mejorá tu plan desde el panel para cargar más.`;
  }
  const categorias = lista => new Set(lista.map(p => cat(p.categoria)).filter(Boolean)).size;
  const nuevas = categorias([...productos, ...ocultos]);
  if (nuevas > plan.categorias && nuevas > categorias(antes)) {
    return `Tu plan ${plan.nombre} permite ${plan.categorias} categorías. Mejorá tu plan desde el panel para usar más.`;
  }
  return null;
}

function resumen(fila) {
  const p = fila.properties;
  return {
    id: limpiarId(fila.id),
    nombre: leer(p['Nombre']),
    rubro: leer(p['Rubro']),
    slug: leer(p['Slug']),
    publicada: leer(p['Publicada']) === true,
    actualizado: fila.last_edited_time,
  };
}

async function listar(res, usuario) {
  const filas = await consultar(DB_PROYECTOS(), {
    filter: { property: 'Usuario', rich_text: { equals: usuario } },
    sorts: [{ timestamp: 'last_edited_time', direction: 'descending' }],
    max: 200,
  });
  return res.status(200).json({ proyectos: filas.map(resumen) });
}

async function abrir(res, usuario, id) {
  const fila = await proyectoDe(id, usuario);
  if (!fila) return error(res, 404, 'Ese proyecto no existe o no es tuyo.');
  let datos = {};
  try { datos = JSON.parse(leer(fila.properties['Datos']) || '{}'); } catch {}
  const productos = (await productosDe(id)).map(({ visible, _orden, ...p }) => p);
  return res.status(200).json({ ...resumen(fila), datos, productos });
}

/** Deja los productos de Notion igual que los del editor, tocando sólo lo que cambió. */
async function sincronizarProductos(id, productos) {
  const actuales = new Map((await productosDe(id, { todos: true })).map(p => [p._nid, p]));
  const ids = {}, usados = new Set();

  for (const [orden, prod] of productos.entries()) {
    const nid = limpiarId(prod._nid);
    const previo = nid && !usados.has(nid) ? actuales.get(nid) : null;   // un duplicado del editor es un producto nuevo
    const props = aPropiedades(prod, orden);
    if (previo) {
      usados.add(nid);
      const igual = previo.titulo === String(prod.titulo || '') && previo.precio === String(prod.precio || '')
        && previo.texto === String(prod.texto || '') && previo.img === (props['Imagen'].url || '')
        && previo.categoria === (opcion(prod.categoria)?.name || '') && previo.etiqueta === (opcion(prod.etiqueta)?.name || '');
      // el orden se compara aparte: mover un producto sólo cambia ese número
      if (!igual || orden !== previo._orden) await notion(`/pages/${nid}`, { method: 'PATCH', body: { properties: props } });
      if (prod._k) ids[prod._k] = nid;
    } else {
      const nueva = await notion('/pages', {
        method: 'POST',
        body: {
          parent: { database_id: DB_PRODUCTOS() },
          properties: { ...props, 'Proyecto': { relation: [{ id }] }, 'Visible': { checkbox: true } },
        },
      });
      if (prod._k) ids[prod._k] = limpiarId(nueva.id);
    }
  }
  // lo que se quitó en el editor se archiva (Notion lo guarda 30 días en la papelera);
  // lo que el dueño ocultó en Notion no llegó al editor, así que se deja como está
  for (const [nid, p] of actuales) {
    if (!usados.has(nid) && p.visible) await notion(`/pages/${nid}`, { method: 'PATCH', body: { archived: true } });
  }
  return ids;
}

async function guardar(req, res, usuario) {
  const b = req.body || {};
  const nombre = String(b.nombre || 'Página sin título').slice(0, 200);
  const rubro = String(b.rubro || '').slice(0, 60);
  if (!b.datos || typeof b.datos !== 'object') return error(res, 400, 'Faltan los datos del proyecto.');
  const productos = Array.isArray(b.productos) ? b.productos.slice(0, MAX_PRODUCTOS) : null;

  // los productos viven en su propia base; en Datos va el resto del diseño
  const { productos: _, ...diseño } = b.datos;
  const props = {
    'Nombre': { title: texto(nombre) },
    'Rubro': { select: opcion(rubro) },
    'Datos': { rich_text: texto(JSON.stringify(diseño)) },
  };

  let id = limpiarId(b.id), fila;
  if (id) {
    const previa = await proyectoDe(id, usuario);
    if (!previa) return error(res, 404, 'Ese proyecto no existe o no es tuyo.');
    const motivo = productos && await excedePlan(previa, usuario, id, productos);
    if (motivo) return error(res, 403, motivo, { mejorar: true });
    fila = await notion(`/pages/${id}`, { method: 'PATCH', body: { properties: props } });
  } else {
    fila = await notion('/pages', {
      method: 'POST',
      body: {
        parent: { database_id: DB_PROYECTOS() },
        properties: {
          ...props,
          'Usuario': { rich_text: texto(usuario) },
          'Nombre de usuario': { rich_text: texto(await nombreDeUsuario(usuario)) },
        },
      },
    });
    id = limpiarId(fila.id);
  }

  const ids = productos ? await sincronizarProductos(id, productos) : {};
  return res.status(200).json({ id, actualizado: fila.last_edited_time, ids });
}

async function borrar(res, usuario, id) {
  if (!(await proyectoDe(id, usuario))) return error(res, 404, 'Ese proyecto no existe o no es tuyo.');
  for (const p of await productosDe(id, { todos: true })) {
    await notion(`/pages/${p._nid}`, { method: 'PATCH', body: { archived: true } });
  }
  await notion(`/pages/${id}`, { method: 'PATCH', body: { archived: true } });
  return res.status(200).json({ ok: true });
}

export default async function handler(req, res) {
  cors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  const faltan = faltantes(REQUERIDAS);
  if (faltan.length) return error(res, 500, 'Al proyecto le faltan variables en Vercel.', { faltan });

  const usuario = await usuarioDe(req);
  if (!usuario) return error(res, 401, 'Ingresá con tu usuario para ver y guardar proyectos.');

  const id = limpiarId(req.query.id);
  if (req.query.id !== undefined && !id) return error(res, 400, 'El id del proyecto no tiene el formato esperado.');

  try {
    if (req.method === 'GET') return id ? await abrir(res, usuario, id) : await listar(res, usuario);
    if (req.method === 'POST') return await guardar(req, res, usuario);
    if (req.method === 'DELETE' && id) return await borrar(res, usuario, id);
    return error(res, 405, 'Método no permitido.');
  } catch (e) {
    if (e.status === 413) return error(res, 413, e.message);
    return error(res, 502, 'No se pudo hablar con Notion.', { detalle: String(e.message || e) });
  }
}

/* Acceso a Notion compartido por las funciones de la API.
   Las bases son siempre las mismas para todas las tiendas:
     NOTION_DB_PROYECTOS  una fila por tienda (proyecto), con su dueño, su dirección y su diseño
     NOTION_DB_PRODUCTOS  una fila por producto, con relación a su tienda
     NOTION_DB_PEDIDOS    una fila por pedido que entra por una tienda publicada
     NOTION_DB_PAGOS      una fila por pago de un plan con Pagopar
   tools/preparar-notion.mjs crea las dos últimas. */

const VERSION_NOTION = '2022-06-28';
const MAX_TEXTO = 2000;          // Notion corta cada trozo de texto en 2000 caracteres
const MAX_TROZOS = 100;          // y admite hasta 100 trozos por propiedad

export const DB_PROYECTOS = () => limpiarId(process.env.NOTION_DB_PROYECTOS);
export const DB_PRODUCTOS = () => limpiarId(process.env.NOTION_DB_PRODUCTOS);
export const DB_PEDIDOS = () => limpiarId(process.env.NOTION_DB_PEDIDOS);
export const DB_PAGOS = () => limpiarId(process.env.NOTION_DB_PAGOS);

/** Un id de Notion sin guiones, o '' si no tiene el formato de 32 caracteres. */
export function limpiarId(s) {
  const id = String(s || '').trim().replace(/-/g, '').toLowerCase();
  return /^[0-9a-f]{32}$/.test(id) ? id : '';
}

const esperar = ms => new Promise(r => setTimeout(r, ms));

/** Pedido a la API de Notion. Reintenta cuando Notion pide bajar el ritmo. */
export async function notion(ruta, { method = 'GET', body } = {}, intento = 0) {
  const r = await fetch('https://api.notion.com/v1' + ruta, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.NOTION_TOKEN}`,
      'Notion-Version': VERSION_NOTION,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (r.status === 429 && intento < 3) {
    await esperar(1000 * (Number(r.headers.get('retry-after')) || intento + 1));
    return notion(ruta, { method, body }, intento + 1);
  }
  const datos = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = new Error(datos.message || `Notion respondió ${r.status}`);
    e.status = r.status;
    e.code = datos.code;
    throw e;
  }
  return datos;
}

/** Todas las filas de una base que cumplen el filtro, de a 100. */
export async function consultar(db, { filter, sorts, max = 500 } = {}) {
  const filas = [];
  let cursor;
  do {
    const d = await notion(`/databases/${db}/query`, {
      method: 'POST',
      body: { page_size: 100, filter, sorts, ...(cursor ? { start_cursor: cursor } : {}) },
    });
    filas.push(...d.results);
    cursor = d.has_more ? d.next_cursor : null;
  } while (cursor && filas.length < max);
  return filas;
}

/* ---------- valores ---------- */

/** Texto para una propiedad rich_text o title, partido en trozos de 2000. */
export function texto(s) {
  const v = String(s ?? '');
  const trozos = [];
  for (let i = 0; i < v.length; i += MAX_TEXTO) trozos.push(v.slice(i, i + MAX_TEXTO));
  if (trozos.length > MAX_TROZOS) {
    const e = new Error('El proyecto es demasiado grande para guardarlo en Notion.');
    e.status = 413;
    throw e;
  }
  return trozos.map(t => ({ type: 'text', text: { content: t } }));
}

/** Lee una propiedad de Notion como texto plano, sea del tipo que sea. */
export function leer(p) {
  if (!p) return '';
  switch (p.type) {
    case 'title':     return p.title.map(t => t.plain_text).join('');
    case 'rich_text': return p.rich_text.map(t => t.plain_text).join('');
    case 'number':    return p.number == null ? '' : String(p.number);
    case 'select':    return p.select?.name || '';
    case 'url':       return p.url || '';
    case 'email':     return p.email || '';
    case 'phone_number': return p.phone_number || '';
    case 'date':      return p.date?.start || '';
    case 'created_time': return p.created_time || '';
    case 'checkbox':  return p.checkbox;
    case 'last_edited_time': return p.last_edited_time || '';
    case 'files': {
      const f = p.files?.[0];
      return f ? (f.file?.url || f.external?.url || '') : '';
    }
    default: return '';
  }
}

/** Una opción de select: Notion no admite comas en el nombre. */
export const opcion = s => {
  const v = String(s || '').replace(/,/g, ' ').trim().slice(0, 100);
  return v ? { name: v } : null;
};

/* ---------- proyectos ---------- */

/** La fila del proyecto, si existe, no está archivada y es de este usuario.
 *  Un proyecto ajeno y uno inexistente dan lo mismo (null): así no se puede
 *  averiguar qué ids existen. */
export async function proyectoDe(id, usuario) {
  if (!id || !usuario) return null;
  let fila;
  try { fila = await notion(`/pages/${id}`); }
  catch (e) { if (e.status === 404 || e.status === 400) return null; throw e; }
  const deLaBase = limpiarId(fila.parent?.database_id) === DB_PROYECTOS();
  if (!deLaBase || fila.archived || leer(fila.properties['Usuario']) !== usuario) return null;
  return fila;
}

/* ---------- direcciones de tienda ---------- */

/** Palabras que no pueden ser la dirección de una tienda: son páginas de la plataforma. */
const RESERVADAS = new Set(['api', 'css', 'js', 'img', 'panel', 'editor', 'admin', 'precios', 'planes', 'ayuda',
  'ingresar', 'registro', 'cuenta', 'tienda', 'tiendas', 'demo', 'soporte', 'terminos', 'privacidad', 'index', 'www']);

/** La dirección normalizada (minúsculas, sin tildes, con guiones), o '' si no sirve. */
export function normalizarSlug(s) {
  const v = String(s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, 40).replace(/-+$/, '');
  return v.length >= 3 && !RESERVADAS.has(v) ? v : '';
}

/** Filas de Proyectos (sin archivar) que usan esa dirección, la más vieja primero. */
export async function conSlug(slug) {
  const filas = await consultar(DB_PROYECTOS(), { filter: { property: 'Slug', rich_text: { equals: slug } } });
  return filas.sort((a, b) => a.created_time.localeCompare(b.created_time) || a.id.localeCompare(b.id));
}

/** La tienda publicada con esa dirección, o null. Si por una carrera
 *  quedaron dos con la misma, vale la que la tomó primero. */
export async function tiendaPorSlug(slug) {
  const s = normalizarSlug(slug);
  if (!s) return null;
  const [fila] = await conSlug(s);
  return fila && leer(fila.properties['Publicada']) === true ? fila : null;
}

/* ---------- productos ---------- */

/** Fila de Notion → producto de la tienda. */
export function aProducto(fila) {
  const p = fila.properties || {};
  return {
    _nid:      limpiarId(fila.id),
    titulo:    leer(p['Nombre']),
    precio:    leer(p['Precio']),
    texto:     leer(p['Descripción']),
    categoria: leer(p['Categoría']),
    etiqueta:  leer(p['Etiqueta']),
    img:       leer(p['Imagen']),
    visible:   p['Visible'] ? p['Visible'].checkbox : true,
    _orden:    p['Orden'] ? p['Orden'].number : null,
  };
}

/** Producto de la tienda → propiedades de Notion (sin la relación ni Visible). */
export function aPropiedades(prod, orden) {
  const img = String(prod.img || '');
  return {
    'Nombre':      { title: texto(String(prod.titulo || '').slice(0, 2000)) },
    'Precio':      { rich_text: texto(String(prod.precio || '').slice(0, 2000)) },
    'Descripción': { rich_text: texto(String(prod.texto || '').slice(0, 2000)) },
    'Categoría':   { select: opcion(prod.categoria) },
    'Etiqueta':    { select: opcion(prod.etiqueta) },
    // las fotos incrustadas (data:) no entran en Notion; las locales viajan con la demo
    'Imagen':      { url: img && !img.startsWith('data:') && img.length <= 2000 ? img : null },
    'Orden':       { number: orden },
  };
}

/** Productos visibles de un proyecto, en orden. */
export async function productosDe(proyecto, { todos = false } = {}) {
  const filas = await consultar(DB_PRODUCTOS(), {
    filter: { property: 'Proyecto', relation: { contains: proyecto } },
    sorts: [{ property: 'Orden', direction: 'ascending' }],
  });
  const prods = filas.map(aProducto);
  return todos ? prods : prods.filter(p => p.visible);
}

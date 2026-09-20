/* GET /api/catalogo?db=<id de la base de Notion>
   Devuelve los productos normalizados para las tarjetas de una plantilla.

   Lo llaman dos cosas: el editor (botón "Importar ahora") y las páginas
   publicadas que leen el catálogo en cada visita. Por eso responde con
   CORS abierto y con caché de CDN: Notion es lento y tiene límite de
   pedidos, así que servimos la misma respuesta durante un minuto.

   Columnas que busca en Notion (no importa el orden ni las mayúsculas):
     título      → la columna de tipo "title", se llame como se llame
     precio      → Precio · Monto · Valor · Meta · Dato
     descripción → Descripción · Detalle · Texto · Descripcion
     imagen      → Imagen · Foto · Image · Portada   (archivo subido o URL)
     visible     → Visible · Publicado · Activo      (casilla; si está y es
                   falsa, el producto se omite)
     orden       → Orden · Posición · Nº             (número, ordena la lista)
*/
import { cors, error } from './_comun.js';

const VERSION_NOTION = '2022-06-28';
const MAX_PRODUCTOS = 300;

const ALIAS = {
  precio:      ['precio', 'monto', 'valor', 'meta', 'dato', 'price'],
  descripcion: ['descripcion', 'descripción', 'detalle', 'texto', 'description'],
  imagen:      ['imagen', 'image', 'foto', 'portada', 'img'],
  visible:     ['visible', 'publicado', 'activo', 'published'],
  orden:       ['orden', 'posicion', 'posición', 'nro', 'n°', 'order'],
};

const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

/** Saca un valor legible de una propiedad de Notion, sea del tipo que sea. */
function valor(p) {
  if (!p) return '';
  switch (p.type) {
    case 'title':       return p.title.map(t => t.plain_text).join('').trim();
    case 'rich_text':   return p.rich_text.map(t => t.plain_text).join('').trim();
    case 'number':      return p.number == null ? '' : String(p.number);
    case 'select':      return p.select?.name || '';
    case 'multi_select':return p.multi_select.map(o => o.name).join(', ');
    case 'status':      return p.status?.name || '';
    case 'url':         return p.url || '';
    case 'email':       return p.email || '';
    case 'phone_number':return p.phone_number || '';
    case 'checkbox':    return p.checkbox;
    case 'date':        return p.date?.start || '';
    case 'files': {
      const f = p.files?.[0];
      return f ? (f.file?.url || f.external?.url || '') : '';
    }
    case 'formula':     return valorSimple(p.formula);
    case 'rollup':      return p.rollup?.type === 'array' ? valor(p.rollup.array?.[0]) : valorSimple(p.rollup);
    default:            return '';
  }
}
function valorSimple(f) {
  if (!f) return '';
  if (f.type === 'string')  return f.string || '';
  if (f.type === 'number')  return f.number == null ? '' : String(f.number);
  if (f.type === 'boolean') return f.boolean;
  if (f.type === 'date')    return f.date?.start || '';
  return '';
}

/** Busca una propiedad por alias; devuelve la primera que exista. */
function buscar(props, alias) {
  const claves = Object.keys(props);
  for (const a of alias) {
    const k = claves.find(c => norm(c) === a);
    if (k) return props[k];
  }
  // segunda pasada, más laxa: que contenga el alias
  for (const a of alias) {
    const k = claves.find(c => norm(c).includes(a));
    if (k) return props[k];
  }
  return null;
}

/** Un precio guardado como número sale crudo ("285000"); lo dejamos legible.
 *  Si en Notion está escrito como texto, se respeta tal cual. */
function precio(prop, moneda) {
  if (!prop) return '';
  const v = valor(prop);
  if (prop.type !== 'number' || v === '') return String(v);
  return `${moneda} ${Number(v).toLocaleString('es-PY')}`.trim();
}

function mapear(pagina, moneda = 'Gs.') {
  const props = pagina.properties || {};
  const titular = Object.values(props).find(p => p.type === 'title');
  const visibleProp = buscar(props, ALIAS.visible);
  const visible = visibleProp && visibleProp.type === 'checkbox' ? visibleProp.checkbox : true;
  const ordenProp = buscar(props, ALIAS.orden);
  return {
    titulo: (titular ? valor(titular) : '') || 'Sin título',
    meta:   precio(buscar(props, ALIAS.precio), moneda),
    texto:  String(valor(buscar(props, ALIAS.descripcion)) || ''),
    img:    String(valor(buscar(props, ALIAS.imagen)) || ''),
    visible,
    orden:  ordenProp && ordenProp.type === 'number' ? (ordenProp.number ?? null) : null,
  };
}

export default async function handler(req, res) {
  cors(req, res, { abierto: true });
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return error(res, 405, 'Usá GET.');

  const db = String(req.query.db || '').trim().replace(/-/g, '');
  if (!/^[0-9a-f]{32}$/i.test(db)) {
    return error(res, 400, 'Falta el id de la base de Notion, o no tiene el formato esperado (32 caracteres).');
  }
  // moneda opcional: ?moneda=Gs.  ·  ?moneda=USD  ·  ?moneda= (vacío, sin prefijo)
  const moneda = req.query.moneda === undefined ? 'Gs.' : String(req.query.moneda).slice(0, 8);

  if (!process.env.NOTION_TOKEN) {
    return error(res, 500, 'Al proyecto le falta la variable NOTION_TOKEN en Vercel.', { faltan: ['NOTION_TOKEN'] });
  }

  try {
    const productos = [];
    let cursor;
    do {
      const r = await fetch(`https://api.notion.com/v1/databases/${db}/query`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.NOTION_TOKEN}`,
          'Notion-Version': VERSION_NOTION,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) }),
      });

      if (!r.ok) {
        const cuerpo = await r.json().catch(() => ({}));
        const ayuda = r.status === 404
          ? 'Notion no encuentra esa base. Revisá el id, y sobre todo que hayas compartido la base con tu integración (menú ••• → Conexiones).'
          : r.status === 401
          ? 'El NOTION_TOKEN no es válido.'
          : cuerpo.message || 'Notion devolvió un error.';
        return error(res, r.status === 401 ? 500 : 502, ayuda, { notion: cuerpo.code || r.status });
      }

      const data = await r.json();
      productos.push(...data.results.map(p => mapear(p, moneda)));
      cursor = data.has_more ? data.next_cursor : null;
    } while (cursor && productos.length < MAX_PRODUCTOS);

    const visibles = productos.filter(p => p.visible);
    visibles.sort((a, b) => {
      if (a.orden == null && b.orden == null) return 0;
      if (a.orden == null) return 1;
      if (b.orden == null) return -1;
      return a.orden - b.orden;
    });
    const salida = visibles.slice(0, MAX_PRODUCTOS).map(({ visible, orden, ...p }) => p);

    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=600');
    return res.status(200).json({ productos: salida, total: salida.length, leidoEn: new Date().toISOString() });
  } catch (e) {
    return error(res, 502, 'No se pudo consultar Notion.', { detalle: String(e.message || e) });
  }
}

/* se exportan para poder probar el mapeo sin credenciales */
export { mapear, valor, buscar, precio };

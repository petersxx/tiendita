/* GET /<dirección> → la tienda publicada, armada en el momento con sus
   productos de Notion. vercel.json manda acá cualquier ruta de un solo
   tramo que no sea un archivo (index, panel, editor…).

   La respuesta queda un minuto en la CDN de Vercel: con muchas visitas,
   Notion recibe un pedido por minuto por tienda, no uno por visita.

   Todas las tiendas comparten dominio con el panel. Por eso la página
   sale con una política de contenido que sólo deja correr el script del
   carrito (con nonce) y ningún enlace javascript:. */
import { randomBytes } from 'node:crypto';
import { faltantes } from './_comun.js';
import { tiendaPorSlug, productosDe, leer, limpiarId } from './_notion.js';
import { planDe } from './_planes.js';
import { renderTienda } from './_render.js';

const REQUERIDAS = ['CLERK_SECRET_KEY', 'NOTION_TOKEN', 'NOTION_DB_PROYECTOS', 'NOTION_DB_PRODUCTOS'];

function csp(nonce) {
  return [
    "default-src 'self'",
    `script-src 'nonce-${nonce}'`,
    "style-src 'unsafe-inline' https://fonts.googleapis.com",
    'font-src https://fonts.gstatic.com',
    'img-src https: data:',
    "connect-src 'self'",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'self'",
  ].join('; ');
}

const MARCA = `<a href="/" style="position:fixed;left:14px;bottom:14px;z-index:40;display:inline-flex;align-items:center;gap:7px;
  padding:7px 12px;border-radius:999px;background:#111827;color:#fff;font:600 12px/1 system-ui,sans-serif;text-decoration:none;
  box-shadow:0 4px 14px rgba(0,0,0,.18)"><span style="width:8px;height:8px;border-radius:50%;background:#22C55E"></span>Creá tu tienda gratis</a>`;

function noEncontrada(res, estado, titulo, texto) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=30');
  return res.status(estado).send(`<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${titulo}</title><meta name="robots" content="noindex">
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;font:16px/1.6 system-ui,sans-serif;background:#F8FAFC;color:#0F172A;padding:24px;text-align:center}
h1{font-size:26px;margin:0 0 8px}p{color:#475569;margin:0 0 22px}a{display:inline-block;background:#0F766E;color:#fff;padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:600}</style>
</head><body><main><h1>${titulo}</h1><p>${texto}</p><a href="/">Ir al inicio</a></main></body></html>`);
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return res.status(405).end();
  if (faltantes(REQUERIDAS).length) return noEncontrada(res, 503, 'Tienda no disponible', 'Probá de nuevo en unos minutos.');

  let fila;
  try { fila = await tiendaPorSlug(req.query.slug); }
  catch { return noEncontrada(res, 503, 'Tienda no disponible', 'No pudimos cargar la tienda. Probá de nuevo en unos minutos.'); }
  if (!fila) return noEncontrada(res, 404, 'Esta tienda no existe', 'Revisá la dirección, o creá la tuya en minutos.');

  try {
    const id = limpiarId(fila.id);
    const slug = leer(fila.properties['Slug']);
    const [plan, productos] = await Promise.all([planDe(leer(fila.properties['Usuario'])), productosDe(id)]);

    let datos = {};
    try { datos = JSON.parse(leer(fila.properties['Datos']) || '{}'); } catch {}
    delete datos._apiBase;
    // lo que excede el plan (por ejemplo, un plan que venció) no se muestra, pero no se borra
    datos.productos = productos
      .slice(0, Number.isFinite(plan.productos) ? plan.productos : undefined)
      .map(({ visible, _orden, ...p }) => p);
    datos._pedidos = '/api/pedidos';
    datos._slug = slug;

    const nonce = randomBytes(16).toString('base64');
    const html = renderTienda({ rubro: leer(fila.properties['Rubro']), datos, nonce, marca: plan.marca ? MARCA : '' });

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Security-Policy', csp(nonce));
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=600');
    return res.status(200).send(html);
  } catch (e) {
    console.error('[tienda]', e);
    return noEncontrada(res, 503, 'Tienda no disponible', 'No pudimos cargar la tienda. Probá de nuevo en unos minutos.');
  }
}

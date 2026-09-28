/* /api/pedidos — los pedidos que entran por las tiendas publicadas.

   POST { tienda: <dirección>, items: [{ id, c }], nombre, telefono, entrega, direccion, pago, notas }
        Público: lo manda el carrito de la tienda. Los precios, el envío y
        el total se recalculan acá con los productos de Notion; lo que dice
        el navegador sólo cuenta para qué y cuántos.
        → { numero, total, mensaje }   el mensaje listo para WhatsApp
        → 409 { error, recargar: true } si algún producto ya no está

   GET  ?tienda=<id>                        (con sesión) → { pedidos: [...] }
   POST { accion: 'estado', id, estado }    (con sesión) → { ok: true }
        Sólo el dueño de la tienda ve y cambia sus pedidos. */
import { randomInt } from 'node:crypto';
import { cors, faltantes, error } from './_comun.js';
import { usuarioDe } from './_sesion.js';
import { notion, consultar, texto, leer, limpiarId, proyectoDe, tiendaPorSlug, productosDe, DB_PEDIDOS } from './_notion.js';
import { planDe } from './_planes.js';

const REQUERIDAS = ['CLERK_SECRET_KEY', 'NOTION_TOKEN', 'NOTION_DB_PROYECTOS', 'NOTION_DB_PRODUCTOS', 'NOTION_DB_PEDIDOS'];
export const ESTADOS = ['Nuevo', 'Confirmado', 'Enviado', 'Entregado', 'Cancelado'];
const MAX_LINEAS = 50, MAX_CANTIDAD = 99;

const numeroPrecio = s => { const n = String(s || '').replace(/\D/g, ''); return n ? Number(n) : 0; };
const corto = (s, n) => String(s ?? '').trim().slice(0, n);
const plata = (moneda, n) => `${moneda} ${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;

/* sin letras que se confunden (0/O, 1/I/L) para dictarlo por teléfono */
function numeroPedido() {
  const abc = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 5 }, () => abc[randomInt(abc.length)]).join('');
}

async function crear(req, res) {
  const b = req.body || {};
  if (b.web) return error(res, 400, 'Pedido rechazado.');           // el campo trampa sólo lo llenan los robots

  const fila = await tiendaPorSlug(b.tienda);
  if (!fila) return error(res, 404, 'Esta tienda ya no recibe pedidos.', { recargar: true });
  const tienda = limpiarId(fila.id);

  const items = Array.isArray(b.items) ? b.items : [];
  if (!items.length || items.length > MAX_LINEAS) return error(res, 400, 'El pedido está vacío o es demasiado largo.');
  const nombre = corto(b.nombre, 120);
  if (!nombre) return error(res, 400, 'Falta tu nombre.');

  let datos = {};
  try { datos = JSON.parse(leer(fila.properties['Datos']) || '{}'); } catch {}
  const moneda = datos._moneda || 'Gs.';
  const plan = await planDe(leer(fila.properties['Usuario']));
  const lista = (await productosDe(tienda)).slice(0, Number.isFinite(plan.productos) ? plan.productos : undefined);
  const porId = new Map(lista.map(p => [p._nid, p]));

  const lineas = [];
  for (const it of items) {
    const p = porId.get(limpiarId(it?.id));
    const c = Number(it?.c);
    const precio = p ? numeroPrecio(p.precio) : 0;
    if (!p || !precio || /^agotad/i.test(p.etiqueta || '') || !Number.isInteger(c) || c < 1 || c > MAX_CANTIDAD) {
      return error(res, 409, 'Algunos productos cambiaron. Recargá la página y armá el pedido de nuevo.', { recargar: true });
    }
    const previa = lineas.find(l => l.id === p._nid);
    if (previa) previa.c = Math.min(MAX_CANTIDAD, previa.c + c);
    else lineas.push({ id: p._nid, t: p.titulo, p: precio, c });
  }

  const retiro = b.entrega === 'Retiro en el local' || !String(datos.tiendaEnvio || '').trim();
  const direccion = retiro ? '' : corto(b.direccion, 300);
  if (!retiro && !direccion) return error(res, 400, 'Falta la dirección de envío.');
  const subtotal = lineas.reduce((s, l) => s + l.p * l.c, 0);
  const gratis = numeroPrecio(datos.tiendaGratis);
  const envio = retiro ? 0 : (gratis && subtotal >= gratis ? 0 : numeroPrecio(datos.tiendaEnvio));
  const total = subtotal + envio;
  const pagos = String(datos.tiendaPagos || '').split(',').map(s => s.trim()).filter(Boolean);
  const pago = pagos.includes(b.pago) ? b.pago : '';
  const telefono = corto(b.telefono, 30).replace(/[^\d+\s()-]/g, '');
  const notas = corto(b.notas, 500);
  const numero = numeroPedido();

  await notion('/pages', {
    method: 'POST',
    body: {
      parent: { database_id: DB_PEDIDOS() },
      properties: {
        'Pedido':    { title: texto(numero) },
        'Tienda':    { relation: [{ id: tienda }] },
        'Cliente':   { rich_text: texto(nombre) },
        'Teléfono':  { phone_number: telefono || null },
        'Entrega':   { select: { name: retiro ? 'Retiro en el local' : 'Envío a domicilio' } },
        'Dirección': { rich_text: texto(direccion) },
        'Pago':      { rich_text: texto(pago) },
        'Notas':     { rich_text: texto(notas) },
        'Detalle':   { rich_text: texto(JSON.stringify(lineas)) },
        'Subtotal':  { number: subtotal },
        'Envío':     { number: envio },
        'Total':     { number: total },
        'Estado':    { select: { name: 'Nuevo' } },
      },
    },
  });

  const mensaje = [
    `Hola ${datos.marca || ''}, quiero hacer este pedido (N° ${numero}):`.replace('Hola ,', 'Hola,'),
    '',
    ...lineas.map(l => `• ${l.c} × ${l.t} — ${plata(moneda, l.p * l.c)}`),
    '',
    `Subtotal: ${plata(moneda, subtotal)}`,
    retiro ? 'Retiro en el local' : `Envío: ${envio ? plata(moneda, envio) : 'gratis'}`,
    `Total: ${plata(moneda, total)}`,
    '',
    `Nombre: ${nombre}`,
    retiro ? null : `Dirección: ${direccion}`,
    pago ? `Pago: ${pago}` : null,
    notas ? `Notas: ${notas}` : null,
  ].filter(x => x !== null).join('\n');

  return res.status(200).json({ numero, total, mensaje });
}

function aPedido(f) {
  const p = f.properties;
  let detalle = [];
  try { detalle = JSON.parse(leer(p['Detalle']) || '[]'); } catch {}
  return {
    id: limpiarId(f.id),
    numero: leer(p['Pedido']),
    cliente: leer(p['Cliente']),
    telefono: leer(p['Teléfono']),
    entrega: leer(p['Entrega']),
    direccion: leer(p['Dirección']),
    pago: leer(p['Pago']),
    notas: leer(p['Notas']),
    detalle,
    subtotal: Number(leer(p['Subtotal'])) || 0,
    envio: Number(leer(p['Envío'])) || 0,
    total: Number(leer(p['Total'])) || 0,
    estado: leer(p['Estado']) || 'Nuevo',
    creado: f.created_time,
  };
}

async function listar(res, usuario, tienda) {
  if (!(await proyectoDe(tienda, usuario))) return error(res, 404, 'Esa tienda no existe o no es tuya.');
  const filas = await consultar(DB_PEDIDOS(), {
    filter: { property: 'Tienda', relation: { contains: tienda } },
    sorts: [{ timestamp: 'created_time', direction: 'descending' }],
    max: 300,
  });
  return res.status(200).json({ pedidos: filas.map(aPedido) });
}

async function cambiarEstado(req, res, usuario) {
  const id = limpiarId(req.body?.id);
  const estado = req.body?.estado;
  if (!id || !ESTADOS.includes(estado)) return error(res, 400, 'Pedido o estado inválido.');
  let fila;
  try { fila = await notion(`/pages/${id}`); } catch { return error(res, 404, 'Ese pedido no existe.'); }
  const tienda = limpiarId(fila.properties?.['Tienda']?.relation?.[0]?.id);
  const deLaBase = limpiarId(fila.parent?.database_id) === DB_PEDIDOS();
  if (!deLaBase || fila.archived || !(await proyectoDe(tienda, usuario))) return error(res, 404, 'Ese pedido no existe.');
  await notion(`/pages/${id}`, { method: 'PATCH', body: { properties: { 'Estado': { select: { name: estado } } } } });
  return res.status(200).json({ ok: true });
}

export default async function handler(req, res) {
  cors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  const faltan = faltantes(REQUERIDAS);
  if (faltan.length) return error(res, 500, 'Al proyecto le faltan variables en Vercel.', { faltan });

  try {
    if (req.method === 'POST' && !req.body?.accion) return await crear(req, res);

    const usuario = await usuarioDe(req);
    if (!usuario) return error(res, 401, 'Ingresá para ver tus pedidos.');
    if (req.method === 'GET') {
      const tienda = limpiarId(req.query.tienda);
      if (!tienda) return error(res, 400, 'Falta la tienda.');
      return await listar(res, usuario, tienda);
    }
    if (req.method === 'POST' && req.body.accion === 'estado') return await cambiarEstado(req, res, usuario);
    return error(res, 405, 'Método no permitido.');
  } catch (e) {
    console.error('[pedidos]', e);
    return error(res, 502, 'No se pudo hablar con Notion.');
  }
}

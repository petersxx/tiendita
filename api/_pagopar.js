/* Cobro de planes con Pagopar (https://soporte.pagopar.com).

   1. /api/planes crea una fila Pendiente en la base Pagos y le pide a
      Pagopar un pedido: devuelve un hash y el comprador paga en
      https://www.pagopar.com/pagos/<hash>.
   2. Pagopar avisa a /api/pagopar cuando se paga, y además el comprador
      vuelve a /panel?pago=<hash>. Los dos caminos llaman a confirmarPago(),
      que le pregunta el estado a Pagopar (no confía en lo que llegó) y
      recalcula el plan. Pueden llegar juntos o repetidos: da lo mismo.

   PAGOPAR_PUBLIC_KEY y PAGOPAR_PRIVATE_KEY salen del panel de comercio
   de Pagopar. La clave privada nunca sale del servidor. */
import { createHash } from 'node:crypto';
import { notion, consultar, texto, leer, limpiarId, DB_PAGOS } from './_notion.js';
import { recalcularPlan } from './_planes.js';

const API = 'https://api.pagopar.com/api';
export const configurado = () => !!(process.env.PAGOPAR_PUBLIC_KEY && process.env.PAGOPAR_PRIVATE_KEY && process.env.NOTION_DB_PAGOS);

const sha1 = s => createHash('sha1').update(s).digest('hex');
export const tokenDe = s => sha1(process.env.PAGOPAR_PRIVATE_KEY + s);

async function pagopar(ruta, body) {
  const r = await fetch(API + ruta, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.respuesta !== true) {
    const e = new Error(typeof d.resultado === 'string' ? d.resultado : `Pagopar respondió ${r.status}`);
    e.pagopar = true;
    throw e;
  }
  return d.resultado;
}

/* "2026-09-30 14:05:00" en hora de Paraguay (UTC−3 todo el año) */
function fechaPy(d) {
  const p = new Date(d.getTime() - 3 * 3600e3).toISOString();
  return p.slice(0, 10) + ' ' + p.slice(11, 19);
}
const aISO = s => s ? String(s).replace(' ', 'T').slice(0, 19) + '-03:00' : new Date().toISOString();

/** Pide el pedido a Pagopar y devuelve { hash, url }. */
export async function iniciarPago({ pedido, monto, descripcion, idProducto, comprador }) {
  const publica = process.env.PAGOPAR_PUBLIC_KEY;
  const resultado = await pagopar('/comercios/2.0/iniciar-transaccion', {
    token: tokenDe(pedido + String(parseFloat(monto))),
    public_key: publica,
    monto_total: monto,
    tipo_pedido: 'VENTA-COMERCIO',
    id_pedido_comercio: pedido,
    descripcion_resumen: descripcion,
    fecha_maxima_pago: fechaPy(new Date(Date.now() + 48 * 3600e3)),
    comprador: {
      ruc: comprador.ruc || '',
      email: comprador.email,
      ciudad: null,
      nombre: comprador.nombre,
      telefono: comprador.telefono,
      direccion: '',
      documento: comprador.documento,
      coordenadas: '',
      razon_social: comprador.razonSocial || comprador.nombre,
      tipo_documento: 'CI',
      direccion_referencia: null,
    },
    compras_items: [{
      ciudad: '1',
      nombre: descripcion,
      cantidad: 1,
      categoria: '909',
      public_key: publica,
      url_imagen: '',
      descripcion,
      id_producto: idProducto,
      precio_total: monto,
      vendedor_telefono: '',
      vendedor_direccion: '',
      vendedor_direccion_referencia: '',
      vendedor_direccion_coordenadas: '',
    }],
  });
  const hash = resultado?.[0]?.data;
  if (!hash) throw new Error('Pagopar no devolvió el pedido.');
  return { hash, url: `https://www.pagopar.com/pagos/${hash}` };
}

/** Lo que Pagopar dice hoy de ese pedido. */
async function estadoEnPagopar(hash) {
  const [r] = await pagopar('/pedidos/1.1/traer', {
    hash_pedido: hash,
    token: tokenDe('CONSULTA'),
    token_publico: process.env.PAGOPAR_PUBLIC_KEY,
  });
  return r || {};
}

export async function filaDePago(hash) {
  if (!/^[0-9a-z]{20,128}$/i.test(String(hash || ''))) return null;
  const [fila] = await consultar(DB_PAGOS(), { filter: { property: 'Hash', rich_text: { equals: hash } }, max: 1 });
  return fila || null;
}

export function aPago(fila) {
  const p = fila.properties;
  return {
    id: limpiarId(fila.id),
    pedido: leer(p['Pedido']),
    plan: leer(p['Plan']),
    meses: Number(leer(p['Meses'])) || 0,
    monto: Number(leer(p['Monto'])) || 0,
    estado: leer(p['Estado']) || 'Pendiente',
    formaPago: leer(p['Forma de pago']),
    pagadoEl: leer(p['Pagado el']),
    creado: fila.created_time,
    hash: leer(p['Hash']),
  };
}

/** Confirma un pago contra Pagopar y, si se pagó, recalcula el plan del
 *  dueño. Devuelve el pago actualizado, o null si el hash no es nuestro. */
export async function confirmarPago(hash) {
  const fila = await filaDePago(hash);
  if (!fila) return null;
  const pago = aPago(fila);
  if (pago.estado === 'Pagado') return pago;

  const r = await estadoEnPagopar(hash);
  const usuario = leer(fila.properties['Usuario']);
  if (r.pagado === true && Math.round(Number(r.monto)) === pago.monto) {
    await notion(`/pages/${pago.id}`, {
      method: 'PATCH',
      body: { properties: {
        'Estado': { select: { name: 'Pagado' } },
        'Pagado el': { date: { start: aISO(r.fecha_pago) } },
        'Forma de pago': { rich_text: texto(String(r.forma_pago || '')) },
      } },
    });
    await recalcularPlan(usuario);
    return { ...pago, estado: 'Pagado', formaPago: String(r.forma_pago || '') };
  }
  if (r.cancelado === true && pago.estado !== 'Cancelado') {
    await notion(`/pages/${pago.id}`, { method: 'PATCH', body: { properties: { 'Estado': { select: { name: 'Cancelado' } } } } });
    return { ...pago, estado: 'Cancelado' };
  }
  return pago;
}

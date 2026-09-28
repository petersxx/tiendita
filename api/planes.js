/* /api/planes — los planes y el pago de un plan.

   GET                → { planes, meses, cobro }   público: lo usa la portada
                        con sesión suma { plan, pagos } del usuario
   GET  ?pago=<hash>  → además confirma ese pago con Pagopar (la vuelta del checkout)
   POST { plan, meses, comprador: { nombre, documento, telefono, ruc?, razonSocial? } }
                      → { url }   el checkout de Pagopar

   El precio sale de _planes.js, nunca del navegador. */
import { cors, error } from './_comun.js';
import { usuarioDe } from './_sesion.js';
import { createClerkClient } from '@clerk/backend';
import { notion, consultar, texto, DB_PAGOS } from './_notion.js';
import { PLANES, MESES, planesPublicos, planDe } from './_planes.js';
import { configurado, iniciarPago, confirmarPago, filaDePago, aPago } from './_pagopar.js';

const corto = (s, n) => String(s ?? '').trim().slice(0, n);

async function pagosDe(usuario) {
  if (!process.env.NOTION_DB_PAGOS) return [];
  const filas = await consultar(DB_PAGOS(), {
    filter: { property: 'Usuario', rich_text: { equals: usuario } },
    sorts: [{ timestamp: 'created_time', direction: 'descending' }],
    max: 50,
  });
  return filas.map(aPago).map(({ hash, id, ...p }) => p);
}

async function pagar(req, res, usuario) {
  if (!configurado()) return error(res, 503, 'El cobro con Pagopar todavía no está configurado.');
  const b = req.body || {};
  const plan = PLANES[b.plan];
  const meses = Number(b.meses);
  if (!plan || !plan.precio) return error(res, 400, 'Elegí un plan pago.');
  if (!MESES.includes(meses)) return error(res, 400, 'Elegí por cuántos meses.');

  const c = b.comprador || {};
  const comprador = {
    nombre: corto(c.nombre, 120),
    documento: corto(c.documento, 20).replace(/[^\dA-Za-z-]/g, ''),
    telefono: corto(c.telefono, 30).replace(/[^\d+]/g, ''),
    ruc: corto(c.ruc, 20).replace(/[^\d-]/g, ''),
    razonSocial: corto(c.razonSocial, 120),
  };
  if (!comprador.nombre || !comprador.documento || !comprador.telefono) {
    return error(res, 400, 'Completá tu nombre, tu cédula y tu teléfono para la factura.');
  }
  const u = await createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY }).users.getUser(usuario);
  comprador.email = u.primaryEmailAddress?.emailAddress || '';
  if (!comprador.email) return error(res, 400, 'Tu cuenta necesita un correo para pagar. Agregalo desde tu perfil.');

  const monto = plan.precio * meses;
  const pedido = `${Date.now()}${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`;
  const descripcion = `Plan ${plan.nombre} · ${meses} ${meses === 1 ? 'mes' : 'meses'}`;

  const fila = await notion('/pages', {
    method: 'POST',
    body: {
      parent: { database_id: DB_PAGOS() },
      properties: {
        'Pedido': { title: texto(pedido) },
        'Usuario': { rich_text: texto(usuario) },
        'Email': { email: comprador.email },
        'Plan': { select: { name: b.plan } },
        'Meses': { number: meses },
        'Monto': { number: monto },
        'Estado': { select: { name: 'Pendiente' } },
      },
    },
  });

  let pago;
  try {
    pago = await iniciarPago({ pedido, monto, descripcion, idProducto: Object.keys(PLANES).indexOf(b.plan), comprador });
  } catch (e) {
    await notion(`/pages/${fila.id}`, { method: 'PATCH', body: { archived: true } }).catch(() => {});
    console.error('[planes] Pagopar', e);
    return error(res, 502, e.pagopar ? `Pagopar no aceptó el pedido: ${e.message}` : 'No se pudo hablar con Pagopar.');
  }
  await notion(`/pages/${fila.id}`, { method: 'PATCH', body: { properties: { 'Hash': { rich_text: texto(pago.hash) } } } });
  return res.status(200).json({ url: pago.url });
}

export default async function handler(req, res) {
  cors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    const usuario = await usuarioDe(req);
    if (req.method === 'POST') {
      if (!usuario) return error(res, 401, 'Ingresá para elegir un plan.');
      return await pagar(req, res, usuario);
    }
    if (req.method !== 'GET') return error(res, 405, 'Método no permitido.');

    const publico = { planes: planesPublicos(), meses: MESES, cobro: configurado() };
    if (!usuario) {
      res.setHeader('Cache-Control', 'public, s-maxage=300');
      return res.status(200).json(publico);
    }
    let confirmado = null;
    if (req.query.pago && configurado()) {
      const fila = await filaDePago(req.query.pago);
      // sólo el dueño del pago puede pedir que se confirme desde acá
      if (fila && fila.properties['Usuario']?.rich_text?.map(t => t.plain_text).join('') === usuario) {
        const { hash, id, ...p } = await confirmarPago(req.query.pago);
        confirmado = p;
      }
    }
    const [plan, pagos] = await Promise.all([planDe(usuario), pagosDe(usuario)]);
    res.setHeader('Cache-Control', 'private, no-store');
    return res.status(200).json({
      ...publico,
      plan: { ...plan, productos: Number.isFinite(plan.productos) ? plan.productos : null, categorias: Number.isFinite(plan.categorias) ? plan.categorias : null },
      pagos,
      confirmado,
    });
  } catch (e) {
    console.error('[planes]', e);
    return error(res, 502, 'No se pudo cargar los planes.');
  }
}

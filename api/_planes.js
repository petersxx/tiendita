/* Los planes de la plataforma: precios y límites en un solo lugar.
   La portada y el panel los leen de GET /api/planes, así que cambiar un
   precio o un límite es cambiarlo acá.

   El plan de cada usuario vive en la metadata pública de Clerk, que sólo
   se escribe desde el servidor o desde el panel de Clerk:
     plan, planHasta   los calcula recalcularPlan() a partir de la base Pagos
     planFijo          opcional, a mano desde el panel de Clerk (ej. "pro"):
                       un plan sin vencimiento para cortesías o pruebas */
import { createClerkClient } from '@clerk/backend';
import { consultar, leer, DB_PAGOS } from './_notion.js';

export const PLANES = {
  gratis: {
    nombre: 'Gratis', precio: 0,
    resumen: 'Para arrancar y probar sin gastar nada.',
    productos: 20, categorias: 3, tiendas: 1, marca: true,
    incluye: ['Hasta 20 productos', 'Hasta 3 categorías', 'Pedidos por WhatsApp', 'Panel con tus pedidos', 'Todas las plantillas'],
  },
  negocio: {
    nombre: 'Negocio', precio: 79000, destacado: true,
    resumen: 'Para tiendas que ya venden todos los días.',
    productos: Infinity, categorias: Infinity, tiendas: 1, marca: false,
    incluye: ['Productos ilimitados', 'Categorías ilimitadas', 'Sin la marca de la plataforma', 'Todo lo del plan Gratis'],
  },
  pro: {
    nombre: 'Pro', precio: 149000,
    resumen: 'Para quien maneja más de una marca o local.',
    productos: Infinity, categorias: Infinity, tiendas: 3, marca: false,
    incluye: ['Hasta 3 tiendas', 'Productos y categorías ilimitados', 'Sin la marca de la plataforma', 'Todo lo del plan Negocio'],
  },
};

/** Cuántos meses se pueden pagar de una vez. */
export const MESES = [1, 3, 12];

/** Los planes tal como los ve el navegador (Infinity no existe en JSON). */
export function planesPublicos() {
  return Object.entries(PLANES).map(([id, p]) => ({
    id, ...p,
    productos: Number.isFinite(p.productos) ? p.productos : null,
    categorias: Number.isFinite(p.categorias) ? p.categorias : null,
  }));
}

const clerk = () => createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

/** El plan vigente de un usuario: { id, hasta, ...límites }. Vencido = gratis. */
export function planVigente(meta = {}) {
  if (meta.planFijo && PLANES[meta.planFijo]) return { id: meta.planFijo, hasta: null, fijo: true, ...PLANES[meta.planFijo] };
  const hasta = meta.planHasta ? new Date(meta.planHasta) : null;
  if (meta.plan && PLANES[meta.plan] && hasta && hasta > new Date()) return { id: meta.plan, hasta: meta.planHasta, ...PLANES[meta.plan] };
  return { id: 'gratis', hasta: null, vencido: meta.plan && meta.plan !== 'gratis' ? meta.plan : undefined, ...PLANES.gratis };
}

export async function planDe(usuario) {
  try {
    const u = await clerk().users.getUser(usuario);
    return planVigente(u.publicMetadata);
  } catch {
    return planVigente();
  }
}

function sumarMeses(fecha, meses) {
  const d = new Date(fecha);
  const dia = d.getUTCDate();
  d.setUTCMonth(d.getUTCMonth() + meses);
  if (d.getUTCDate() < dia) d.setUTCDate(0);          // 31 de enero + 1 mes = fin de febrero
  return d;
}

/** Recalcula el plan desde cero a partir de los pagos acreditados y lo
 *  guarda en Clerk. Siempre da el mismo resultado para los mismos pagos,
 *  así que no importa si el aviso de Pagopar y la vuelta del comprador
 *  llegan a la vez: ningún pago se cuenta dos veces. */
export async function recalcularPlan(usuario) {
  const pagos = (await consultar(DB_PAGOS(), {
    filter: { and: [
      { property: 'Usuario', rich_text: { equals: usuario } },
      { property: 'Estado', select: { equals: 'Pagado' } },
    ] },
    max: 1000,
  }))
    .map(f => ({
      plan: leer(f.properties['Plan']),
      meses: Number(leer(f.properties['Meses'])) || 0,
      el: f.properties['Pagado el']?.date?.start || f.created_time,
      pedido: leer(f.properties['Pedido']),
    }))
    .filter(p => PLANES[p.plan] && p.meses > 0)
    .sort((a, b) => a.el.localeCompare(b.el) || a.pedido.localeCompare(b.pedido));

  // Pagar el mismo plan mientras está vigente lo extiende; pagar otro plan lo reemplaza desde ese día.
  let plan = null, hasta = null;
  for (const p of pagos) {
    const el = new Date(p.el);
    if (plan === p.plan && hasta > el) hasta = sumarMeses(hasta, p.meses);
    else { plan = p.plan; hasta = sumarMeses(el, p.meses); }
  }
  await clerk().users.updateUserMetadata(usuario, {
    publicMetadata: { plan: plan || 'gratis', planHasta: hasta ? hasta.toISOString() : null },
  });
  const u = await clerk().users.getUser(usuario);
  return planVigente(u.publicMetadata);
}

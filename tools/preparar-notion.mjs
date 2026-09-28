/* Deja Notion listo para la plataforma. Se puede correr más de una vez.

     node --env-file=.env.local tools/preparar-notion.mjs

   - Agrega a Proyectos las columnas Slug (la dirección de la tienda) y Publicada.
   - Crea las bases Pedidos y Pagos al lado de Proyectos, si todavía no
     están en NOTION_DB_PEDIDOS / NOTION_DB_PAGOS, e imprime sus ids para
     cargarlos en Vercel. */

const h = {
  Authorization: `Bearer ${process.env.NOTION_TOKEN}`,
  'Notion-Version': '2022-06-28',
  'Content-Type': 'application/json',
};
async function notion(ruta, method = 'GET', body) {
  const r = await fetch('https://api.notion.com/v1' + ruta, { method, headers: h, body: body && JSON.stringify(body) });
  const d = await r.json();
  if (!r.ok) throw new Error(`${ruta}: ${d.message}`);
  return d;
}
const titulo = t => [{ type: 'text', text: { content: t } }];
const opciones = (...n) => ({ select: { options: n.map(name => ({ name })) } });

const proyectos = process.env.NOTION_DB_PROYECTOS;
const db = await notion(`/databases/${proyectos}`);
const padre = db.parent.page_id;

const faltan = {};
if (!db.properties['Slug']) faltan['Slug'] = { rich_text: {} };
if (!db.properties['Publicada']) faltan['Publicada'] = { checkbox: {} };
if (Object.keys(faltan).length) {
  await notion(`/databases/${proyectos}`, 'PATCH', { properties: faltan });
  console.log('Proyectos: agregadas', Object.keys(faltan).join(', '));
} else console.log('Proyectos: ya tenía Slug y Publicada');

async function crear(variable, nombre, properties) {
  if (process.env[variable]) { console.log(`${nombre}: ya existe (${variable})`); return; }
  const nueva = await notion('/databases', 'POST', {
    parent: { type: 'page_id', page_id: padre },
    title: titulo(nombre),
    properties,
  });
  console.log(`${nombre}: creada → ${variable}=${nueva.id.replace(/-/g, '')}`);
}

await crear('NOTION_DB_PEDIDOS', 'Pedidos', {
  'Pedido':    { title: {} },
  'Tienda':    { relation: { database_id: proyectos, single_property: {} } },
  'Cliente':   { rich_text: {} },
  'Teléfono':  { phone_number: {} },
  'Entrega':   opciones('Envío a domicilio', 'Retiro en el local'),
  'Dirección': { rich_text: {} },
  'Pago':      { rich_text: {} },
  'Notas':     { rich_text: {} },
  'Detalle':   { rich_text: {} },
  'Subtotal':  { number: { format: 'number' } },
  'Envío':     { number: { format: 'number' } },
  'Total':     { number: { format: 'number' } },
  'Estado':    opciones('Nuevo', 'Confirmado', 'Enviado', 'Entregado', 'Cancelado'),
  'Creado':    { created_time: {} },
});

await crear('NOTION_DB_PAGOS', 'Pagos', {
  'Pedido':    { title: {} },
  'Usuario':   { rich_text: {} },
  'Email':     { email: {} },
  'Plan':      opciones('negocio', 'pro'),
  'Meses':     { number: { format: 'number' } },
  'Monto':     { number: { format: 'number' } },
  'Hash':      { rich_text: {} },
  'Estado':    opciones('Pendiente', 'Pagado', 'Cancelado'),
  'Forma de pago': { rich_text: {} },
  'Pagado el': { date: {} },
  'Creado':    { created_time: {} },
});

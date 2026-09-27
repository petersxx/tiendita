/* POST /api/publicar
   Publica una demo en Vercel: cada demo es su propio proyecto
   (demo-<nombre>), así volver a publicar la misma demo actualiza
   la misma dirección que ya le mandaste al cliente.

   Cuerpo:    { proyecto, proyectoId, html, archivos: [{ file, sha, size }] }
   Cabeceras: x-publicar-token: <PUBLICAR_TOKEN>
              Authorization: Bearer <token de sesión de Clerk>
   Respuesta: { url, proyecto, deploy, listo }
              409 { faltanArchivos: [sha] } si Vercel no tiene alguna imagen

   Las imágenes van aparte, de a una, porque juntas no entran en el
   límite de 4,5 MB de una función:
   Cuerpo:    { subir: { sha, datos (base64) } }
   Respuesta: { ok: true }

   El VERCEL_TOKEN nunca sale de acá. Como con él se puede desplegar en
   tu cuenta, esta función exige PUBLICAR_TOKEN: sin esa variable no
   publica nada. El registro de cuentas es abierto, así que la sesión
   sola no alcanza: la clave dice quién puede publicar.

   Cada dirección es de un solo proyecto (columna Demo de la base
   Proyectos). Se publica sólo desde un proyecto propio y guardado, y
   sólo en una dirección que ya es de ese proyecto o que no existe. Una
   demo que existe en Vercel sin dueño (de un proyecto borrado) no la
   puede tomar nadie: así nadie cambia una página que no es suya.
*/
import { createHash } from 'node:crypto';
import { cors, faltantes, error } from './_comun.js';
import { usuarioDe } from './_sesion.js';
import { notion, consultar, texto, leer, limpiarId, proyectoDe, DB_PROYECTOS } from './_notion.js';

const API = 'https://api.vercel.com';
const REQUERIDAS = ['VERCEL_TOKEN', 'PUBLICAR_TOKEN', 'CLERK_SECRET_KEY', 'NOTION_TOKEN', 'NOTION_DB_PROYECTOS'];
const MAX_BYTES = 4 * 1024 * 1024;   // el límite del cuerpo de una función es 4,5 MB
const ESPERA_MS = 25000;
const IMG_MAX_BYTES = 3 * 1024 * 1024;
const MAX_ARCHIVOS = 80;
const RUTA_IMG = /^img\/[0-9a-f]{12}\.(webp|jpg|png|gif|svg)$/;

/** demo-<algo> en minúsculas, sólo letras, números y guiones, hasta 52 caracteres. */
export function nombreProyecto(s) {
  const base = String(s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/^demo-/, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, 47).replace(/-+$/, '');
  return base ? `demo-${base}` : '';
}

function vercel(ruta, { method = 'GET', body, headers } = {}) {
  const url = new URL(API + ruta);
  if (process.env.VERCEL_TEAM_ID) url.searchParams.set('teamId', process.env.VERCEL_TEAM_ID);
  const crudo = Buffer.isBuffer(body);
  return fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.VERCEL_TOKEN}`,
      'Content-Type': crudo ? 'application/octet-stream' : 'application/json',
      ...headers,
    },
    body: crudo ? body : body ? JSON.stringify(body) : undefined,
  }).then(async r => ({ ok: r.ok, status: r.status, datos: await r.json().catch(() => ({})) }));
}

const esperar = ms => new Promise(r => setTimeout(r, ms));

const conDemo = nombre => consultar(DB_PROYECTOS(), { filter: { property: 'Demo', rich_text: { equals: nombre } } });
const fijarDemo = (id, nombre) =>
  notion(`/pages/${id}`, { method: 'PATCH', body: { properties: { 'Demo': { rich_text: nombre ? texto(nombre) : [] } } } });

/** Reserva la dirección para el proyecto. Devuelve null si quedó reservada,
 *  o el mensaje de por qué no se puede usar. */
async function reservar(nombre, fila) {
  const id = limpiarId(fila.id);
  const duenos = await conDemo(nombre);
  if (duenos.some(f => limpiarId(f.id) !== id)) return 'Esa dirección ya la usa otro proyecto. Elegí otro nombre.';
  if (duenos.length) return null;                                   // ya era de este proyecto

  // nadie la tiene en Notion; si igual existe en Vercel, quedó de un proyecto borrado
  const existe = await vercel(`/v9/projects/${nombre}`);
  if (existe.ok) return 'Esa dirección ya existe y no es de este proyecto. Elegí otro nombre.';
  if (existe.status !== 404) throw new Error('Vercel no respondió al revisar la dirección.');

  const anterior = leer(fila.properties['Demo']);
  await fijarDemo(id, nombre);
  // si dos proyectos la pidieron a la vez, se la queda el que Notion creó primero
  const ahora = (await conDemo(nombre)).sort((a, b) => a.created_time.localeCompare(b.created_time) || a.id.localeCompare(b.id));
  if (ahora.length > 1 && limpiarId(ahora[0].id) !== id) {
    await fijarDemo(id, anterior);
    return 'Esa dirección ya la usa otro proyecto. Elegí otro nombre.';
  }
  return null;
}

/** Sube una imagen a Vercel, identificada por su SHA-1. */
async function subirArchivo(res, { sha, datos } = {}) {
  if (!/^[0-9a-f]{40}$/.test(sha || '') || typeof datos !== 'string') return error(res, 400, 'Imagen mal armada.');
  const buf = Buffer.from(datos, 'base64');
  if (buf.length > IMG_MAX_BYTES) return error(res, 400, 'La imagen pasa de 3 MB.');
  if (createHash('sha1').update(buf).digest('hex') !== sha) return error(res, 400, 'La imagen llegó dañada. Probá de nuevo.');
  const r = await vercel('/v2/files', { method: 'POST', body: buf, headers: { 'x-vercel-digest': sha } });
  if (!r.ok) return error(res, 502, 'Vercel no aceptó la imagen.', { vercel: r.datos.error?.message || r.status });
  return res.status(200).json({ ok: true });
}

export default async function handler(req, res) {
  cors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return error(res, 405, 'Usá POST.');

  const faltan = faltantes(REQUERIDAS);
  if (faltan.length) return error(res, 500, 'Al proyecto le faltan variables de entorno en Vercel.', { faltan });

  if (req.headers['x-publicar-token'] !== process.env.PUBLICAR_TOKEN) {
    return error(res, 401, 'Clave de publicación inválida o ausente.');
  }
  const usuario = await usuarioDe(req);
  if (!usuario) return error(res, 401, 'Ingresá con tu usuario para publicar.');

  if (req.body?.subir) return subirArchivo(res, req.body.subir);

  const { html } = req.body || {};
  const archivos = Array.isArray(req.body?.archivos) ? req.body.archivos : [];
  if (archivos.length > MAX_ARCHIVOS) return error(res, 400, `Son más de ${MAX_ARCHIVOS} imágenes.`);
  if (!archivos.every(a => RUTA_IMG.test(a?.file) && /^[0-9a-f]{40}$/.test(a?.sha) && Number.isInteger(a?.size))) {
    return error(res, 400, 'La lista de imágenes está mal armada.');
  }
  const proyecto = nombreProyecto(req.body?.proyecto);
  if (!proyecto) return error(res, 400, 'Falta el nombre de la demo.');
  const fila = await proyectoDe(limpiarId(req.body?.proyectoId), usuario);
  if (!fila) return error(res, 404, 'Guardá el proyecto antes de publicarlo.');
  if (typeof html !== 'string' || !/<html[\s>]/i.test(html)) return error(res, 400, 'Falta el HTML de la página.');
  if (Buffer.byteLength(html) > MAX_BYTES) return error(res, 400, 'La página pasa de 4 MB. Usá imágenes por URL en vez de incrustadas.');

  let motivo;
  try { motivo = await reservar(proyecto, fila); }
  catch (e) { return error(res, 502, 'No se pudo reservar la dirección.', { detalle: String(e.message || e) }); }
  if (motivo) return error(res, 409, motivo);

  // 1. El proyecto de Vercel: si ya existe (409) es el de esta demo, que acabamos de comprobar.
  const alta = await vercel('/v11/projects', { method: 'POST', body: { name: proyecto, framework: null } });
  if (!alta.ok && alta.status !== 409) {
    return error(res, 502, 'Vercel no dejó crear el proyecto.', { vercel: alta.datos.error?.message || alta.status });
  }
  // Una demo es para mandarla: sin la pantalla de login de Vercel.
  await vercel(`/v9/projects/${proyecto}`, { method: 'PATCH', body: { ssoProtection: null } });

  // 2. El deploy: index.html y sus imágenes, directo a producción.
  const deploy = await vercel('/v13/deployments?skipAutoDetectionConfirmation=1', {
    method: 'POST',
    body: {
      name: proyecto,
      project: proyecto,
      target: 'production',
      files: [
        { file: 'index.html', data: html },
        ...archivos.map(({ file, sha, size }) => ({ file, sha, size })),
      ],
      projectSettings: { framework: null },
    },
  });
  if (deploy.datos.error?.code === 'missing_files') {
    return res.status(409).json({ error: 'Faltan imágenes.', faltanArchivos: deploy.datos.error.missing || [] });
  }
  if (!deploy.ok) {
    return error(res, 502, 'Vercel rechazó el deploy.', { vercel: deploy.datos.error?.message || deploy.status });
  }

  // 3. Una página estática queda lista en segundos; esperamos un poco para devolver la dirección final.
  let estado = deploy.datos.readyState;
  const hasta = Date.now() + ESPERA_MS;
  while (!['READY', 'ERROR', 'CANCELED'].includes(estado) && Date.now() < hasta) {
    await esperar(1500);
    const d = await vercel(`/v13/deployments/${deploy.datos.id}`);
    estado = d.datos.readyState || estado;
  }
  if (estado === 'ERROR' || estado === 'CANCELED') return error(res, 502, 'El deploy falló en Vercel.');

  // La dirección de producción del proyecto (demo-x.vercel.app, o con sufijo si el nombre estaba tomado).
  const dominios = await vercel(`/v9/projects/${proyecto}/domains`);
  const dominio = dominios.datos.domains?.find(d => d.name.endsWith('.vercel.app'))?.name
    || dominios.datos.domains?.[0]?.name;

  const url = `https://${dominio || deploy.datos.url}`;
  await notion(`/pages/${limpiarId(fila.id)}`, { method: 'PATCH', body: { properties: { 'Demo publicada': { url } } } }).catch(() => {});

  return res.status(200).json({
    url,
    proyecto,
    deploy: `https://${deploy.datos.url}`,
    listo: estado === 'READY',
  });
}

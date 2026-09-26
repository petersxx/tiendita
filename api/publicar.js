/* POST /api/publicar
   Publica una demo en Vercel: cada demo es su propio proyecto
   (demo-<nombre>), así volver a publicar la misma demo actualiza
   la misma dirección que ya le mandaste al cliente.

   Cuerpo:    { proyecto, html }
   Cabecera:  x-publicar-token: <PUBLICAR_TOKEN>
   Respuesta: { url, proyecto, deploy, listo }

   El VERCEL_TOKEN nunca sale de acá. Como con él se puede desplegar en
   tu cuenta, esta función exige PUBLICAR_TOKEN: sin esa variable no
   publica nada.
*/
import { cors, faltantes, error } from './_comun.js';

const API = 'https://api.vercel.com';
const REQUERIDAS = ['VERCEL_TOKEN', 'PUBLICAR_TOKEN'];
const MAX_BYTES = 4 * 1024 * 1024;   // el límite del cuerpo de una función es 4,5 MB
const ESPERA_MS = 25000;

/** demo-<algo> en minúsculas, sólo letras, números y guiones, hasta 52 caracteres. */
export function nombreProyecto(s) {
  const base = String(s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/^demo-/, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, 47).replace(/-+$/, '');
  return base ? `demo-${base}` : '';
}

function vercel(ruta, { method = 'GET', body } = {}) {
  const url = new URL(API + ruta);
  if (process.env.VERCEL_TEAM_ID) url.searchParams.set('teamId', process.env.VERCEL_TEAM_ID);
  return fetch(url, {
    method,
    headers: { Authorization: `Bearer ${process.env.VERCEL_TOKEN}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  }).then(async r => ({ ok: r.ok, status: r.status, datos: await r.json().catch(() => ({})) }));
}

const esperar = ms => new Promise(r => setTimeout(r, ms));

export default async function handler(req, res) {
  cors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return error(res, 405, 'Usá POST.');

  const faltan = faltantes(REQUERIDAS);
  if (faltan.length) return error(res, 500, 'Al proyecto le faltan variables de entorno en Vercel.', { faltan });

  if (req.headers['x-publicar-token'] !== process.env.PUBLICAR_TOKEN) {
    return error(res, 401, 'Clave de publicación inválida o ausente.');
  }

  const { html } = req.body || {};
  const proyecto = nombreProyecto(req.body?.proyecto);
  if (!proyecto) return error(res, 400, 'Falta el nombre de la demo.');
  if (typeof html !== 'string' || !/<html[\s>]/i.test(html)) return error(res, 400, 'Falta el HTML de la página.');
  if (Buffer.byteLength(html) > MAX_BYTES) return error(res, 400, 'La página pasa de 4 MB. Usá imágenes por URL en vez de incrustadas.');

  // 1. El proyecto: si ya existe (409) seguimos con ese.
  const alta = await vercel('/v11/projects', { method: 'POST', body: { name: proyecto, framework: null } });
  if (!alta.ok && alta.status !== 409) {
    return error(res, 502, 'Vercel no dejó crear el proyecto.', { vercel: alta.datos.error?.message || alta.status });
  }
  // Una demo es para mandarla: sin la pantalla de login de Vercel.
  await vercel(`/v9/projects/${proyecto}`, { method: 'PATCH', body: { ssoProtection: null } });

  // 2. El deploy: un solo index.html, directo a producción.
  const deploy = await vercel('/v13/deployments?skipAutoDetectionConfirmation=1', {
    method: 'POST',
    body: {
      name: proyecto,
      project: proyecto,
      target: 'production',
      files: [{ file: 'index.html', data: html }],
      projectSettings: { framework: null },
    },
  });
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

  return res.status(200).json({
    url: `https://${dominio || deploy.datos.url}`,
    proyecto,
    deploy: `https://${deploy.datos.url}`,
    listo: estado === 'READY',
  });
}

/* POST /api/subir
   Devuelve una URL prefirmada para que el navegador suba la imagen
   DIRECTO a R2, sin que el archivo pase por este servidor.

   Cuerpo:    { nombre, tipo, tamano }
   Respuesta: { urlSubida, urlPublica, clave, expiraEn }

   Las claves de R2 nunca salen de acá: lo único que viaja al navegador
   es una URL firmada que sirve para un solo archivo y caduca en 5 minutos.
*/
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'node:crypto';
import { cors, faltantes, error } from './_comun.js';

const TIPOS = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif', 'image/svg+xml']);
const EXT = { 'image/jpeg':'jpg', 'image/png':'png', 'image/webp':'webp', 'image/avif':'avif', 'image/gif':'gif', 'image/svg+xml':'svg' };
const MAX_BYTES = 10 * 1024 * 1024;
const VIGENCIA = 300;

const REQUERIDAS = ['R2_ACCOUNT_ID', 'R2_BUCKET', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_PUBLIC_BASE'];

function limpiar(nombre) {
  return String(nombre || 'imagen')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\.[^.]+$/, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    .slice(0, 40) || 'imagen';
}

export default async function handler(req, res) {
  cors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return error(res, 405, 'Usá POST.');

  const faltan = faltantes(REQUERIDAS);
  if (faltan.length) return error(res, 500, 'Al proyecto le faltan variables de entorno en Vercel.', { faltan });

  // Puerta opcional: si SUBIDA_TOKEN está definida, hay que mandarla.
  const puerta = process.env.SUBIDA_TOKEN;
  if (puerta && req.headers['x-subida-token'] !== puerta) {
    return error(res, 401, 'Clave de subida inválida o ausente.');
  }

  const { nombre, tipo, tamano } = req.body || {};
  if (!TIPOS.has(tipo)) return error(res, 400, 'Ese tipo de archivo no se acepta.', { permitidos: [...TIPOS] });
  if (Number(tamano) > MAX_BYTES) return error(res, 400, 'La imagen pasa de 10 MB. Achicala antes de subirla.');

  const hoy = new Date().toISOString().slice(0, 10);
  const clave = `${hoy}/${randomUUID().slice(0, 8)}-${limpiar(nombre)}.${EXT[tipo]}`;

  const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });

  try {
    const urlSubida = await getSignedUrl(
      s3,
      new PutObjectCommand({ Bucket: process.env.R2_BUCKET, Key: clave, ContentType: tipo }),
      { expiresIn: VIGENCIA }
    );
    const base = process.env.R2_PUBLIC_BASE.replace(/\/+$/, '');
    return res.status(200).json({ urlSubida, urlPublica: `${base}/${clave}`, clave, expiraEn: VIGENCIA });
  } catch (e) {
    return error(res, 502, 'R2 no aceptó la firma. Revisá las claves del bucket.', { detalle: String(e.message || e) });
  }
}

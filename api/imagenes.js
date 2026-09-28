/* POST /api/imagenes — permiso para subir una foto al bucket de R2.

   Cuerpo:    { tipo, tamano }
   Cabecera:  Authorization: Bearer <token de sesión de Clerk>
   Respuesta: { urlSubida, urlPublica }

   El navegador achica la foto y la sube DIRECTO a R2 con un PUT a
   urlSubida, sin pasar por Vercel. La firma vale 5 minutos, para un solo
   archivo, con ese tipo y ese tamaño exactos, dentro de la carpeta del
   usuario (u/<id de Clerk>/…). Las claves de R2 no salen de acá. */
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'node:crypto';
import { cors, faltantes, error } from './_comun.js';
import { usuarioDe } from './_sesion.js';

const REQUERIDAS = ['CLERK_SECRET_KEY', 'R2_ACCOUNT_ID', 'R2_BUCKET', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_PUBLIC_BASE'];
// sin SVG: puede llevar scripts, y las fotos se sirven a cualquiera
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif', 'image/gif': 'gif' };
const MAX_BYTES = 5 * 1024 * 1024;
const VIGENCIA = 300;

let s3;
const cliente = () => s3 ||= new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY },
  // si no, el SDK firma la suma de control de un cuerpo vacío y la subida real no coincide
  requestChecksumCalculation: 'WHEN_REQUIRED',
});

export default async function handler(req, res) {
  cors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return error(res, 405, 'Usá POST.');

  const faltan = faltantes(REQUERIDAS);
  if (faltan.length) return error(res, 503, 'La subida de fotos todavía no está configurada.', { faltan });

  const usuario = await usuarioDe(req);
  if (!usuario) return error(res, 401, 'Ingresá para subir fotos.');

  const { tipo } = req.body || {};
  const tamano = Number(req.body?.tamano);
  if (!EXT[tipo]) return error(res, 400, 'Subí una foto JPG, PNG, WebP, AVIF o GIF.');
  if (!Number.isInteger(tamano) || tamano < 1 || tamano > MAX_BYTES) return error(res, 400, 'La foto pasa de 5 MB.');

  const mes = new Date().toISOString().slice(0, 7);
  const clave = `u/${usuario.replace(/[^\w-]/g, '')}/${mes}/${randomUUID()}.${EXT[tipo]}`;
  try {
    const urlSubida = await getSignedUrl(cliente(), new PutObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: clave,
      ContentType: tipo,
      ContentLength: tamano,
    }), { expiresIn: VIGENCIA, signableHeaders: new Set(['content-type', 'content-length']) });
    const base = process.env.R2_PUBLIC_BASE.replace(/\/+$/, '');
    return res.status(200).json({ urlSubida, urlPublica: `${base}/${clave}` });
  } catch (e) {
    console.error('[imagenes]', e);
    return error(res, 502, 'R2 no aceptó la firma. Revisá las claves del bucket.');
  }
}

/* POST /api/pagopar — el aviso de Pagopar cuando cambia un pedido.
   Se configura en el panel de Pagopar como «URL de respuesta».

   Cuerpo: { respuesta: true, resultado: [{ hash_pedido, token, pagado, … }] }
   El token tiene que ser sha1(clave privada + hash_pedido). Aun así no se
   cree lo que dice el aviso: confirmarPago() le vuelve a preguntar a
   Pagopar. Pagopar espera un 200 con el mismo `resultado` que mandó. */
import { configurado, tokenDe, confirmarPago } from './_pagopar.js';
import { timingSafeEqual } from 'node:crypto';

const iguales = (a, b) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Usá POST.' });
  if (!configurado()) return res.status(503).json({ error: 'Pagopar no está configurado.' });

  const resultado = Array.isArray(req.body?.resultado) ? req.body.resultado : [];
  const r = resultado[0] || {};
  const hash = String(r.hash_pedido || '');
  if (!hash || !iguales(String(r.token || ''), tokenDe(hash))) return res.status(400).json({ error: 'Token inválido.' });

  try {
    await confirmarPago(hash);
  } catch (e) {
    console.error('[pagopar]', e);
    return res.status(502).json({ error: 'No se pudo confirmar el pago.' });   // Pagopar reintenta
  }
  return res.status(200).json(resultado);
}

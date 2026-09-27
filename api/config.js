/* GET /api/config — lo que el editor necesita saber antes de arrancar.
   Sólo valores públicos: la clave publicable de Clerk está hecha para
   ir en el navegador. */
import { cors } from './_comun.js';

export default function handler(req, res) {
  cors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  res.setHeader('Cache-Control', 'public, s-maxage=300');
  return res.status(200).json({ clerk: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || '' });
}

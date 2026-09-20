/* Utilidades compartidas por las funciones de la API. */

/** Orígenes que pueden llamar a los endpoints con credenciales.
 *  Se configuran en ORIGENES_PERMITIDOS, separados por coma.
 *  Vacío = se permite el mismo despliegue y localhost. */
export function cors(req, res, { abierto = false } = {}) {
  if (abierto) {                       // el catálogo es de lectura: cualquier página exportada puede pedirlo
    res.setHeader('Access-Control-Allow-Origin', '*');
  } else {
    const lista = (process.env.ORIGENES_PERMITIDOS || '')
      .split(',').map(s => s.trim()).filter(Boolean);
    const origen = req.headers.origin || '';
    const propio = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '';
    const permitido =
      lista.includes(origen) ||
      (!lista.length && (origen === propio || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origen)));
    if (permitido) res.setHeader('Access-Control-Allow-Origin', origen);
  }
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,x-subida-token');
  res.setHeader('Access-Control-Max-Age', '86400');
}

/** Devuelve la lista de variables de entorno que faltan. */
export function faltantes(claves) {
  return claves.filter(k => !process.env[k]);
}

export function error(res, codigo, mensaje, extra) {
  return res.status(codigo).json({ error: mensaje, ...(extra || {}) });
}

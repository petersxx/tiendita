/* Quién hace el pedido, según la sesión de Clerk.
   El editor manda el token de sesión en `Authorization: Bearer …`;
   acá se verifica la firma sin llamar a Clerk en cada pedido. */
import { verifyToken, createClerkClient } from '@clerk/backend';

/** El id de usuario de Clerk, o null si no hay sesión válida. */
export async function usuarioDe(req) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  try {
    const datos = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY });
    return datos.sub || null;
  } catch {
    return null;
  }
}

/** El nombre de usuario, para que en Notion se lea de quién es cada proyecto. */
export async function nombreDeUsuario(id) {
  try {
    const u = await createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY }).users.getUser(id);
    return u.username || u.primaryEmailAddress?.emailAddress || '';
  } catch {
    return '';
  }
}

/** Si el usuario puede publicar demos: `publicar: true` en su metadata pública.
 *  La metadata pública sólo se escribe desde el servidor o el panel de Clerk. */
export async function puedePublicar(id) {
  try {
    const u = await createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY }).users.getUser(id);
    return u.publicMetadata?.publicar === true;
  } catch {
    return false;
  }
}

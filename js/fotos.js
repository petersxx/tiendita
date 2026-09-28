/* =========================================================
   FOTOS — se achican en el navegador y se suben a R2
   Las comparten el editor y el panel. La subida pide permiso a
   /api/imagenes (con la sesión) y manda el archivo directo al bucket.
   ========================================================= */
const FOTO_LADO_MAX = 1920;                   // px del lado más largo
const FOTO_TIPOS = { 'image/webp':'webp', 'image/jpeg':'jpg', 'image/png':'png', 'image/gif':'gif', 'image/svg+xml':'svg', 'image/avif':'avif' };

/* achica fotos grandes a WebP; SVG y GIF (vectores, animaciones) pasan tal cual */
async function achicarFoto(archivo){
  if(/svg|gif/.test(archivo.type)) return archivo;
  let bmp;
  try{ bmp = await createImageBitmap(archivo); }
  catch(e){ throw new Error('Este navegador no puede leer esa imagen. Probá con JPG o PNG.'); }
  const k = Math.min(1, FOTO_LADO_MAX / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  if(bmp.close) bmp.close();
  const aBlob = (tipo, q)=> new Promise(ok=>c.toBlob(ok, tipo, q));
  let b = await aBlob('image/webp', .82);
  if(!b || b.type !== 'image/webp') b = await aBlob(archivo.type === 'image/png' ? 'image/png' : 'image/jpeg', .85);
  // si ya venía chica y en un formato conocido, no la empeoramos
  return (k === 1 && FOTO_TIPOS[archivo.type] && archivo.size <= b.size) ? archivo : b;
}

/* sube una foto ya achicada y devuelve su dirección pública.
   Un error con status 503 quiere decir que R2 no está configurado. */
async function subirFoto(blob){
  const { urlSubida, urlPublica } = await api('/api/imagenes', { method:'POST', body:{ tipo: blob.type, tamano: blob.size } });
  const r = await fetch(urlSubida, { method:'PUT', headers:{ 'Content-Type': blob.type }, body: blob });
  if(!r.ok) throw new Error('El almacén de fotos rechazó la subida (' + r.status + ').');
  return urlPublica;
}

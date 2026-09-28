/* =========================================================
   CUENTA — ingreso con Clerk y pedidos a la API con la sesión
   La clave publicable llega de /api/config; el SDK de Clerk se baja
   del Frontend API de la propia instancia, como indica Clerk.
   ========================================================= */

/* la API vive en el mismo despliegue que el editor; si el editor se abre
   desde otro lado (servidor estático, archivo suelto), usa la publicada */
let API_BASE = null;
function apiBase(){ return API_BASE ?? ESTILO_POR_DEFECTO._apiBase; }

async function leerConfig(){
  if(/^https?:$/.test(location.protocol)){
    try{
      const r = await fetch('/api/config');
      if(r.ok && /json/.test(r.headers.get('content-type') || '')){ API_BASE = location.origin; return r.json(); }
    }catch(e){}
  }
  API_BASE = ESTILO_POR_DEFECTO._apiBase;
  return (await fetch(API_BASE + '/api/config')).json();
}

function cargarScript(src, attrs){
  return new Promise((ok, mal)=>{
    const s = document.createElement('script');
    s.src = src; s.async = true; s.crossOrigin = 'anonymous';
    Object.entries(attrs || {}).forEach(([k,v])=> s.setAttribute(k, v));
    s.onload = ok; s.onerror = ()=> mal(new Error('No se pudo cargar ' + src));
    document.head.appendChild(s);
  });
}

const cuenta = {
  clerk: null,
  estado: 'cargando',            // 'cargando' · 'listo' · 'sin-servicio'
  alCambiar: ()=>{},
  _ultimo: undefined,

  get usuario(){ return this.clerk && this.clerk.user || null; },
  get nombre(){
    const u = this.usuario;
    return u ? (u.username || u.primaryEmailAddress?.emailAddress || 'tu cuenta') : '';
  },

  async iniciar(){
    try{
      const { clerk: pk } = await leerConfig();
      if(!pk) throw new Error('Falta la clave de Clerk en el servidor.');
      // la clave publicable lleva, en base64, la dirección del Frontend API de la instancia
      const fapi = atob(pk.split('_').slice(2).join('_')).replace(/\$$/, '');
      // desde Clerk Core 3 las ventanas de ingreso vienen en un paquete aparte (@clerk/ui)
      await Promise.all([
        cargarScript(`https://${fapi}/npm/@clerk/ui@1/dist/ui.browser.js`),
        cargarScript(`https://${fapi}/npm/@clerk/clerk-js@6/dist/clerk.browser.js`, { 'data-clerk-publishable-key': pk }),
      ]);
      let localization;
      try{ localization = (await import('https://cdn.jsdelivr.net/npm/@clerk/localizations@4/+esm')).esES; }catch(e){}
      await window.Clerk.load({ localization, ui: { ClerkUI: window.__internal_ClerkUICtor } });
      this.clerk = window.Clerk;
      this.estado = 'listo';
      this.clerk.addListener(()=> this._avisar());
    }catch(err){
      console.warn('[cuenta]', err);
      this.estado = 'sin-servicio';
    }
    this.pintar();
    this._avisar(true);
  },

  /* Clerk avisa por cualquier cambio de sesión; sólo nos importa cuando cambia el usuario */
  _avisar(forzar){
    const id = this.usuario ? this.usuario.id : null;
    if(!forzar && id === this._ultimo) return;
    this._ultimo = id;
    this.pintar();
    this.alCambiar();
  },

  /* el editor tiene una caja (#cuenta); el panel, varias ([data-cuenta]) */
  pintar(){
    document.querySelectorAll('#cuenta, [data-cuenta]').forEach(caja => this._pintarEn(caja));
  },
  _pintarEn(caja){
    if(this.estado === 'cargando'){ caja.innerHTML = ''; return; }
    if(this.estado === 'sin-servicio'){
      caja.innerHTML = `<span class="cuenta-off" title="${esc(EN_VISOR
        ? 'El visor de Claude bloquea las conexiones externas. Abrí el editor publicado para ingresar.'
        : 'No se pudo conectar con el servicio de cuentas.')}">Sin conexión</span>`;
      return;
    }
    if(this.usuario){
      // un botón montado para otra persona no sirve: se vuelve a montar
      if(caja.dataset.uid !== this.usuario.id || !caja.querySelector('.cuenta-usuario')){
        caja.dataset.uid = this.usuario.id;
        caja.innerHTML = '<div class="cuenta-usuario"></div>';
        this.clerk.mountUserButton(caja.querySelector('.cuenta-usuario'));
      }
    }else{
      delete caja.dataset.uid;
      caja.innerHTML = '<button class="btn" type="button" data-ingresar>Ingresar</button>';
    }
  },

  ingresar(){ if(this.clerk) this.clerk.openSignIn(); },
  registrarse(){ if(this.clerk) this.clerk.openSignUp(); },

  async token(){
    try{ return this.clerk && this.clerk.session ? await this.clerk.session.getToken() : null; }
    catch(e){ return null; }
  },
};

document.addEventListener('click', e=>{
  if(e.target.closest('[data-ingresar]')) cuenta.ingresar();
  if(e.target.closest('[data-registrarse]')) cuenta.registrarse();
});

/* pedido a la API con la sesión; tira un Error con el mensaje del servidor */
async function api(ruta, { method = 'GET', body } = {}){
  const uid = cuenta.usuario ? cuenta.usuario.id : null;
  const token = await cuenta.token();
  // si mientras se pedía el token entró otra persona, el pedido no sale con su sesión
  if((cuenta.usuario ? cuenta.usuario.id : null) !== uid) throw new Error('Cambió la sesión. Probá de nuevo.');
  const r = await fetch(apiBase() + ruta, {
    method,
    headers: {
      ...(body ? { 'Content-Type':'application/json' } : {}),
      ...(token ? { Authorization:'Bearer ' + token } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(()=>({}));
  if(!r.ok){ const e = new Error(j.error || `El servidor respondió ${r.status}`); e.status = r.status; throw e; }
  return j;
}

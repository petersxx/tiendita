/* =========================================================
   SECCIONES — cada una declara sus campos y su HTML.
   Un rubro es una lista de secciones + contenido propio.

   El tercer argumento `a` marca los nodos editables. En la vista
   previa devuelve atributos (data-campo, data-campo-img, data-item)
   que la capa de edición usa para saber qué toca cada clic; al
   exportar devuelve cadenas vacías, así el HTML sale limpio.
   ========================================================= */
const ANCLAS = { cards:'#catalogo', precios:'#precios', texto:'#nosotros', faq:'#preguntas', contacto:'#contacto' };

function marcas(activo){
  const q = s => String(s).replace(/"/g,'&quot;');
  if(!activo){ const nada = ()=> ''; return { c:nada, p:nada, im:nada, it:nada }; }
  return {
    c:  r => ` data-campo="${q(r)}"`,                    // texto de una línea
    p:  r => ` data-campo="${q(r)}" data-multi="1"`,     // texto de varios párrafos
    im: r => ` data-campo-img="${q(r)}"`,                // imagen o fondo generado
    it: r => ` data-item="${q(r)}"`,                     // ítem de una lista repetible
  };
}

const SEC = {
  nav: {
    campos:[
      {k:'marca',   g:'Identidad', l:'Nombre del negocio', t:'text'},
      {k:'navCta',  g:'Identidad', l:'Botón de la barra',  t:'text'},
      {k:'navLinks',g:'Identidad', l:'Enlaces del menú',   t:'lista', add:'Agregar enlace',
        nuevo:{txt:'Sección', url:'#'},
        item:[{k:'txt',l:'Texto',t:'text'},{k:'url',l:'Destino',t:'text'}]},
    ],
    html:(d,t,a)=>`
<header class="nav"><div class="wrap">
  <a class="marca" href="#"${a.c('marca')}>${esc(d.marca)}</a>
  <nav class="nav-links">${(d.navLinks||[]).map((l,i)=>`<a href="${esc(l.url)}"${a.c(`navLinks.${i}.txt`)}>${esc(l.txt)}</a>`).join('')}</nav>
  <a class="btn" href="${wa(d.whatsapp,'Hola '+d.marca+', vi su página y quiero consultar.')}"${a.c('navCta')}>${esc(d.navCta)}</a>
</div></header>`
  },

  heroSplit: {
    campos:[
      {k:'heroEyebrow',g:'Portada',l:'Bajada corta',t:'text'},
      {k:'heroTitulo', g:'Portada',l:'Titular',t:'textarea'},
      {k:'heroTexto',  g:'Portada',l:'Párrafo de apertura',t:'textarea'},
      {k:'heroCta',    g:'Portada',l:'Botón principal',t:'text'},
      {k:'heroCtaUrl', g:'Portada',l:'Destino del botón',t:'text'},
      {k:'heroImg',    g:'Portada',l:'Imagen de portada',t:'img'},
    ],
    html:(d,t,a)=>`
<section class="hero hero-split"><div class="wrap">
  <div>
    <span class="eyebrow"${a.c('heroEyebrow')}>${esc(d.heroEyebrow)}</span>
    <h1${a.c('heroTitulo')}>${esc(d.heroTitulo)}</h1>
    <p class="lead"${a.c('heroTexto')}>${esc(d.heroTexto)}</p>
    <div class="acciones">
      <a class="btn" href="${esc(d.heroCtaUrl)}"${a.c('heroCta')}>${esc(d.heroCta)}</a>
      <a class="btn alt" href="${wa(d.whatsapp,'Hola '+d.marca+', quiero más información.')}">WhatsApp</a>
    </div>
  </div>
  ${media(d.heroImg,t,0,'',a.im('heroImg'))}
</div></section>`
  },

  heroBanner: {
    campos:'heroSplit',
    html:(d,t,a)=>`
<section class="hero hero-banner">
  <div class="fondo" ${d.heroImg?'':`style="${arte(t,2)}"`}${a.im('heroImg')}>${d.heroImg?`<img src="${esc(d.heroImg)}" alt="">`:''}</div>
  <div class="velo"></div>
  <div class="wrap">
    <span class="eyebrow"${a.c('heroEyebrow')}>${esc(d.heroEyebrow)}</span>
    <h1${a.c('heroTitulo')}>${esc(d.heroTitulo)}</h1>
    <p class="lead"${a.c('heroTexto')}>${esc(d.heroTexto)}</p>
    <div class="acciones">
      <a class="btn" href="${esc(d.heroCtaUrl)}"${a.c('heroCta')}>${esc(d.heroCta)}</a>
      <a class="btn alt" href="${wa(d.whatsapp,'Hola '+d.marca+', quiero más información.')}">Escribir por WhatsApp</a>
    </div>
  </div>
</section>`
  },

  heroTipo: {
    campos:'heroSplit',
    html:(d,t,a)=>`
<section class="hero hero-tipo"><div class="wrap">
  <span class="eyebrow"${a.c('heroEyebrow')}>${esc(d.heroEyebrow)}</span>
  <h1${a.c('heroTitulo')}>${esc(d.heroTitulo)}</h1>
  <p class="lead"${a.c('heroTexto')}>${esc(d.heroTexto)}</p>
  <div class="acciones">
    <a class="btn" href="${esc(d.heroCtaUrl)}"${a.c('heroCta')}>${esc(d.heroCta)}</a>
    <a class="btn alt" href="${wa(d.whatsapp,'Hola '+d.marca+', quiero más información.')}">WhatsApp</a>
  </div>
  <div class="regla"></div>
</div></section>`
  },

  tiras: {
    campos:[
      {k:'tiras',g:'Datos en cifras',l:'Cifras',t:'lista',add:'Agregar cifra',
        nuevo:{valor:'100+',etiqueta:'Dato'},
        item:[{k:'valor',l:'Cifra',t:'text'},{k:'etiqueta',l:'Qué mide',t:'text'}]},
    ],
    html:(d,t,a)=> !(d.tiras||[]).length ? '' : `
<div class="tiras"><div class="wrap">
  ${d.tiras.map((x,i)=>`<div class="tira"${a.it(`tiras.${i}`)}>
    <b${a.c(`tiras.${i}.valor`)}>${esc(x.valor)}</b>
    <span${a.c(`tiras.${i}.etiqueta`)}>${esc(x.etiqueta)}</span>
  </div>`).join('')}
</div></div>`
  },

  cards: {
    campos:[
      {k:'cardsTitulo',g:'Catálogo',l:'Título de la sección',t:'text'},
      {k:'cardsIntro', g:'Catálogo',l:'Bajada',t:'textarea'},
      {k:'cards',      g:'Catálogo',l:'Ítems',t:'lista',add:'Agregar ítem',
        nuevo:{titulo:'Ítem nuevo',meta:'',texto:'',img:''},
        item:[{k:'titulo',l:'Título',t:'text'},{k:'meta',l:'Dato destacado (precio, medida, duración)',t:'text'},
              {k:'texto',l:'Descripción',t:'textarea'},{k:'img',l:'Imagen',t:'img'}]},

      {k:'_notionDb',   g:'Catálogo desde Notion', l:'ID de la base de Notion', t:'text',
        pista:'Está en la URL de la base: notion.so/…/<32 caracteres>?v=…'},
      {k:'_notionVivo', g:'Catálogo desde Notion', l:'Leer Notion cada vez que alguien abre la página', t:'check',
        pista:'Apagado: los productos quedan escritos en el HTML y la página no depende de nada.'},
      {k:'_moneda',     g:'Catálogo desde Notion', l:'Prefijo del precio', t:'text',
        pista:'Se usa sólo si en Notion el precio es un número. Si lo escribís como texto, se respeta tal cual.'},
      {k:'_apiBase',    g:'Catálogo desde Notion', l:'Dirección de la API', t:'text',
        pista:'El despliegue de Vercel que guarda las claves de Notion y publica las demos.'},
      {k:'_importar',   g:'Catálogo desde Notion', l:'', t:'accion',
        texto:'Importar productos ahora', accion:'importarNotion',
        pista:'Trae los productos de Notion y reemplaza la lista de arriba.'},
    ],
    html:(d,t,a)=>`
<section class="sec" id="catalogo"><div class="wrap">
  <div class="sec-h"><h2${a.c('cardsTitulo')}>${esc(d.cardsTitulo)}</h2>${d.cardsIntro?`<p${a.c('cardsIntro')}>${esc(d.cardsIntro)}</p>`:''}</div>
  <div class="rejilla ${esc(d._cardStyle||'grid')}" data-catalogo>
    ${(d.cards||[]).map((c,i)=>`
    <article class="tarj"${a.it(`cards.${i}`)}>
      ${media(c.img,t,i+1,'',a.im(`cards.${i}.img`))}
      <div class="cuerpo">
        <h3${a.c(`cards.${i}.titulo`)}>${esc(c.titulo)}</h3>
        ${c.meta?`<div class="meta"${a.c(`cards.${i}.meta`)}>${esc(c.meta)}</div>`:''}
        ${c.texto?`<p${a.c(`cards.${i}.texto`)}>${esc(c.texto)}</p>`:''}
      </div>
    </article>`).join('')}
  </div>
</div></section>`
  },

  precios: {
    campos:[
      {k:'preciosTitulo',g:'Lista de precios',l:'Título de la sección',t:'text'},
      {k:'preciosIntro', g:'Lista de precios',l:'Bajada',t:'textarea'},
      {k:'precios',      g:'Lista de precios',l:'Renglones',t:'lista',add:'Agregar renglón',
        nuevo:{seccion:'General',nombre:'Nuevo',detalle:'',precio:'Gs. 0'},
        item:[{k:'seccion',l:'Grupo (agrupa los renglones)',t:'text'},{k:'nombre',l:'Nombre',t:'text'},
              {k:'detalle',l:'Detalle',t:'text'},{k:'precio',l:'Precio',t:'text'}]},
    ],
    html:(d,t,a)=>{
      const g = {};
      (d.precios||[]).forEach((r,i)=>{ (g[r.seccion||''] ||= []).push({...r, _i:i}); });
      return `
<section class="sec" id="precios"><div class="wrap">
  <div class="sec-h"><h2${a.c('preciosTitulo')}>${esc(d.preciosTitulo)}</h2>${d.preciosIntro?`<p${a.c('preciosIntro')}>${esc(d.preciosIntro)}</p>`:''}</div>
  <div class="precios">
    ${Object.entries(g).map(([sec,rows])=>`
    <div class="bloque">
      ${sec?`<h3${a.c(`precios.${rows[0]._i}.seccion`)}>${esc(sec)}</h3>`:''}
      ${rows.map(r=>`<div class="fila"${a.it(`precios.${r._i}`)}>
        <span class="nom"${a.c(`precios.${r._i}.nombre`)}>${esc(r.nombre)}</span>
        <span class="det"${a.c(`precios.${r._i}.detalle`)}>${esc(r.detalle)}</span>
        <span class="pre"${a.c(`precios.${r._i}.precio`)}>${esc(r.precio)}</span>
      </div>`).join('')}
    </div>`).join('')}
  </div>
</div></section>`;
    }
  },

  pasos: {
    campos:[
      {k:'pasosTitulo',g:'Cómo trabajamos',l:'Título de la sección',t:'text'},
      {k:'pasos',      g:'Cómo trabajamos',l:'Pasos (en orden)',t:'lista',add:'Agregar paso',
        nuevo:{titulo:'Paso nuevo',texto:''},
        item:[{k:'titulo',l:'Título del paso',t:'text'},{k:'texto',l:'Qué pasa acá',t:'textarea'}]},
    ],
    html:(d,t,a)=>`
<section class="sec"><div class="wrap">
  <div class="sec-h"><h2${a.c('pasosTitulo')}>${esc(d.pasosTitulo)}</h2></div>
  <div class="pasos">
    ${(d.pasos||[]).map((p,i)=>`<div class="paso"${a.it(`pasos.${i}`)}>
      <h3${a.c(`pasos.${i}.titulo`)}>${esc(p.titulo)}</h3>
      <p${a.c(`pasos.${i}.texto`)}>${esc(p.texto)}</p>
    </div>`).join('')}
  </div>
</div></section>`
  },

  texto: {
    campos:[
      {k:'textoTitulo',g:'Sobre el negocio',l:'Título',t:'text'},
      {k:'textoCuerpo',g:'Sobre el negocio',l:'Texto (una línea en blanco separa párrafos)',t:'textarea'},
      {k:'textoImg',   g:'Sobre el negocio',l:'Imagen',t:'img'},
    ],
    html:(d,t,a)=>`
<section class="sec dueto" id="nosotros"><div class="wrap">
  ${media(d.textoImg,t,5,'',a.im('textoImg'))}
  <div>
    <h2${a.c('textoTitulo')}>${esc(d.textoTitulo)}</h2>
    <div class="texto"${a.p('textoCuerpo')}>${parrafos(d.textoCuerpo)}</div>
  </div>
</div></section>`
  },

  faq: {
    campos:[
      {k:'faqTitulo',g:'Preguntas',l:'Título de la sección',t:'text'},
      {k:'faq',      g:'Preguntas',l:'Preguntas',t:'lista',add:'Agregar pregunta',
        nuevo:{p:'¿Pregunta?',r:'Respuesta.'},
        item:[{k:'p',l:'Pregunta',t:'text'},{k:'r',l:'Respuesta',t:'textarea'}]},
    ],
    html:(d,t,a)=>`
<section class="sec" id="preguntas"><div class="wrap">
  <div class="sec-h"><h2${a.c('faqTitulo')}>${esc(d.faqTitulo)}</h2></div>
  <div class="faq">
    ${(d.faq||[]).map((f,i)=>`<details${i===0?' open':''}${a.it(`faq.${i}`)}>
      <summary><span${a.c(`faq.${i}.p`)}>${esc(f.p)}</span></summary>
      <div class="r"${a.p(`faq.${i}.r`)}>${parrafos(f.r)}</div>
    </details>`).join('')}
  </div>
</div></section>`
  },

  testimonios: {
    campos:[
      {k:'testiTitulo',g:'Testimonios',l:'Título de la sección',t:'text'},
      {k:'testimonios',g:'Testimonios',l:'Comentarios',t:'lista',add:'Agregar comentario',
        nuevo:{texto:'',autor:''},
        item:[{k:'texto',l:'Comentario',t:'textarea'},{k:'autor',l:'Quién lo dice',t:'text'}]},
    ],
    html:(d,t,a)=>`
<section class="sec"><div class="wrap">
  <div class="sec-h"><h2${a.c('testiTitulo')}>${esc(d.testiTitulo)}</h2></div>
  <div class="citas">
    ${(d.testimonios||[]).map((c,i)=>`<blockquote class="cita"${a.it(`testimonios.${i}`)}>
      <p${a.c(`testimonios.${i}.texto`)}>${esc(c.texto)}</p>
      <b${a.c(`testimonios.${i}.autor`)}>${esc(c.autor)}</b>
    </blockquote>`).join('')}
  </div>
</div></section>`
  },

  contacto: {
    campos:[
      {k:'contactoTitulo',g:'Contacto',l:'Título',t:'text'},
      {k:'contactoTexto', g:'Contacto',l:'Bajada',t:'textarea'},
      {k:'whatsapp', g:'Contacto',l:'WhatsApp (ej. 0981 123 456)',t:'text'},
      {k:'telefono', g:'Contacto',l:'Teléfono fijo',t:'text'},
      {k:'direccion',g:'Contacto',l:'Dirección',t:'text'},
      {k:'ciudad',   g:'Contacto',l:'Ciudad',t:'text'},
      {k:'horario',  g:'Contacto',l:'Horario',t:'text'},
      {k:'instagram',g:'Contacto',l:'Instagram (usuario)',t:'text'},
      {k:'email',    g:'Contacto',l:'Correo',t:'text'},
      {k:'mapaUrl',  g:'Contacto',l:'Enlace a Google Maps',t:'text'},
      {k:'pago',     g:'Contacto',l:'Formas de pago',t:'text'},
    ],
    html:(d,t,a)=>{
      const fila = (et,val,href,ruta) => !val ? '' :
        `<div class="dato"><b>${esc(et)}</b><span>${href
          ? `<a href="${esc(href)}"${ruta?a.c(ruta):''}>${esc(val)}</a>`
          : `<span${ruta?a.c(ruta):''}>${esc(val)}</span>`}</span></div>`;
      return `
<section class="sec contacto" id="contacto"><div class="wrap">
  <div>
    <div class="sec-h"><h2${a.c('contactoTitulo')}>${esc(d.contactoTitulo)}</h2>${d.contactoTexto?`<p${a.c('contactoTexto')}>${esc(d.contactoTexto)}</p>`:''}</div>
    <div class="datos">
      ${fila('WhatsApp', d.whatsapp, wa(d.whatsapp,'Hola '+d.marca+', quiero hacer una consulta.'), 'whatsapp')}
      ${fila('Teléfono', d.telefono, tel(d.telefono), 'telefono')}
      ${fila('Dirección', [d.direccion,d.ciudad].filter(Boolean).join(', '), d.mapaUrl||'')}
      ${fila('Horario', d.horario, '', 'horario')}
      ${fila('Instagram', d.instagram?('@'+String(d.instagram).replace(/^@/,'')):'', ig(d.instagram))}
      ${fila('Correo', d.email, d.email?('mailto:'+d.email):'', 'email')}
      ${fila('Pagos', d.pago, '', 'pago')}
    </div>
    <div class="acciones">
      <a class="btn" href="${wa(d.whatsapp,'Hola '+d.marca+', quiero hacer una consulta.')}">Escribir por WhatsApp</a>
      ${d.mapaUrl?`<a class="btn alt" href="${esc(d.mapaUrl)}">Cómo llegar</a>`:''}
    </div>
  </div>
  <div class="mapa arte" style="${arte(t,7)}"></div>
</div></section>`;
    }
  },

  pie: {
    campos:[],
    html:(d,t,a)=>`
<footer class="pie"><div class="wrap">
  <span class="marca"${a.c('marca')}>${esc(d.marca)}</span>
  <span>© ${new Date().getFullYear()} ${esc(d.marca)}${d.ciudad?' · '+esc(d.ciudad)+', Paraguay':' · Paraguay'}</span>
  ${d.instagram?`<a href="${ig(d.instagram)}">Instagram</a>`:''}
  <a href="${wa(d.whatsapp,'Hola '+d.marca)}">WhatsApp</a>
</div></footer>`
  },
};

/* campos de estilo, comunes a todos los rubros */
const CAMPOS_ESTILO = [
  {k:'_accent',g:'Estilo',l:'Color de acento',t:'color'},
  {k:'_bg',    g:'Estilo',l:'Fondo',t:'color'},
  {k:'_fg',    g:'Estilo',l:'Texto',t:'color'},
  {k:'_font',  g:'Estilo',l:'Tipografía',t:'select',
    opts:Object.entries(FUENTES).map(([v,f])=>({v,l:f.l}))},
  {k:'_escala',g:'Estilo',l:'Tamaño del texto',t:'rango',min:0.85,max:1.3,paso:0.05,vivo:'--esc',
    formato:v=>Math.round(v*100)+'%'},
  {k:'_radio', g:'Estilo',l:'Redondeo de esquinas',t:'rango',min:0,max:28,paso:1,vivo:'--rad',unidad:'px',
    formato:v=>Math.round(v)+' px'},
  {k:'_aire',  g:'Estilo',l:'Aire entre secciones',t:'rango',min:0.6,max:1.5,paso:0.05,vivo:'--aire',
    formato:v=>Math.round(v*100)+'%'},
  {k:'_cardStyle',g:'Estilo',l:'Disposición del catálogo',t:'select',
    opts:[{v:'grid',l:'Cuadrícula'},{v:'compacto',l:'Cuadrícula compacta'},{v:'ancho',l:'Filas anchas'}]},
];

/* valores de estilo que todo rubro hereda si no los define */
const ESTILO_POR_DEFECTO = {
  _escala:1, _radio:14, _aire:1,
  _notionDb:'', _notionVivo:false, _moneda:'Gs.',
  _apiBase:'https://tiendita-ebon-one.vercel.app',
};

/* reúne los campos de un rubro a partir de sus secciones */
function camposDe(tpl){
  const out = [], vistos = new Set();
  tpl.secciones.forEach(nombre => {
    let s = SEC[nombre]; if(!s) return;
    let cs = s.campos;
    if(typeof cs === 'string') cs = SEC[cs].campos;
    (cs||[]).forEach(c => { if(!vistos.has(c.k)){ vistos.add(c.k); out.push(c); } });
  });
  CAMPOS_ESTILO.forEach(c => { if(!vistos.has(c.k)){ vistos.add(c.k); out.push(c); } });
  return out;
}

/* ---------- capa de edición: sólo va en la vista previa ---------- */
function capaEditorCss(){ return `
[data-campo],[data-campo-img]{outline-offset:3px}
[data-campo]{cursor:text}
[data-campo-img]{cursor:pointer}
[data-campo]:hover,[data-campo-img]:hover{outline:2px dashed #2563EB}
[data-item]:hover{outline:1px dashed rgba(37,99,235,.45);outline-offset:7px}
.tp-sel,.tp-sel:hover{outline:2px solid #2563EB !important;box-shadow:0 0 0 4px rgba(37,99,235,.20)}
[data-campo][contenteditable="true"]{outline:2px solid #2563EB;box-shadow:0 0 0 4px rgba(37,99,235,.20)}
[data-campo][contenteditable="true"]:empty::before{content:attr(data-vacio);opacity:.45}
`; }

/* ---------- catálogo leído de Notion en cada visita ----------
   Los productos que ya están escritos en el HTML quedan como respaldo:
   si Notion tarda o falla, la página igual muestra algo. */
function guionCatalogo(d){
  if(!(d._notionVivo && d._notionDb)) return '';
  const api = String(d._apiBase || '').replace(/\/+$/,'');
  if(!api) return '';
  const url = api + '/api/catalogo?db=' + encodeURIComponent(String(d._notionDb).replace(/-/g,''))
            + '&moneda=' + encodeURIComponent(d._moneda || '');
  return `
<script>
(function(){
  var cont = document.querySelector('[data-catalogo]');
  if(!cont || !window.fetch) return;
  function e(s){ return String(s == null ? '' : s).replace(/[&<>"]/g, function(c){
    return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c];
  }); }
  function tarjeta(p){
    var medio = p.img ? '<img src="' + e(p.img) + '" alt="" loading="lazy">'
                      : '<div class="arte arte-auto"></div>';
    return '<article class="tarj">' + medio + '<div class="cuerpo">'
      + '<h3>' + e(p.titulo) + '</h3>'
      + (p.meta  ? '<div class="meta">' + e(p.meta) + '</div>' : '')
      + (p.texto ? '<p>' + e(p.texto) + '</p>' : '')
      + '</div></article>';
  }
  fetch(${JSON.stringify(url)}, { headers: { Accept: 'application/json' } })
    .then(function(r){ return r.ok ? r.json() : null; })
    .then(function(d){
      if(!d || !d.productos || !d.productos.length) return;  // se queda el respaldo
      cont.innerHTML = d.productos.map(tarjeta).join('');
    })
    .catch(function(){});
})();
<\/script>`;
}

/* documento final: HTML autónomo, listo para subir a cualquier hosting */
function renderDoc(tpl, d, editable){
  const t = tema(d);
  const a = marcas(!!editable);
  const cuerpo = tpl.secciones.map(n => SEC[n] ? SEC[n].html(d,t,a) : '').join('\n');
  const titulo = [d.marca, tpl.rubro].filter(Boolean).join(' — ');
  const desc = (d.heroTexto || d.contactoTexto || '').slice(0,155);
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(titulo)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:title" content="${esc(titulo)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="website">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${t.url}">
<style>${kitCss(t)}${editable ? capaEditorCss() : ''}</style>
</head>
<body>
${cuerpo}
${guionCatalogo(d)}
</body>
</html>`;
}

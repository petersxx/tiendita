/* =========================================================
   SECCIONES — cada una declara sus campos y su HTML.
   Un rubro es una lista de secciones + contenido propio.
   ========================================================= */
const ANCLAS = { cards:'#catalogo', precios:'#precios', texto:'#nosotros', faq:'#preguntas', contacto:'#contacto' };

const SEC = {
  nav: {
    campos:[
      {k:'marca',   g:'Identidad', l:'Nombre del negocio', t:'text'},
      {k:'navCta',  g:'Identidad', l:'Botón de la barra',  t:'text'},
      {k:'navLinks',g:'Identidad', l:'Enlaces del menú',   t:'lista', add:'Agregar enlace',
        nuevo:{txt:'Sección', url:'#'},
        item:[{k:'txt',l:'Texto',t:'text'},{k:'url',l:'Destino',t:'text'}]},
    ],
    html:(d,t)=>`
<header class="nav"><div class="wrap">
  <a class="marca" href="#">${esc(d.marca)}</a>
  <nav class="nav-links">${(d.navLinks||[]).map(l=>`<a href="${esc(l.url)}">${esc(l.txt)}</a>`).join('')}</nav>
  <a class="btn" href="${wa(d.whatsapp,'Hola '+d.marca+', vi su página y quiero consultar.')}">${esc(d.navCta)}</a>
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
    html:(d,t)=>`
<section class="hero hero-split"><div class="wrap">
  <div>
    <span class="eyebrow">${esc(d.heroEyebrow)}</span>
    <h1>${esc(d.heroTitulo)}</h1>
    <p class="lead">${esc(d.heroTexto)}</p>
    <div class="acciones">
      <a class="btn" href="${esc(d.heroCtaUrl)}">${esc(d.heroCta)}</a>
      <a class="btn alt" href="${wa(d.whatsapp,'Hola '+d.marca+', quiero más información.')}">WhatsApp</a>
    </div>
  </div>
  ${media(d.heroImg,t,0,'')}
</div></section>`
  },

  heroBanner: {
    campos:'heroSplit',
    html:(d,t)=>`
<section class="hero hero-banner">
  <div class="fondo" ${d.heroImg?'':`style="${arte(t,2)}"`}>${d.heroImg?`<img src="${esc(d.heroImg)}" alt="">`:''}</div>
  <div class="velo"></div>
  <div class="wrap">
    <span class="eyebrow">${esc(d.heroEyebrow)}</span>
    <h1>${esc(d.heroTitulo)}</h1>
    <p class="lead">${esc(d.heroTexto)}</p>
    <div class="acciones">
      <a class="btn" href="${esc(d.heroCtaUrl)}">${esc(d.heroCta)}</a>
      <a class="btn alt" href="${wa(d.whatsapp,'Hola '+d.marca+', quiero más información.')}">Escribir por WhatsApp</a>
    </div>
  </div>
</section>`
  },

  heroTipo: {
    campos:'heroSplit',
    html:(d,t)=>`
<section class="hero hero-tipo"><div class="wrap">
  <span class="eyebrow">${esc(d.heroEyebrow)}</span>
  <h1>${esc(d.heroTitulo)}</h1>
  <p class="lead">${esc(d.heroTexto)}</p>
  <div class="acciones">
    <a class="btn" href="${esc(d.heroCtaUrl)}">${esc(d.heroCta)}</a>
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
    html:(d,t)=> !(d.tiras||[]).length ? '' : `
<div class="tiras"><div class="wrap">
  ${d.tiras.map(x=>`<div class="tira"><b>${esc(x.valor)}</b><span>${esc(x.etiqueta)}</span></div>`).join('')}
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
    ],
    html:(d,t)=>`
<section class="sec" id="catalogo"><div class="wrap">
  <div class="sec-h"><h2>${esc(d.cardsTitulo)}</h2>${d.cardsIntro?`<p>${esc(d.cardsIntro)}</p>`:''}</div>
  <div class="rejilla ${esc(d._cardStyle||'grid')}">
    ${(d.cards||[]).map((c,i)=>`
    <article class="tarj">
      ${media(c.img,t,i+1,'')}
      <div class="cuerpo">
        <h3>${esc(c.titulo)}</h3>
        ${c.meta?`<div class="meta">${esc(c.meta)}</div>`:''}
        ${c.texto?`<p>${esc(c.texto)}</p>`:''}
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
    html:(d,t)=>{
      const g = {}; (d.precios||[]).forEach(r=>{ (g[r.seccion||''] ||= []).push(r); });
      return `
<section class="sec" id="precios"><div class="wrap">
  <div class="sec-h"><h2>${esc(d.preciosTitulo)}</h2>${d.preciosIntro?`<p>${esc(d.preciosIntro)}</p>`:''}</div>
  <div class="precios">
    ${Object.entries(g).map(([sec,rows])=>`
    <div class="bloque">
      ${sec?`<h3>${esc(sec)}</h3>`:''}
      ${rows.map(r=>`<div class="fila">
        <span class="nom">${esc(r.nombre)}</span>
        <span class="det">${esc(r.detalle)}</span>
        <span class="pre">${esc(r.precio)}</span>
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
    html:(d,t)=>`
<section class="sec"><div class="wrap">
  <div class="sec-h"><h2>${esc(d.pasosTitulo)}</h2></div>
  <div class="pasos">
    ${(d.pasos||[]).map(p=>`<div class="paso"><h3>${esc(p.titulo)}</h3><p>${esc(p.texto)}</p></div>`).join('')}
  </div>
</div></section>`
  },

  texto: {
    campos:[
      {k:'textoTitulo',g:'Sobre el negocio',l:'Título',t:'text'},
      {k:'textoCuerpo',g:'Sobre el negocio',l:'Texto (una línea en blanco separa párrafos)',t:'textarea'},
      {k:'textoImg',   g:'Sobre el negocio',l:'Imagen',t:'img'},
    ],
    html:(d,t)=>`
<section class="sec dueto" id="nosotros"><div class="wrap">
  ${media(d.textoImg,t,5,'')}
  <div><h2>${esc(d.textoTitulo)}</h2><div class="texto">${parrafos(d.textoCuerpo)}</div></div>
</div></section>`
  },

  faq: {
    campos:[
      {k:'faqTitulo',g:'Preguntas',l:'Título de la sección',t:'text'},
      {k:'faq',      g:'Preguntas',l:'Preguntas',t:'lista',add:'Agregar pregunta',
        nuevo:{p:'¿Pregunta?',r:'Respuesta.'},
        item:[{k:'p',l:'Pregunta',t:'text'},{k:'r',l:'Respuesta',t:'textarea'}]},
    ],
    html:(d,t)=>`
<section class="sec" id="preguntas"><div class="wrap">
  <div class="sec-h"><h2>${esc(d.faqTitulo)}</h2></div>
  <div class="faq">
    ${(d.faq||[]).map((f,i)=>`<details${i===0?' open':''}><summary>${esc(f.p)}</summary><div class="r">${parrafos(f.r)}</div></details>`).join('')}
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
    html:(d,t)=>`
<section class="sec"><div class="wrap">
  <div class="sec-h"><h2>${esc(d.testiTitulo)}</h2></div>
  <div class="citas">
    ${(d.testimonios||[]).map(c=>`<blockquote class="cita"><p>“${esc(c.texto)}”</p><b>${esc(c.autor)}</b></blockquote>`).join('')}
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
    html:(d,t)=>{
      const fila = (et,val,href) => !val ? '' :
        `<div class="dato"><b>${esc(et)}</b><span>${href?`<a href="${esc(href)}">${esc(val)}</a>`:esc(val)}</span></div>`;
      return `
<section class="sec contacto" id="contacto"><div class="wrap">
  <div>
    <div class="sec-h"><h2>${esc(d.contactoTitulo)}</h2>${d.contactoTexto?`<p>${esc(d.contactoTexto)}</p>`:''}</div>
    <div class="datos">
      ${fila('WhatsApp', d.whatsapp, wa(d.whatsapp,'Hola '+d.marca+', quiero hacer una consulta.'))}
      ${fila('Teléfono', d.telefono, tel(d.telefono))}
      ${fila('Dirección', [d.direccion,d.ciudad].filter(Boolean).join(', '), d.mapaUrl||'')}
      ${fila('Horario', d.horario)}
      ${fila('Instagram', d.instagram?('@'+String(d.instagram).replace(/^@/,'')):'', ig(d.instagram))}
      ${fila('Correo', d.email, d.email?('mailto:'+d.email):'')}
      ${fila('Pagos', d.pago)}
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
    html:(d,t)=>`
<footer class="pie"><div class="wrap">
  <span class="marca">${esc(d.marca)}</span>
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
  {k:'_cardStyle',g:'Estilo',l:'Disposición del catálogo',t:'select',
    opts:[{v:'grid',l:'Cuadrícula'},{v:'compacto',l:'Cuadrícula compacta'},{v:'ancho',l:'Filas anchas'}]},
];

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

/* documento final: HTML autónomo, listo para subir a cualquier hosting */
function renderDoc(tpl, d){
  const t = tema(d);
  const cuerpo = tpl.secciones.map(n => SEC[n] ? SEC[n].html(d,t) : '').join('\n');
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
<style>${kitCss(t)}</style>
</head>
<body>
${cuerpo}
</body>
</html>`;
}

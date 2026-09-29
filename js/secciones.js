/* =========================================================
   SECCIONES — cada una declara sus campos y su HTML.
   Un rubro es una lista de secciones + contenido propio.

   El tercer argumento `a` marca los nodos editables. En la vista
   previa devuelve atributos (data-campo, data-campo-img, data-item)
   que la capa de edición usa para saber qué toca cada clic; al
   exportar devuelve cadenas vacías, así el HTML sale limpio.
   ========================================================= */
const ANCLAS = { cards:'#catalogo', tienda:'#tienda', precios:'#precios', texto:'#nosotros', faq:'#preguntas', contacto:'#contacto', galeria:'#galeria' };

function marcas(activo){
  const q = s => String(s).replace(/"/g,'&quot;');
  if(!activo){ const nada = ()=> ''; return { on:false, c:nada, p:nada, im:nada, it:nada }; }
  return {
    on: true,                                            // en edición los campos vacíos igual se muestran
    c:  r => ` data-campo="${q(r)}"`,                    // texto de una línea
    p:  r => ` data-campo="${q(r)}" data-multi="1"`,     // texto de varios párrafos
    im: r => ` data-campo-img="${q(r)}"`,                // imagen o fondo generado
    it: r => ` data-item="${q(r)}"`,                     // ítem de una lista repetible
  };
}

const SEC = {
  nav: {
    nombre:'Barra de menú', fija:'arriba',
    nuevo:{ navCta:'Escribinos', navLinks:[{txt:'Contacto',url:'#contacto'}] },
    campos:[
      {k:'marca',   g:'Identidad', l:'Nombre del negocio', t:'text'},
      {k:'navCta',  g:'Identidad', l:'Botón de la barra',  t:'text'},
      {k:'navLinks',g:'Identidad', l:'Enlaces del menú',   t:'lista', add:'Agregar enlace',
        nuevo:{txt:'Sección', url:'#'},
        item:[{k:'txt',l:'Texto',t:'text',enlace:'url'},{k:'url',l:'Destino',t:'text'}]},
    ],
    html:(d,t,a)=>`
<header class="nav"><div class="wrap">
  <a class="marca" href="#"${a.c('marca')}>${esc(d.marca)}</a>
  <nav class="nav-links">${(d.navLinks||[]).map((l,i)=>`<a href="${esc(l.url)}"${a.c(`navLinks.${i}.txt`)}${a.it(`navLinks.${i}`)}>${esc(l.txt)}</a>`).join('')}</nav>
  <a class="btn" href="${wa(d.whatsapp,'Hola '+d.marca+', vi su página y quiero consultar.')}"${a.c('navCta')}>${esc(d.navCta)}</a>
</div></header>`
  },

  heroSplit: {
    nombre:'Portada', familia:'hero', variante:'Imagen al costado',
    nuevo:{ heroEyebrow:'Bienvenidos', heroTitulo:'Un titular que diga qué hacés y para quién',
      heroTexto:'Una o dos oraciones que expliquen por qué elegirte: qué ofrecés, dónde y cómo se compra.',
      heroCta:'Escribinos', heroCtaUrl:'#contacto', heroImg:'' },
    campos:[
      {k:'heroEyebrow',g:'Portada',l:'Bajada corta',t:'text'},
      {k:'heroTitulo', g:'Portada',l:'Titular',t:'textarea'},
      {k:'heroTexto',  g:'Portada',l:'Párrafo de apertura',t:'textarea'},
      {k:'heroCta',    g:'Portada',l:'Botón principal',t:'text',enlace:'heroCtaUrl'},
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
    nombre:'Portada', familia:'hero', variante:'Imagen de fondo',
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
    nombre:'Portada', familia:'hero', variante:'Sólo texto',
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
    nombre:'Datos en cifras',
    nuevo:{ tiras:[{valor:'10 años',etiqueta:'En el rubro'},{valor:'24 h',etiqueta:'Tiempo de respuesta'},{valor:'100%',etiqueta:'Clientes atendidos'}] },
    campos:[
      {k:'tiras',g:'Datos en cifras',l:'Cifras',t:'lista',add:'Agregar cifra',
        nuevo:{valor:'100+',etiqueta:'Dato'},
        item:[{k:'valor',l:'Cifra',t:'text'},{k:'etiqueta',l:'Qué mide',t:'text'}]},
    ],
    html:(d,t,a)=> !(d.tiras||[]).length && !a.on ? '' : `
<div class="tiras"><div class="wrap">
  ${(d.tiras||[]).map((x,i)=>`<div class="tira"${a.it(`tiras.${i}`)}>
    <b${a.c(`tiras.${i}.valor`)}>${esc(x.valor)}</b>
    <span${a.c(`tiras.${i}.etiqueta`)}>${esc(x.etiqueta)}</span>
  </div>`).join('')}
</div></div>`
  },

  cards: {
    nombre:'Catálogo',
    nuevo:{ cardsTitulo:'Lo que ofrecemos', cardsIntro:'',
      cards:[{titulo:'Producto uno',meta:'Gs. 100.000',texto:'Una línea que cuente qué es y para quién.',img:''},
             {titulo:'Producto dos',meta:'Gs. 150.000',texto:'Una línea que cuente qué es y para quién.',img:''},
             {titulo:'Producto tres',meta:'Gs. 200.000',texto:'Una línea que cuente qué es y para quién.',img:''}] },
    variantes:{ campo:'_cardStyle', opts:[{v:'grid',l:'Cuadrícula'},{v:'compacto',l:'Cuadrícula compacta'},{v:'ancho',l:'Filas anchas'}] },
    campos:[
      {k:'cardsTitulo',g:'Catálogo',l:'Título de la sección',t:'text'},
      {k:'cardsIntro', g:'Catálogo',l:'Bajada',t:'textarea'},
      {k:'_cardStyle', g:'Catálogo',l:'Disposición',t:'select',
        opts:[{v:'grid',l:'Cuadrícula'},{v:'compacto',l:'Cuadrícula compacta'},{v:'ancho',l:'Filas anchas'}]},
      {k:'cards',      g:'Catálogo',l:'Ítems',t:'lista',add:'Agregar ítem',
        nuevo:{titulo:'Ítem nuevo',meta:'',texto:'',img:''},
        item:[{k:'titulo',l:'Título',t:'text'},{k:'meta',l:'Dato destacado (precio, medida, duración)',t:'text'},
              {k:'texto',l:'Descripción',t:'textarea'},{k:'img',l:'Imagen',t:'img'}]},
    ],
    html:(d,t,a)=>`
<section class="sec" id="catalogo"><div class="wrap">
  <div class="sec-h"><h2${a.c('cardsTitulo')}>${esc(d.cardsTitulo)}</h2>${d.cardsIntro||a.on?`<p${a.c('cardsIntro')}>${esc(d.cardsIntro)}</p>`:''}</div>
  <div class="rejilla ${esc(d._cardStyle||'grid')}">
    ${(d.cards||[]).map((c,i)=>`
    <article class="tarj"${a.it(`cards.${i}`)}>
      ${media(c.img,t,i+1,'',a.im(`cards.${i}.img`))}
      <div class="cuerpo">
        <h3${a.c(`cards.${i}.titulo`)}>${esc(c.titulo)}</h3>
        ${c.meta||a.on?`<div class="meta"${a.c(`cards.${i}.meta`)}>${esc(c.meta)}</div>`:''}
        ${c.texto||a.on?`<p${a.c(`cards.${i}.texto`)}>${esc(c.texto)}</p>`:''}
      </div>
    </article>`).join('')}
  </div>
</div></section>`
  },

  /* tienda: el catálogo con carrito. El carrito vive en el guion de
     guionTienda(): en edición no se incluye, así cada clic edita. */
  tienda: {
    nombre:'Tienda con carrito',
    nuevo:{ tiendaTitulo:'Tienda', tiendaIntro:'Elegí lo que querés, armá tu pedido y lo confirmamos por WhatsApp.',
      tiendaEnvio:'Gs. 20.000', tiendaGratis:'Gs. 300.000', tiendaPagos:'Efectivo, Transferencia, Tigo Money',
      productos:[{titulo:'Producto uno',precio:'Gs. 100.000',texto:'Una línea que cuente qué es.',categoria:'General',etiqueta:'Nuevo',img:''},
                 {titulo:'Producto dos',precio:'Gs. 150.000',texto:'Una línea que cuente qué es.',categoria:'General',etiqueta:'',img:''},
                 {titulo:'Producto tres',precio:'Gs. 200.000',texto:'Una línea que cuente qué es.',categoria:'General',etiqueta:'',img:''}] },
    campos:[
      {k:'tiendaTitulo',g:'Tienda',l:'Título de la sección',t:'text'},
      {k:'tiendaIntro', g:'Tienda',l:'Bajada',t:'textarea'},
      {k:'productos',   g:'Tienda',l:'Productos',t:'lista',add:'Agregar producto',
        nuevo:{titulo:'Producto nuevo',precio:'Gs. 0',texto:'',categoria:'',etiqueta:'',img:''},
        item:[{k:'titulo',l:'Nombre',t:'text'},{k:'precio',l:'Precio',t:'text',pista:'Sin número (ej. «A consultar») el botón pasa a consultar por WhatsApp.'},
              {k:'texto',l:'Descripción',t:'textarea'},{k:'categoria',l:'Categoría',t:'text',pista:'Con dos o más categorías aparecen los filtros.'},
              {k:'etiqueta',l:'Etiqueta',t:'text',pista:'Nuevo, Oferta… «Agotado» no deja agregarlo al carrito.'},{k:'img',l:'Foto',t:'img'}]},
      {k:'tiendaEnvio', g:'Pedido',l:'Costo de envío',t:'text',pista:'Vacío: sólo retiro en el local.'},
      {k:'tiendaGratis',g:'Pedido',l:'Envío gratis desde',t:'text',pista:'Vacío: el envío siempre se cobra.'},
      {k:'tiendaPagos', g:'Pedido',l:'Formas de pago del pedido',t:'text',pista:'Separadas por coma; salen como opciones en el carrito.'},
      {k:'whatsapp',    g:'Pedido',l:'WhatsApp que recibe los pedidos',t:'text'},
      {k:'_moneda',     g:'Pedido',l:'Moneda de los totales',t:'text',pista:'El prefijo del subtotal y el total del carrito, ej. Gs. o USD.'},
    ],
    html:(d,t,a)=>{
      const prods = d.productos || [];
      const cats = [...new Set(prods.map(p => String(p.categoria||'').trim()).filter(Boolean))];
      return `
<section class="sec" id="tienda"><div class="wrap">
  <div class="sec-h"><h2${a.c('tiendaTitulo')}>${esc(d.tiendaTitulo)}</h2>${d.tiendaIntro||a.on?`<p${a.c('tiendaIntro')}>${esc(d.tiendaIntro)}</p>`:''}</div>
  ${cats.length > 1 ? `<div class="filtros" role="group" aria-label="Filtrar por categoría">
    <button type="button" class="chip on" data-filtro="">Todo</button>${cats.map(c=>`<button type="button" class="chip" data-filtro="${esc(c)}">${esc(c)}</button>`).join('')}
  </div>` : ''}
  <div class="rejilla grid tienda">
    ${prods.map((p,i)=>{
      const agotado = /^agotad/i.test(String(p.etiqueta||'').trim());
      const conPrecio = /\d/.test(p.precio||'');
      return `
    <article class="tarj prod"${a.it(`productos.${i}`)} data-cat="${esc(String(p.categoria||'').trim())}">
      <div class="foto">
        ${media(p.img,t,i+1,'',a.im(`productos.${i}.img`))}
        ${p.etiqueta||a.on?`<span class="etq${agotado?' agot':''}"${a.c(`productos.${i}.etiqueta`)}>${esc(p.etiqueta)}</span>`:''}
      </div>
      <div class="cuerpo">
        ${a.on?`<small class="cat"${a.c(`productos.${i}.categoria`)}>${esc(p.categoria)}</small>`:''}
        <h3${a.c(`productos.${i}.titulo`)}>${esc(p.titulo)}</h3>
        ${p.texto||a.on?`<p${a.c(`productos.${i}.texto`)}>${esc(p.texto)}</p>`:''}
        <div class="compra">
          <span class="meta"${a.c(`productos.${i}.precio`)}>${esc(p.precio)}</span>
          ${agotado ? `<button type="button" class="btn chico" disabled>Agotado</button>`
            : conPrecio ? `<button type="button" class="btn chico" data-agregar="${i}">Agregar</button>`
            : `<a class="btn chico alt" href="${wa(d.whatsapp,'Hola '+d.marca+', quiero consultar por '+p.titulo+'.')}">Consultar</a>`}
        </div>
      </div>
    </article>`;}).join('')}
  </div>
</div></section>`;
    }
  },

  precios: {
    nombre:'Lista de precios',
    nuevo:{ preciosTitulo:'Precios', preciosIntro:'',
      precios:[{seccion:'',nombre:'Servicio uno',detalle:'Qué incluye',precio:'Gs. 100.000'},
               {seccion:'',nombre:'Servicio dos',detalle:'Qué incluye',precio:'Gs. 150.000'},
               {seccion:'',nombre:'Servicio tres',detalle:'Qué incluye',precio:'Gs. 200.000'}] },
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
  <div class="sec-h"><h2${a.c('preciosTitulo')}>${esc(d.preciosTitulo)}</h2>${d.preciosIntro||a.on?`<p${a.c('preciosIntro')}>${esc(d.preciosIntro)}</p>`:''}</div>
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
    nombre:'Cómo trabajamos',
    nuevo:{ pasosTitulo:'Cómo trabajamos',
      pasos:[{titulo:'Nos escribís',texto:'Por WhatsApp o por teléfono, contanos qué necesitás.'},
             {titulo:'Te pasamos el presupuesto',texto:'En el día, sin compromiso.'},
             {titulo:'Lo hacemos',texto:'En la fecha acordada, con factura a tu RUC.'}] },
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
    nombre:'Sobre el negocio',
    nuevo:{ textoTitulo:'Quiénes somos', textoImg:'',
      textoCuerpo:'Contá la historia del negocio: cuándo empezó, quién está detrás y qué lo hace distinto.\n\nUn segundo párrafo con algo concreto que genere confianza.' },
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
    nombre:'Preguntas frecuentes',
    nuevo:{ faqTitulo:'Preguntas frecuentes',
      faq:[{p:'¿Hacen envíos?',r:'Sí, a todo el país.'},{p:'¿Qué formas de pago aceptan?',r:'Efectivo, transferencia, tarjetas y billeteras.'}] },
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
    nombre:'Testimonios',
    nuevo:{ testiTitulo:'Lo que dicen nuestros clientes',
      testimonios:[{texto:'Muy buena atención y cumplieron con lo que prometieron.',autor:'Cliente, Asunción'},
                   {texto:'Rápidos y prolijos. Los vuelvo a llamar.',autor:'Cliente, Luque'}] },
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
    nombre:'Contacto',
    nuevo:{ contactoTitulo:'Contacto', contactoTexto:'Escribinos y te respondemos en el día.',
      whatsapp:'', telefono:'', direccion:'', ciudad:'', horario:'', instagram:'', email:'', mapaUrl:'', pago:'' },
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
    <div class="sec-h"><h2${a.c('contactoTitulo')}>${esc(d.contactoTitulo)}</h2>${d.contactoTexto||a.on?`<p${a.c('contactoTexto')}>${esc(d.contactoTexto)}</p>`:''}</div>
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
    nombre:'Pie de página', fija:'abajo',
    campos:[],
    html:(d,t,a)=>`
<footer class="pie"><div class="wrap">
  <span class="marca"${a.c('marca')}>${esc(d.marca)}</span>
  <span>© ${new Date().getFullYear()} ${esc(d.marca)}${d.ciudad?' · '+esc(d.ciudad)+', Paraguay':' · Paraguay'}</span>
  ${d.instagram?`<a href="${ig(d.instagram)}">Instagram</a>`:''}
  <a href="${wa(d.whatsapp,'Hola '+d.marca)}">WhatsApp</a>
</div></footer>`
  },

  galeria: {
    nombre:'Galería de fotos',
    nuevo:{ galeriaTitulo:'Galería', galeria:[1,2,3,4,5,6].map(()=>({img:'',pie:''})) },
    campos:[
      {k:'galeriaTitulo',g:'Galería',l:'Título de la sección',t:'text'},
      {k:'galeria',      g:'Galería',l:'Fotos',t:'lista',add:'Agregar foto',
        nuevo:{img:'',pie:''},
        item:[{k:'pie',l:'Epígrafe (opcional)',t:'text'},{k:'img',l:'Foto',t:'img'}]},
    ],
    html:(d,t,a)=>`
<section class="sec" id="galeria"><div class="wrap">
  <div class="sec-h"><h2${a.c('galeriaTitulo')}>${esc(d.galeriaTitulo)}</h2></div>
  <div class="galeria">
    ${(d.galeria||[]).map((g,i)=>`<figure${a.it(`galeria.${i}`)}>
      ${media(g.img,t,i+2,'',a.im(`galeria.${i}.img`))}
      ${g.pie||a.on?`<figcaption${a.c(`galeria.${i}.pie`)}>${esc(g.pie)}</figcaption>`:''}
    </figure>`).join('')}
  </div>
</div></section>`
  },
};

/* secciones que se pueden agregar, una por familia (las portadas son variantes de una) */
const FAMILIA = n => (SEC[n] && SEC[n].familia) || n;
const CATALOGO_SECCIONES = ['nav','heroSplit','tiras','cards','tienda','galeria','precios','pasos','texto','testimonios','faq','contacto','pie'];
const VARIANTES_PORTADA = ['heroSplit','heroBanner','heroTipo'];

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
];

/* valores de estilo que todo rubro hereda si no los define */
const ESTILO_POR_DEFECTO = {
  _escala:1, _radio:14, _aire:1,
  _moneda:'Gs.',
  _apiBase:'https://tiendita.maintechnologies.dev',
};

/* los campos que declara una sección */
function camposSeccion(nombre){
  const s = SEC[nombre]; if(!s) return [];
  return (typeof s.campos === 'string' ? SEC[s.campos].campos : s.campos) || [];
}

/* reúne los campos de una lista de secciones, más los de estilo */
function camposDe(secciones){
  const out = [], vistos = new Set();
  secciones.forEach(nombre => camposSeccion(nombre).forEach(c => {
    if(!vistos.has(c.k)){ vistos.add(c.k); out.push(c); }
  }));
  CAMPOS_ESTILO.forEach(c => { if(!vistos.has(c.k)){ vistos.add(c.k); out.push(c); } });
  return out;
}

/* las secciones de esta página: las que eligió el usuario o las del rubro */
const seccionesDe = (tpl, d) => d._secciones || tpl.secciones;

/* ---------- capa de edición: sólo va en la vista previa ---------- */
function capaEditorCss(){ return `
[data-campo],[data-campo-img]{outline-offset:3px}
[data-campo]{cursor:text}
[data-campo-img]{cursor:pointer}
[data-campo]:hover,[data-campo-img]:hover{outline:2px dashed #2563EB}
[data-item]:hover{outline:1px dashed rgba(37,99,235,.45);outline-offset:7px}
.tp-sel,.tp-sel:hover{outline:2px solid #2563EB !important;box-shadow:0 0 0 4px rgba(37,99,235,.20)}
[data-campo][contenteditable="true"]{outline:2px solid #2563EB;box-shadow:0 0 0 4px rgba(37,99,235,.20)}
[data-campo]:empty::before{content:attr(data-vacio);opacity:.4;font-style:italic}
[data-campo]:empty{display:inline-block;min-width:4em}
[data-sec]{position:relative}
[data-sec].sec-hover::after{content:"";position:absolute;inset:0;pointer-events:none;
  outline:2px solid rgba(37,99,235,.55);outline-offset:-2px;z-index:30}
[data-item][data-arrastrando],[data-sec][data-arrastrando]{opacity:.35}
.tp-soltar{outline:3px solid #16A34A !important;outline-offset:-3px}
`; }

/* ---------- carrito de la tienda ----------
   Arma el pedido en el navegador del visitante y lo manda por WhatsApp.
   No hay pasarela de pago: el negocio confirma el pedido y cobra como
   ya cobra. El carrito queda en localStorage para no perderlo al recargar.
   En una tienda de la plataforma (d._pedidos) el pedido además se registra
   en el panel del negocio; el servidor recalcula precios y totales. */
const numeroPrecio = s => { const n = String(s||'').replace(/\D/g,''); return n ? Number(n) : 0; };

function guionTienda(d){
  const n = String(d.whatsapp||'').replace(/\D/g,'');
  const datos = {
    marca: d.marca || '',
    wa: n ? (n.startsWith('595') ? n : '595' + n.replace(/^0+/,'')) : '',
    moneda: d._moneda || 'Gs.',
    envio: String(d.tiendaEnvio||'').trim() ? numeroPrecio(d.tiendaEnvio) : null,
    gratis: numeroPrecio(d.tiendaGratis),
    pagos: String(d.tiendaPagos||'').split(',').map(s=>s.trim()).filter(Boolean),
    productos: (d.productos||[]).map(p => ({ t: p.titulo||'', p: numeroPrecio(p.precio), id: p._nid||'' })),
    api: d._pedidos || '',
    tienda: d._slug || '',
  };
  const json = JSON.stringify(datos).replace(/</g,'\\u003c');
  return `
<button type="button" class="carro-btn" hidden aria-label="Ver carrito">
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 7h12l-1 13H7L6 7z"/><path d="M9 7a3 3 0 0 1 6 0"/></svg>
  <span>Carrito</span><b class="carro-n">0</b>
</button>
<div class="carro-velo" hidden></div>
<aside class="carro" hidden aria-label="Carrito">
  <div class="carro-h"><h3>Tu pedido</h3><button type="button" class="carro-x" aria-label="Cerrar">✕</button></div>
  <div class="carro-lineas"></div>
  <form class="carro-form">
    <div class="carro-tot"></div>
    <label>Nombre<input name="nombre" required autocomplete="name" maxlength="120"></label>
    <label>Teléfono<input name="telefono" type="tel" autocomplete="tel" maxlength="30" placeholder="0981 123 456"></label>
    <label class="carro-entrega">Entrega<select name="entrega"><option>Envío a domicilio</option><option>Retiro en el local</option></select></label>
    <label class="carro-dir">Dirección<input name="direccion" autocomplete="street-address"></label>
    <label class="carro-pago">Pago<select name="pago"></select></label>
    <label>Notas<textarea name="notas" rows="2" maxlength="500" placeholder="Talle, color, horario de entrega…"></textarea></label>
    <input name="web" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px">
    <button type="submit" class="btn">Enviar pedido por WhatsApp</button>
    <button type="button" class="carro-vaciar">Vaciar carrito</button>
  </form>
</aside>
<div class="carro-aviso" role="status" aria-live="polite"></div>
<script>
(function(){
  var D = ${json};
  // en la plataforma todas las tiendas comparten dominio: la dirección las distingue
  var CLAVE = 'carrito:' + (D.tienda || D.marca), items = {};
  var $ = function(s){ return document.querySelector(s); };
  function e(s){ return String(s == null ? '' : s).replace(/[&<>"]/g, function(c){
    return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]; }); }
  function plata(n){ return D.moneda + ' ' + String(n).replace(/\\B(?=(\\d{3})+(?!\\d))/g, '.'); }
  try{ items = JSON.parse(localStorage.getItem(CLAVE)) || {}; }catch(_){}
  // si el catálogo cambió, se descarta lo que ya no coincide
  Object.keys(items).forEach(function(i){
    var p = D.productos[i];
    if(!p || p.t !== items[i].t || !p.p) delete items[i];
  });

  var btn = $('.carro-btn'), velo = $('.carro-velo'), panel = $('.carro'), form = $('.carro-form');
  form.pago.innerHTML = D.pagos.map(function(p){ return '<option>' + e(p) + '</option>'; }).join('');
  $('.carro-pago').hidden = !D.pagos.length;
  if(D.envio === null){ $('.carro-entrega').hidden = true; form.entrega.value = 'Retiro en el local'; }

  function guardar(){ try{ localStorage.setItem(CLAVE, JSON.stringify(items)); }catch(_){} }
  function cuentas(){
    var sub = 0, cant = 0;
    Object.keys(items).forEach(function(i){ sub += D.productos[i].p * items[i].c; cant += items[i].c; });
    var retiro = form.entrega.value === 'Retiro en el local';
    var envio = retiro || D.envio === null ? 0 : (D.gratis && sub >= D.gratis ? 0 : D.envio);
    return { sub:sub, cant:cant, envio:envio, retiro:retiro, total:sub + envio };
  }
  function pintar(){
    var k = cuentas(), ids = Object.keys(items);
    btn.hidden = !k.cant;
    $('.carro-n').textContent = k.cant;
    $('.carro-lineas').innerHTML = ids.length ? ids.map(function(i){
      var p = D.productos[i], c = items[i].c;
      return '<div class="linea"><div><b>' + e(p.t) + '</b><small>' + plata(p.p) + ' c/u</small></div>'
        + '<div class="cant"><button type="button" data-mas="' + i + '" data-d="-1" aria-label="Uno menos">−</button>'
        + '<span>' + c + '</span><button type="button" data-mas="' + i + '" data-d="1" aria-label="Uno más">+</button></div>'
        + '<b class="sub">' + plata(p.p * c) + '</b></div>';
    }).join('') : '<p class="carro-vacio">Todavía no agregaste nada.</p>';
    form.hidden = !ids.length;
    $('.carro-dir').hidden = k.retiro;
    form.direccion.required = !k.retiro;
    var falta = D.gratis && !k.retiro && D.envio && k.sub < D.gratis ? D.gratis - k.sub : 0;
    $('.carro-tot').innerHTML = '<div><span>Subtotal</span><b>' + plata(k.sub) + '</b></div>'
      + (k.retiro ? '' : '<div><span>Envío</span><b>' + (k.envio ? plata(k.envio) : 'Gratis') + '</b></div>')
      + (falta ? '<p>Te faltan ' + plata(falta) + ' para el envío gratis.</p>' : '')
      + '<div class="total"><span>Total</span><b>' + plata(k.total) + '</b></div>';
  }
  var tAviso;
  function aviso(t){
    var a = $('.carro-aviso'); a.textContent = t; a.classList.add('on');
    clearTimeout(tAviso); tAviso = setTimeout(function(){ a.classList.remove('on'); }, 1800);
  }
  function abrir(si){
    panel.hidden = velo.hidden = !si;
    document.body.style.overflow = si ? 'hidden' : '';
    if(si) panel.querySelector('.carro-x').focus();
  }

  document.addEventListener('click', function(ev){
    var t = ev.target.closest ? ev.target : ev.target.parentNode;
    var ag = t.closest('[data-agregar]');
    if(ag){
      var i = ag.dataset.agregar, p = D.productos[i];
      items[i] = { t:p.t, c:(items[i] ? items[i].c : 0) + 1 };
      guardar(); pintar(); aviso('Agregado: ' + p.t);
      btn.classList.remove('salto'); void btn.offsetWidth; btn.classList.add('salto');
      return;
    }
    var mas = t.closest('[data-mas]');
    if(mas){
      var j = mas.dataset.mas;
      items[j].c += Number(mas.dataset.d);
      if(items[j].c < 1) delete items[j];
      guardar(); pintar();
      if(!Object.keys(items).length) abrir(false);
      return;
    }
    var f = t.closest('[data-filtro]');
    if(f){
      document.querySelectorAll('[data-filtro]').forEach(function(b){ b.classList.toggle('on', b === f); });
      document.querySelectorAll('.prod').forEach(function(a){
        a.hidden = !!f.dataset.filtro && a.dataset.cat !== f.dataset.filtro;
      });
    }
  });
  btn.addEventListener('click', function(){ abrir(true); });
  velo.addEventListener('click', function(){ abrir(false); });
  panel.querySelector('.carro-x').addEventListener('click', function(){ abrir(false); });
  document.addEventListener('keydown', function(ev){ if(ev.key === 'Escape' && !panel.hidden) abrir(false); });
  form.entrega.addEventListener('change', pintar);
  $('.carro-vaciar').addEventListener('click', function(){ items = {}; guardar(); pintar(); abrir(false); });

  function mandar(msg, ventana){
    var url = 'https://wa.me/' + D.wa + '?text=' + encodeURIComponent(msg);
    if(ventana){ ventana.location.href = url; } else { window.location.href = url; }
  }
  var enviando = false;
  form.addEventListener('submit', function(ev){
    ev.preventDefault();
    if(enviando) return;
    var k = cuentas(), v = form.elements;
    var renglones = Object.keys(items).map(function(i){
      var p = D.productos[i];
      return '• ' + items[i].c + ' × ' + p.t + ' — ' + plata(p.p * items[i].c);
    });
    var msg = ['Hola ' + D.marca + ', quiero hacer este pedido:', ''].concat(renglones, [
      '',
      'Subtotal: ' + plata(k.sub),
      k.retiro ? 'Retiro en el local' : 'Envío: ' + (k.envio ? plata(k.envio) : 'gratis'),
      'Total: ' + plata(k.total),
      '',
      'Nombre: ' + v.nombre.value.trim(),
      k.retiro ? null : 'Dirección: ' + v.direccion.value.trim(),
      D.pagos.length ? 'Pago: ' + v.pago.value : null,
      v.notas.value.trim() ? 'Notas: ' + v.notas.value.trim() : null,
    ]).filter(function(x){ return x !== null; }).join('\\n');
    if(!D.wa){ aviso('Falta cargar el WhatsApp del negocio'); return; }
    if(!D.api){ window.open('https://wa.me/' + D.wa + '?text=' + encodeURIComponent(msg), '_blank'); return; }

    // la pestaña se abre ya, con el clic; si se abriera después de esperar al servidor, el navegador la bloquea
    var ventana = window.open('', '_blank');
    var enviar = form.querySelector('[type=submit]');
    enviando = true; enviar.disabled = true; enviar.textContent = 'Enviando…';
    var ctrl = window.AbortController ? new AbortController() : null;
    var corte = setTimeout(function(){ if(ctrl) ctrl.abort(); }, 8000);
    fetch(D.api, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctrl ? ctrl.signal : undefined,
      body: JSON.stringify({
        tienda: D.tienda,
        items: Object.keys(items).map(function(i){ return { id: D.productos[i].id, c: items[i].c }; }),
        nombre: v.nombre.value.trim(), telefono: v.telefono.value.trim(),
        entrega: k.retiro ? 'Retiro en el local' : 'Envío a domicilio',
        direccion: k.retiro ? '' : v.direccion.value.trim(),
        pago: D.pagos.length ? v.pago.value : '', notas: v.notas.value.trim(),
        web: v.web ? v.web.value : '',
      }),
    }).then(function(r){ return r.json().catch(function(){ return {}; }).then(function(j){ return { ok: r.ok, j: j }; }); })
      .then(function(x){
        if(x.ok && x.j.mensaje){
          mandar(x.j.mensaje, ventana);
          items = {}; guardar(); pintar(); abrir(false); form.reset();
          aviso('Pedido ' + x.j.numero + ' registrado');
        }else if(x.j && x.j.error && x.j.recargar){
          if(ventana) ventana.close();
          aviso(x.j.error);
        }else{
          mandar(msg, ventana);              // sin registro, el pedido igual llega por WhatsApp
        }
      })
      .catch(function(){ mandar(msg, ventana); })
      .then(function(){ clearTimeout(corte); enviando = false; enviar.disabled = false; enviar.textContent = 'Enviar pedido por WhatsApp'; });
  });

  pintar();
})();
<\/script>`;
}

/* documento final: HTML autónomo, listo para subir a cualquier hosting */
function renderDoc(tpl, d, editable){
  const t = tema(d);
  const a = marcas(!!editable);
  const cuerpo = seccionesDe(tpl, d).map((n, i) => {
    const html = SEC[n] ? SEC[n].html(d,t,a) : '';
    // en edición cada sección lleva su número, para poder moverla o quitarla
    return editable ? html.replace(/^(\s*<[a-z]+)/, `$1 data-sec="${i}"`) : html;
  }).join('\n');
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
${!editable && seccionesDe(tpl, d).includes('tienda') ? guionTienda(d) : ''}
</body>
</html>`;
}

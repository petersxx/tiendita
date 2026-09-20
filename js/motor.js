/* =========================================================
   TALLER DE PÁGINAS — motor de plantillas
   Una plantilla por rubro. Cada página exportada es un HTML
   autónomo: sin scripts, sin dependencias, sólo Google Fonts.
   ========================================================= */

/* ---------- utilidades ---------- */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const parrafos = s => String(s ?? '').split(/\n{2,}/).filter(Boolean)
  .map(p => '<p>' + esc(p).replace(/\n/g, '<br>') + '</p>').join('');
const slug = s => String(s || 'pagina').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'')
  .replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,50) || 'pagina';

function rgb(h){ h = String(h||'#000').replace('#',''); if(h.length===3) h = h.split('').map(c=>c+c).join('');
  const n = parseInt(h,16)||0; return [n>>16 & 255, n>>8 & 255, n & 255]; }
function hex(a){ return '#' + a.map(v => Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join(''); }
function mix(a,b,p){ const x=rgb(a), y=rgb(b); return hex(x.map((v,i)=> v+(y[i]-v)*p)); }
function lum(h){ const [r,g,b]=rgb(h).map(v=>{ v/=255; return v<=.03928? v/12.92 : Math.pow((v+.055)/1.055,2.4); });
  return .2126*r + .7152*g + .0722*b; }
const legible = h => lum(h) > .42 ? '#10100F' : '#FFFFFF';
const alpha = (h,a) => { const [r,g,b]=rgb(h); return `rgba(${r},${g},${b},${a})`; };

/* ---------- tipografías (todas de un solo eje: cargan sin fallar) ---------- */
const FUENTES = {
  moderna:   { l:'Moderna',   t:'"Syne",sans-serif',            c:'"Manrope",system-ui,sans-serif',
               u:'https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;800&family=Syne:wght@700;800&display=swap' },
  editorial: { l:'Editorial', t:'"Playfair Display",Georgia,serif', c:'"Lora",Georgia,serif',
               u:'https://fonts.googleapis.com/css2?family=Lora:wght@400;500;600&family=Playfair+Display:wght@700;900&display=swap' },
  tecnica:   { l:'Técnica',   t:'"Archivo Black",system-ui,sans-serif', c:'"IBM Plex Sans",system-ui,sans-serif',
               u:'https://fonts.googleapis.com/css2?family=Archivo+Black&family=IBM+Plex+Sans:wght@400;500;600&display=swap' },
  suave:     { l:'Suave',     t:'"Sora",system-ui,sans-serif',   c:'"Epilogue",system-ui,sans-serif',
               u:'https://fonts.googleapis.com/css2?family=Epilogue:wght@400;600&family=Sora:wght@600;700&display=swap' },
};

/* ---------- tema derivado de 3 colores + 1 tipografía ---------- */
function tema(d){
  const bg = d._bg, fg = d._fg, ac = d._accent;
  const f = FUENTES[d._font] || FUENTES.moderna;
  return {
    bg, fg, ac,
    sup:   mix(bg, fg, .04),          // superficie elevada
    sup2:  mix(bg, fg, .08),
    linea: mix(bg, fg, .16),
    mudo:  mix(fg, bg, .40),
    onAc:  legible(ac),
    acSuave: mix(bg, ac, .14),
    acFuerte: mix(ac, fg, .28),
    tit: f.t, txt: f.c, url: f.u,
    esc:  d._escala ?? 1,      // escala tipográfica
    rad:  d._radio  ?? 14,     // redondeo de esquinas
    aire: d._aire   ?? 1,      // altura de las secciones
  };
}

/* ---------- arte generado: reemplaza fotos que aún no existen ---------- */
function arte(t, i){
  const a = t.ac, b = t.acFuerte, c = mix(t.bg, t.ac, .10), d = mix(t.bg, t.fg, .06);
  const p = [
    `background:${c};background-image:radial-gradient(circle at 28% 22%,${a} 0%,${alpha(a,0)} 58%),radial-gradient(circle at 78% 74%,${b} 0%,${alpha(b,0)} 52%)`,
    `background:${c};background-image:repeating-linear-gradient(135deg,${a} 0 9px,${alpha(a,0)} 9px 26px)`,
    `background:linear-gradient(158deg,${a} 0%,${b} 58%,${d} 100%)`,
    `background:${c};background-image:repeating-radial-gradient(circle at 18% 82%,${a} 0 3px,${alpha(a,0)} 3px 17px)`,
    `background:${d};background-image:linear-gradient(0deg,${alpha(a,.45)} 0 2px,${alpha(a,0)} 2px),linear-gradient(90deg,${alpha(a,.45)} 0 2px,${alpha(a,0)} 2px);background-size:32px 32px`,
    `background:${c};background-image:conic-gradient(from 205deg at 62% 38%,${a},${b},${c},${a})`,
    `background:${c};background-image:linear-gradient(45deg,${a} 25%,${alpha(a,0)} 25% 75%,${a} 75%),linear-gradient(45deg,${b} 25%,${alpha(b,0)} 25% 75%,${b} 75%);background-size:44px 44px;background-position:0 0,22px 22px`,
    `background:${d};background-image:radial-gradient(ellipse 120% 70% at 50% 110%,${a} 0%,${alpha(a,0)} 70%)`,
  ];
  return p[Math.abs(i) % p.length];
}
function media(url, t, i, cls, attr){
  const a = attr || '';
  return url
    ? `<img class="${cls}" src="${esc(url)}" alt="" loading="lazy"${a}>`
    : `<div class="${cls} arte" style="${arte(t,i)}" role="presentation"${a}></div>`;
}

/* ---------- enlaces paraguayos ---------- */
function wa(num, msg){
  const n = String(num||'').replace(/\D/g,'');
  if(!n) return '#contacto';
  const full = n.startsWith('595') ? n : '595' + n.replace(/^0+/,'');
  return 'https://wa.me/' + full + (msg ? '?text=' + encodeURIComponent(msg) : '');
}
const tel = n => 'tel:+' + (String(n||'').replace(/\D/g,'').replace(/^0+/,'595$&').replace(/^595595/,'595'));
const ig = u => { const h = String(u||'').replace(/^@/,'').trim(); return h ? (h.startsWith('http') ? h : 'https://instagram.com/' + h) : ''; };

/* =========================================================
   CSS COMPARTIDO DE LAS PÁGINAS GENERADAS
   ========================================================= */
function kitCss(t){ return `
:root{--esc:${t.esc};--rad:${t.rad}px;--aire:${t.aire}}
*,*::before,*::after{box-sizing:border-box}
body{margin:0;background:${t.bg};color:${t.fg};font-family:${t.txt};font-size:calc(16px*var(--esc));line-height:1.62;-webkit-font-smoothing:antialiased}
img{max-width:100%;height:auto;display:block}
a{color:inherit}
h1,h2,h3,h4{font-family:${t.tit};line-height:1.08;text-wrap:balance;margin:0;font-weight:700}
p{margin:0 0 1em}
p:last-child{margin-bottom:0}
.wrap{width:100%;max-width:1120px;margin:0 auto;padding-inline:22px}
.sec{padding-block:calc(clamp(48px,7.5vw,96px)*var(--aire))}
.sec-h{max-width:620px;margin-bottom:clamp(26px,4vw,44px)}
.sec-h h2{font-size:calc(clamp(26px,4.2vw,40px)*var(--esc));margin-bottom:.4em}
.sec-h p{color:${t.mudo};font-size:16px;margin:0}
.eyebrow{display:inline-block;font-size:11.5px;letter-spacing:.2em;text-transform:uppercase;font-weight:600;color:${t.ac};margin-bottom:14px}
.arte{background-color:${t.sup2}}
.btn{display:inline-block;background:${t.ac};color:${t.onAc};padding:14px 28px;border-radius:999px;
  text-decoration:none;font-weight:600;font-family:${t.txt};font-size:calc(15px*var(--esc));border:2px solid ${t.ac}}
.btn:hover{background:${t.acFuerte};border-color:${t.acFuerte}}
.btn.alt{background:transparent;color:${t.fg};border-color:${t.linea}}
.btn.alt:hover{background:${t.sup};border-color:${t.fg}}
.acciones{display:flex;flex-wrap:wrap;gap:12px;margin-top:28px}

/* barra superior */
.nav{position:sticky;top:0;z-index:20;background:${alpha(t.bg,.92)};backdrop-filter:blur(10px);
  border-bottom:1px solid ${t.linea}}
.nav .wrap{display:flex;align-items:center;gap:18px;min-height:66px;flex-wrap:wrap;padding-block:10px}
.marca{font-family:${t.tit};font-weight:700;font-size:19px;letter-spacing:-.01em;text-decoration:none;margin-right:auto}
.marca em{font-style:normal;color:${t.ac}}
.nav-links{display:flex;gap:18px;flex-wrap:wrap;font-size:14.5px}
.nav-links a{text-decoration:none;color:${t.mudo}}
.nav-links a:hover{color:${t.ac}}
.nav .btn{padding:10px 18px;font-size:14px}

/* portadas */
.hero{position:relative;overflow:hidden}
.hero h1{font-size:calc(clamp(34px,6.4vw,66px)*var(--esc));letter-spacing:-.02em}
.hero .lead{font-size:calc(clamp(16px,2vw,19px)*var(--esc));color:${t.mudo};max-width:52ch;margin-top:20px}
.hero-split .wrap{display:grid;grid-template-columns:1.05fr .95fr;gap:clamp(28px,5vw,64px);align-items:center;
  padding-block:clamp(48px,7vw,90px)}
.hero-split .arte,.hero-split img{width:100%;aspect-ratio:4/5;border-radius:calc(var(--rad) + 2px);object-fit:cover}
.hero-banner{color:${legible(t.ac)===('#FFFFFF')?'#fff':t.fg}}
.hero-banner .fondo{position:absolute;inset:0}
.hero-banner .fondo img{width:100%;height:100%;object-fit:cover}
.hero-banner .velo{position:absolute;inset:0;background:linear-gradient(200deg,${alpha(t.ac,.86)},${alpha(mix(t.ac,t.fg,.6),.94)})}
.hero-banner .wrap{position:relative;padding-block:clamp(72px,12vw,148px);max-width:900px}
.hero-banner h1,.hero-banner .lead,.hero-banner .eyebrow{color:${t.onAc}}
.hero-banner .lead{opacity:.9}
.hero-banner .btn{background:${t.onAc};color:${t.ac};border-color:${t.onAc}}
.hero-banner .btn.alt{background:transparent;color:${t.onAc};border-color:${alpha(t.onAc,.5)}}
.hero-tipo{border-bottom:1px solid ${t.linea}}
.hero-tipo .wrap{padding-block:clamp(56px,9vw,120px);max-width:960px}
.hero-tipo h1{font-size:calc(clamp(38px,8.4vw,86px)*var(--esc))}
.hero-tipo .lead{font-size:calc(clamp(17px,2.2vw,21px)*var(--esc))}
.hero-tipo .regla{height:1px;background:${t.linea};margin:clamp(28px,5vw,52px) 0 0}

/* franja de datos */
.tiras{border-block:1px solid ${t.linea};background:${t.sup}}
.tiras .wrap{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:2px;padding-block:0}
.tira{padding:26px 14px 26px 0;border-right:1px solid ${t.linea}}
.tira:last-child{border-right:0}
.tira b{display:block;font-family:${t.tit};font-size:calc(clamp(24px,3.4vw,34px)*var(--esc));color:${t.ac};line-height:1;font-variant-numeric:tabular-nums}
.tira span{display:block;font-size:13px;color:${t.mudo};margin-top:8px;letter-spacing:.02em}

/* tarjetas */
.rejilla{display:grid;gap:clamp(16px,2.4vw,26px)}
.rejilla.grid{grid-template-columns:repeat(auto-fill,minmax(250px,1fr))}
.rejilla.compacto{grid-template-columns:repeat(auto-fill,minmax(200px,1fr))}
.tarj{background:${t.sup};border:1px solid ${t.linea};border-radius:var(--rad);overflow:hidden;display:flex;flex-direction:column}
.tarj .arte,.tarj img{width:100%;aspect-ratio:4/3;object-fit:cover}
.tarj .cuerpo{padding:16px 17px 19px;display:flex;flex-direction:column;gap:7px;flex:1}
.tarj h3{font-size:calc(18px*var(--esc))}
.tarj .meta{font-family:${t.txt};font-weight:600;color:${t.ac};font-size:14.5px}
.tarj p{color:${t.mudo};font-size:14px;margin:0}
.rejilla.ancho{grid-template-columns:1fr}
.rejilla.ancho .tarj{flex-direction:row;align-items:stretch}
.rejilla.ancho .tarj .arte,.rejilla.ancho .tarj img{width:38%;max-width:320px;aspect-ratio:auto;min-height:190px;flex:none}
.rejilla.ancho .tarj .cuerpo{padding:22px 24px;justify-content:center}
.rejilla.ancho .tarj h3{font-size:calc(21px*var(--esc))}

/* lista de precios */
.precios{display:flex;flex-direction:column;gap:clamp(26px,4vw,42px)}
.bloque h3{font-size:14px;letter-spacing:.16em;text-transform:uppercase;color:${t.ac};font-family:${t.txt};
  font-weight:600;padding-bottom:10px;border-bottom:1px solid ${t.linea};margin-bottom:6px}
.fila{display:flex;align-items:baseline;gap:10px;padding:13px 0;border-bottom:1px dotted ${t.linea}}
.fila:last-child{border-bottom:0}
.fila .nom{font-weight:600;font-size:calc(16px*var(--esc));flex:none;max-width:60%}
.fila .det{color:${t.mudo};font-size:13.5px;flex:1;min-width:0}
.fila .pre{margin-left:auto;font-weight:700;color:${t.ac};font-size:calc(16px*var(--esc));white-space:nowrap;font-variant-numeric:tabular-nums}

/* pasos numerados (secuencia real) */
.pasos{display:grid;grid-template-columns:repeat(auto-fit,minmax(215px,1fr));gap:clamp(18px,2.6vw,30px);counter-reset:p}
.paso{counter-increment:p;padding-top:20px;border-top:2px solid ${t.ac}}
.paso::before{content:counter(p,decimal-leading-zero);font-family:${t.tit};font-size:13px;color:${t.ac};
  display:block;margin-bottom:10px;letter-spacing:.1em}
.paso h3{font-size:calc(18px*var(--esc));margin-bottom:8px}
.paso p{color:${t.mudo};font-size:14.5px;margin:0}

/* bloque de texto */
.dueto .wrap{display:grid;grid-template-columns:1fr 1fr;gap:clamp(26px,5vw,60px);align-items:center}
.dueto .arte,.dueto img{width:100%;aspect-ratio:1/1;border-radius:calc(var(--rad) + 2px);object-fit:cover}
.dueto h2{font-size:calc(clamp(24px,3.8vw,36px)*var(--esc));margin-bottom:.55em}
.dueto .texto{color:${t.mudo};font-size:16px}

/* preguntas */
.faq{max-width:760px;border-top:1px solid ${t.linea}}
.faq details{border-bottom:1px solid ${t.linea}}
.faq summary{cursor:pointer;padding:17px 0;font-weight:600;font-size:calc(16.5px*var(--esc));list-style:none;display:flex;gap:12px;align-items:flex-start}
.faq summary::-webkit-details-marker{display:none}
.faq summary::before{content:"+";color:${t.ac};font-weight:700;flex:none;width:14px}
.faq details[open] summary::before{content:"–"}
.faq .r{padding:0 0 18px 26px;color:${t.mudo};font-size:15px}

/* testimonios */
.citas{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:clamp(16px,2.4vw,26px)}
.cita{background:${t.sup};border:1px solid ${t.linea};border-left:3px solid ${t.ac};border-radius:0 var(--rad) var(--rad) 0;padding:22px 24px}
.cita p{font-size:calc(16px*var(--esc));margin-bottom:14px}
.cita p::before{content:"\\201C"}
.cita p::after{content:"\\201D"}
.cita b{font-size:13.5px;color:${t.mudo};font-weight:600}

/* contacto */
.contacto{background:${t.sup};border-top:1px solid ${t.linea}}
.contacto .wrap{display:grid;grid-template-columns:1fr 1fr;gap:clamp(26px,5vw,56px);align-items:start}
.datos{display:flex;flex-direction:column;gap:2px;margin-top:22px}
.dato{display:flex;gap:14px;padding:13px 0;border-bottom:1px solid ${t.linea};font-size:15px}
.dato:last-child{border-bottom:0}
.dato b{flex:none;width:96px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:${t.mudo};
  font-weight:600;padding-top:3px;font-family:${t.txt}}
.dato a{color:${t.ac};text-decoration:none;font-weight:600}
.dato a:hover{text-decoration:underline}
.mapa{width:100%;aspect-ratio:4/3;border-radius:calc(var(--rad) + 2px);border:1px solid ${t.linea};overflow:hidden}
.mapa iframe{width:100%;height:100%;border:0;display:block}

/* pie */
.pie{border-top:1px solid ${t.linea};padding-block:34px;font-size:13.5px;color:${t.mudo}}
.pie .wrap{display:flex;flex-wrap:wrap;gap:14px 26px;align-items:center}
.pie .marca{font-size:16px;margin-right:auto}
.pie a{color:${t.mudo};text-decoration:none}
.pie a:hover{color:${t.ac}}

@media (max-width:820px){
  .hero-split .wrap,.dueto .wrap,.contacto .wrap{grid-template-columns:1fr}
  .hero-split .arte,.hero-split img{aspect-ratio:16/10}
  .rejilla.ancho .tarj{flex-direction:column}
  .rejilla.ancho .tarj .arte,.rejilla.ancho .tarj img{width:100%;max-width:none;aspect-ratio:16/9;min-height:0}
  .tira{border-right:0;border-bottom:1px solid ${t.linea};padding-right:0}
  .tira:last-child{border-bottom:0}
  .nav-links{display:none}
}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
`; }

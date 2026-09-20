/* Genera el archivo único que consume el Artifact de Claude a partir del
   repo. El visor de Artifacts aporta su propio <!doctype>, <head> y un
   reset base, así que acá sólo emitimos título, fuentes, estilos, el
   marcado y los scripts, todo en línea.

   Uso:  node tools/build-artifact.mjs [destino.html]
*/
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const raiz = resolve(import.meta.dirname, '..');
const destino = process.argv[2] ?? resolve(raiz, 'dist/taller-de-paginas.html');
const leer = p => readFileSync(resolve(raiz, p), 'utf8');

const index = leer('index.html');

const titulo = index.match(/<title>[\s\S]*?<\/title>/)[0];
const fuentes = [...index.matchAll(/<link rel="(?:preconnect|stylesheet)"[^>]*fonts\.g[^>]*>/g)].map(m => m[0]);
const arranqueTema = index.match(/<script>\s*\/\* Antes de pintar[\s\S]*?<\/script>/)[0];

// el marcado es lo que va entre el cierre del <head> y el primer <script src>
const marcado = index.split('</head>')[1].split('<script src=')[0]
  .replace(/^\s*<body>\s*/, '').trimEnd();

const fuentesJs = [...index.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);

const partes = [
  titulo,
  ...fuentes,
  '<style>\n' + leer('css/taller.css').trim() + '\n</style>',
  arranqueTema,
  '',
  marcado,
  '',
  ...fuentesJs.map(f => '<script>\n' + leer(f).trim() + '\n</script>'),
];

const salida = partes.join('\n') + '\n';

if (salida.includes('</script>\n</script>')) throw new Error('scripts mal anidados');
mkdirSync(dirname(destino), { recursive: true });
writeFileSync(destino, salida);
console.log(`${destino}  ${(salida.length / 1024).toFixed(1)} KB  ·  ${fuentesJs.length} scripts en línea`);

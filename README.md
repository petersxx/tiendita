# Taller de Páginas

Editor de plantillas para armar páginas web por rubro. Elegís la categoría de tu
negocio, editás los textos en un panel, ves el resultado en vivo y descargás un
archivo `index.html` autónomo listo para subir a cualquier hosting.

El contenido de arranque está pensado para negocios paraguayos: precios en
guaraníes, enlaces de WhatsApp armados solos, horarios partidos por la siesta,
facturación a RUC y medios de pago locales (Tigo Money, Billetera Personal, Zimple).

## Rubros incluidos

| Rubro | Qué cubre |
|---|---|
| Gastronomía | Restaurante, parrillada, comedor |
| Moda y textil | Tienda de ropa, boutique |
| Belleza | Barbería, peluquería, estética |
| Inmobiliaria | Venta, alquiler, loteamientos |
| Agro y ganadería | Insumos, campos, servicios rurales |
| Salud | Consultorio médico y odontológico |
| Automotriz | Taller mecánico, repuestos |
| Construcción | Constructora, corralón de materiales |
| Despensa y delivery | Minimercado, almacén de barrio |
| Servicios profesionales | Estudio contable y jurídico |
| Educación | Instituto, academia, cursos |
| Tecnología | Celulares, servicio técnico, informática |
| Eventos | Salón de fiestas, organización |
| Turismo y hotelería | Hotel, posada, excursiones |

## Edición directa sobre la página

No hace falta buscar el campo en un formulario: **se toca el texto en la misma
página y se escribe encima**. Al elegir algo:

- el texto queda editable en el lugar y el panel salta al campo que le corresponde;
- si es parte de una lista (un producto, un renglón de precios, un paso), aparece
  una barra flotante para subirlo, bajarlo, duplicarlo o quitarlo;
- si es una imagen, la barra permite quitarla y volver al fondo generado.

El panel también funciona al revés: al enfocar un campo, la página se desplaza y
resalta el elemento correspondiente.

El botón **Previsualizar** apaga la edición y deja la página como la ve un
visitante, con los enlaces y las preguntas desplegables funcionando.

Las marcas que hacen posible todo esto (`data-campo`, `data-item`) existen sólo en
la vista previa. El HTML exportado sale sin ellas.

## Controles visuales

- **Zoom** con `−` / `+` / *Ajustar*, y anchos reales de escritorio (1280 px),
  tablet (820 px) y móvil (390 px).
- **Deslizadores** para el tamaño del texto, el redondeo de las esquinas y el aire
  entre secciones. Se aplican al instante sobre variables CSS, sin rehacer la página.

## Cómo funciona

Una plantilla no es un archivo HTML suelto: es una **lista de secciones** más su
contenido. Las secciones (`js/secciones.js`) son piezas reutilizables — barra,
portada, cifras, catálogo, lista de precios, pasos, preguntas, testimonios,
contacto, pie — y cada una declara qué campos muestra en el panel de edición.
Agregar un rubro nuevo es agregar un objeto en `js/rubros.js`: qué secciones usa,
con qué paleta y con qué contenido arranca.

La página exportada no depende de este proyecto: es un solo archivo con el CSS
adentro, sin JavaScript y sin más pedido externo que Google Fonts.

## Estructura

```
index.html          Cáscara de la aplicación y marcado del editor
css/taller.css      Estilos del editor (claro y oscuro)
js/motor.js         Utilidades, tipografías, paletas, fondos generados, CSS de las páginas
js/secciones.js     Secciones reutilizables, sus campos y el armado del documento final
js/rubros.js        Los 14 rubros con su contenido de arranque
js/app.js           Panel, edición directa, zoom, subida a R2, guardado y exportación
api/subir.js        Firma la subida a R2 (las claves no salen del servidor)
api/catalogo.js     Lee la base de productos de Notion y la normaliza
api/_comun.js       CORS y utilidades compartidas
tools/build-artifact.mjs   Arma el archivo único que consume el Artifact de Claude
```

La versión publicada como Artifact de Claude es el mismo código en un solo
archivo. No se edita a mano: se genera con

```bash
node tools/build-artifact.mjs dist/taller-de-paginas.html
```

## Correrlo localmente

El editor es estático. Para levantarlo solo, sin las funciones de la API:

```bash
python3 -m http.server 8777
```

Para trabajar **también** con `/api/subir` y `/api/catalogo`, hace falta el
entorno de Vercel, que carga las variables:

```bash
npm install
vercel env pull        # trae las variables a .env.local
vercel dev             # editor + API en http://localhost:3000
```

## Imágenes en Cloudflare R2 y catálogo en Notion

El editor sube imágenes a un bucket de R2 y puede traer los productos de una
base de Notion. Ninguna clave vive en el navegador: hay dos funciones en
`api/` que las guardan del lado del servidor.

```
navegador  ──POST /api/subir──►  Vercel  ──firma con las claves de R2──►  URL prefirmada
navegador  ──PUT con esa URL──►  R2                    (el archivo nunca pasa por Vercel)

página     ──GET /api/catalogo?db=…──►  Vercel  ──token de Notion──►  Notion
```

### Estado de la configuración

| | |
|---|---|
| Acceso público de R2 | listo — `https://pub-3a0ab81b24b7485b917cf49de2d1576f.r2.dev` |
| `R2_ACCOUNT_ID`, `R2_BUCKET`, `R2_PUBLIC_BASE` | cargadas en Vercel |
| `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | **faltan** (token de API del bucket) |
| `NOTION_TOKEN` | **falta** (secreto de la integración) |
| Regla CORS del bucket | **falta** (sin ella el navegador no puede subir) |
| Base de Notion compartida con la integración | **falta** |

Las que faltan son credenciales: cargalas vos, no deben pasar por un chat.

```bash
vercel env add R2_ACCESS_KEY_ID production
vercel env add R2_SECRET_ACCESS_KEY production
vercel env add NOTION_TOKEN production
vercel --prod          # las variables recién se toman en el siguiente deploy
```

### Variables de entorno en Vercel

Se cargan una sola vez, desde el panel de Vercel o con `vercel env add <NOMBRE>`.
**Cargalas vos**: son credenciales y no deben pasar por un chat ni quedar en el repo.

| Variable | Qué es |
|---|---|
| `R2_ACCOUNT_ID` | `f9d775fecdc16425d4e6f98d8c3b7555` (el de tu endpoint) |
| `R2_BUCKET` | `tiendita` |
| `R2_ACCESS_KEY_ID` | Del token de API de R2 |
| `R2_SECRET_ACCESS_KEY` | Del token de API de R2 |
| `R2_PUBLIC_BASE` | La URL **pública** del bucket, sin barra final. Ya cargada |
| `NOTION_TOKEN` | El secreto de la integración de Notion |
| `SUBIDA_TOKEN` | Opcional. Si la definís, hay que escribirla en el editor para poder subir |
| `ORIGENES_PERMITIDOS` | Opcional. Orígenes que pueden subir, separados por coma |

### Cloudflare R2: lo que falta configurar

El endpoint `…r2.cloudflarestorage.com/tiendita` es la **API S3**, sirve para subir.
Para *mostrar* las imágenes hace falta habilitar una URL pública aparte:

1. **Acceso público.** En el panel de R2 → bucket `tiendita` → *Settings* → *Public
   access*. O bien conectás un dominio propio (recomendado, ej. `img.tudominio.com`),
   o habilitás el subdominio de desarrollo `r2.dev`. Cualquiera de los dos te da una
   URL: esa es `R2_PUBLIC_BASE`.
2. **Regla CORS**, sin la cual el navegador no puede subir. En el mismo bucket →
   *Settings* → *CORS policy*:

```json
[
  {
    "AllowedOrigins": ["https://tiendita-ebon-one.vercel.app", "http://localhost:8777"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["content-type"],
    "MaxAgeSeconds": 3600
  }
]
```

3. **Token de API** con permiso de *Object Read & Write* sobre el bucket. De ahí
   salen `R2_ACCESS_KEY_ID` y `R2_SECRET_ACCESS_KEY`.

### Notion: lo que falta configurar

1. Creá una integración interna en <https://www.notion.so/my-integrations>. El
   secreto que te da es `NOTION_TOKEN`.
2. Abrí la base de productos → menú `•••` → *Conexiones* → agregá la integración.
   **Sin este paso Notion responde 404**, aunque el id sea correcto.
3. Copiá el id de la base: son los 32 caracteres de la URL,
   `notion.so/<workspace>/<ID DE 32>?v=…`.

La base puede tener las columnas que quieras. Se buscan por nombre, sin
distinguir mayúsculas ni acentos:

| Campo de la plantilla | Columnas que reconoce | Tipo |
|---|---|---|
| Título | la columna de tipo *title*, se llame como se llame | title |
| Precio | Precio · Monto · Valor · Meta · Dato | número o texto |
| Descripción | Descripción · Detalle · Texto | texto |
| Imagen | Imagen · Foto · Portada | archivo o URL |
| Visible | Visible · Publicado · Activo | casilla (si es falsa, se omite) |
| Orden | Orden · Posición · Nº | número |

Si el precio es un **número**, se formatea como `Gs. 285.000`. Si lo escribís como
texto, se respeta tal cual.

### Leer en vivo o dejarlo escrito

La casilla *«Leer Notion cada vez que alguien abre la página»* decide qué pasa al
exportar:

- **Apagada**: los productos quedan escritos en el HTML. Un archivo suelto, sin
  dependencias.
- **Encendida**: la página consulta `/api/catalogo` al abrirse, así el dueño cambia
  un precio en Notion y se ve solo. Los productos escritos quedan igual como
  **respaldo**: si Notion tarda o falla, la página muestra la última versión
  exportada en vez de un hueco.

## Dónde se guardan los proyectos

En `localStorage` del navegador: los proyectos guardados y un borrador por rubro,
para no perder lo que estabas editando al cambiar de plantilla. No hay servidor ni
base de datos. La copia que no depende del navegador es el HTML exportado.

## Deploy

En Vercel se publica sin configuración: los archivos de la raíz se sirven tal
cual y lo que está en `api/` se convierte en funciones. Cada push a `main`
genera un deploy.

## Nota sobre las imágenes

Si un campo de imagen queda vacío, se dibuja un fondo generado a partir del color
de acento, así nunca se ve una foto rota. Si no, se usa la imagen: la que subiste
a R2 o cualquier URL que pegues.

La vista previa del editor **sí** muestra las imágenes de R2. Dentro del Artifact
de Claude no, porque ese visor bloquea las imágenes externas; ahí se ve el fondo
generado y la imagen real aparece al exportar.

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
js/app.js           Panel, edición directa, zoom, imágenes, guardado, exportación y publicación
api/catalogo.js     Lee la base de productos de Notion y la normaliza
api/publicar.js     Publica una demo como proyecto propio en Vercel
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

Para trabajar **también** con `/api/publicar` y `/api/catalogo`, hace falta el
entorno de Vercel, que carga las variables:

```bash
vercel env pull        # trae las variables a .env.local
vercel dev             # editor + API en http://localhost:3000
```

## Catálogo en Notion

El editor puede traer los productos de una base de Notion. El token vive del
lado del servidor, en `api/catalogo.js`.

```
página     ──GET /api/catalogo?db=…──►  Vercel  ──token de Notion──►  Notion
```

| Variable | Qué es |
|---|---|
| `NOTION_TOKEN` | El secreto de la integración de Notion. **Falta cargarlo** |
| `ORIGENES_PERMITIDOS` | Opcional. Orígenes que pueden llamar a `/api/publicar`, separados por coma |

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

## Publicar demos para clientes

El botón **Publicar demo** sube la página tal como se exporta a Vercel y
devuelve un enlace para mandarle al cliente (con atajo a WhatsApp).

- Cada demo es **su propio proyecto** en Vercel, `demo-<nombre>`, con dirección
  `https://demo-<nombre>.vercel.app` (si el nombre ya existe en otra cuenta,
  Vercel le agrega un sufijo; la dirección real aparece en el diálogo).
- Volver a publicar la misma demo **actualiza la misma dirección**: el nombre
  queda guardado en el proyecto.
- Las demos se publican **sin la pantalla de login de Vercel**, para que el
  cliente las abra directo.

```
navegador ──POST /api/publicar (HTML + clave)──► Vercel (tiendita) ──VERCEL_TOKEN──► API de Vercel
                                                                 crea demo-x y despliega index.html
```

Hace falta cargar, una sola vez:

| Variable | Qué es |
|---|---|
| `VERCEL_TOKEN` | Token de <https://vercel.com/account/tokens>, con alcance al equipo donde van las demos |
| `VERCEL_TEAM_ID` | El id del equipo (`team_…`). Sin él, las demos van a la cuenta personal del token |
| `PUBLICAR_TOKEN` | Una clave que inventás vos. Se escribe en el diálogo la primera vez y queda en ese navegador. **Obligatoria**: sin ella la función no publica, porque cualquiera que abra el editor podría desplegar en tu cuenta |

```bash
vercel env add VERCEL_TOKEN production
vercel env add VERCEL_TEAM_ID production
vercel env add PUBLICAR_TOKEN production
vercel --prod
```

Para borrar una demo vieja: panel de Vercel → proyecto `demo-…` → *Settings* →
*Delete project*, o `vercel project rm demo-…`.

## Dónde se guardan los proyectos

En `localStorage` del navegador: los proyectos guardados y un borrador por rubro,
para no perder lo que estabas editando al cambiar de plantilla. No hay servidor ni
base de datos. La copia que no depende del navegador es el HTML exportado.

## Deploy

En Vercel se publica sin configuración: los archivos de la raíz se sirven tal
cual y lo que está en `api/` se convierte en funciones. Cada push a `main`
genera un deploy.

## Imágenes

Al tocar **Subir** (o arrastrar una foto sobre el campo), la imagen se achica en
el navegador a 1920 px de lado como máximo, pasa a WebP y se guarda en el
IndexedDB de ese navegador. La demo la nombra `img/<hash>.webp`.

- **Al publicar**, cada imagen viaja como un archivo más del deploy, al lado del
  `index.html`. Se suben de a una (el límite de una función es 4,5 MB) y sólo
  las que Vercel todavía no tiene: republicar una demo no las vuelve a mandar.
- **Al exportar** o ver el HTML, las imágenes van incrustadas en el archivo, así
  sigue siendo un solo archivo sin dependencias.
- También se puede pegar la URL de cualquier imagen en el campo de texto.

Las fotos quedan en **el navegador donde las subiste**. Si abrís el mismo
proyecto en otra compu, esas imágenes no están; hay que volver a subirlas (la
demo ya publicada no se ve afectada).

Si un campo de imagen queda vacío, se dibuja un fondo generado a partir del
color de acento, así nunca se ve una foto rota.

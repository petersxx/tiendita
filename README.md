# Taller de Páginas

Editor de plantillas para armar páginas web por rubro. Elegís la categoría de tu
negocio, editás todo directamente sobre la página y la publicás o descargás como un
archivo `index.html` autónomo listo para subir a cualquier hosting.

El contenido de arranque está pensado para negocios paraguayos: precios en
guaraníes, enlaces de WhatsApp armados solos, horarios partidos por la siesta,
facturación a RUC y medios de pago locales (Tigo Money, Billetera Personal, Zimple).

## Rubros incluidos

| Rubro | Qué cubre |
|---|---|
| Gastronomía | Restaurante, parrillada, comedor |
| Moda y textil | Tienda de ropa, boutique |
| Tienda online | Catálogo con carrito, pedidos por WhatsApp |
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

## Todo se edita sobre la página

No hay panel de campos: la página misma es el editor.

- **Textos**: se tocan y se escribe encima. Los campos vacíos muestran su nombre
  en gris, así se pueden completar aunque no tengan nada.
- **Imágenes**: al tocarlas aparece *Cambiar foto*; también se puede soltar una
  foto encima.
- **Botones y enlaces**: el texto se edita en el lugar y 🔗 cambia adónde llevan.
- **Ítems de una lista** (productos, renglones, pasos, cifras, fotos): al elegir
  uno aparece una barra para moverlo arrastrando **⠿**, subirlo, bajarlo,
  duplicarlo o quitarlo.
- **Secciones**: al pasar el mouse (o tocar el fondo en pantallas táctiles)
  aparece su barra: **⠿** para arrastrarla, el estilo (las portadas y el catálogo
  tienen variantes), **＋ Ítem**, **Datos** con todos sus campos (el WhatsApp, la
  dirección, Notion…) y **✕** para quitarla. El **＋ Sección** del borde de abajo
  agrega una nueva justo ahí.
- **Estilo**, arriba: colores, tipografía, tamaño del texto, esquinas y aire.
- **Deshacer** con el botón o con Ctrl/Cmd + Z.

Cada página guarda su propia lista de secciones (`_secciones`), así que dos demos
del mismo rubro pueden tener secciones distintas. Una sección quitada conserva
sus datos: si se vuelve a agregar, aparece como estaba.

El botón **Previsualizar** apaga la edición y deja la página como la ve un
visitante, con los enlaces y las preguntas desplegables funcionando.

Las marcas que hacen posible todo esto (`data-campo`, `data-item`, `data-sec`)
existen sólo en la vista previa. El HTML exportado sale sin ellas.

## Tienda con carrito

La sección **Tienda con carrito** (viene en el rubro *Tienda online* y se puede
agregar a cualquier página con **＋ Sección**) convierte el catálogo en una tienda:

- Cada producto tiene nombre, precio, descripción, foto, **categoría** y
  **etiqueta**. Con dos o más categorías aparecen filtros arriba de la grilla.
- La etiqueta *Agotado* deja el producto a la vista pero sin botón de compra.
  Un precio sin número (*A consultar*) cambia el botón por *Consultar* en WhatsApp.
- El visitante agrega productos, ajusta cantidades en el carrito lateral, elige
  envío o retiro y forma de pago, y **manda el pedido por WhatsApp** con el
  detalle, el subtotal, el envío y el total ya calculados.
- En **Datos** de la sección: costo de envío (vacío = sólo retiro), monto para
  envío gratis, formas de pago y el WhatsApp que recibe los pedidos.
- El carrito se guarda en el `localStorage` del visitante, así no se pierde al
  recargar. Si el catálogo cambia, se descartan los productos que ya no existen.

No hay cobro en línea: el negocio confirma stock y cobra como ya lo hace. Es la
única sección, junto con el catálogo vivo de Notion, que suma un script a la
página exportada; en modo **Editar** el script no se carga, para que cada clic
siga editando.

## Controles visuales

- **Zoom** con `−` / `+` / *Ajustar*, y anchos reales de escritorio (1280 px),
  tablet (820 px) y móvil (390 px).
- **Deslizadores** para el tamaño del texto, el redondeo de las esquinas y el aire
  entre secciones. Se aplican al instante sobre variables CSS, sin rehacer la página.

## Cómo funciona

Una plantilla no es un archivo HTML suelto: es una **lista de secciones** más su
contenido. Las secciones (`js/secciones.js`) son piezas reutilizables — barra,
portada, cifras, catálogo, galería, lista de precios, pasos, preguntas,
testimonios, contacto, pie — y cada una declara sus campos y un contenido
genérico (`nuevo`) para cuando se agrega a un rubro que no la traía.
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
js/rubros.js        Los 15 rubros con su contenido de arranque
js/cuenta.js        Ingreso con Clerk y pedidos a la API
js/app.js           Panel, edición directa, zoom, imágenes, guardado, exportación y publicación
api/proyectos.js    Proyectos y productos de cada usuario, en Notion
api/config.js       Clave publicable de Clerk para el editor
api/_sesion.js      Verifica la sesión de Clerk
api/_notion.js      Acceso a las bases de Notion
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

Para trabajar **también** con la API (cuentas, proyectos, publicar), hace falta el
entorno de Vercel, que carga las variables:

```bash
vercel env pull        # trae las variables a .env.local
vercel dev             # editor + API en http://localhost:3000
```

## Cuentas y proyectos

Para guardar hay que **ingresar**. Las cuentas (usuario y contraseña) las maneja
[Clerk](https://clerk.com), instalado desde el Marketplace de Vercel; los datos
viven en Notion, en **dos bases compartidas por todos los proyectos**:

| Base | Qué guarda | Variable |
|---|---|---|
| **Proyectos** | Una fila por proyecto: nombre, rubro, dueño (`Usuario` = id de Clerk), el diseño en JSON (`Datos`) y la demo publicada | `NOTION_DB_PROYECTOS` |
| **Productos** | Una fila por producto de la tienda, con relación a su proyecto: nombre, precio, descripción, imagen, categoría, etiqueta, orden y visible | `NOTION_DB_PRODUCTOS` |

```
editor ──token de sesión de Clerk──► /api/proyectos ──verifica el token──► Notion
                                      (sólo tus proyectos)
```

- **Cada usuario ve sólo lo suyo.** El usuario sale del token firmado por Clerk,
  nunca de lo que manda el navegador, y cada lectura, escritura o borrado
  comprueba que el proyecto sea suyo. Un id ajeno responde 404, igual que uno
  que no existe. Los productos se buscan sólo dentro de un proyecto propio: el
  id de un producto ajeno no sirve para modificarlo.
- Los **borradores** del navegador son por usuario: en una compu compartida,
  quien ingresa no ve lo que editó el anterior, y al cambiar de cuenta la
  pantalla vuelve a la plantilla.
- **Desde Notion** se puede editar un producto o apagar *Visible*: el editor
  lo toma al abrir el proyecto, y guardar no toca los ocultos.
- Borrar un proyecto lo archiva junto con sus productos: quedan 30 días en la
  papelera de Notion.
- Si había proyectos guardados en el navegador de antes de las cuentas, al
  ingresar aparece *Pasarlos a mi cuenta*.

| Variable | Qué es |
|---|---|
| `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Las carga sola la integración de Clerk |
| `NOTION_TOKEN` | El secreto de la integración de Notion (`tienditapy`) |
| `NOTION_DB_PROYECTOS`, `NOTION_DB_PRODUCTOS` | Los ids de las dos bases |

En Clerk (*Configure → User & authentication*, instancia **Development**) están
activados el usuario para registrarse e ingresar y la contraseña de 8 caracteres
como mínimo. La instancia de **Production** tiene su propia configuración.

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

### Cada dirección tiene dueño

Publicar pide **haber ingresado** con una cuenta que tenga **permiso para
publicar**: `{"publicar": true}` en la *metadata pública* del usuario de Clerk
(panel de Clerk → *Users* → el usuario → *Metadata* → *Public*). Esa metadata
sólo se escribe desde el servidor o el panel: el navegador no puede dársela.
Hace falta porque el registro es abierto y publicar despliega en tu cuenta de
Vercel. En el navegador no hay ninguna clave.

- La demo se publica desde un **proyecto guardado**. El editor lo guarda solo
  si hace falta. La dirección queda a nombre de ese proyecto, en la columna
  **Demo** de la base Proyectos.
- Sólo ese proyecto puede volver a publicar en esa dirección. Otro usuario, o
  hasta otro proyecto tuyo, recibe *«Esa dirección ya la usa otro proyecto»*.
- Si un proyecto cambia de dirección o se borra, la demo vieja queda en línea
  pero **nadie puede tomarla**. Existe en Vercel sin dueño, y eso se rechaza
  siempre. Para reasignarla a mano, escribí el nombre (`demo-…`) en la columna
  *Demo* del proyecto que corresponda.
- Si dos personas piden la misma dirección a la vez, se la queda una sola.

```
navegador ──POST /api/publicar (HTML + sesión)──► Vercel (tiendita) ──VERCEL_TOKEN──► API de Vercel
                                                                 crea demo-x y despliega index.html
```

Hace falta cargar, una sola vez (sólo en el servidor):

| Variable | Qué es |
|---|---|
| `VERCEL_TOKEN` | Token de <https://vercel.com/account/tokens>, con alcance al equipo donde van las demos |
| `VERCEL_TEAM_ID` | El id del equipo (`team_…`). Sin él, las demos van a la cuenta personal del token |

```bash
vercel env add VERCEL_TOKEN production
vercel env add VERCEL_TEAM_ID production
vercel --prod
```

Para borrar una demo vieja: panel de Vercel → proyecto `demo-…` → *Settings* →
*Delete project*, o `vercel project rm demo-…`.

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

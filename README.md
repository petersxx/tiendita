# Tiendita

Plataforma para que emprendedores paraguayos armen su tienda online solos:
se registran, eligen la dirección y el rubro, cargan productos y reciben los
pedidos armados en su WhatsApp. Cada pedido además queda registrado en su
panel. Los planes pagos se cobran con Pagopar.

| Ruta | Qué es |
|---|---|
| `/` | Portada pública (`index.html`): funciones, plantillas reales, precios y preguntas |
| `/panel` | Panel del cliente (`panel.html`): alta de la tienda, inicio con métricas, productos, pedidos, ajustes y plan |
| `/editor?tienda=<id>` | El editor de diseño, abierto sobre la tienda del cliente |
| `/editor` | El Taller de Páginas de siempre, para armar demos (ver más abajo) |
| `/<dirección>` | Cada tienda publicada, armada en el momento por `api/tienda.js` |

## Cómo funciona una tienda

```
visitante ──GET /casa-nanduti──► api/tienda.js ──► Notion (tienda + productos) + Clerk (plan del dueño)
                                     │ mismo motor que el editor (js/motor.js, secciones.js, rubros.js)
                                     ▼
                                HTML con carrito · 1 minuto en la CDN de Vercel

carrito ──POST /api/pedidos──► recalcula precios y total con Notion ──► fila en Pedidos
        ◄── número y mensaje ──  y abre WhatsApp con el pedido armado
```

- **Una tienda es una fila de Proyectos con `Slug`** (su dirección) y
  `Publicada`. El diseño lo sigue guardando el editor; el panel cambia nombre,
  dirección, WhatsApp, envío y formas de pago sin abrirlo.
- **Al crearla** arranca con la plantilla del rubro, siempre con carrito, sin
  testimonios de ejemplo (en una tienda real parecerían reseñas verdaderas) y
  con los productos de ejemplo del rubro cargados en Notion.
- **El precio lo pone el servidor.** El carrito sólo dice qué y cuántos; si un
  producto cambió o se agotó, pide recargar. Si el registro falla, el pedido
  igual sale por WhatsApp.
- **Aislamiento.** Todo endpoint del panel filtra por el usuario del token de
  Clerk: un id ajeno responde 404. Todas las tiendas comparten dominio con el
  panel, así que cada tienda sale con una política de contenido que sólo deja
  correr el script del carrito (con nonce), y los enlaces que no son web,
  correo o teléfono se descartan al armarla.
- Hay direcciones reservadas (`panel`, `editor`, `api`, `precios`…) en
  `api/_notion.js`.

## Planes

Los precios y límites viven en **un solo lugar**, `api/_planes.js`; la portada
y el panel los leen de `GET /api/planes`.

| Plan | Precio | Límites |
|---|---|---|
| Gratis | Gs. 0 | 20 productos, 3 categorías, 1 tienda, con el botón «Creá tu tienda gratis» |
| Negocio | Gs. 79.000/mes | Productos y categorías ilimitados, 1 tienda, sin la marca |
| Pro | Gs. 149.000/mes | Todo ilimitado, hasta 3 tiendas, sin la marca |

- Los límites se aplican en el servidor (`api/productos.js`, `api/tiendas.js`
  y al guardar desde el editor). Ocultar un producto no libera lugar.
- **Si un plan vence**, la tienda sigue en línea con los límites del Gratis:
  los productos que pasan el límite dejan de mostrarse, pero no se borran, y se
  puede seguir guardando lo que ya había.
- El plan de cada usuario vive en la **metadata pública de Clerk** (`plan`,
  `planHasta`), que sólo escribe el servidor. Se **recalcula desde cero** a
  partir de los pagos acreditados de la base Pagos, así que un aviso repetido
  nunca cuenta un pago dos veces. Pagar el mismo plan lo extiende; pagar otro
  lo reemplaza desde ese día.
- **Cortesías:** `{"planFijo": "pro"}` en la metadata pública de un usuario
  (panel de Clerk → *Users* → *Metadata*) le da ese plan sin vencimiento.
  Conviene ponérselo a tu propia cuenta.

### Cobro con Pagopar

```
panel ──POST /api/planes──► fila Pendiente en Pagos ──► Pagopar: iniciar-transaccion
      ◄── checkout de Pagopar (pagopar.com/pagos/<hash>)
Pagopar ──POST /api/pagopar (aviso firmado)──┐
comprador ──vuelve a /panel?pago=<hash>──────┴──► confirmarPago(): le vuelve a preguntar
                                                   el estado a Pagopar y recalcula el plan
```

No hay débito automático: el cliente elige 1, 3 o 12 meses y paga una vez.
Para activarlo:

1. En el panel de comercio de Pagopar, copiá la **clave pública** y la **privada**.
2. Configurá ahí la **URL de respuesta**: `https://<tu-dominio>/api/pagopar`,
   y la **URL de redirección**: `https://<tu-dominio>/panel?pago=($hash)`.
3. Cargá las claves en Vercel (no las pegues en un chat):
   ```bash
   vercel env add PAGOPAR_PUBLIC_KEY production
   vercel env add PAGOPAR_PRIVATE_KEY production
   ```

Sin esas claves el panel muestra los planes pero con el pago deshabilitado.

## Fotos en Cloudflare R2

El panel y el editor achican cada foto en el navegador (WebP, 1920 px como
máximo) y la suben **directo** al bucket con una URL firmada por
`api/imagenes.js`: vale 5 minutos, para un solo archivo con ese tipo y ese
tamaño, dentro de `u/<id de Clerk>/`. Pide sesión iniciada. No se aceptan SVG
(pueden llevar scripts).

Para activarlo, en Cloudflare:

1. Un **token de API de R2** con permiso de *Object Read & Write* sobre el
   bucket `tiendita`.
2. La **regla CORS** del bucket, para que el navegador pueda subir:
   ```json
   [{ "AllowedOrigins": ["https://<tu-dominio>", "http://localhost:3000"],
      "AllowedMethods": ["PUT"], "AllowedHeaders": ["content-type"], "MaxAgeSeconds": 3600 }]
   ```
3. Las variables en Vercel:
   ```bash
   vercel env add R2_ACCOUNT_ID production      # f9d775fecdc16425d4e6f98d8c3b7555
   vercel env add R2_BUCKET production          # tiendita
   vercel env add R2_PUBLIC_BASE production     # https://pub-3a0ab81b24b7485b917cf49de2d1576f.r2.dev
   vercel env add R2_ACCESS_KEY_ID production
   vercel env add R2_SECRET_ACCESS_KEY production
   ```

Sin R2 el panel deja pegar el enlace de una imagen, y el Taller sigue
guardando las fotos de las demos en el navegador como antes.

## Variables de entorno

| Variable | Para qué |
|---|---|
| `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Cuentas (las carga la integración de Clerk) |
| `NOTION_TOKEN`, `NOTION_DB_PROYECTOS`, `NOTION_DB_PRODUCTOS` | Tiendas y productos |
| `NOTION_DB_PEDIDOS`, `NOTION_DB_PAGOS` | Pedidos y pagos de planes. Las crea `node --env-file=.env.local tools/preparar-notion.mjs` |
| `R2_*` | Fotos (ver arriba) |
| `PAGOPAR_PUBLIC_KEY`, `PAGOPAR_PRIVATE_KEY` | Cobro de planes (ver arriba) |
| `VERCEL_TOKEN`, `VERCEL_TEAM_ID` | Sólo para «Publicar demo» del Taller |

---

# Taller de Páginas

El editor de plantillas que usan las tiendas. Abierto en `/editor` sin
`?tienda=`, sigue siendo la herramienta para armar demos por rubro, editarlas
sobre la página y publicarlas o descargarlas como un `index.html` autónomo.

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
index.html          Portada pública
panel.html          Panel de clientes
editor.html         El editor (Taller de Páginas)
css/sitio.css       Estilos de la portada y piezas comunes (claro y oscuro)
css/panel.css       Estilos del panel
css/taller.css      Estilos del editor
js/motor.js         Utilidades, tipografías, paletas, fondos generados, CSS de las páginas
js/secciones.js     Secciones reutilizables, el carrito y el armado del documento final
js/rubros.js        Los 15 rubros con su contenido de arranque
js/sitio.js         Portada: miniaturas reales de plantillas y precios
js/panel.js         Panel: alta, inicio, productos, pedidos, ajustes y plan
js/cuenta.js        Ingreso con Clerk y pedidos a la API
js/fotos.js         Achicar fotos y subirlas a R2 (panel y editor)
js/app.js           Editor: edición directa, zoom, imágenes, guardado, exportación y demos
api/tienda.js       Sirve cada tienda publicada en /<dirección>
api/tiendas.js      Alta y ajustes de las tiendas de cada usuario
api/productos.js    Productos de una tienda, de a uno, con los límites del plan
api/pedidos.js      Alta pública de pedidos; lista y estados para el dueño
api/planes.js       Planes, pago con Pagopar y confirmación a la vuelta
api/pagopar.js      Aviso de Pagopar cuando cambia un pago
api/imagenes.js     Firma la subida de una foto a R2
api/proyectos.js    Diseño y productos desde el editor, en Notion
api/publicar.js     Publica una demo del Taller como proyecto propio en Vercel
api/config.js       Clave publicable de Clerk
api/_planes.js      Precios, límites y cálculo del plan de cada usuario
api/_pagopar.js     Firmas, inicio y confirmación de pagos con Pagopar
api/_render.js      El motor de plantillas cargado en el servidor
api/_notion.js      Acceso a las bases de Notion y direcciones de tienda
api/_sesion.js      Verifica la sesión de Clerk
api/_comun.js       CORS y utilidades compartidas
tools/preparar-notion.mjs  Crea las bases Pedidos y Pagos y las columnas nuevas
tools/build-artifact.mjs   Arma el archivo único que consume el Artifact de Claude
```

La versión publicada como Artifact de Claude es el mismo código en un solo
archivo. No se edita a mano: se genera con

```bash
node tools/build-artifact.mjs dist/taller-de-paginas.html
```

## Correrlo localmente

El editor y la portada son estáticos. Para verlos solos, sin las funciones de la API:

```bash
python3 -m http.server 8777
```

Para trabajar **también** con la API (cuentas, proyectos, publicar), hace falta el
entorno de Vercel, que carga las variables:

```bash
vercel env pull        # trae las variables a .env.local
vercel dev             # portada, panel, editor, tiendas y API en http://localhost:3000
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

Con sesión iniciada y R2 configurado, las fotos van a R2 (ver *Fotos en
Cloudflare R2*) y quedan con una dirección pública que sirve en cualquier
compu. Sin R2, en el Taller se usa lo de siempre:

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

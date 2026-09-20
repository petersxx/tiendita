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
js/app.js           Panel de edición, vista previa, guardado y exportación
```

## Correrlo localmente

Es un sitio estático: no hay build ni dependencias.

```bash
python3 -m http.server 8000
# abrir http://localhost:8000
```

Abrir `index.html` con doble clic también funciona.

## Dónde se guardan los proyectos

En `localStorage` del navegador: los proyectos guardados y un borrador por rubro,
para no perder lo que estabas editando al cambiar de plantilla. No hay servidor ni
base de datos. La copia que no depende del navegador es el HTML exportado.

## Deploy

Sitio estático sin build. En Vercel se publica tal cual, sin configuración:
cada push a `main` genera un deploy.

## Nota sobre las imágenes

Si un campo de imagen queda vacío, se dibuja un fondo generado a partir del color
de acento, así nunca se ve una foto rota. Si pegás una URL, se usa esa imagen.

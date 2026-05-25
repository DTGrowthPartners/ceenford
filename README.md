# Ceenford — XII Congreso Internacional 2026

Sitio de registro para el **XII Congreso Internacional de Psicología, Educación y Neurociencias** — Monterrey 2026.

Landing en HTML + CSS + JS vanilla, lista para conectar a un backend.

## Stack

- **HTML / CSS / JavaScript** sin frameworks ni build system
- **Montserrat** (Google Fonts)
- **flag-icons** ([lipis/flag-icons](https://github.com/lipis/flag-icons)) vía CDN para las banderas del selector de país
- Custom dropdowns accesibles (sin librerías)
- Animación fade-in al scroll vía `IntersectionObserver`

## Estructura

```
.
├── index.html          Markup completo de la landing
├── styles.css          Todos los estilos (con responsive: 1024 / 720 / 480)
├── script.js           Lógica de custom dropdowns y fade-in al scroll
├── img/                Assets (logos, íconos, fondo, foto sede)
│   └── iconos/         SVGs de íconos (incluye banderas de partners)
├── backup/             Copia local previa al trabajo mobile (referencia)
└── broshure 4.pdf      Referencia de diseño original
```

## Secciones de la landing

1. **Hero** — Logos de organizadores, título del congreso, fecha y "qué incluye"
2. **Paso 1** — Elegir opción de pago (VIP 600 USD / HOY 350 USD / Registrate $0)
3. **Paso 2** — Tipo de participación (Asistente / Estudiante / Ponente / Patrocinador)
4. **Paso 3** — Formulario de datos (con dropdowns custom para país y área profesional)
5. **Paso 4** — Confirmación y botón principal "Continuar con mi registro"
6. **Beneficios** — Franja de 4 ventajas
7. **Sede** — Wyndham Monterrey + link a Google Maps
8. **Footer** — CTA "Tu lugar está asegurado" + 4 columnas (marca, contacto, organizan, colabora)

## Cómo correr localmente

Cualquier servidor estático sirve. Las opciones más rápidas:

**Con VSCode**: instalar la extensión **Live Server** y abrir `index.html` con "Open with Live Server".

**Con Python**:
```bash
python -m http.server 8000
```

**Con Node**:
```bash
npx serve .
```

Abrir `http://localhost:8000` (o el puerto que asigne el servidor).

## Envío del formulario y webhook

El formulario ya está cableado para hacer submit vía JS (ver `script.js`,
función `initFormSubmit`). Al hacer click en "Continuar con mi registro":

1. Se valida que todos los campos requeridos estén llenos
2. Se construye un JSON con los datos
3. Si está configurada una URL de webhook, se envía un `POST` con el JSON
4. Se muestra estado de éxito o error en la UI

### Conexión con la API de Ceenford

La integración con la API oficial (`https://api.ceenford.org/API/index.php`)
ya está implementada. El payload interno se transforma al esquema que
espera la API antes de enviarlo (función `payloadToCeenfordApi` en `script.js`).

**Mapping de campos:**

| Interno (nuestro) | API Ceenford       | Notas |
|-------------------|--------------------|-------|
| `nombre`          | `name`             | requerido |
| `correo`          | `email`            | requerido |
| `pais` (código)   | `country`          | se manda el **nombre completo** ("México") leído del custom-select, no el código |
| `telefono`        | `phone`            | |
| `ciudad`          | `city`             | la API lo guarda dentro de `message` |
| `area`            | `professionl_area` | ⚠️ typo del lado de ellos (sin la "a" final) |
| `institucion`     | `company`          | |
| `id`              | `document`         | referencia cruzada con la sheet |
| —                 | `event`            | viene de `FORM_CONFIG.eventId` (default: `'monterrey-2026'`) |
| —                 | `source`           | `window.location.hostname` |
| `opcion_pago_label` + `tipo_participacion_label` | `message` | "Opción de pago: 350 USD \| Tipo de participación: Asistente" |

La API responde con su propio `consecutive` (6 dígitos random, único por
`event`). Nuestro `id` con timestamp se sigue mandando como `document`
para poder correlacionar ambos registros.

### Configuración

```js
const FORM_CONFIG = {
    webhookUrl: 'https://api.ceenford.org/API/index.php',
    sheetsUrl:  'https://script.google.com/macros/s/.../exec',
    eventId:    'monterrey-2026'   // identificador del evento
};
```

### ⚠️ CORS

Mientras el sitio esté hosteado en un dominio distinto al de la API
(p. ej. `ceenford.dtgrowthpartners.com` ≠ `api.ceenford.org`), el browser
puede bloquear la petición a la API con error CORS. Para producción se
asume que el sitio quedará en infra de Ceenford (mismo origen) o que el
dev habilitará `Access-Control-Allow-Origin` en su servidor.

**Mientras tanto**: si la API falla por CORS, Google Sheets sigue
recibiendo todos los datos como backup. El form muestra éxito si al
menos uno de los dos destinos respondió OK.

### Estructura del JSON que se envía

```json
{
  "opcion_pago": "vip" | "hoy" | "registro",
  "opcion_pago_label": "600 USD",
  "tipo_participacion": "asistente" | "estudiante" | "ponente" | "patrocinador",
  "tipo_participacion_label": "Asistente",
  "nombre": "Juan Pérez",
  "pais": "mx",
  "ciudad": "Monterrey",
  "telefono": "+52 555 123 4567",
  "correo": "juan@ejemplo.com",
  "area": "psicologia",
  "institucion": "Universidad XYZ",
  "acepta_terminos": true,
  "confirma_registro": true,
  "enviado_en": "2026-08-15T14:30:00.000Z",
  "origen": "ceenford.dtgrowthpartners.com",
  "user_agent": "Mozilla/5.0 ...",
  "id": "20260815143000000"
}
```

- Los campos `*_label` incluyen el texto legible por humanos (útil para
  emails de confirmación). Los campos `pais` y `area` van como códigos cortos.
- `id` es un identificador único basado en el timestamp UTC con formato
  `YYYYMMDDHHMMSSmmm` (17 dígitos). Sirve como consecutivo para correlacionar
  con el backend cuando esté disponible.

### Guardar en Google Sheets (sin backend)

La forma más simple es usar **Google Apps Script** como Web App:

1. Crear una Google Sheet con columnas que coincidan con el JSON
2. En la Sheet: `Extensiones → Apps Script`
3. Pegar este código:

```js
function doPost(e) {
    const data = JSON.parse(e.postData.contents);
    const sheet = SpreadsheetApp.getActiveSheet();
    sheet.appendRow([
        data.enviado_en,
        data.nombre,
        data.correo,
        data.telefono,
        data.pais,
        data.ciudad,
        data.opcion_pago_label,
        data.tipo_participacion_label,
        data.area,
        data.institucion || '',
        data.id  // ID consecutivo (ultima columna)
    ]);
    return ContentService.createTextOutput(JSON.stringify({ ok: true }))
        .setMimeType(ContentService.MimeType.JSON);
}
```

4. `Implementar → Nueva implementación → Aplicación web`
5. Ejecutar como: **Yo (tu cuenta)** · Acceso: **Cualquier persona**
6. Copiar la URL `/exec` y pegarla en `FORM_CONFIG.sheetsUrl` de `script.js`

> Apps Script maneja CORS automáticamente y no requiere credenciales en el
> frontend (la autenticación se hace en el deploy del script). El archivo
> JSON de credenciales que mencionaste **NO se debe subir al frontend** —
> exponer un service account permitiría a cualquiera escribir/leer tu sheet.

## Compatibilidad

- Navegadores modernos (Chrome, Safari, Firefox, Edge — últimas 2 versiones)
- Mobile-first responsive desde 360px hasta 1280px+
- Respeta `prefers-reduced-motion` (los usuarios con esa preferencia ven el contenido sin animación)
- Soporte para iPhones con notch (`safe-area-inset`)

# Handoff técnico — Ceenford XII Congreso Monterrey 2026

Documento para el dev que va a integrar las notificaciones de WhatsApp.

---

## Resumen rápido

- **Sitio en vivo**: https://ceenford.dtgrowthpartners.com
- **Repo**: https://github.com/DTGrowthPartners/ceenford
- **Stack**: HTML + CSS + JS vanilla (sin build system, sin framework)
- **Servidor**: VPS Ubuntu 24.04 con nginx + Let's Encrypt
- **Formulario**: envía POST en paralelo a 2 destinos (API de Ceenford + Google Sheets)

---

## 1. Acceso al servidor

```bash
ssh ubuntu@149.56.133.201
# Password: (preguntar al dueño de DTGrowthPartners)
```

El usuario `ubuntu` tiene sudo passwordless.

**Importante**: el servidor hostea ~50 sitios distintos. NO tocar otros directorios fuera de `/var/www/ceenford/` y `/etc/nginx/sites-available/ceenford.dtgrowthpartners.com`.

## 2. Estructura del despliegue

```
/var/www/ceenford/              ← Código del sitio (clonado desde GitHub)
├── index.html                  Landing principal con el formulario
├── gracias.html                Página de confirmación post-submit
├── styles.css                  Todos los estilos
├── script.js                   Lógica JS (form submit, dropdowns, animaciones)
├── img/                        Assets (logos, íconos, fondos, foto sede)
└── .git/                       Repo activo, se actualiza con `git pull`

/etc/nginx/sites-available/ceenford.dtgrowthpartners.com
                                ← Config de nginx (servir archivos + SSL)

/etc/letsencrypt/live/ceenford.dtgrowthpartners.com/
                                ← Certificados SSL (auto-renovados)

/var/log/nginx/ceenford.access.log
/var/log/nginx/ceenford.error.log
                                ← Logs
```

## 3. Cómo desplegar cambios

El flujo es **git pull**, no se sube por SCP/FTP:

```bash
ssh ubuntu@149.56.133.201
cd /var/www/ceenford
sudo -u www-data git pull
# nginx sirve archivos estáticos, no hace falta reload
```

Si el comando da error de "dubious ownership":

```bash
sudo git config --global --add safe.directory /var/www/ceenford
sudo git pull
sudo chown -R www-data:www-data /var/www/ceenford
```

Para invalidar el caché del browser tras un cambio crítico de JS/CSS, podés agregar un query string al `<link>` o `<script>` (`?v=2`), aunque normalmente el `Last-Modified` que nginx envía es suficiente.

## 4. Cómo funciona el formulario

El usuario llena 4 pasos (opción de pago, tipo de participación, datos, confirmación). Al hacer submit, `script.js`:

1. Valida que todos los campos `required` estén llenos
2. Construye un JSON con todos los datos + metadata
3. Envía **dos `fetch` POST en paralelo** (`Promise.allSettled`):
   - **API de Ceenford** — `https://api.ceenford.org/API/index.php` (sistema oficial con DB del cliente)
   - **Google Sheets** — vía Apps Script Web App (backup/auditoría)
4. Si al menos uno responde OK → redirige a `gracias.html?nombre=Juan&id=20260522...`
5. Si los dos fallan → muestra banner rojo, usuario reintenta

### JSON que se envía al webhook (Google Sheets + WhatsApp futuro)

```json
{
  "opcion_pago": "hoy",                                  // "vip" | "hoy" | "registro"
  "opcion_pago_label": "350 USD",                        // texto legible
  "tipo_participacion": "asistente",                     // "asistente" | "estudiante" | "ponente" | "patrocinador"
  "tipo_participacion_label": "Asistente",
  "nombre": "Juan Pérez",
  "pais": "mx",                                          // código ISO en minúsculas
  "ciudad": "Monterrey",
  "telefono": "+52 555 123 4567",                        // siempre con indicativo
  "correo": "juan@ejemplo.com",                          // siempre lowercase
  "area": "psicologia",                                  // "psicologia" | "educacion" | "neurociencias" | "medicina" | "otro"
  "institucion": "Universidad XYZ",                      // null si está vacío
  "acepta_terminos": true,
  "confirma_registro": true,
  "enviado_en": "2026-08-15T14:30:00.000Z",              // ISO 8601 UTC
  "origen": "ceenford.dtgrowthpartners.com",
  "user_agent": "Mozilla/5.0 ...",
  "id": "20260815143000000"                              // YYYYMMDDHHMMSSmmm — ID único por timestamp
}
```

### JSON transformado que se envía a la API de Ceenford

El esquema de la API espera nombres distintos (ver `payloadToCeenfordApi` en `script.js`):

```json
{
  "name": "Juan Pérez",
  "email": "juan@ejemplo.com",
  "country": "México",                                   // nombre completo, no código
  "phone": "+52 555 123 4567",
  "city": "Monterrey",
  "professionl_area": "Psicología",                      // ⚠️ typo del lado de ellos
  "company": "Universidad XYZ",
  "event": "monterrey-2026",                             // viene de FORM_CONFIG.eventId
  "source": "ceenford.dtgrowthpartners.com",
  "document": "20260815143000000",                       // nuestro id timestamp para cross-reference
  "message": "Opción de pago: 350 USD | Tipo de participación: Asistente"
}
```

## 5. Cómo agregar WhatsApp notifications

Tenés tres caminos posibles, de más simple a más robusto:

### Opción A — Webhook adicional en el frontend (más simple, recomendado)

Editar `script.js` y agregar un tercer destino en la lógica de envío. Por ejemplo:

```js
const FORM_CONFIG = {
    webhookUrl:  'https://api.ceenford.org/API/index.php',
    sheetsUrl:   'https://script.google.com/macros/s/.../exec',
    whatsappUrl: 'https://tu-endpoint-whatsapp.com/notify',   // ← AGREGAR ESTO
    eventId:     'monterrey-2026'
};
```

Y en el submit handler (`initFormSubmit`):

```js
const results = await Promise.allSettled([
    sendToWebhook(FORM_CONFIG.webhookUrl, apiPayload),
    sendToWebhook(FORM_CONFIG.sheetsUrl,  payload),
    sendToWebhook(FORM_CONFIG.whatsappUrl, payload)   // ← AGREGAR ESTA LÍNEA
]);
```

Tu endpoint recibe el JSON completo (el de Google Sheets) por POST con `Content-Type: application/json`. Desde ahí disparás el mensaje de WhatsApp.

**Pros**: independiente del flujo actual, no toca nada de Ceenford. Si falla tu endpoint, el resto sigue.
**Contras**: si el usuario tiene JavaScript desactivado o el browser bloquea CORS, no llega.

### Opción B — Trigger desde Google Apps Script (más confiable)

El Apps Script ya recibe todos los registros (es el backup oficial). Podés agregar el envío de WhatsApp dentro de su `doPost`:

```js
function doPost(e) {
    const data = JSON.parse(e.postData.contents);
    const sheet = SpreadsheetApp.getActiveSheet();
    sheet.appendRow([data.enviado_en, data.nombre, ...]);

    // Notificar WhatsApp
    UrlFetchApp.fetch('https://tu-endpoint-whatsapp.com/notify', {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify(data),
        muteHttpExceptions: true
    });

    return ContentService.createTextOutput(JSON.stringify({ ok: true }))
        .setMimeType(ContentService.MimeType.JSON);
}
```

URL del Apps Script actual:
`https://script.google.com/macros/s/AKfycbyYsL9yLQJNl_HXMYim6HMhQBrW-LbhujnnkSjxVLiQHX4Jm56oDfHnwyyHfyOr0LIkCQ/exec`

Para editarlo necesitás acceso a la cuenta de Google que lo creó (`dev@dtgrowthpartners.com` o quien sea).

**Pros**: corre del lado servidor (Google), no depende del browser del usuario. Más confiable.
**Contras**: tenés que tocar el Apps Script y re-implementar (genera nueva versión).

### Opción C — Disparador sobre la hoja de Sheets (más independiente)

En la Google Sheet podés crear un trigger "On form submit" o "On change" que ejecute una función que mande WhatsApp. Esto se hace desde el editor de Apps Script:

```js
function onNewRow(e) {
    const sheet = SpreadsheetApp.getActiveSheet();
    const lastRow = sheet.getLastRow();
    const data = sheet.getRange(lastRow, 1, 1, sheet.getLastColumn()).getValues()[0];
    // [enviado_en, nombre, correo, telefono, pais, ciudad, pago, tipo, area, institucion, id]

    UrlFetchApp.fetch('https://tu-endpoint-whatsapp.com/notify', {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify({
            nombre: data[1],
            correo: data[2],
            telefono: data[3],
            // ...
            id: data[10]
        }),
        muteHttpExceptions: true
    });
}
```

Y configurás el trigger en `Apps Script → Triggers → Add Trigger → onNewRow → Spreadsheet → On change`.

**Pros**: totalmente desacoplado del form.
**Contras**: solo se dispara cuando la hoja cambia (puede haber lag).

### Cuál recomiendo

Si vos solo necesitás recibir un POST con los datos del registro, **opción A** es lo más simple. Te creás un endpoint (Lambda, Netlify Function, server propio) que reciba el JSON y dispare el WhatsApp con la API de Twilio/Meta/lo-que-uses.

Si necesitás algo más confiable y que no dependa del frontend, **opción B** dentro del Apps Script.

## 6. Cosas importantes a tener en cuenta

### CORS

- La API de Ceenford (`api.ceenford.org`) está en un dominio distinto al sitio. Hoy puede dar problemas de CORS desde el browser. Si pasa, igual los datos se guardan en Sheets (que es backup).
- Si tu endpoint de WhatsApp también está en otro dominio, asegurate de habilitar `Access-Control-Allow-Origin: *` en tus respuestas. O si querés un envío "fire-and-forget", podés usar `mode: 'no-cors'` como ya hacemos con el Apps Script (ver `sendToWebhook` en `script.js`).

### SSL

- Cert de Let's Encrypt, expira cada 90 días y se auto-renueva (cron de certbot).
- Si querés validar:
  ```bash
  sudo certbot certificates
  ```

### Logs y debugging

- Logs de nginx: `/var/log/nginx/ceenford.access.log` y `ceenford.error.log`
- Logs de Apps Script: `Apps Script → Ejecuciones` (panel izquierdo)
- Logs del browser: F12 → Console (los `console.error` salen ahí)

### Restart de nginx (rara vez necesario)

```bash
sudo nginx -t                  # Validar config
sudo systemctl reload nginx    # Recargar sin downtime
sudo systemctl restart nginx   # Restart completo
```

## 7. Variables sensibles

Ninguna está en el repo:

- Password del SSH → no commitear (está en `deploy_helper.py` que está en `.gitignore`)
- URL del Apps Script → está en `script.js` pública (no es sensible, pero es el endpoint donde caen los datos)
- Credenciales de Google → no se usan en frontend, todo va vía Apps Script

Cuando configures tu URL de WhatsApp, ponela directamente en `script.js`. Si tu endpoint requiere autenticación, podés agregar un header bearer token en `sendToWebhook` para los URLs que lo necesiten.

## 8. Contacto / dudas

Repo: https://github.com/DTGrowthPartners/ceenford
Sitio: https://ceenford.dtgrowthpartners.com
Hoja de Sheets actual: pedirle al equipo de DTGrowthPartners

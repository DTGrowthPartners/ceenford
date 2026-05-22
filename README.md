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

## Próximos pasos / handoff a backend

El form del Paso 3 (`<form class="form-datos">`) está listo para conectarse:

- Todos los inputs nativos (`<input>`) tienen `name` definidos: `nombre`, `ciudad`, `telefono`, `correo`, `institucion`, `terminos`, `confirma`
- Los dropdowns custom **(País y Área profesional)** guardan el valor en un `<input type="hidden">` con `name="pais"` y `name="area"`, y disparan evento `change` al seleccionar — funcionan igual que un `<select>` nativo para el backend
- Los radios del Paso 1 y Paso 2 tienen `name="opcion-paso1"` y `name="opcion-paso2"`

Para conectar:

1. Agregar `action` y `method` al `<form>` (o un `submit` listener)
2. Validar campos requeridos (todos están marcados con `required`)
3. Manejar respuesta y redirigir a una página de confirmación

## Compatibilidad

- Navegadores modernos (Chrome, Safari, Firefox, Edge — últimas 2 versiones)
- Mobile-first responsive desde 360px hasta 1280px+
- Respeta `prefers-reduced-motion` (los usuarios con esa preferencia ven el contenido sin animación)
- Soporte para iPhones con notch (`safe-area-inset`)

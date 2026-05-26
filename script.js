/**
 * Dropdowns personalizados (.custom-select)
 * ------------------------------------------
 * Reemplaza los <select> nativos por un componente accesible:
 *   - <button> como disparador (aria-haspopup, aria-expanded)
 *   - <ul role="listbox"> con opciones role="option"
 *   - <input type="hidden"> con el valor real para enviar al backend
 *
 * Al seleccionar una opción se dispara un evento "change" sobre el input
 * oculto, así un script de backend puede escuchar cambios igual que con
 * un <select> nativo.
 */
(function () {
    'use strict';

    // Solo puede haber un dropdown abierto a la vez
    let openSelect = null;

    // Cierra el dropdown actualmente abierto (si hay)
    function closeAll() {
        if (!openSelect) return;
        const root = openSelect;
        const trigger = root.querySelector('.custom-select__trigger');
        const panel = root.querySelector('.custom-select__panel');
        panel.hidden = true;
        trigger.setAttribute('aria-expanded', 'false');
        root.classList.remove('is-open');
        openSelect = null;
    }

    // Abre un dropdown. Si ya hay otro abierto, lo cierra primero.
    function open(root) {
        if (openSelect && openSelect !== root) closeAll();
        const trigger = root.querySelector('.custom-select__trigger');
        const panel = root.querySelector('.custom-select__panel');
        panel.hidden = false;
        trigger.setAttribute('aria-expanded', 'true');
        root.classList.add('is-open');
        openSelect = root;
    }

    // Alterna abrir/cerrar al hacer click en el disparador
    function toggle(root) {
        const panel = root.querySelector('.custom-select__panel');
        if (panel.hidden) open(root); else closeAll();
    }

    // Aplica la opción seleccionada: actualiza el label visible,
    // guarda el value en el input oculto y dispara evento change.
    function selectOption(root, opt) {
        const value = opt.dataset.value;
        const text = opt.querySelector('.custom-select__option-text').textContent.trim();
        const flagEl = opt.querySelector('.fi');
        const currentEl = root.querySelector('.custom-select__current');
        const hidden = root.querySelector('.custom-select__value');

        currentEl.innerHTML = '';
        if (flagEl) {
            const flagClone = flagEl.cloneNode(true);
            currentEl.appendChild(flagClone);
            currentEl.appendChild(document.createTextNode(' '));
        }
        currentEl.appendChild(document.createTextNode(text));
        currentEl.classList.add('is-filled');

        hidden.value = value;
        hidden.dispatchEvent(new Event('change', { bubbles: true }));

        root.querySelectorAll('.custom-select__option').forEach(o => {
            o.classList.toggle('is-active', o === opt);
            o.setAttribute('aria-selected', o === opt ? 'true' : 'false');
        });

        closeAll();
    }

    // Inicializa un dropdown: enlaza eventos al disparador y a cada opción
    function initSelect(root) {
        const trigger = root.querySelector('.custom-select__trigger');
        const options = root.querySelectorAll('.custom-select__option');

        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            toggle(root);
        });

        options.forEach(opt => {
            opt.addEventListener('click', () => selectOption(root, opt));
            // Selección con teclado (Enter o Espacio)
            opt.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    selectOption(root, opt);
                }
            });
        });
    }

    // Inicializa todos los dropdowns de la página y configura los listeners
    // globales (click fuera y tecla Escape para cerrar)
    function init() {
        document.querySelectorAll('.custom-select').forEach(initSelect);

        // Cerrar al hacer click fuera del dropdown
        document.addEventListener('click', (e) => {
            if (openSelect && !openSelect.contains(e.target)) closeAll();
        });

        // Cerrar al presionar Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && openSelect) closeAll();
        });

        // Inicializar animaciones fade-in al hacer scroll
        initFadeIn();

        // Inicializar el handler del formulario de registro
        initFormSubmit();

        // Sanitizar el input del teléfono (el "+" va como prefijo visual,
        // el usuario no lo escribe — si pega uno, lo quitamos)
        initPhoneInput();

        // Crear segunda fila del carrusel de partners (visible en mobile)
        initPartnersDualRow();
    }

    /**
     * Si el usuario pega o tipea un "+" al inicio del campo teléfono,
     * lo removemos. El "+" se muestra como prefijo visual (.form-field__prefix)
     * fuera del input, y se prepende al valor cuando se envía el formulario
     * (ver collectFormData).
     */
    function initPhoneInput() {
        const phoneInput = document.querySelector('input[name="telefono"]');
        if (!phoneInput) return;
        phoneInput.addEventListener('input', (e) => {
            if (e.target.value.startsWith('+')) {
                e.target.value = e.target.value.replace(/^\++/, '');
            }
        });
    }

    /**
     * Carrusel de partners:
     * 1. Clona el primer track para crear la segunda fila (visible solo
     *    en mobile, animada en dirección contraria).
     * 2. Espera a que todos los logos (originales + clones) terminen de
     *    cargar antes de mostrar el carrusel. Sin esto, los SVG aparecen
     *    de a uno en orden aleatorio según se descargan = mala UX.
     */
    function initPartnersDualRow() {
        const partners = document.querySelector('.hero__partners');
        if (!partners) return;

        // 1. Clonar para segunda fila
        const firstTrack = partners.querySelector('.hero__partners-track');
        if (firstTrack) {
            const secondTrack = firstTrack.cloneNode(true);
            secondTrack.classList.add('hero__partners-track--rtl');
            secondTrack.setAttribute('aria-hidden', 'true');
            partners.appendChild(secondTrack);
        }

        // 2. Esperar a que todos los logos terminen de cargar
        const images = Array.from(partners.querySelectorAll('.hero__partners-item'));
        const markReady = () => partners.classList.add('is-ready');

        if (images.length === 0) {
            markReady();
            return;
        }

        let loaded = 0;
        const onDone = () => {
            loaded++;
            if (loaded >= images.length) markReady();
        };

        images.forEach((img) => {
            if (img.complete) {
                onDone();
            } else {
                img.addEventListener('load', onDone, { once: true });
                img.addEventListener('error', onDone, { once: true });
            }
        });

        // Fallback: si algún logo nunca carga, mostrar igual después de 3s
        setTimeout(markReady, 3000);
    }

    /**
     * Configuración del envío del formulario
     * ---------------------------------------
     * El form envía cada inscripción a dos destinos en paralelo:
     *
     * 1. webhookUrl → API oficial de Ceenford (su sistema con base de
     *    datos). El payload se transforma al esquema que la API espera
     *    (ver payloadToCeenfordApi más abajo).
     *
     * 2. sheetsUrl  → Google Apps Script que guarda en una hoja como
     *    backup / auditoría con el detalle completo (incluyendo opción
     *    de pago, tipo de participación, IDs, etc.).
     *
     * Si alguna URL está vacía, se omite ese destino.
     */
    const FORM_CONFIG = {
        webhookUrl: 'https://api.ceenford.org/API/index.php',
        sheetsUrl:  'https://script.google.com/macros/s/AKfycbyYsL9yLQJNl_HXMYim6HMhQBrW-LbhujnnkSjxVLiQHX4Jm56oDfHnwyyHfyOr0LIkCQ/exec',

        // Identificador del evento al que pertenecen las inscripciones.
        // La API de Ceenford genera un "consecutive" único por evento.
        // Confirmar con el dev de ellos el formato exacto que esperan.
        eventId: 'monterrey-2026'
    };

    /**
     * Lee el texto visible (label) del custom-select identificado por
     * data-name. Por ejemplo para "pais" devuelve "México" en lugar del
     * código "mx". Útil para mandar al API de Ceenford los nombres
     * completos en vez de códigos ISO.
     */
    function getCustomSelectLabel(name) {
        const select = document.querySelector('.custom-select[data-name="' + name + '"]');
        if (!select) return null;
        const current = select.querySelector('.custom-select__current');
        if (!current || !current.classList.contains('is-filled')) return null;

        // Si tiene bandera (en país), excluirla del texto para devolver
        // solo el nombre del país sin el emoji/imagen.
        const clone = current.cloneNode(true);
        const flag = clone.querySelector('.fi');
        if (flag) flag.remove();
        return clone.textContent.trim();
    }

    /**
     * Transforma nuestro payload interno al esquema que espera la API
     * oficial de Ceenford (api.ceenford.org/API/index.php).
     *
     * Mapping:
     *   nombre        → name          (requerido)
     *   correo        → email         (requerido)
     *   pais          → country       (nombre completo, no código)
     *   telefono      → phone
     *   ciudad        → city          (API lo guarda dentro de message)
     *   area          → professionl_area  (typo del lado de ellos)
     *   institucion   → company
     *   id (nuestro)  → document      (referencia cruzada con la sheet)
     *   FORM_CONFIG.eventId → event   (la API genera un consecutive por evento)
     *   window.hostname → source
     *   opción pago + tipo → message  (no hay campos específicos en su API)
     */
    function payloadToCeenfordApi(payload) {
        const pago = payload.opcion_pago_label || payload.opcion_pago || '';
        const tipo = payload.tipo_participacion_label || payload.tipo_participacion || '';

        return {
            name:             payload.nombre,
            email:            payload.correo,
            country:          getCustomSelectLabel('pais') || payload.pais,
            phone:            payload.telefono,
            city:             payload.ciudad,
            professionl_area: getCustomSelectLabel('area') || payload.area,
            company:          payload.institucion || '',
            event:            FORM_CONFIG.eventId,
            source:           window.location.hostname,
            document:         payload.id,
            message:          'Opción de pago: ' + pago + ' | Tipo de participación: ' + tipo
        };
    }

    /**
     * Genera un ID consecutivo irrepetible basado en el timestamp UTC.
     * Formato: YYYYMMDDHHMMSSmmm (17 dígitos)
     * Ejemplo: 20260522205530123 → 2026-05-22 20:55:30.123 UTC
     *
     * Es el mismo ID en formato numérico que el enviado_en ISO, así si en
     * el futuro hay que correlacionarlos es trivial.
     */
    function generateId() {
        const d = new Date();
        const pad = (n, len = 2) => String(n).padStart(len, '0');
        return (
            d.getUTCFullYear().toString() +
            pad(d.getUTCMonth() + 1) +
            pad(d.getUTCDate()) +
            pad(d.getUTCHours()) +
            pad(d.getUTCMinutes()) +
            pad(d.getUTCSeconds()) +
            pad(d.getUTCMilliseconds(), 3)
        );
    }

    /**
     * Extrae todos los datos del form y arma un objeto plano listo para JSON.
     * Incluye los radios fuera del <form> (vinculados via form="form-registro"),
     * los inputs ocultos de los custom-select y los checkboxes.
     */
    function collectFormData(form) {
        const data = new FormData(form);
        const labelOpcionPago = {
            vip: '600 USD',
            hoy: '350 USD',
            registro: '0 USD (pago en 15 días)'
        };
        const labelTipoParticipacion = {
            asistente: 'Asistente',
            estudiante: 'Estudiante',
            ponente: 'Ponente',
            patrocinador: 'Patrocinador / Stand comercial'
        };

        const opcionPago = data.get('opcion-paso1');
        const tipoPart  = data.get('opcion-paso2');
        const now       = new Date();

        // Telefono: prepend "+" obligatorio. El "+" se muestra como prefijo
        // visual en el form pero no está en el value del input — lo agregamos
        // aquí. Si el usuario igual escribió un "+", lo limpiamos antes para
        // no terminar con "++52...".
        const phoneRaw = (data.get('telefono') || '').trim().replace(/^\++/, '');
        const telefono = phoneRaw ? '+' + phoneRaw : '';

        return {
            // Selecciones de pasos 1 y 2
            opcion_pago: opcionPago,
            opcion_pago_label: labelOpcionPago[opcionPago] || null,
            tipo_participacion: tipoPart,
            tipo_participacion_label: labelTipoParticipacion[tipoPart] || null,

            // Datos personales (paso 3)
            nombre:      (data.get('nombre')      || '').trim(),
            pais:        data.get('pais'),
            ciudad:      (data.get('ciudad')      || '').trim(),
            telefono:    telefono,
            correo:      (data.get('correo')      || '').trim().toLowerCase(),
            area:        data.get('area'),
            institucion: (data.get('institucion') || '').trim() || null,

            // Aceptaciones (paso 3)
            acepta_terminos:   data.get('terminos') === 'on',
            confirma_registro: data.get('confirma') === 'on',

            // Metadata útil para auditar el envío
            enviado_en: now.toISOString(),
            origen:     window.location.hostname,
            user_agent: navigator.userAgent,

            // ID consecutivo irrepetible (timestamp numérico)
            id: generateId()
        };
    }

    /**
     * Envía el payload al webhook configurado. Devuelve una Promise que
     * resuelve true si todo salió bien, false si hubo error de red.
     *
     * Detalle CORS con Apps Script de Google:
     * Apps Script web apps redirigen de script.google.com a
     * script.googleusercontent.com, y la response final no incluye
     * Access-Control-Allow-Origin que permita leer la respuesta. Eso hace
     * que fetch lance una excepción CORS aunque el doPost se haya
     * ejecutado correctamente.
     *
     * La solución estándar es usar mode: 'no-cors': el POST llega y se
     * procesa, pero la response es "opaca" (no se puede leer). Como sólo
     * nos interesa que llegue, asumimos éxito si no hubo excepción.
     *
     * En modo no-cors no se puede setear Content-Type custom; el body
     * va como text/plain por defecto. El doPost recibe el contenido en
     * e.postData.contents y lo parsea con JSON.parse — funciona igual.
     */
    async function sendToWebhook(url, payload) {
        if (!url) return null;
        const isAppsScript = url.includes('script.google.com');
        const options = {
            method: 'POST',
            body: JSON.stringify(payload),
            redirect: 'follow'
        };
        if (isAppsScript) {
            options.mode = 'no-cors';
        } else {
            options.headers = { 'Content-Type': 'application/json' };
        }
        try {
            const res = await fetch(url, options);
            // Con no-cors la response es opaca y res.ok siempre es false.
            // Si llegó hasta aquí sin excepción, el POST salió.
            if (options.mode === 'no-cors') return true;
            return res.ok;
        } catch (err) {
            console.error('[Form] Error enviando al webhook:', err);
            return false;
        }
    }

    function showError(submitBtn, message) {
        if (!submitBtn) return;
        const banner = document.createElement('div');
        banner.className = 'form-error';
        banner.setAttribute('role', 'alert');
        banner.textContent = message;
        submitBtn.parentNode.insertBefore(banner, submitBtn);
        setTimeout(() => banner.remove(), 6000);
    }

    function initFormSubmit() {
        const form = document.getElementById('form-registro');
        if (!form) return;

        const submitBtn = document.querySelector('[form="form-registro"][type="submit"]');

        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            // checkValidity() valida los required, pattern y custom dropdowns
            if (!form.checkValidity()) {
                form.reportValidity();
                return;
            }

            const payload = collectFormData(form);
            // Payload transformado al esquema de la API de Ceenford
            const apiPayload = payloadToCeenfordApi(payload);

            // Estado visual: deshabilitar mientras se procesa
            if (submitBtn) {
                submitBtn.disabled = true;
                const labelEl = submitBtn.querySelector('.btn-primary__label');
                if (labelEl) labelEl.textContent = 'Enviando...';
            }

            // Envío paralelo: API de Ceenford (con su esquema) y
            // Google Sheets (con nuestro payload completo de auditoría)
            const results = await Promise.allSettled([
                sendToWebhook(FORM_CONFIG.webhookUrl, apiPayload),
                sendToWebhook(FORM_CONFIG.sheetsUrl, payload)
            ]);

            // Consideramos éxito si AL MENOS UNO de los destinos funcionó.
            // Si la API de Ceenford falla por CORS u otra cosa, Google Sheets
            // queda como respaldo confiable; en producción ambos funcionarán.
            const configuredCount = [
                FORM_CONFIG.webhookUrl,
                FORM_CONFIG.sheetsUrl
            ].filter(Boolean).length;

            const successCount = results.filter(
                (r) => r.status === 'fulfilled' && r.value === true
            ).length;

            if (configuredCount > 0 && successCount === 0) {
                // Todos los destinos fallaron → re-habilitar y mostrar error
                if (submitBtn) {
                    submitBtn.disabled = false;
                    const labelEl = submitBtn.querySelector('.btn-primary__label');
                    if (labelEl) labelEl.textContent = 'Continuar con mi registro';
                }
                showError(submitBtn, 'No pudimos enviar tu registro. Intenta nuevamente en unos segundos.');
                return;
            }

            // Éxito → redirigir a la página de confirmación.
            // Pasamos el nombre y el ID como params por si en el futuro
            // la página de gracias quiere personalizar el saludo.
            const params = new URLSearchParams({
                nombre: (payload.nombre || '').split(' ')[0],
                id:     payload.id || ''
            });
            window.location.href = 'gracias.html?' + params.toString();
        });
    }

    /**
     * Animación fade-in al hacer scroll
     * ----------------------------------
     * Marca las secciones below-the-fold con la clase .fade-in (estado
     * oculto) y usa IntersectionObserver para agregar .is-visible cuando
     * entran al viewport, lo que dispara la transición CSS (ver styles.css).
     *
     * El .hero queda fuera porque ya es visible al cargar la página: animarlo
     * provocaría un flash brusco (visible → oculto → fade-in) ya que el JS
     * con `defer` corre después del render inicial.
     *
     * Fallback: si el navegador no soporta IntersectionObserver, se muestran
     * todas las secciones directamente sin animación.
     */
    function initFadeIn() {
        const sections = document.querySelectorAll(
            '.paso, .beneficios, .sede, .footer'
        );

        sections.forEach((s) => s.classList.add('fade-in'));

        // Fallback para navegadores sin soporte
        if (!('IntersectionObserver' in window)) {
            sections.forEach((s) => s.classList.add('is-visible'));
            return;
        }

        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                    // Una vez visible, dejar de observar (no repetir animación)
                    observer.unobserve(entry.target);
                }
            });
        }, {
            threshold: 0.08,
            rootMargin: '0px 0px -40px 0px'
        });

        sections.forEach((s) => observer.observe(s));
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

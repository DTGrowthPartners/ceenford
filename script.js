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

        // Crear segunda fila del carrusel de partners (visible en mobile)
        initPartnersDualRow();
    }

    /**
     * Crea una segunda fila del carrusel de partners clonando la primera.
     * Por CSS está oculta en desktop y solo aparece en mobile (<= 720px),
     * donde se anima en dirección contraria (de derecha a izquierda).
     */
    function initPartnersDualRow() {
        const partners = document.querySelector('.hero__partners');
        if (!partners) return;
        const firstTrack = partners.querySelector('.hero__partners-track');
        if (!firstTrack) return;
        const secondTrack = firstTrack.cloneNode(true);
        secondTrack.classList.add('hero__partners-track--rtl');
        secondTrack.setAttribute('aria-hidden', 'true');
        partners.appendChild(secondTrack);
    }

    /**
     * Configuración del envío del formulario
     * ---------------------------------------
     * Cuando llegue la URL del webhook de la otra empresa, ponla en
     * `webhookUrl` y los datos se enviarán automáticamente al hacer submit.
     *
     * Si también quieres guardar a Google Sheets vía Apps Script, pon la
     * URL del Web App en `sheetsUrl` (ver README para más info).
     *
     * Mientras estén vacíos, el submit solo imprime el JSON en consola y
     * muestra el estado de éxito en la UI (útil para testing).
     */
    const FORM_CONFIG = {
        webhookUrl: '',  // p.ej. 'https://api.empresa.com/webhook/inscripciones'
        sheetsUrl:  'https://script.google.com/macros/s/AKfycbzdK8VeWJFHj9sDaw3sN2sgCB88l-auEXJmyksAaTtKvszlkM_vrUJLFAWv98CTaiiXVg/exec'
    };

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
            telefono:    (data.get('telefono')    || '').trim(),
            correo:      (data.get('correo')      || '').trim().toLowerCase(),
            area:        data.get('area'),
            institucion: (data.get('institucion') || '').trim() || null,

            // Aceptaciones (paso 3)
            acepta_terminos:   data.get('terminos') === 'on',
            confirma_registro: data.get('confirma') === 'on',

            // Metadata útil para auditar el envío
            enviado_en: new Date().toISOString(),
            origen:     window.location.hostname,
            user_agent: navigator.userAgent
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

    /**
     * Muestra el estado de éxito reemplazando el botón con un mensaje.
     */
    function showSuccess(form, submitBtn) {
        const banner = document.createElement('div');
        banner.className = 'form-success';
        banner.setAttribute('role', 'status');
        banner.innerHTML = `
            <strong>¡Registro enviado!</strong>
            <span>Recibirás la confirmación en tu correo y WhatsApp en breve.</span>
        `;

        if (submitBtn && submitBtn.parentNode) {
            submitBtn.disabled = true;
            submitBtn.parentNode.insertBefore(banner, submitBtn);
        }

        // Scrollear al banner para que el usuario lo vea
        banner.scrollIntoView({ behavior: 'smooth', block: 'center' });
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

            // Imprime el JSON en consola para testing y para que el dev
            // de backend vea la estructura exacta que va a recibir.
            console.log('[Form] Payload listo para webhook:', payload);
            console.log('[Form] JSON string:\n' + JSON.stringify(payload, null, 2));

            // Estado visual: deshabilitar mientras se procesa
            if (submitBtn) {
                submitBtn.disabled = true;
                const labelEl = submitBtn.querySelector('.btn-primary__label');
                if (labelEl) labelEl.textContent = 'Enviando...';
            }

            // Envío paralelo a webhook y a sheets (si están configurados)
            const results = await Promise.allSettled([
                sendToWebhook(FORM_CONFIG.webhookUrl, payload),
                sendToWebhook(FORM_CONFIG.sheetsUrl,  payload)
            ]);

            const someConfigured = FORM_CONFIG.webhookUrl || FORM_CONFIG.sheetsUrl;
            const someFailed = results.some(r => r.status === 'fulfilled' && r.value === false);

            if (someConfigured && someFailed) {
                // Re-habilitar el botón y mostrar error
                if (submitBtn) {
                    submitBtn.disabled = false;
                    const labelEl = submitBtn.querySelector('.btn-primary__label');
                    if (labelEl) labelEl.textContent = 'Continuar con mi registro';
                }
                showError(submitBtn, 'No pudimos enviar tu registro. Intenta nuevamente en unos segundos.');
                return;
            }

            showSuccess(form, submitBtn);
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

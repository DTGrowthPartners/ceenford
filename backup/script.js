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
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

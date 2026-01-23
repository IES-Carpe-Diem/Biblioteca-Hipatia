import { showToast, setupFocusTrap, cleanupFocusTrap } from './utils.js';

export function setDaltonismMode(mode) {
    const body = document.body;
    body.setAttribute('data-daltonism', mode);
    localStorage.setItem('daltonism-mode', mode);
    const labels = {
        normal: 'Modo normal',
        deuteranomaly: 'Deuteranomalía (verde-rojo)',
        protanomaly: 'Protanomalía (rojo-verde)',
        tritanomaly: 'Tritanomalía (azul-amarillo)'
    };
    showToast(`Daltonismo: ${labels[mode]}`, 'success');
    document.querySelectorAll('input[name="daltonism"]').forEach(radio => {
        radio.checked = radio.value === mode;
    });
}

export function loadDaltonismMode() {
    const saved = localStorage.getItem('daltonism-mode') || 'normal';
    document.body.setAttribute('data-daltonism', saved);
}

export function updateFontSize(value) {
    const numValue = parseFloat(value) || 50;
    const multiplier = 0.2 + (numValue / 100) * 1.6;
    document.documentElement.style.setProperty('--font-size', `${multiplier}em`);
    localStorage.setItem('font-size', numValue);
    const fontValueSpan = document.getElementById('font-size-value');
    if (fontValueSpan) {
        fontValueSpan.textContent = numValue + '%';
    }
}

export function updateLetterSpacing(value) {
    const numValue = parseFloat(value) || 50;
    const spacing = (numValue - 50) / 50 * 0.32;
    document.documentElement.style.setProperty('--letter-spacing', `${spacing}em`);
    localStorage.setItem('letter-spacing', numValue);
    const letterValueSpan = document.getElementById('letter-spacing-value');
    if (letterValueSpan) {
        letterValueSpan.textContent = numValue + '%';
    }
}

export function updateButtonSize(value) {
    const numValue = parseFloat(value) || 50;
    const multiplier = 0.2 + (numValue / 100) * 1.6;
    document.documentElement.style.setProperty('--button-size', `${multiplier}em`);
    localStorage.setItem('button-size', numValue);
    const buttonValueSpan = document.getElementById('button-size-value');
    if (buttonValueSpan) {
        buttonValueSpan.textContent = numValue + '%';
    }
}

export function updateContrast(value) {
    const numValue = parseFloat(value) || 50;
    const level = 0.2 + (numValue / 100) * 1.6;
    document.documentElement.style.setProperty('--contrast', level);
    localStorage.setItem('contrast', numValue);
    const contrastValueSpan = document.getElementById('contrast-value');
    if (contrastValueSpan) {
        contrastValueSpan.textContent = numValue + '%';
    }
}

export function updateBrightness(value) {
    const numValue = parseFloat(value) || 50;
    const level = 0.3 + (numValue / 100) * 1.4;
    document.documentElement.style.setProperty('--brightness', level);
    localStorage.setItem('brightness', numValue);
    const brightnessValueSpan = document.getElementById('brightness-value');
    if (brightnessValueSpan) {
        brightnessValueSpan.textContent = numValue + '%';
    }
}

export function loadSizeCSS() {
    try {
        const fontSize = localStorage.getItem('font-size') || 50;
        const letterSpacing = localStorage.getItem('letter-spacing') || 50;
        const buttonSize = localStorage.getItem('button-size') || 50;
        const contrast = localStorage.getItem('contrast') || 50;
        const brightness = localStorage.getItem('brightness') || 50;
        updateFontSize(fontSize);
        updateLetterSpacing(letterSpacing);
        updateButtonSize(buttonSize);
        updateContrast(contrast);
        updateBrightness(brightness);
    } catch (e) {
        console.warn('Error loading accessibility CSS:', e);
        document.documentElement.style.setProperty('--font-size', '1em');
        document.documentElement.style.setProperty('--letter-spacing', '0em');
        document.documentElement.style.setProperty('--button-size', '1em');
        document.documentElement.style.setProperty('--contrast', '1');
        document.documentElement.style.setProperty('--brightness', '1');
    }
}

function loadSliderValues() {
    const fontSize = localStorage.getItem('font-size') || 50;
    const letterSpacing = localStorage.getItem('letter-spacing') || 50;
    const buttonSize = localStorage.getItem('button-size') || 50;
    const contrast = localStorage.getItem('contrast') || 50;
    const brightness = localStorage.getItem('brightness') || 50;

    const fontSlider = document.getElementById('font-size-slider');
    const letterSlider = document.getElementById('letter-spacing-slider');
    const buttonSlider = document.getElementById('button-size-slider');
    const contrastSlider = document.getElementById('contrast-slider');
    const brightnessSlider = document.getElementById('brightness-slider');

    const fontValue = document.getElementById('font-size-value');
    const letterValue = document.getElementById('letter-spacing-value');
    const buttonValue = document.getElementById('button-size-value');
    const contrastValue = document.getElementById('contrast-value');
    const brightnessValue = document.getElementById('brightness-value');

    if (fontSlider) fontSlider.value = fontSize;
    if (letterSlider) letterSlider.value = letterSpacing;
    if (buttonSlider) buttonSlider.value = buttonSize;
    if (contrastSlider) contrastSlider.value = contrast;
    if (brightnessSlider) brightnessSlider.value = brightness;

    if (fontValue) fontValue.textContent = fontSize + '%';
    if (letterValue) letterValue.textContent = letterSpacing + '%';
    if (buttonValue) buttonValue.textContent = buttonSize + '%';
    if (contrastValue) contrastValue.textContent = contrast + '%';
    if (brightnessValue) brightnessValue.textContent = brightness + '%';
}

export function resetAccessibility() {
    setDaltonismMode('normal');
    const fontSlider = document.getElementById('font-size-slider');
    const letterSlider = document.getElementById('letter-spacing-slider');
    const buttonSlider = document.getElementById('button-size-slider');
    const contrastSlider = document.getElementById('contrast-slider');
    const brightnessSlider = document.getElementById('brightness-slider');

    if (fontSlider) fontSlider.value = 50;
    if (letterSlider) letterSlider.value = 50;
    if (buttonSlider) buttonSlider.value = 50;
    if (contrastSlider) contrastSlider.value = 50;
    if (brightnessSlider) brightnessSlider.value = 50;

    updateFontSize(50);
    updateLetterSpacing(50);
    updateButtonSize(50);
    updateContrast(50);
    updateBrightness(50);
    showToast('Ajustes de accesibilidad restablecidos', 'success');
}

export function abrirModalAccesibilidad() {
    const content = document.getElementById('accessibilityContent');
    const currentDaltonism = document.body.getAttribute('data-daltonism') || 'normal';
    content.innerHTML = `
        <div class="accessibility-section">
            <h4>⌨️ Navegación por Teclado y Lectores de pantalla</h4>
            <p>¡Hola, explorador! Usa el Tabulador para saltar entre botones e inputs, Enter para activarlos y Escape para cerrar ventanas. Si lees con un screen reader 👂, como NVDA o VoiceOver, hemos etiquetado todo para que sea claro y accesible.</p>
        </div>
        <div class="accessibility-section">
            <h4>👁️ Visión y Contraste</h4>
            <div class="accessibility-group">
                <label for="contrast-slider">Alto Contraste (<span id="contrast-value">50%</span>)</label>
                <input type="range"
                       id="contrast-slider"
                       min="0"
                       max="100"
                       value="50"
                       step="1"
                       oninput="updateContrast(this.value)">
            </div>
            <div class="accessibility-group">
                <label for="brightness-slider">Brillo (<span id="brightness-value">50%</span>)</label>
                <input type="range"
                       id="brightness-slider"
                       min="0"
                       max="100"
                       value="50"
                       step="1"
                       oninput="updateBrightness(this.value)">
            </div>
            <div class="accessibility-group">
                <label>Daltonismo</label>
                <div class="daltonism-options">
                    <div class="daltonism-option">
                        <input type="radio"
                               id="daltonism-normal"
                               name="daltonism"
                               value="normal"
                               ${currentDaltonism === 'normal' ? 'checked' : ''}>
                        <label for="daltonism-normal">Normal</label>
                    </div>
                    <div class="daltonism-option">
                        <input type="radio"
                               id="daltonism-deuteranomaly"
                               name="daltonism"
                               value="deuteranomaly"
                               ${currentDaltonism === 'deuteranomaly' ? 'checked' : ''}>
                        <label for="daltonism-deuteranomaly">Deuteranomalía (verde-rojo)</label>
                    </div>
                    <div class="daltonism-option">
                        <input type="radio"
                               id="daltonism-protanomaly"
                               name="daltonism"
                               value="protanomaly"
                               ${currentDaltonism === 'protanomaly' ? 'checked' : ''}>
                        <label for="daltonism-protanomaly">Protanomalía (rojo-verde)</label>
                    </div>
                    <div class="daltonism-option">
                        <input type="radio"
                               id="daltonism-tritanomaly"
                               name="daltonism"
                               value="tritanomaly"
                               ${currentDaltonism === 'tritanomaly' ? 'checked' : ''}>
                        <label for="daltonism-tritanomaly">Tritanomalía (azul-amarillo)</label>
                    </div>
                </div>
            </div>
        </div>
        <div class="accessibility-section">
            <h4>✋ Tamaños y Espaciado</h4>
            <div class="accessibility-group">
                <label for="font-size-slider">Tamaño de Letras (<span id="font-size-value">50%</span>)</label>
                <input type="range"
                       id="font-size-slider"
                       min="0"
                       max="100"
                       value="50"
                       step="1"
                       oninput="updateFontSize(this.value)">
            </div>
            <div class="accessibility-group">
                <label for="letter-spacing-slider">Espacio entre Letras (<span id="letter-spacing-value">50%</span>)</label>
                <input type="range"
                       id="letter-spacing-slider"
                       min="0"
                       max="100"
                       value="50"
                       step="1"
                       oninput="updateLetterSpacing(this.value)">
            </div>
            <div class="accessibility-group">
                <label for="button-size-slider">Tamaño de Botones (<span id="button-size-value">50%</span>)</label>
                <input type="range"
                       id="button-size-slider"
                       min="0"
                       max="100"
                       value="50"
                       step="1"
                       oninput="updateButtonSize(this.value)">
            </div>
        </div>
        <div class="accessibility-section">
            <h4>ℹ️ Sobre estos ajustes</h4>
            <p>Inspirados en las <a href="https://www.w3.org/WAI/standards-guidelines/wcag/es" target="_blank" rel="noopener noreferrer">Directrices WCAG 2.2</a> del W3C, estos controles garantizan una accesibilidad web inclusiva y te permiten personalizar tu experiencia adaptándola a tus necesidades específicas.</p>
        </div>
        <div class="accessibility-group">
            <button class="reset-btn" onclick="resetAccessibility()">Restablecer Ajustes</button>
        </div>
    `;
    loadSliderValues();
    document.querySelectorAll('input[name="daltonism"]').forEach(radio => {
        radio.addEventListener('change', (e) => setDaltonismMode(e.target.value));
    });
    document.getElementById('accessibilityModal').style.display = 'block';
    setupFocusTrap('accessibilityModal');
    const themeControls = document.querySelector('.theme-controls');
    if (themeControls) themeControls.classList.add('active');
}

export function cerrarModalAccesibilidad() {
    cleanupFocusTrap('accessibilityModal');
    document.getElementById('accessibilityModal').style.display = 'none';
    const themeControls = document.querySelector('.theme-controls');
    if (themeControls) themeControls.classList.remove('active');
}
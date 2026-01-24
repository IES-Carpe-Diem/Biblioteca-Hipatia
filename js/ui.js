// js/ui.js
// Módulo responsable de la interfaz de usuario (UI) y accesibilidad
// Incluye:
//   - Gestión de temas (claro/oscuro)
//   - Ajustes de accesibilidad (tamaño fuente, espaciado, contraste, brillo, daltonismo)
//   - Modales (búsqueda, favoritos, valorados, accesibilidad, admin)
//   - Favoritos y valoraciones (estrellas, fireworks)
//   - Paginación y resultados de búsqueda
//   - Contador diario y funciones auxiliares de UI
//   - Panel de administrador para portadas

let searchResults = [];
let searchQuery = '';
let currentPageSearch = 1;
let currentPageFavoritos = 1;
let currentPageValorados = 1;
let toastCount = 0;
let favoritos = JSON.parse(localStorage.getItem('libros_favoritos')) || [];

function toggleTheme() {
    const body = document.body;
    const isDark = body.getAttribute('data-theme') === 'dark';
    const newTheme = isDark ? 'light' : 'dark';
    body.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    const themeBtn = document.querySelector('.theme-toggle');
    themeBtn.textContent = newTheme === 'dark' ? '☀️' : '🌙';
    showToast(newTheme === 'dark' ? 'Modo oscuro activado' : 'Modo claro activado', 'success');
}

function loadTheme() {
    const saved = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const defaultTheme = saved || (prefersDark ? 'dark' : 'light');
    document.body.setAttribute('data-theme', defaultTheme);
    const themeBtn = document.querySelector('.theme-toggle');
    themeBtn.textContent = defaultTheme === 'dark' ? '☀️' : '🌙';
}

function setDaltonismMode(mode) {
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

function loadDaltonismMode() {
    const saved = localStorage.getItem('daltonism-mode') || 'normal';
    document.body.setAttribute('data-daltonism', saved);
}

function updateFontSize(value) {
    const numValue = parseFloat(value) || 50;
    const multiplier = 0.2 + (numValue / 100) * 1.6;
    document.documentElement.style.setProperty('--font-size', `${multiplier}em`);
    localStorage.setItem('font-size', numValue);
    const fontValueSpan = document.getElementById('font-size-value');
    if (fontValueSpan) {
        fontValueSpan.textContent = numValue + '%';
    }
}

function updateLetterSpacing(value) {
    const numValue = parseFloat(value) || 50;
    const spacing = (numValue - 50) / 50 * 0.32;
    document.documentElement.style.setProperty('--letter-spacing', `${spacing}em`);
    localStorage.setItem('letter-spacing', numValue);
    const letterValueSpan = document.getElementById('letter-spacing-value');
    if (letterValueSpan) {
        letterValueSpan.textContent = numValue + '%';
    }
}

function updateButtonSize(value) {
    const numValue = parseFloat(value) || 50;
    const multiplier = 0.2 + (numValue / 100) * 1.6;
    document.documentElement.style.setProperty('--button-size', `${multiplier}em`);
    localStorage.setItem('button-size', numValue);
    const buttonValueSpan = document.getElementById('button-size-value');
    if (buttonValueSpan) {
        buttonValueSpan.textContent = numValue + '%';
    }
}

function updateContrast(value) {
    const numValue = parseFloat(value) || 50;
    const level = 0.2 + (numValue / 100) * 1.6;
    document.documentElement.style.setProperty('--contrast', level);
    localStorage.setItem('contrast', numValue);
    const contrastValueSpan = document.getElementById('contrast-value');
    if (contrastValueSpan) {
        contrastValueSpan.textContent = numValue + '%';
    }
}

function updateBrightness(value) {
    const numValue = parseFloat(value) || 50;
    const level = 0.3 + (numValue / 100) * 1.4;
    document.documentElement.style.setProperty('--brightness', level);
    localStorage.setItem('brightness', numValue);
    const brightnessValueSpan = document.getElementById('brightness-value');
    if (brightnessValueSpan) {
        brightnessValueSpan.textContent = numValue + '%';
    }
}

function loadSizeCSS() {
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

function resetAccessibility() {
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

function abrirModalAccesibilidad() {
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

function cerrarModalAccesibilidad() {
    cleanupFocusTrap('accessibilityModal');
    document.getElementById('accessibilityModal').style.display = 'none';
    const themeControls = document.querySelector('.theme-controls');
    if (themeControls) themeControls.classList.remove('active');
}

function cerrarModal() {
    cleanupFocusTrap('searchModal');
    document.getElementById('searchModal').style.display = 'none';
    document.getElementById('buscarInput').focus();
    document.getElementById('modalSearchInput').value = '';
    document.querySelector('.theme-controls').classList.remove('active');
}

function cerrarModalAdmin() {
    cleanupFocusTrap('adminModal');
    document.getElementById('adminModal').style.display = 'none';
    document.getElementById('adminContent').innerHTML = '';
}

function cerrarModalFavoritos() {
    cleanupFocusTrap('favoritosModal');
    document.getElementById('favoritosModal').style.display = 'none';
    currentPageFavoritos = 1;
}

function cerrarModalValorados() {
    cleanupFocusTrap('valoradosModal');
    document.getElementById('valoradosModal').style.display = 'none';
    currentPageValorados = 1;
}

function openReservationForm() {
    window.open(CONFIG.FORMS.RESERVA, '_blank', 'noopener,noreferrer');
}

function openReviewForm() {
    window.open(CONFIG.FORMS.RESEÑA, '_blank', 'noopener,noreferrer');
}

function openRequestForm() {
    window.open(CONFIG.FORMS.SOLICITUD, '_blank', 'noopener,noreferrer');
}

function openDonationForm() {
    window.open(CONFIG.FORMS.DONACIONES, '_blank', 'noopener,noreferrer');
}

const handleSearchKeypress = debounce((event) => {
    if (event.key === 'Enter') mostrarResultadosBusqueda();
}, CONFIG.DEBOUNCE_DELAY);

const handleModalSearchKeypress = debounce((event) => {
    if (event.key === 'Enter') buscarEnModal();
}, CONFIG.DEBOUNCE_DELAY);

function mostrarResultadosBusqueda() {
    if (!catalogo.length) {
        showToast('Catálogo en Mantenimiento, disculpe las molestias.', 'warning');
        return;
    }
    const query = document.getElementById('buscarInput').value.trim();
    if (!query) {
        showToast('Por favor, introduce un término de búsqueda.', 'warning');
        return;
    }
    searchQuery = query;
    searchResults = buscarLibros(query);
    currentPageSearch = 1;
    abrirModal();
    mostrarResultadosModal();
}

function buscarEnModal() {
    const query = document.getElementById('modalSearchInput').value.trim();
    if (!query) {
        showToast('Por favor, introduce un término de búsqueda.', 'warning');
        return;
    }
    searchQuery = query;
    document.getElementById('buscarInput').value = query;
    searchResults = buscarLibros(query);
    currentPageSearch = 1;
    mostrarResultadosModal();
}

function abrirModal() {
    const modal = document.getElementById('searchModal');
    const modalSearchInput = document.getElementById('modalSearchInput');
    modalSearchInput.value = searchQuery;
    modal.style.display = 'block';
    setupFocusTrap('searchModal');
    modalSearchInput.focus();
    document.querySelector('.theme-controls').classList.add('active');
    detenerRotativas();
}

function mostrarResultadosModal() {
    const pageSize = CONFIG.PAGE_SIZE;
    const totalPages = Math.ceil(searchResults.length / pageSize);
    const start = (currentPageSearch - 1) * pageSize;
    const end = start + pageSize;
    const paginatedResults = searchResults.slice(start, end);
    const isAdminLogged = localStorage.getItem('adminLogged') === 'true';
    const conteoDiv = document.getElementById('conteoResultadosModal');
    if (searchResults.length > 0) {
        conteoDiv.textContent = `Encontrados ${searchResults.length} resultados. El color del Tejuelo indica su estantería.`;
        conteoDiv.style.display = 'block';
    } else {
        let sugerencia = '';
        if (searchQuery.length > 3) {
            const similar = catalogo.find(l => {
                const tituloNorm = normalizarTexto(l.titulo);
                const queryNorm = normalizarTexto(searchQuery);
                return tituloNorm.includes(queryNorm.slice(0, -1)) || tituloNorm.includes(queryNorm.slice(1));
            });
            if (similar) {
                sugerencia = `¿Quizás querías decir "${similar.titulo}"? Inténtalo buscando eso.`;
            }
        }
        conteoDiv.innerHTML = `No se encontraron resultados para "${searchQuery}". ${sugerencia || 'Intenta con otra palabra clave.'}`;
        conteoDiv.style.display = 'block';
    }
    const resultadosDiv = document.getElementById('resultadosModal');
    resultadosDiv.innerHTML = paginatedResults.map(libro => {
        const esFavorito = favoritos.includes(libro.idRegistro);
        return `
                <div class="libro-modal" role="region" aria-label="Resultado de búsqueda para ${libro.titulo}">
                    <div class="portada-section">
                        <div class="portada-container" data-libro-id="${libro.idRegistro}"></div>
                    </div>
                    <div class="info-section">
                        <p><strong>Título:</strong> ${libro.titulo}</p>
                        <p><strong>Autor:</strong> ${libro.autor}</p>
                        <p><strong>Categoría:</strong> ${libro.categoria}</p>
                        <p><strong>Tejuelo:</strong> <span class="tejuelo" data-categoria="${libro.categoria.toLowerCase()}">${libro.signatura || 'N/A'}</span></p>
                        <p><strong>Ejemplares Disponibles:</strong> ${libro.copiasDisponibles || 0}</p>
                        <p><strong>Valoración:</strong>
                            <span class="estrellas" data-id="${libro.idRegistro}" data-titulo="${encodeURIComponent(libro.titulo)}" role="slider" aria-valuemin="1" aria-valuemax="5" aria-valuenow="0" aria-label="Calificar ${libro.titulo} con estrellas">
                                ${[1,2,3,4,5].map(i => `<span class="estrella" data-value="${i}">★</span>`).join('')}
                            </span>
                            <span id="promedio-${libro.idRegistro}" class="promedio">Cargando...</span>
                        </p>
                        <button class="reserva-libro-btn" onclick="openReservationForm()"
                             aria-label="Reservar el libro ${libro.titulo}">Reservar Libro 📚</button>
                        <button class="sinopsis-btn" onclick="mostrarSinopsis('${libro.idRegistro}', '${sanitizeHTML(libro.titulo)}', '${sanitizeHTML(libro.autor)}')"
                                aria-label="Generar sinopsis para ${libro.titulo}">Generar Sinopsis 📝</button>
                        <button class="favorito-btn ${esFavorito ? 'active' : ''}" onclick="toggleFavorito('${libro.idRegistro}')" aria-label="${esFavorito ? 'Quitar' : 'Agregar'} a favoritos el libro ${libro.titulo}">❤️</button>
                        <button class="add-cover-btn" onclick="abrirLoginAdmin('${libro.idRegistro}')"
                            aria-label="Abrir panel de admin para subir portada para ${libro.titulo}">+</button>
                        ${isAdminLogged && (libro.portadas || []).length > 0 ? `
                            <button class="delete-cover-btn" onclick="abrirEliminarPortada('${libro.idRegistro}')"
                                aria-label="Eliminar portada para ${libro.titulo}">−</button>
                        ` : ''}
                        <div id="sinopsis-${libro.idRegistro}" style="display: none; margin-top: 10px;"></div>
                    </div>
                </div>
                `;
    }).join('') || '<p>No se encontraron libros en esta página.</p>';
    const paginationDiv = document.getElementById('searchPagination');
    if (totalPages > 1) {
        let paginationHTML = '';
        paginationHTML += `<button onclick="changePageSearch(${currentPageSearch - 1})" ${currentPageSearch === 1 ? 'disabled' : ''}>Anterior</button>`;
        for (let i = 1; i <= totalPages; i++) {
            paginationHTML += `<button onclick="changePageSearch(${i})" ${i === currentPageSearch ? 'class="active"' : ''}>${i}</button>`;
        }
        paginationHTML += `<button onclick="changePageSearch(${currentPageSearch + 1})" ${currentPageSearch === totalPages ? 'disabled' : ''}>Siguiente</button>`;
        paginationDiv.innerHTML = paginationHTML;
        paginationDiv.style.display = 'block';
    } else {
        paginationDiv.style.display = 'none';
    }
    requestAnimationFrame(async () => {
        try {
            const containers = document.querySelectorAll('.portada-container');
            for (const container of containers) {
                const idLibro = container.dataset.libroId;
                await renderPortadas(container, idLibro);
            }
        } catch (error) {
            console.error('Error rendering portadas:', error);
        }
    });
    initEstrellas();
    iniciarRotativas();
}

function changePageSearch(newPage) {
    const totalPages = Math.ceil(searchResults.length / CONFIG.PAGE_SIZE);
    if (newPage < 1 || newPage > totalPages) return;
    currentPageSearch = newPage;
    mostrarResultadosModal();
}

function renderPagination(containerId, currentPage, totalPages, changeFn) {
    const paginationDiv = document.getElementById(containerId);
    if (totalPages <= 1) {
        paginationDiv.style.display = 'none';
        return;
    }
    let html = `<button onclick="${changeFn}(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>Anterior</button>`;
    for (let i = 1; i <= totalPages; i++) {
        html += `<button onclick="${changeFn}(${i})" ${i === currentPage ? 'class="active"' : ''}>${i}</button>`;
    }
    html += `<button onclick="${changeFn}(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>Siguiente</button>`;
    paginationDiv.innerHTML = html;
    paginationDiv.style.display = 'block';
}

function changePageFavoritos(newPage) {
    const totalPages = Math.ceil(favoritos.length / CONFIG.PAGE_SIZE);
    if (newPage < 1 || newPage > totalPages) return;
    currentPageFavoritos = newPage;
    abrirModalFavoritos();
}

function changePageValorados(newPage) {
    currentPageValorados = newPage;
    abrirModalValorados();
}

function toggleFavorito(idLibro) {
    const index = favoritos.indexOf(idLibro);
    if (index > -1) {
        favoritos.splice(index, 1);
        showToast('Libro removido de favoritos', 'warning');
    } else {
        favoritos.push(idLibro);
        showToast('Libro agregado a favoritos', 'success');
    }
    localStorage.setItem('libros_favoritos', JSON.stringify(favoritos));
    mostrarResultadosModal();
}

function abrirModalFavoritos() {
    const content = document.getElementById('favoritosContent');
    if (favoritos.length === 0) {
        content.innerHTML = '<p>No hay libros favoritos agregados.</p>';
        document.getElementById('favoritosPagination').style.display = 'none';
        return;
    }
    const librosFavoritos = favoritos.map(id => catalogo.find(l => l.idRegistro === id)).filter(Boolean);
    const totalPages = Math.ceil(librosFavoritos.length / CONFIG.PAGE_SIZE);
    const start = (currentPageFavoritos - 1) * CONFIG.PAGE_SIZE;
    const end = start + CONFIG.PAGE_SIZE;
    const paginated = librosFavoritos.slice(start, end);
    const isAdminLogged = localStorage.getItem('adminLogged') === 'true';
    content.innerHTML = paginated.map(libro => {
        const esFavorito = true;
        return `
                    <div class="libro-modal" role="region" aria-label="Libro favorito: ${libro.titulo}">
                        <div class="portada-section">
                            <div class="portada-container" data-libro-id="${libro.idRegistro}"></div>
                        </div>
                        <div class="info-section">
                            <p><strong>Título:</strong> ${libro.titulo || 'Sin título'}</p>
                            <p><strong>Autor:</strong> ${libro.autor || 'Desconocido'}</p>
                            <p><strong>Categoría:</strong> ${libro.categoria || 'No disponible'}</p>
                            <p><strong>Tejuelo:</strong>
                                <span class="tejuelo" data-categoria="${(libro.categoria || 'general').toLowerCase()}">
                                    ${libro.signatura || 'N/A'}
                                </span>
                            </p>
                            <p><strong>Ejemplares Disponibles:</strong> ${libro.copiasDisponibles || 0}</p>
                            <p><strong>Valoración:</strong>
                                <span class="estrellas" data-id="${libro.idRegistro}" data-titulo="${encodeURIComponent(libro.titulo || 'Sin título')}" role="slider" aria-valuemin="1" aria-valuemax="5" aria-valuenow="0" aria-label="Calificar ${libro.titulo} con estrellas">
                                    ${[1,2,3,4,5].map(i => `<span class="estrella" data-value="${i}">★</span>`).join('')}
                                </span>
                                <span id="promedio-${libro.idRegistro}" class="promedio">Cargando...</span>
                            </p>
                            <button class="reserva-libro-btn" onclick="openReservationForm()"
                                 aria-label="Reservar el libro ${libro.titulo}">Reservar Libro 📚</button>
                            <button class="sinopsis-btn" onclick="mostrarSinopsis('${libro.idRegistro}', '${sanitizeHTML(libro.titulo || 'Sin título')}', '${sanitizeHTML(libro.autor || 'Desconocido')}')"
                                    aria-label="Generar sinopsis para ${libro.titulo}">Generar Sinopsis 📝</button>
                            <button class="favorito-btn active" onclick="toggleFavorito('${libro.idRegistro}')" aria-label="Quitar de favoritos el libro ${libro.titulo}">❤️</button>
                            <button class="add-cover-btn" onclick="abrirLoginAdmin('${libro.idRegistro}')"
                                aria-label="Abrir panel de admin para subir portada para ${libro.titulo}">+</button>
                            ${isAdminLogged && (libro.portadas || []).length > 0 ? `
                                <button class="delete-cover-btn" onclick="abrirEliminarPortada('${libro.idRegistro}')"
                                    aria-label="Eliminar portada para ${libro.titulo}">−</button>
                            ` : ''}
                            <div id="sinopsis-${libro.idRegistro}" style="display: none; margin-top: 10px;"></div>
                        </div>
                    </div>
                `;
    }).join('') || '<p>No hay libros en esta página.</p>';
    requestAnimationFrame(async () => {
        const containers = content.querySelectorAll('.portada-container');
        for (const container of containers) {
            const idLibro = container.dataset.libroId;
            await renderPortadas(container, idLibro);
        }
        initEstrellas();
    });
    renderPagination('favoritosPagination', currentPageFavoritos, totalPages, 'changePageFavoritos');
    document.getElementById('favoritosModal').style.display = 'block';
    setupFocusTrap('favoritosModal');
}

async function abrirModalValorados() {
    const content = document.getElementById('valoradosContent');
    content.innerHTML = '<p>Cargando libros más valorados...</p>';
    document.getElementById('valoradosModal').style.display = 'block';
    setupFocusTrap('valoradosModal');
    try {
        const url = `${CONFIG.WEB_APP_URL}?action=getTopCalificados&limit=10&t=${Date.now()}`;
        const response = await fetch(url);
        const text = await response.text();
        let data;
        try { data = JSON.parse(text); }
        catch (e) { throw new Error('JSON inválido: ' + text); }
        if (data.error) throw new Error(data.error);
        if (!Array.isArray(data)) {
            content.innerHTML = '<p>No hay calificaciones aún.</p>';
            return;
        }
        if (data.length === 0) {
            content.innerHTML = '<p>No hay calificaciones suficientes aún.</p>';
            return;
        }
        const catalogoConId = catalogo.map(l => ({
            ...l,
            idRegistro: String(l.idRegistro || l.id_documento || '')
        }));
        const librosValidos = data
            .map(top => {
                const libro = catalogoConId.find(l => l.idRegistro === String(top.id));
                if (!libro) {
                    console.warn('Libro no encontrado en catálogo:', top.id, top.titulo);
                    return null;
                }
                return { ...libro, ...top };
            })
            .filter(Boolean);
        if (librosValidos.length === 0) {
            content.innerHTML = '<p>No hay libros valorados en el catálogo.</p>';
            return;
        }
        const totalPages = Math.ceil(librosValidos.length / CONFIG.PAGE_SIZE);
        const start = (currentPageValorados - 1) * CONFIG.PAGE_SIZE;
        const end = start + CONFIG.PAGE_SIZE;
        const paginated = librosValidos.slice(start, end);
        const isAdminLogged = localStorage.getItem('adminLogged') === 'true';
        content.innerHTML = paginated.map(libro => {
            const esFavorito = favoritos.includes(libro.idRegistro);
            return `
                        <div class="libro-modal" role="region" aria-label="Libro más valorado: ${libro.titulo}">
                            <div class="portada-section">
                                <div class="portada-container" data-libro-id="${libro.idRegistro}"></div>
                            </div>
                            <div class="info-section">
                                <p><strong>Título:</strong> ${libro.titulo || 'Sin título'}</p>
                                <p><strong>Autor:</strong> ${libro.autor || 'Desconocido'}</p>
                                <p><strong>Categoría:</strong> ${libro.categoria || 'No disponible'}</p>
                                <p><strong>Tejuelo:</strong>
                                    <span class="tejuelo" data-categoria="${(libro.categoria || 'general').toLowerCase()}">
                                        ${libro.signatura || 'N/A'}
                                    </span>
                                </p>
                                <p><strong>Ejemplares Disponibles:</strong> ${libro.copiasDisponibles || 0}</p>
                                <p><strong>Valoración:</strong>
                                    <span class="estrellas" data-id="${libro.idRegistro}" data-titulo="${encodeURIComponent(libro.titulo || 'Sin título')}" role="slider" aria-valuemin="1" aria-valuemax="5" aria-valuenow="0" aria-label="Calificar ${libro.titulo} con estrellas">
                                        ${[1,2,3,4,5].map(i => `<span class="estrella" data-value="${i}">★</span>`).join('')}
                                    </span>
                                    <span id="promedio-valorados-${libro.idRegistro}" class="promedio">${libro.promedio.toFixed(1)} ★ (${libro.numVotos} voto${libro.numVotos > 1 ? 's' : ''})</span>
                                </p>
                                <button class="reserva-libro-btn" onclick="openReservationForm()"
                                     aria-label="Reservar el libro ${libro.titulo}">Reservar Libro 📚</button>
                                <button class="sinopsis-btn" onclick="mostrarSinopsis('${libro.idRegistro}', '${sanitizeHTML(libro.titulo || 'Sin título')}', '${sanitizeHTML(libro.autor || 'Desconocido')}')"
                                        aria-label="Generar sinopsis para ${libro.titulo}">Generar Sinopsis 📝</button>
                                <button class="favorito-btn ${esFavorito ? 'active' : ''}" onclick="toggleFavorito('${libro.idRegistro}')" aria-label="${esFavorito ? 'Quitar' : 'Agregar'} a favoritos el libro ${libro.titulo}">❤️</button>
                                <button class="add-cover-btn" onclick="abrirLoginAdmin('${libro.idRegistro}')"
                                    aria-label="Abrir panel de admin para subir portada para ${libro.titulo}">+</button>
                                ${isAdminLogged && (libro.portadas || []).length > 0 ? `
                                    <button class="delete-cover-btn" onclick="abrirEliminarPortada('${libro.idRegistro}')"
                                        aria-label="Eliminar portada para ${libro.titulo}">−</button>
                                ` : ''}
                                <div id="sinopsis-${libro.idRegistro}" style="display: none; margin-top: 10px;"></div>
                            </div>
                        </div>
                    `;
        }).join('');
        requestAnimationFrame(async () => {
            for (const container of content.querySelectorAll('.portada-container')) {
                await renderPortadas(container, container.dataset.libroId);
            }
            initEstrellas();
        });
        renderPagination('valoradosPagination', currentPageValorados, totalPages, 'changePageValorados');
    } catch (error) {
        console.error('Error:', error);
        content.innerHTML = `<p><strong>Error:</strong> ${error.message}</p>`;
    }
}

function actualizarContador() {
    const ahora = new Date();
    const manana = new Date(ahora);
    manana.setDate(manana.getDate() + 1);
    manana.setHours(0, 0, 0, 0);
    const diff = manana - ahora;
    const horas = Math.floor(diff / 3600000);
    const minutos = Math.floor((diff % 3600000) / 60000);
    const segundos = Math.floor((diff % 60000) / 1000);
    document.getElementById('contadorDia').textContent =
        `Nuevos libros en ${horas.toString().padStart(2, '0')}h ${minutos.toString().padStart(2, '0')}m ${segundos.toString().padStart(2, '0')}s`;
}

function abrirLoginAdmin(idLibro) {
    const isAdminLogged = localStorage.getItem('adminLogged') === 'true';
    const loginTime = localStorage.getItem('adminLoginTime');
    const LOGIN_DURATION = 24 * 60 * 60 * 1000;
    if (isAdminLogged && loginTime && (Date.now() - parseInt(loginTime) < LOGIN_DURATION)) {
        mostrarFormularioSubida(idLibro);
        return;
    }
    localStorage.removeItem('adminLogged');
    localStorage.removeItem('adminLoginTime');
    localStorage.removeItem('githubToken');
    const content = document.getElementById('adminContent');
    content.innerHTML = `
        <div class="admin-form">
            <p><strong>Login de Administrador</strong></p>
            <input type="text" id="admin-user" placeholder="Usuario" autocomplete="username">
            <input type="password" id="admin-pass" placeholder="Contraseña" autocomplete="current-password">
            <input type="text" id="github-token" placeholder="GitHub Token" autocomplete="off">
            <button class="admin-login-btn" onclick="validarAdmin('${idLibro}')">Iniciar sesión</button>
            <button class="admin-cancel-btn" onclick="cerrarModalAdmin()">Cancelar</button>
        </div>
    `;
    document.getElementById('adminModal').style.display = 'block';
    setupFocusTrap('adminModal');
    document.getElementById('admin-user').focus();
}

function validarAdmin(idLibro) {
    const user = document.getElementById('admin-user').value.trim();
    const pass = document.getElementById('admin-pass').value;
    const githubToken = document.getElementById('github-token').value.trim();
    if (user === CONFIG.ADMIN_USER && pass === CONFIG.ADMIN_PASS && githubToken) {
        localStorage.setItem('adminLogged', 'true');
        localStorage.setItem('adminLoginTime', Date.now());
        localStorage.setItem('githubToken', githubToken);
        cerrarModalAdmin();
        mostrarFormularioSubida(idLibro);
        showToast('Login correcto. Sube la portada.', 'success');
    } else {
        showToast('Credenciales incorrectas o token faltante.', 'error');
    }
}

function mostrarFormularioSubida(idLibro) {
    const content = document.getElementById('adminContent');
    const libro = catalogo.find(l => l.idRegistro === idLibro);
    content.innerHTML = `
        <div class="admin-form">
            <p><strong>Subir portada para:</strong> <em>${libro?.titulo || 'Libro'}</em></p>
            <input type="file" id="cover-file" accept="image/*">
            <button class="admin-login-btn" onclick="subirPortada('${idLibro}')">Subir portada</button>
            <button class="admin-cancel-btn" onclick="cerrarModalAdmin()">Cancelar</button>
            <p id="upload-status" style="margin-top:8px; font-size:0.9em;"></p>
        </div>
    `;
    document.getElementById('adminModal').style.display = 'block';
    setupFocusTrap('adminModal');
}

async function subirPortada(idLibro) {
    const token = localStorage.getItem('githubToken');
    if (!token) {
        showToast('Token de GitHub no encontrado. Inicia sesión nuevamente.', 'error');
        return;
    }
    const fileInput = document.getElementById('cover-file');
    const status = document.getElementById('upload-status');
    if (!fileInput.files[0]) {
        status.textContent = 'Selecciona una imagen.';
        status.style.color = 'red';
        return;
    }
    const file = fileInput.files[0];
    if (!file.type.startsWith('image/')) {
        status.textContent = 'Archivo no es una imagen válida.';
        status.style.color = 'red';
        return;
    }
    status.textContent = 'Procesando y subiendo a GitHub...';
    status.style.color = 'blue';
    try {
        const base64Content = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    canvas.width = 300;
                    canvas.height = 450;
                    ctx.drawImage(img, 0, 0, 300, 450);
                    resolve(canvas.toDataURL('image/jpeg', 0.8).split(',')[1]);
                };
                img.src = reader.result;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
        const fileName = `${idLibro}_${Date.now()}.jpg`;
        const uploadUrl = `${CONFIG.GITHUB_API_URL}${fileName}`;
        const response = await fetch(uploadUrl, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: `Subir portada para libro ${idLibro} - ${file.name}`,
                content: base64Content
            })
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Error GitHub: ${response.status} - ${errorData.message || 'Desconocido'}`);
        }
        const timestamp = Date.now();
        const publicUrl = `https://cdn.jsdelivr.net/gh/IES-Carpe-Diem/Biblioteca-Hipatia@main/portadas/${fileName}`;
        const cacheBustedUrl = `${publicUrl}?v=${timestamp}`;
        const libro = catalogo.find(l => l.idRegistro === idLibro);
        if (libro) {
            if (!libro.portadas) libro.portadas = [];
            if (!libro.portadas.includes(cacheBustedUrl)) {
                libro.portadas.push(cacheBustedUrl);
            }
        }
        const portadasGuardadas = JSON.parse(localStorage.getItem('portadas_libros') || '{}');
        if (!portadasGuardadas[idLibro]) portadasGuardadas[idLibro] = [];
        if (!portadasGuardadas[idLibro].includes(cacheBustedUrl)) {
            portadasGuardadas[idLibro].push(cacheBustedUrl);
        }
        localStorage.setItem('portadas_libros', JSON.stringify(portadasGuardadas));
        librosConPortadas = catalogo.map(l => ({
            id: l.idRegistro,
            titulo: l.titulo,
            portadas: [...(l.portadas || []), ...(portadasGuardadas[l.idRegistro] || [])]
        })).filter(l => l.portadas.length > 0);
        renderRecomendados();
        iniciarRotativas();
        status.textContent = '¡Portada subida exitosamente a GitHub!';
        status.style.color = 'green';
        showToast(`Portada de "${libro?.titulo || 'el libro'}" ahora disponible globalmente.`, 'success');
        setTimeout(() => {
            cerrarModalAdmin();
            mostrarResultadosModal();
        }, 1000);
    } catch (error) {
        console.error('Error en subida:', error);
        status.textContent = `Error: ${error.message}. Verifica el token de GitHub.`;
        status.style.color = 'red';
        showToast('Fallo en la subida. Revisa la consola para detalles.', 'error');
    }
}

function abrirEliminarPortada(idLibro) {
    const content = document.getElementById('adminContent');
    const libro = catalogo.find(l => l.idRegistro === idLibro);
    const portadas = libro ? libro.portadas : [];
    content.innerHTML = `
        <div class="admin-form">
            <p><strong>Seleccionar portada a eliminar:</strong> <em>${libro?.titulo || 'Libro'}</em></p>
            <select id="delete-cover-select">
                ${portadas.map((portada, index) => `
                    <option value="${portada}" data-index="${index}">Portada ${index + 1}</option>
                `).join('')}
            </select>
            <button class="admin-login-btn" onclick="eliminarPortada('${idLibro}')" style="background:#dc3545;">Eliminar Portada</button>
            <button class="admin-cancel-btn" onclick="cerrarModalAdmin()">Cancelar</button>
            <p id="delete-status" style="margin-top:8px; font-size:0.9em;"></p>
        </div>
    `;
    document.getElementById('adminModal').style.display = 'block';
    setupFocusTrap('adminModal');
}

async function eliminarPortada(idLibro) {
    const token = localStorage.getItem('githubToken');
    if (!token) {
        showToast('Token de GitHub no encontrado. Inicia sesión nuevamente.', 'error');
        return;
    }
    const select = document.getElementById('delete-cover-select');
    const status = document.getElementById('delete-status');
    const portadaUrl = select.value;
    if (!portadaUrl) {
        status.textContent = 'Selecciona una portada para eliminar.';
        status.style.color = 'red';
        return;
    }
    status.textContent = 'Eliminando portada...';
    status.style.color = 'blue';
    try {
        const fileName = portadaUrl.split('/').pop().split('?')[0];
        const deleteUrl = `${CONFIG.GITHUB_API_URL}${fileName}`;
        const getResponse = await fetch(deleteUrl, {
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        if (!getResponse.ok) throw new Error('No se encontró el archivo en GitHub.');
        const fileData = await getResponse.json();
        const sha = fileData.sha;
        const deleteResponse = await fetch(deleteUrl, {
            method: 'DELETE',
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json'
            },
            body: JSON.stringify({
                message: `Eliminar portada para libro ${idLibro}`,
                sha
            })
        });
        if (!deleteResponse.ok) {
            const errorData = await deleteResponse.json();
            throw new Error(`Error GitHub: ${deleteResponse.status} - ${errorData.message || 'Desconocido'}`);
        }
        const libro = catalogo.find(l => l.idRegistro === idLibro);
        if (libro) {
            libro.portadas = libro.portadas.filter(p => p !== portadaUrl);
            const portadasGuardadas = JSON.parse(localStorage.getItem('portadas_libros') || '{}');
            portadasGuardadas[idLibro] = libro.portadas;
            localStorage.setItem('portadas_libros', JSON.stringify(portadasGuardadas));
        }
        librosConPortadas = catalogo.map(l => ({
            id: l.idRegistro,
            titulo: l.titulo,
            portadas: l.portadas.filter(p => p !== portadaUrl)
        })).filter(l => l.portadas.length > 0);
        renderRecomendados();
        iniciarRotativas();
        status.textContent = '¡Portada eliminada exitosamente!';
        status.style.color = 'green';
        showToast(`Portada eliminada de "${libro?.titulo || 'el libro'}".`, 'success');
        setTimeout(() => {
            cerrarModalAdmin();
            mostrarResultadosModal();
        }, 1000);
    } catch (error) {
        console.error('Error al eliminar:', error);
        status.textContent = `Error: ${error.message}`;
        status.style.color = 'red';
        showToast('Fallo al eliminar la portada. Revisa la consola.', 'error');
    }
}

function logoutAdmin() {
    localStorage.removeItem('adminLogged');
    localStorage.removeItem('adminLoginTime');
    localStorage.removeItem('githubToken');
    showToast('Sesión de administrador cerrada.', 'success');
    document.querySelector('.logout-btn').style.display = 'none';
    setTimeout(() => mostrarResultadosModal(), 500);
}

async function getUserIP() {
    try {
        const res = await fetch('https://api.ipify.org?format=json', {
            mode: 'cors',
            cache: 'no-cache'
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const ip = data.ip || 'unknown';
        console.log('IP detectada:', ip);
        return ip;
    } catch (err) {
        console.warn('getUserIP falló:', err);
        const fallback = 'anon_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
        console.log('Usando fallback IP:', fallback);
        return fallback;
    }
}

async function getVotosDiarios(ip) {
    const url = `${CONFIG.WEB_APP_URL}?action=getDailyVotes&ip=${ip}`;
    try {
        const res = await fetch(url);
        const data = await res.json();
        return data.count || 0;
    } catch (err) {
        console.error('Error contando votos diarios:', err);
        return 0;
    }
}

async function eliminarVoto(idLibro, ip) {
    const url = `${CONFIG.WEB_APP_URL}?action=deleteCalificacion&id=${idLibro}&ip=${ip}`;
    try {
        console.log('Eliminando voto →', url);
        const res = await fetch(url, { method: 'GET' });
        if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        const text = await res.text();
        console.log('Respuesta del servidor:', text);
        if (text.trim().startsWith('<')) {
            throw new Error('El servidor devolvió HTML en lugar de JSON. Verifica la publicación del Web App.');
        }
        let data;
        try {
            data = JSON.parse(text);
        } catch (parseError) {
            throw new Error(`Respuesta no es JSON: ${text.substring(0, 100)}`);
        }
        if (data.error) {
            let mensajeError = data.error;
            if (data.error.includes('Acción no válida')) {
                mensajeError = 'Error de servidor: Redeploya el Web App en GAS.';
            } else if (data.error.includes('Faltan ID o IP')) {
                mensajeError = 'IP no detectada. Prueba en otra red.';
            } else if (data.error.includes('Libro no encontrado')) {
                mensajeError = 'Voto no existe. Revota primero.';
            }
            showToast(mensajeError, 'warning');
            return false;
        }
        if (data.success) {
            showToast('Voto eliminado correctamente.', 'success');
            return true;
        }
        showToast('Respuesta inesperada del servidor.', 'warning');
        return false;
    } catch (err) {
        console.error('Error en eliminarVoto():', err);
        showToast(`Error al eliminar: ${err.message}`, 'error');
        return false;
    }
}

async function cargarCalificacion(idLibro, promedioId = `promedio-${idLibro}`) {
    const url = `${CONFIG.WEB_APP_URL}?action=getCalificacion&id=${idLibro}`;
    try {
        const res = await fetch(url);
        const data = await res.json();
        const span = document.getElementById(promedioId);
        if (span) {
            span.textContent = data.numVotos > 0
                ? `${data.promedio.toFixed(1)} ★ (${data.numVotos} voto${data.numVotos > 1 ? 's' : ''})`
                : 'Sin votos';
        }
        return data;
    } catch (err) {
        console.error('Error cargando calificación:', err);
    }
}

async function calificarLibro(idLibro, estrellas, titulo, ip) {
    const votosHoy = await getVotosDiarios(ip);
    const LIMITE_DIARIO = 10;
    if (votosHoy >= LIMITE_DIARIO) {
        showToast(`Límite diario alcanzado (${LIMITE_DIARIO} votos). Intenta mañana.`, 'warning');
        return false;
    }
    const url = `${CONFIG.WEB_APP_URL}?action=setCalificacion&id=${idLibro}&estrellas=${estrellas}&titulo=${encodeURIComponent(titulo)}&ip=${ip}`;
    try {
        const res = await fetch(url, { method: 'GET' });
        const data = await res.json();
        if (data.error) {
            showToast(data.error, 'warning');
            return false;
        }
        showToast(`¡Gracias! Voto de ${estrellas}★ guardado. (${votosHoy + 1}/${LIMITE_DIARIO} hoy)`, 'success');
        return true;
    } catch (err) {
        console.error('Error votando:', err);
        showToast('Error al votar. Intenta más tarde.', 'error');
        return false;
    }
}

function showFireworks(container, fullscreen = false) {
    const fireworks = document.createElement('div');
    fireworks.className = `fireworks ${fullscreen ? 'fullscreen' : ''}`;
    fireworks.setAttribute('aria-hidden', 'true');
    if (!fullscreen) {
        container.parentElement.appendChild(fireworks);
    } else {
        document.body.appendChild(fireworks);
    }
    for (let i = 0; i < 30; i++) {
        const particle = document.createElement('div');
        particle.className = 'firework-particle';
        particle.style.left = '50%';
        particle.style.top = '50%';
        particle.style.setProperty('--dx', (Math.random() - 0.5) * (fullscreen ? 400 : 100) + 'px');
        particle.style.setProperty('--dy', (Math.random() - 0.5) * (fullscreen ? 400 : 100) + 'px');
        fireworks.appendChild(particle);
    }
    setTimeout(() => fireworks.remove(), 1200);
}

function showExplosion(container) {
    container.classList.add('explosion');
    container.querySelectorAll('.estrella').forEach((estrella, i) => {
        setTimeout(() => estrella.classList.add('pendiente-eliminar'), i * 50);
    });
    setTimeout(() => {
        container.classList.remove('explosion');
        container.querySelectorAll('.estrella').forEach(s => s.classList.remove('pendiente-eliminar'));
    }, 600);
}

function initEstrellas() {
    document.querySelectorAll('.estrellas').forEach(container => {
        const idLibro = container.dataset.id;
        const titulo = decodeURIComponent(container.dataset.titulo);
        const estrellas = container.querySelectorAll('.estrella');
        const promedioId = container.closest('#valoradosContent')
            ? `promedio-valorados-${idLibro}`
            : `promedio-${idLibro}`;
        cargarCalificacion(idLibro, promedioId);
        const key = `voto_${idLibro}_local`;
        let seleccionado = parseInt(localStorage.getItem(key)) || -1;
        let modoEliminar = false;
        if (seleccionado > 0) {
            estrellas.forEach((s, i) => {
                if (i < seleccionado) s.classList.add('seleccionada');
            });
        }
        container.addEventListener('mousemove', (e) => {
            if (!e.target.classList.contains('estrella')) return;
            const val = parseInt(e.target.dataset.value);
            estrellas.forEach((s, i) => {
                s.classList.toggle('hover', i < val);
            });
        });
        container.addEventListener('mouseleave', () => {
            estrellas.forEach(s => s.classList.remove('hover'));
        });
        container.addEventListener('click', async (e) => {
            if (!e.target.classList.contains('estrella')) return;
            const val = parseInt(e.target.dataset.value);
            const ip = await getUserIP();
            if (seleccionado > 0 && modoEliminar) {
                const success = await eliminarVoto(idLibro, ip);
                if (success) {
                    localStorage.removeItem(key);
                    seleccionado = -1;
                    modoEliminar = false;
                    estrellas.forEach(s => {
                        s.classList.remove('seleccionada', 'pendiente-eliminar');
                    });
                    container.setAttribute('aria-valuenow', 0);
                    container.setAttribute('aria-label', `Calificación actual: 0 de 5 estrellas para ${titulo}`);
                    cargarCalificacion(idLibro, promedioId);
                    showExplosion(container);
                } else {
                    modoEliminar = false;
                    estrellas.forEach((s, i) => {
                        s.classList.toggle('pendiente-eliminar', i < seleccionado);
                        s.classList.toggle('seleccionada', i < seleccionado);
                    });
                    showToast('No se pudo eliminar el voto.', 'error');
                }
                return;
            }
            if (seleccionado > 0) {
                modoEliminar = true;
                estrellas.forEach((s, i) => {
                    if (i < seleccionado) {
                        s.classList.remove('seleccionada');
                        s.classList.add('pendiente-eliminar');
                    } else {
                        s.classList.remove('pendiente-eliminar');
                    }
                });
                container.setAttribute('aria-label', `Confirmar eliminación de ${seleccionado} estrellas para ${titulo}`);
                showToast('Haz clic de nuevo para confirmar eliminación', 'warning');
                return;
            }
            const votosHoy = await getVotosDiarios(ip);
            if (votosHoy >= 10) {
                showToast(`Límite diario alcanzado (10 votos). Intenta mañana.`, 'warning');
                return;
            }
            const success = await calificarLibro(idLibro, val, titulo, ip);
            if (success) {
                localStorage.setItem(key, val);
                seleccionado = val;
                modoEliminar = false;
                estrellas.forEach((s, i) => {
                    s.classList.toggle('seleccionada', i < val);
                    s.classList.remove('pendiente-eliminar');
                });
                container.setAttribute('aria-valuenow', val);
                container.setAttribute('aria-label', `Calificación actual: ${val} de 5 estrellas para ${titulo}`);
                cargarCalificacion(idLibro, promedioId);
                showFireworks(container, true);
            }
        });
    });
}
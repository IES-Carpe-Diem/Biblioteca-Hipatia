import { CONFIG } from './config.js';
import { normalizarTexto, showToast, setupFocusTrap, cleanupFocusTrap } from './utils.js';
import { renderPortadas } from './portadas.js';
import { initEstrellas } from './valoraciones.js';

let searchResults = [];
let searchQuery = '';
let currentPageSearch = 1;

export function actualizarSugerenciasBusqueda() {
    const datalist = document.getElementById('sugerenciasBusqueda');
    datalist.innerHTML = window.catalogo.map(libro => `
        <option value="${libro.titulo}">${libro.autor} - ${libro.categoria} (${libro.copiasDisponibles || 0} disponibles)</option>
    `).join('');
}

export function mostrarResultadosBusqueda() {
    if (!window.catalogo.length) {
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

function buscarLibros(query, exactMatch = false) {
    if (!window.catalogo.length || !query) return [];
    const lowerQuery = normalizarTexto(query);
    if (exactMatch) {
        return window.catalogo.filter(libro => normalizarTexto(libro.titulo) === lowerQuery);
    }
    return window.catalogo
        .filter(libro =>
            normalizarTexto(libro.titulo).includes(lowerQuery) ||
            normalizarTexto(libro.autor).includes(lowerQuery) ||
            normalizarTexto(libro.categoria).includes(lowerQuery) ||
            normalizarTexto(libro.signatura).includes(lowerQuery) ||
            normalizarTexto(libro.isbn).includes(lowerQuery)
        )
        .sort((a, b) => (b.copiasDisponibles || 0) - (a.copiasDisponibles || 0));
}

export function buscarEnModal() {
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

export function abrirModal() {
    const modal = document.getElementById('searchModal');
    const modalSearchInput = document.getElementById('modalSearchInput');
    modalSearchInput.value = searchQuery;
    modal.style.display = 'block';
    setupFocusTrap('searchModal');
    modalSearchInput.focus();
    document.querySelector('.theme-controls').classList.add('active');
}

export async function mostrarResultadosModal() {
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
            const similar = window.catalogo.find(l => {
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
        const esFavorito = window.favoritos.includes(libro.idRegistro);
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
                <button class="sinopsis-btn" onclick="mostrarSinopsis('${libro.idRegistro}', '${libro.titulo}', '${libro.autor}')"
                        aria-label="Generar sinopsis para ${libro.titulo}">Generar Sinopsis 📝</button>
                <button class="favorito-btn ${esFavorito ? 'active' : ''}" onclick="toggleFavorito('${libro.idRegistro}')" aria-label="${esFavorito ? 'Quitar' : 'Agregar'} a favoritos el libro ${libro.titulo}">❤️</button>
                <!-- Admin buttons -->
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
        const containers = document.querySelectorAll('.portada-container');
        for (const container of containers) {
            const idLibro = container.dataset.libroId;
            await renderPortadas(container, idLibro);
        }
        initEstrellas();
    });
}

export function changePageSearch(newPage) {
    const totalPages = Math.ceil(searchResults.length / CONFIG.PAGE_SIZE);
    if (newPage < 1 || newPage > totalPages) return;
    currentPageSearch = newPage;
    mostrarResultadosModal();
}
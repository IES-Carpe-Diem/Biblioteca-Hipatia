import { CONFIG } from './config.js';
import { showToast, setupFocusTrap, cleanupFocusTrap } from './utils.js';
import { renderPortadas } from './portadas.js';
import { initEstrellas } from './valoraciones.js';

let favoritos = JSON.parse(localStorage.getItem('libros_favoritos') || '[]');
let currentPageFavoritos = 1;

export function toggleFavorito(idLibro) {
    const index = favoritos.indexOf(idLibro);
    if (index > -1) {
        favoritos.splice(index, 1);
        showToast('Libro removido de favoritos', 'warning');
    } else {
        favoritos.push(idLibro);
        showToast('Libro agregado a favoritos', 'success');
    }
    localStorage.setItem('libros_favoritos', JSON.stringify(favoritos));
    // Si estamos en modal resultados, refrescar
    if (document.getElementById('searchModal').style.display === 'block') {
        mostrarResultadosModal(); // Necesitará import de search.js cuando esté completo
    }
}

export function abrirModalFavoritos() {
    const content = document.getElementById('favoritosContent');
    if (favoritos.length === 0) {
        content.innerHTML = '<p>No hay libros favoritos agregados.</p>';
        document.getElementById('favoritosPagination').style.display = 'none';
        document.getElementById('favoritosModal').style.display = 'block';
        setupFocusTrap('favoritosModal');
        return;
    }
    const librosFavoritos = favoritos.map(id => window.catalogo.find(l => l.idRegistro === id)).filter(Boolean);
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
                    <button class="sinopsis-btn" onclick="mostrarSinopsis('${libro.idRegistro}', '${libro.titulo}', '${libro.autor}')"
                            aria-label="Generar sinopsis para ${libro.titulo}">Generar Sinopsis 📝</button>
                    <button class="favorito-btn active" onclick="toggleFavorito('${libro.idRegistro}')" aria-label="Quitar de favoritos el libro ${libro.titulo}">❤️</button>
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
    const paginationDiv = document.getElementById('favoritosPagination');
    if (totalPages > 1) {
        let html = `<button onclick="changePageFavoritos(${currentPageFavoritos - 1})" ${currentPageFavoritos === 1 ? 'disabled' : ''}>Anterior</button>`;
        for (let i = 1; i <= totalPages; i++) {
            html += `<button onclick="changePageFavoritos(${i})" ${i === currentPageFavoritos ? 'class="active"' : ''}>${i}</button>`;
        }
        html += `<button onclick="changePageFavoritos(${currentPageFavoritos + 1})" ${currentPageFavoritos === totalPages ? 'disabled' : ''}>Siguiente</button>`;
        paginationDiv.innerHTML = html;
        paginationDiv.style.display = 'block';
    } else {
        paginationDiv.style.display = 'none';
    }
    document.getElementById('favoritosModal').style.display = 'block';
    setupFocusTrap('favoritosModal');
}

export function changePageFavoritos(newPage) {
    const totalPages = Math.ceil(favoritos.length / CONFIG.PAGE_SIZE);
    if (newPage < 1 || newPage > totalPages) return;
    currentPageFavoritos = newPage;
    abrirModalFavoritos();
}

export function cerrarModalFavoritos() {
    cleanupFocusTrap('favoritosModal');
    document.getElementById('favoritosModal').style.display = 'none';
    currentPageFavoritos = 1;
}

export { favoritos };
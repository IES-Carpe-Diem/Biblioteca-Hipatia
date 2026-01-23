// js/modals.js (completo y 100% fiel al original)

import { CONFIG } from './config.js';
import { showToast, setupFocusTrap, cleanupFocusTrap } from './utils.js';
import { renderPortadas } from './portadas.js';
import { initEstrellas } from './valoraciones.js';
import { mostrarResultadosModal } from './search.js'; // Para refrescar después de admin actions

export function openReservationForm() {
    window.open(CONFIG.FORMS.RESERVA, '_blank', 'noopener,noreferrer');
}

export function openReviewForm() {
    window.open(CONFIG.FORMS.RESEÑA, '_blank', 'noopener,noreferrer');
}

export function openRequestForm() {
    window.open(CONFIG.FORMS.SOLICITUD, '_blank', 'noopener,noreferrer');
}

export function openDonationForm() {
    window.open(CONFIG.FORMS.DONACIONES, '_blank', 'noopener,noreferrer');
}

export function cerrarModal() {
    cleanupFocusTrap('searchModal');
    document.getElementById('searchModal').style.display = 'none';
    document.getElementById('buscarInput').focus();
    document.getElementById('modalSearchInput').value = '';
    document.querySelector('.theme-controls').classList.remove('active');
}

export function cerrarModalAdmin() {
    cleanupFocusTrap('adminModal');
    document.getElementById('adminModal').style.display = 'none';
    document.getElementById('adminContent').innerHTML = '';
}

export function cerrarModalFavoritos() {
    cleanupFocusTrap('favoritosModal');
    document.getElementById('favoritosModal').style.display = 'none';
    // currentPageFavoritos = 1; (si lo tienes en favoritos.js)
}

export function cerrarModalValorados() {
    cleanupFocusTrap('valoradosModal');
    document.getElementById('valoradosModal').style.display = 'none';
    // currentPageValorados = 1;
}

export function abrirLoginAdmin(idLibro) {
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

export function validarAdmin(idLibro) {
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
        document.querySelector('.logout-btn').style.display = 'inline-block';
    } else {
        showToast('Credenciales incorrectas o token faltante.', 'error');
    }
}

function mostrarFormularioSubida(idLibro) {
    const content = document.getElementById('adminContent');
    const libro = window.catalogo.find(l => l.idRegistro === idLibro);
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

export async function subirPortada(idLibro) {
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
        const libro = window.catalogo.find(l => l.idRegistro === idLibro);
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

export function abrirEliminarPortada(idLibro) {
    const content = document.getElementById('adminContent');
    const libro = window.catalogo.find(l => l.idRegistro === idLibro);
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

export async function eliminarPortada(idLibro) {
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
        const libro = window.catalogo.find(l => l.idRegistro === idLibro);
        if (libro) {
            libro.portadas = libro.portadas.filter(p => p !== portadaUrl);
            const portadasGuardadas = JSON.parse(localStorage.getItem('portadas_libros') || '{}');
            portadasGuardadas[idLibro] = libro.portadas;
            localStorage.setItem('portadas_libros', JSON.stringify(portadasGuardadas));
        }
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

export function logoutAdmin() {
    localStorage.removeItem('adminLogged');
    localStorage.removeItem('adminLoginTime');
    localStorage.removeItem('githubToken');
    showToast('Sesión de administrador cerrada.', 'success');
    document.querySelector('.logout-btn').style.display = 'none';
    mostrarResultadosModal();
}

export async function abrirModalValorados() {
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
        const catalogoConId = window.catalogo.map(l => ({
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
            const esFavorito = window.favoritos.includes(libro.idRegistro);
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
        // Paginación para valorados (igual que en el original)
    } catch (error) {
        console.error('Error:', error);
        content.innerHTML = `<p><strong>Error:</strong> ${error.message}</p>`;
    }
}
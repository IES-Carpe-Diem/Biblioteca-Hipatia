// js/main.js (completo y 100% fiel al código original, solo modularizado)

import { CONFIG } from './config.js';
import { debounce, showToast, normalizarTexto } from './utils.js';
import { toggleTheme, loadTheme } from './theme.js';
import { loadDaltonismMode, loadSizeCSS } from './accessibility.js';
import { cargarPortadasDesdeGitHub } from './portadas.js';
import { actualizarSugerenciasBusqueda, mostrarResultadosBusqueda } from './search.js';
import { abrirModalFavoritos } from './favoritos.js';
import { abrirModalValorados } from './modals.js';
import { enviarMensaje } from './chat.js';
import { initEstrellas } from './valoraciones.js';
import { openReservationForm, openReviewForm, openRequestForm, openDonationForm, abrirLoginAdmin, logoutAdmin, abrirModalAccesibilidad } from './modals.js';

let catalogo = [];
let librosConPortadas = [];
let rotativasInterval = null;
let currentRotativaIndex = 0;

window.catalogo = catalogo; // Compartido con otros módulos (temporal hasta data.js)

function parseXML(xmlText) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
    if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
        throw new Error('Error al parsear XML.');
    }
    return xmlDoc;
}

function parseLibros(xmlDoc) {
    const libros = {};
    Array.from(xmlDoc.getElementsByTagName('Libro')).forEach(libro => {
        const idDocumento = libro.getAttribute('id_documento') || '';
        const descriptor = libro.getElementsByTagName('Descriptor')[0];
        const rawCategoria = descriptor ? descriptor.textContent : 'No disponible';
        const categoriaMap = {
            'narrativa': 'Narrativa',
            'poesia': 'Poesía',
            'poesía': 'Poesía',
            'teatro': 'Teatro',
            'literatura inglesa': 'Literatura inglesa',
            'enciclopedias': 'Enciclopedias',
            'comic': 'Cómic',
            'cómic': 'Cómic',
            'deportes': 'Deportes',
            'lecturas graduadas': 'Lecturas Graduadas'
        };
        const categoria = categoriaMap[rawCategoria.toLowerCase()] || rawCategoria;
        libros[idDocumento] = {
            titulo: libro.getElementsByTagName('Titulo')[0]?.textContent || 'Sin título',
            autor: libro.getElementsByTagName('Autor')[0]?.textContent || 'Desconocido',
            categoria: categoria,
            fechaEdicion: libro.getElementsByTagName('FechaEdicion')[0]?.textContent || 'No disponible'
        };
    });
    return libros;
}

function agruparEjemplares(xmlDoc, libros) {
    const librosAgrupados = {};
    Array.from(xmlDoc.getElementsByTagName('Ejemplar')).forEach(ejemplar => {
        const idRegistro = ejemplar.getAttribute('IdRegistro') || '';
        const libro = libros[idRegistro] || {};
        let signatura1 = ejemplar.getAttribute('Signatura1') || '';
        const signaturaMap = {
            'Narrativa': 'N',
            'Poesía': 'P',
            'Teatro': 'T',
            'Literatura inglesa': 'LI',
            'Enciclopedias': 'E',
            'Cómic': 'C',
            'Deportes': 'D',
            'Lecturas Graduadas': 'AC'
        };
        signatura1 = signaturaMap[libro.categoria] || signatura1 || '';
        const signatura = `${signatura1}-${ejemplar.getAttribute('Signatura2') || ''}-${ejemplar.getAttribute('Signatura3') || ''}`.trim();
        if (!librosAgrupados[idRegistro]) {
            librosAgrupados[idRegistro] = {
                titulo: libro.titulo || 'Sin título',
                autor: libro.autor || 'Desconocido',
                categoria: libro.categoria || 'No disponible',
                fechaEdicion: libro.fechaEdicion || 'No disponible',
                signatura: signatura || 'No disponible',
                isbn: ejemplar.getAttribute('ISBN') || 'No disponible',
                fecha: ejemplar.getAttribute('Fecha') || 'No disponible',
                copiasTotales: 0,
                copiasDisponibles: 0,
                idRegistro: idRegistro,
                portadas: []
            };
        }
        librosAgrupados[idRegistro].copiasTotales += 1;
        if (ejemplar.getAttribute('Estado') === '0') {
            librosAgrupados[idRegistro].copiasDisponibles += 1;
        }
    });
    return librosAgrupados;
}

async function cargarCatalogo(reintentosMaximos = CONFIG.RETRY_MAX) {
    const cacheVersion = 'catalog-v1';
    const cachedCatalogo = localStorage.getItem('catalogo');
    const cachedVersion = localStorage.getItem('catalogoVersion');
    const cachedTimestamp = localStorage.getItem('catalogoTimestamp');
    if (cachedCatalogo && cachedVersion === cacheVersion && cachedTimestamp) {
        const timestamp = parseInt(cachedTimestamp, 10);
        if (Date.now() - timestamp < CONFIG.CACHE_DURATION) {
            catalogo = JSON.parse(cachedCatalogo);
            window.catalogo = catalogo;
            actualizarSugerenciasBusqueda();
            return;
        }
    }
    let ultimoError = null;
    for (let intento = 0; intento < reintentosMaximos; intento++) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);
            const response = await fetch('./data/Ejemplares.xml', { signal: controller.signal });
            clearTimeout(timeoutId);
            if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
            const xmlText = await response.text();
            const xmlDoc = parseXML(xmlText);
            const libros = parseLibros(xmlDoc);
            const librosAgrupados = agruparEjemplares(xmlDoc, libros);
            // mergePortadas se llama en cargarPortadasDesdeGitHub o aquí si prefieres
            catalogo = Object.values(librosAgrupados).map(libro => ({
                ...libro,
                idRegistro: libro.idRegistro || libro.id_documento || ''
            }));
            window.catalogo = catalogo;
            localStorage.setItem('catalogo', JSON.stringify(catalogo));
            localStorage.setItem('catalogoVersion', cacheVersion);
            localStorage.setItem('catalogoTimestamp', Date.now());
            actualizarSugerenciasBusqueda();
            console.log(`Catálogo cargado exitosamente en intento ${intento + 1}.`);
            return;
        } catch (error) {
            ultimoError = error;
            console.warn(`Intento ${intento + 1}/${reintentosMaximos} falló: ${error.message}`);
            if (intento < reintentosMaximos - 1) {
                const delay = 1000 * Math.pow(2, intento);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    console.error('Todos los reintentos fallaron:', ultimoError);
    catalogo = [];
    window.catalogo = catalogo;
    showToast('Catálogo en Mantenimiento, disculpe las molestias.', 'error');
}

function renderRecomendados() {
    const ahora = new Date();
    const añoMesDia = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-${String(ahora.getDate()).padStart(2, '0')}`;
    const claveCache = `recomendados_${añoMesDia}`;
    const cache = JSON.parse(localStorage.getItem(claveCache) || 'null');
    const diaMes = String(ahora.getDate()).padStart(2, '0');
    const mesNum = String(ahora.getMonth() + 1).padStart(2, '0');
    const año = ahora.getFullYear();
    document.getElementById('tituloRecomendados').textContent = `Libros destacados de ${diaMes}/${mesNum}/${año}🐱‍👓`;
    const conPortadas = librosConPortadas.filter(l => l.portadas.length > 0);
    if (conPortadas.length === 0) {
        document.getElementById('recomendadosGrid').innerHTML = '<p style="text-align: center; color: var(--text-secondary);">No hay portadas disponibles hoy.</p>';
        return;
    }
    let seleccionados = [];
    if (cache && cache.libros && cache.fecha === añoMesDia) {
        seleccionados = cache.libros.map(id => conPortadas.find(l => l.id === id)).filter(Boolean);
    }
    if (seleccionados.length < 5) {
        const seed = parseInt(añoMesDia.replace(/-/g, ''), 10);
        const seededRandom = (function(s) {
            let state = s;
            return function() {
                state = (state * 1664525 + 1013904223) % 2147483647;
                return state / 2147483647;
            };
        })(seed);
        const shuffled = [...conPortadas].sort(() => seededRandom() - 0.5);
        seleccionados = shuffled.slice(0, 5);
        localStorage.setItem(claveCache, JSON.stringify({
            fecha: añoMesDia,
            libros: seleccionados.map(l => l.id)
        }));
    }
    const grid = document.getElementById('recomendadosGrid');
    grid.innerHTML = seleccionados.map(libro => `
        <img src="${libro.portadas[0]}" alt="Portada de ${libro.titulo}"
             data-id="${libro.id}" loading="lazy" onerror="this.src='${CONFIG.DEFAULT_PORTADA}'">
    `).join('');
    grid.querySelectorAll('img').forEach(img => {
        img.onclick = () => openSearchForBook(img.dataset.id);
    });
}

function iniciarRotativas() {
    const conPortadas = librosConPortadas.filter(l => l.portadas.length > 0);
    if (conPortadas.length === 0) {
        document.getElementById('rotativasContainer').innerHTML = '<p style="text-align: center; color: var(--text-secondary);">No hay portadas para rotar.</p>';
        return;
    }
    const container = document.getElementById('rotativasContainer');
    container.innerHTML = '';
    conPortadas.forEach((libro, index) => {
        const total = conPortadas.length;
        const img = document.createElement('img');
        img.src = libro.portadas[0];
        img.alt = `Portada de ${libro.titulo}`;
        img.dataset.id = libro.id;
        img.className = index === 0 ? 'active' : '';
        img.loading = 'lazy';
        img.onerror = () => { img.src = CONFIG.DEFAULT_PORTADA; };
        img.onclick = () => openSearchForBook(libro.id);
        container.appendChild(img);
    });
    currentRotativaIndex = 0;
    rotativasInterval = setInterval(() => {
        const imgs = container.querySelectorAll('img');
        imgs[currentRotativaIndex].classList.remove('active');
        currentRotativaIndex = (currentRotativaIndex + 1) % imgs.length;
        imgs[currentRotativaIndex].classList.add('active');
    }, 4000);
}

function detenerRotativas() {
    if (rotativasInterval) {
        clearInterval(rotativasInterval);
        rotativasInterval = null;
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

function openSearchForBook(idLibro) {
    const libro = catalogo.find(l => l.idRegistro === idLibro);
    if (libro) {
        // Llama a función de search.js para abrir modal con ese libro
        mostrarResultadosBusqueda(); // Ajusta con query = libro.titulo
    } else {
        showToast('Libro no encontrado en el catálogo.', 'warning');
    }
}

function precargarPortadasClave() {
    const clave = librosConPortadas.slice(0, 8);
    clave.forEach(libro => {
        if (libro.portadas.length > 0) {
            const link = document.createElement('link');
            link.rel = 'preload';
            link.as = 'image';
            link.href = libro.portadas[0];
            document.head.appendChild(link);
        }
    });
}

async function initApp() {
    const MIN_SPLASH_DURATION = 2000;
    const startTime = Date.now();

    loadTheme();
    loadDaltonismMode();
    loadSizeCSS();

    try {
        await cargarCatalogo();
        await cargarPortadasDesdeGitHub();

        const hoy = new Date().toISOString().split('T')[0];
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith('recomendados_') && key !== `recomendados_${hoy}`) {
                localStorage.removeItem(key);
            }
        });

        renderRecomendados();
        iniciarRotativas();
        precargarPortadasClave();
        actualizarContador();
        setInterval(actualizarContador, 1000);

        const ahora = new Date();
        const manana = new Date(ahora);
        manana.setDate(manana.getDate() + 1);
        manana.setHours(0, 0, 0, 0);
        const tiempoHastaMedianoche = manana - ahora;
        setTimeout(async () => {
            await cargarCatalogo();
            await cargarPortadasDesdeGitHub();
            renderRecomendados();
            iniciarRotativas();
            showToast('¡Nuevos libros destacados de hoy!', 'success');
        }, tiempoHastaMedianoche);

        // Mensaje inicial del chat
        document.getElementById('chatMensajes').innerHTML = '';
        // agregarMensaje desde chat.js cuando esté listo
    } catch (error) {
        console.error('Error en initApp:', error);
        showToast('Error al cargar la aplicación.', 'error');
    }

    const elapsedTime = Date.now() - startTime;
    const remainingTime = MIN_SPLASH_DURATION - elapsedTime;
    if (remainingTime > 0) {
        await new Promise(resolve => setTimeout(resolve, remainingTime));
    }

    const splash = document.getElementById('splash');
    splash.classList.add('hidden');
    document.getElementById('app').style.display = 'block';

    setTimeout(() => splash.remove(), 500);

    // Eventos del header
    document.querySelector('.theme-toggle').onclick = toggleTheme;
    document.querySelector('.accessibility-toggle').onclick = abrirModalAccesibilidad;
    document.querySelector('.logout-btn').onclick = logoutAdmin;

    document.querySelector('.buscar-btn').onclick = mostrarResultadosBusqueda;
    document.querySelector('.reserva-btn').onclick = openReservationForm;
    document.querySelector('.reseña-btn').onclick = openReviewForm;
    document.querySelector('.solicitud-btn').onclick = openRequestForm;
    document.querySelector('.donaciones-btn').onclick = openDonationForm;
    document.querySelector('.favoritos-btn').onclick = abrirModalFavoritos;
    document.querySelector('.valorados-btn').onclick = abrirModalValorados;

    document.getElementById('buscarInput').onkeypress = debounce((event) => {
        if (event.key === 'Enter') mostrarResultadosBusqueda();
    }, CONFIG.DEBOUNCE_DELAY);

    document.getElementById('chatInput').onkeypress = debounce((event) => {
        if (event.key === 'Enter') enviarMensaje();
    }, CONFIG.DEBOUNCE_DELAY);

    const chatSendBtn = document.querySelector('.chat-controls button');
    if (chatSendBtn) chatSendBtn.onclick = enviarMensaje;

    // Admin persistente
    const isAdminLogged = localStorage.getItem('adminLogged') === 'true';
    const loginTime = localStorage.getItem('adminLoginTime');
    const LOGIN_DURATION = 24 * 60 * 60 * 1000;
    if (isAdminLogged && loginTime && (Date.now() - parseInt(loginTime) < LOGIN_DURATION)) {
        document.querySelector('.logout-btn').style.display = 'inline-block';
    } else {
        localStorage.removeItem('adminLogged');
        localStorage.removeItem('adminLoginTime');
        localStorage.removeItem('githubToken');
    }

    // Limpieza portadas huérfanas
    const portadasGuardadas = JSON.parse(localStorage.getItem('portadas_libros') || '{}');
    Object.keys(portadasGuardadas).forEach(id => {
        if (!catalogo.find(l => l.idRegistro === id)) {
            delete portadasGuardadas[id];
        }
    });
    localStorage.setItem('portadas_libros', JSON.stringify(portadasGuardadas));

    // Escape global para modales
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const openModals = document.querySelectorAll('.modal[style*="block"]');
            openModals.forEach(modal => {
                const id = modal.id;
                if (id === 'searchModal') cerrarModal();
                if (id === 'adminModal') cerrarModalAdmin();
                if (id === 'favoritosModal') cerrarModalFavoritos();
                if (id === 'valoradosModal') cerrarModalValorados();
                if (id === 'accessibilityModal') cerrarModalAccesibilidad();
            });
        }
    });

    document.getElementById('main-content').focus();
    window.addEventListener('beforeunload', detenerRotativas);
}

// Llamada inicial (o desde index.html)
initApp();
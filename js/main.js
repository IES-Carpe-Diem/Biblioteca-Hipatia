// js/main.js (modular y seguro)

import { CONFIG } from './config.js';
import { debounce, showToast, normalizarTexto } from './utils.js';
import { toggleTheme, loadTheme } from './theme.js';
import { loadDaltonismMode, loadSizeCSS } from './accessibility.js';
import { cargarPortadasDesdeGitHub } from './portadas.js';
import { actualizarSugerenciasBusqueda, mostrarResultadosBusqueda } from './search.js';
import { abrirModalFavoritos } from './favoritos.js';
import { abrirModalValorados, openReservationForm, openReviewForm, openRequestForm, openDonationForm, abrirModalAccesibilidad, cerrarModal, cerrarModalAdmin, cerrarModalFavoritos, cerrarModalValorados, cerrarModalAccesibilidad } from './modals.js';
import { enviarMensaje } from './chat.js';
import { initEstrellas } from './valoraciones.js';

let catalogo = [];
let librosConPortadas = [];
let rotativasInterval = null;
let currentRotativaIndex = 0;

window.catalogo = catalogo; // compartido con otros módulos

// ------------------- XML Parsing -------------------

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
            id: idDocumento,
            titulo: libro.getElementsByTagName('Titulo')[0]?.textContent || 'Sin título',
            autor: libro.getElementsByTagName('Autor')[0]?.textContent || 'Desconocido',
            categoria,
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
                ...libro,
                signatura: signatura || 'No disponible',
                isbn: ejemplar.getAttribute('ISBN') || 'No disponible',
                fecha: ejemplar.getAttribute('Fecha') || 'No disponible',
                copiasTotales: 0,
                copiasDisponibles: 0,
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

// ------------------- Carga de catálogo -------------------

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

            catalogo = Object.values(librosAgrupados);
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

// ------------------- Recomendados -------------------

function renderRecomendados() {
    const ahora = new Date();
    const añoMesDia = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-${String(ahora.getDate()).padStart(2, '0')}`;
    const claveCache = `recomendados_${añoMesDia}`;
    const cache = JSON.parse(localStorage.getItem(claveCache) || 'null');

    document.getElementById('tituloRecomendados').textContent =
        `Libros destacados de ${String(ahora.getDate()).padStart(2, '0')}/${String(ahora.getMonth() + 1).padStart(2, '0')}/${ahora.getFullYear()}🐱‍👓`;

    const conPortadas = librosConPortadas.filter(l => l.portadas.length > 0);
    if (conPortadas.length === 0) {
        document.getElementById('recomendadosGrid').innerHTML = '<p style="text-align:center;color:var(--text-secondary)">No hay portadas disponibles hoy.</p>';
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
        <img src="${libro.portadas[0]}" alt="Portada de ${libro.titulo}" data-id="${libro.id}" loading="lazy" onerror="this.src='${CONFIG.DEFAULT_PORTADA}'">
    `).join('');

    grid.querySelectorAll('img').forEach(img => {
        img.onclick = () => openSearchForBook(img.dataset.id);
    });
}

// ------------------- Rotativas -------------------

function iniciarRotativas() {
    const conPortadas = librosConPortadas.filter(l => l.portadas.length > 0);
    if (conPortadas.length === 0) {
        document.getElementById('rotativasContainer').innerHTML = '<p style="text-align:center;color:var(--text-secondary)">No hay portadas para rotar.</p>';
        return;
    }

    const container = document.getElementById('rotativasContainer');
    container.innerHTML = '';
    conPortadas.forEach((libro, index) => {
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
    if (rotativasInterval) clearInterval(rotativasInterval);
}

// ------------------- Contador -------------------

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
        `Nuevos libros en ${horas.toString().padStart(2,'0')}h ${minutos.toString().padStart(2,'0')}m ${segundos.toString().padStart(2,'0')}s`;
}

// ------------------- Búsqueda -------------------

function openSearchForBook(idLibro) {
    const libro = catalogo.find(l => l.id === idLibro);
    if (libro) {
        mostrarResultadosBusqueda(); // Ajustar con query = libro.titulo
    } else {
        showToast('Libro no encontrado en el catálogo.', 'warning');
    }
}

// ------------------- Precarga -------------------

function precargarPortadasClave() {
    librosConPortadas.slice(0,8).forEach(libro => {
        if (libro.portadas.length > 0) {
            const link = document.createElement('link');
            link.rel = 'preload';
            link.as = 'image';
            link.href = libro.portadas[0];
            document.head.appendChild(link);
        }
    });
}

// ------------------- Inicialización -------------------

async function initApp() {
    const MIN_SPLASH_DURATION = 2000;
    const startTime = Date.now();

    try {
        loadTheme();
        loadDaltonismMode();
        loadSizeCSS();

        await cargarCatalogo();
        await cargarPortadasDesdeGitHub();

        // Limpiar caches antiguos
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

        // Eventos header
        document.querySelector('.theme-toggle').onclick = toggleTheme;
        document.querySelector('.accessibility-toggle').onclick = abrirModalAccesibilidad;
        document.querySelector('.logout-btn').onclick = () => { localStorage.removeItem('adminLogged'); window.location.reload(); };

        document.querySelector('.buscar-btn').onclick = mostrarResultadosBusqueda;
        document.querySelector('.reserva-btn').onclick = openReservationForm;
        document.querySelector('.reseña-btn').onclick = openReviewForm;
        document.querySelector('.solicitud-btn').onclick = openRequestForm;
        document.querySelector('.donaciones-btn').onclick = openDonationForm;
        document.querySelector('.favoritos-btn').onclick = abrirModalFavoritos;
        document.querySelector('.valorados-btn').onclick = abrirModalValorados;

        document.getElementById('buscarInput').onkeypress = debounce(e => {
            if(e.key === 'Enter') mostrarResultadosBusqueda();
        }, CONFIG.DEBOUNCE_DELAY);

        document.getElementById('chatInput').onkeypress = debounce(e => {
            if(e.key === 'Enter') enviarMensaje();
        }, CONFIG.DEBOUNCE_DELAY);

        const chatSendBtn = document.querySelector('.chat-controls button');
        if(chatSendBtn) chatSendBtn.onclick = enviarMensaje;

        // Escape global para modales
        document.addEventListener('keydown', (e) => {
            if(e.key === 'Escape') {
                cerrarModal();
                cerrarModalAdmin();
                cerrarModalFavoritos();
                cerrarModalValorados();
                cerrarModalAccesibilidad();
            }
        });

    } catch(error) {
        console.error('Error en initApp:', error);
        showToast('Error al cargar la aplicación.', 'error');
    } finally {
        // Siempre ocultar splash
        const elapsedTime = Date.now() - startTime;
        const remainingTime = MIN_SPLASH_DURATION - elapsedTime;
        if (remainingTime > 0) await new Promise(r => setTimeout(r, remainingTime));

        const splash = document.getElementById('splash');
        if(splash) {
            splash.classList.add('hidden');
            const app = document.getElementById('app');
            if(app) app.style.display = 'block';
            setTimeout(() => splash.remove(), 500);
        }
    }

    // Detener rotativas al salir
    window.addEventListener('beforeunload', detenerRotativas);
}


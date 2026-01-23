// js/main.js

import { CONFIG } from './config.js';
import { debounce, showToast } from './utils.js';
import { toggleTheme, loadTheme } from './theme.js';
import { loadDaltonismMode, loadSizeCSS } from './accessibility.js';
import { cargarPortadasDesdeGitHub } from './portadas.js';
import { actualizarSugerenciasBusqueda, mostrarResultadosBusqueda } from './search.js';
import { abrirModalFavoritos } from './favoritos.js';
import { abrirModalValorados } from './modals.js';
import { enviarMensaje } from './chat.js';
import { openReservationForm, openReviewForm, openRequestForm, openDonationForm, logoutAdmin, abrirModalAccesibilidad } from './modals.js';

let catalogo = [];
let librosConPortadas = [];
let rotativasInterval = null;
let currentRotativaIndex = 0;

window.catalogo = catalogo;

// --------------------- UTILIDADES ---------------------

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
            narrativa: 'Narrativa',
            poesia: 'Poesía',
            'poesía': 'Poesía',
            teatro: 'Teatro',
            'literatura inglesa': 'Literatura inglesa',
            enciclopedias: 'Enciclopedias',
            comic: 'Cómic',
            'cómic': 'Cómic',
            deportes: 'Deportes',
            'lecturas graduadas': 'Lecturas Graduadas'
        };
        const categoria = categoriaMap[rawCategoria.toLowerCase()] || rawCategoria;
        libros[idDocumento] = {
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
        const signaturaMap = {
            Narrativa: 'N',
            Poesía: 'P',
            Teatro: 'T',
            'Literatura inglesa': 'LI',
            Enciclopedias: 'E',
            Cómic: 'C',
            Deportes: 'D',
            'Lecturas Graduadas': 'AC'
        };
        let signatura1 = signaturaMap[libro.categoria] || ejemplar.getAttribute('Signatura1') || '';
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
                idRegistro,
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

// --------------------- CARGA CATALOGO ---------------------

async function cargarCatalogo() {
    try {
        const response = await fetch('./data/Ejemplares.xml');
        if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
        const xmlText = await response.text();
        const xmlDoc = parseXML(xmlText);
        const libros = parseLibros(xmlDoc);
        const librosAgrupados = agruparEjemplares(xmlDoc, libros);

        catalogo = Object.values(librosAgrupados).map(libro => ({
            ...libro,
            idRegistro: libro.idRegistro || ''
        }));
        window.catalogo = catalogo;
        actualizarSugerenciasBusqueda();
        return catalogo;
    } catch (err) {
        console.error('Error cargando catálogo:', err);
        showToast('Error cargando catálogo.', 'error');
        catalogo = [];
        return catalogo;
    }
}

// --------------------- UI ---------------------

function renderRecomendados() {
    const grid = document.getElementById('recomendadosGrid');
    if (!grid) return;
    const conPortadas = librosConPortadas.filter(l => l.portadas.length > 0);
    if (conPortadas.length === 0) {
        grid.innerHTML = '<p style="text-align:center;color:var(--text-secondary)">No hay portadas disponibles.</p>';
        return;
    }
    const seleccionados = conPortadas.slice(0, 5);
    grid.innerHTML = seleccionados.map(libro => `
        <img src="${libro.portadas[0]}" alt="Portada ${libro.titulo}" loading="lazy" onerror="this.src='${CONFIG.DEFAULT_PORTADA}'" data-id="${libro.id}">
    `).join('');
    grid.querySelectorAll('img').forEach(img => img.onclick = () => mostrarResultadosBusqueda());
}

function iniciarRotativas() {
    const container = document.getElementById('rotativasContainer');
    if (!container) return;
    const conPortadas = librosConPortadas.filter(l => l.portadas.length > 0);
    if (conPortadas.length === 0) {
        container.innerHTML = '<p style="text-align:center;color:var(--text-secondary)">No hay portadas para rotar.</p>';
        return;
    }
    container.innerHTML = '';
    conPortadas.forEach((libro, index) => {
        const img = document.createElement('img');
        img.src = libro.portadas[0];
        img.alt = libro.titulo;
        img.dataset.id = libro.id;
        img.className = index === 0 ? 'active' : '';
        img.loading = 'lazy';
        img.onerror = () => { img.src = CONFIG.DEFAULT_PORTADA; };
        img.onclick = () => mostrarResultadosBusqueda();
        container.appendChild(img);
    });

    currentRotativaIndex = 0;
    if (rotativasInterval) clearInterval(rotativasInterval);
    rotativasInterval = setInterval(() => {
        const imgs = container.querySelectorAll('img');
        imgs[currentRotativaIndex].classList.remove('active');
        currentRotativaIndex = (currentRotativaIndex + 1) % imgs.length;
        imgs[currentRotativaIndex].classList.add('active');
    }, 4000);
}

function actualizarContador() {
    const contador = document.getElementById('contadorDia');
    if (!contador) return;
    const ahora = new Date();
    const manana = new Date(ahora);
    manana.setDate(manana.getDate() + 1);
    manana.setHours(0, 0, 0, 0);
    const diff = manana - ahora;
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    contador.textContent = `Nuevos libros en ${h.toString().padStart(2,'0')}h ${m.toString().padStart(2,'0')}m ${s.toString().padStart(2,'0')}s`;
}

function precargarPortadasClave() {
    librosConPortadas.slice(0, 8).forEach(libro => {
        if (libro.portadas.length > 0) {
            const link = document.createElement('link');
            link.rel = 'preload';
            link.as = 'image';
            link.href = libro.portadas[0];
            document.head.appendChild(link);
        }
    });
}

// --------------------- INICIALIZACION ---------------------

export async function initApp() {
    const splash = document.getElementById('splash');
    const app = document.getElementById('app');
    const MIN_SPLASH_DURATION = 2000;
    const MAX_SPLASH_DURATION = 5000;
    const startTime = Date.now();

    if (splash) splash.style.display = 'flex';
    if (app) app.style.display = 'none';

    loadTheme();
    loadDaltonismMode();
    loadSizeCSS();

    renderRecomendados();
    iniciarRotativas();
    actualizarContador();
    setInterval(actualizarContador, 1000);

    // Carga de datos en segundo plano
    const catalogoPromise = cargarCatalogo();
    const portadasPromise = cargarPortadasDesdeGitHub().then(data => {
        librosConPortadas = data;
        return data;
    }).catch(err => {
        console.error(err);
        librosConPortadas = [];
        return [];
    });

    const forceHideSplash = new Promise(resolve => setTimeout(resolve, MAX_SPLASH_DURATION));

    try {
        await Promise.race([
            Promise.all([catalogoPromise, portadasPromise]),
            forceHideSplash
        ]);
        renderRecomendados();
        iniciarRotativas();
        precargarPortadasClave();
    } catch (err) {
        console.error(err);
    } finally {
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, MIN_SPLASH_DURATION - elapsed);
        setTimeout(() => {
            if (splash) splash.remove();
            if (app) app.style.display = 'block';
        }, remaining);
    }

    // Eventos generales
    document.querySelector('.theme-toggle')?.addEventListener('click', toggleTheme);
    document.querySelector('.accessibility-toggle')?.addEventListener('click', abrirModalAccesibilidad);
    document.querySelector('.logout-btn')?.addEventListener('click', logoutAdmin);
    document.querySelector('.buscar-btn')?.addEventListener('click', mostrarResultadosBusqueda);

    document.getElementById('buscarInput')?.addEventListener('keypress', debounce(e => {
        if (e.key === 'Enter') mostrarResultadosBusqueda();
    }, CONFIG.DEBOUNCE_DELAY));

    const chatSendBtn = document.querySelector('.chat-controls button');
    if (chatSendBtn) chatSendBtn.addEventListener('click', enviarMensaje);

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
    });
}

// --------------------- LLAMADA INICIAL ---------------------

initApp();

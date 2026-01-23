// js/main.js

import { CONFIG } from './config.js';
import { debounce, showToast, normalizarTexto } from './utils.js';
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

// --- UTILIDADES DE XML ---
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

// --- CARGA DE CATALOGO ---
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

// --- FUNCIONES UI ---
function renderRecomendados() {
    const grid = document.getElementById('recomendadosGrid');
    grid.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">Cargando libros...</p>';
}

function iniciarRotativas() {
    const container = document.getElementById('rotativasContainer');
    container.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">Cargando portadas...</p>';
}

function detenerRotativas() {
    if (rotativasInterval) clearInterval(rotativasInterval);
}

function actualizarContador() {
    const ahora = new Date();
    const manana = new Date(ahora);
    manana.setDate(manana.getDate() + 1);
    manana.setHours(0,0,0,0);
    const diff = manana - ahora;
    const horas = Math.floor(diff / 3600000);
    const minutos = Math.floor((diff % 3600000) / 60000);
    const segundos = Math.floor((diff % 60000) / 1000);
    const contador = document.getElementById('contadorDia');
    if(contador) contador.textContent = `Nuevos libros en ${horas.toString().padStart(2,'0')}h ${minutos.toString().padStart(2,'0')}m ${segundos.toString().padStart(2,'0')}s`;
}

function openSearchForBook(idLibro) {
    const libro = catalogo.find(l => l.idRegistro === idLibro);
    if (libro) mostrarResultadosBusqueda();
    else showToast('Libro no encontrado en el catálogo.', 'warning');
}

function precargarPortadasClave() {
    librosConPortadas.slice(0,8).forEach(libro => {
        if(libro.portadas.length>0){
            const link = document.createElement('link');
            link.rel='preload';
            link.as='image';
            link.href=libro.portadas[0];
            document.head.appendChild(link);
        }
    });
}

// --- INICIALIZACIÓN ---
export async function initApp() {
    const MIN_SPLASH_DURATION = 2000;
    const startTime = Date.now();

    // --- OCULTAR SPLASH INMEDIATAMENTE ---
    const splash = document.getElementById('splash');
    const app = document.getElementById('app');
    if(splash && app){
        splash.classList.add('hidden');
        app.style.display = 'block';
        setTimeout(()=>splash.remove(),500);
    }

    // --- CARGA INICIAL ---
    loadTheme();
    loadDaltonismMode();
    loadSizeCSS();

    // Carga de datos en segundo plano
    cargarCatalogo().catch(console.error);
    cargarPortadasDesdeGitHub().catch(console.error);

    // Contador y UI inicial
    actualizarContador();
    setInterval(actualizarContador,1000);
    renderRecomendados();
    iniciarRotativas();

    // --- EVENTOS HEADER ---
    document.querySelector('.theme-toggle')?.addEventListener('click', toggleTheme);
    document.querySelector('.accessibility-toggle')?.addEventListener('click', abrirModalAccesibilidad);
    document.querySelector('.logout-btn')?.addEventListener('click', logoutAdmin);

    document.querySelector('.buscar-btn')?.addEventListener('click', mostrarResultadosBusqueda);
    document.querySelector('.reserva-btn')?.addEventListener('click', openReservationForm);
    document.querySelector('.reseña-btn')?.addEventListener('click', openReviewForm);
    document.querySelector('.solicitud-btn')?.addEventListener('click', openRequestForm);
    document.querySelector('.donaciones-btn')?.addEventListener('click', openDonationForm);
    document.querySelector('.favoritos-btn')?.addEventListener('click', abrirModalFavoritos);
    document.querySelector('.valorados-btn')?.addEventListener('click', abrirModalValorados);

    document.getElementById('buscarInput')?.addEventListener('keypress', debounce(e=>{
        if(e.key==='Enter') mostrarResultadosBusqueda();
    }, CONFIG.DEBOUNCE_DELAY));

    document.getElementById('chatInput')?.addEventListener('keypress', debounce(e=>{
        if(e.key==='Enter') enviarMensaje();
    }, CONFIG.DEBOUNCE_DELAY));

    const chatSendBtn = document.querySelector('.chat-controls button');
    if(chatSendBtn) chatSendBtn.addEventListener('click', enviarMensaje);

    // ESCAPE GLOBAL PARA MODALES
    document.addEventListener('keydown', e=>{
        if(e.key==='Escape'){
            const modales = document.querySelectorAll('.modal[style*="block"]');
            modales.forEach(modal=>modal.style.display='none');
        }
    });

    // MODALES CERRAR CON X
    document.querySelectorAll('.modal-close').forEach(btn=>{
        btn.onclick=()=>btn.closest('.modal')?.style.display='none';
    });

    // ADMIN persistente
    const isAdminLogged = localStorage.getItem('adminLogged')==='true';
    const loginTime = localStorage.getItem('adminLoginTime');
    const LOGIN_DURATION = 24*60*60*1000;
    if(!(isAdminLogged && loginTime && (Date.now()-parseInt(loginTime)<LOGIN_DURATION))){
        localStorage.removeItem('adminLogged');
        localStorage.removeItem('adminLoginTime');
        localStorage.removeItem('githubToken');
    }

    // LIMPIEZA portadas huérfanas
    const portadasGuardadas = JSON.parse(localStorage.getItem('portadas_libros') || '{}');
    Object.keys(portadasGuardadas).forEach(id=>{
        if(!catalogo.find(l=>l.idRegistro===id)) delete portadasGuardadas[id];
    });
    localStorage.setItem('portadas_libros', JSON.stringify(portadasGuardadas));

    // Focus principal
    document.getElementById('main-content')?.focus();
    window.addEventListener('beforeunload', detenerRotativas);
}

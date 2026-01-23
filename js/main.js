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

// --- UTILIDADES XML ---
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

// --- CARGA CATALOGO ---
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
            return catalogo;
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
            console.log(`Catálogo cargado exitosamente.`);
            return catalogo;
        } catch (error) {
            ultimoError = error;
            console.warn(`Intento ${intento + 1} falló: ${error.message}`);
            if (intento < reintentosMaximos - 1) {
                const delay = 1000 * Math.pow(2, intento);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    console.error('Todos los reintentos fallaron:', ultimoError);
    showToast('Catálogo en mantenimiento.', 'error');
    catalogo = [];
    window.catalogo = catalogo;
    return catalogo;
}

// --- UI ---
function renderRecomendados() {
    const grid = document.getElementById('recomendadosGrid');
    if(!grid) return;
    if(librosConPortadas.length === 0){
        grid.innerHTML = '<p style="text-align:center;color:var(--text-secondary)">No hay portadas disponibles.</p>';
        return;
    }
    const seleccionados = librosConPortadas.slice(0,5);
    grid.innerHTML = seleccionados.map(libro=>`
        <img src="${libro.portadas[0]}" alt="Portada ${libro.titulo}" loading="lazy" onerror="this.src='${CONFIG.DEFAULT_PORTADA}'" data-id="${libro.id}">
    `).join('');
    grid.querySelectorAll('img').forEach(img=>img.onclick=()=>mostrarResultadosBusqueda());
}

function iniciarRotativas() {
    const container = document.getElementById('rotativasContainer');
    if(!container) return;
    if(librosConPortadas.length===0){
        container.innerHTML='<p style="text-align:center;color:var(--text-secondary)">No hay portadas para rotar.</p>';
        return;
    }
    container.innerHTML='';
    librosConPortadas.forEach((libro,index)=>{
        const img=document.createElement('img');
        img.src=libro.portadas[0];
        img.alt=libro.titulo;
        img.dataset.id=libro.id;
        img.className=index===0?'active':'';
        img.loading='lazy';
        img.onerror=()=>{img.src=CONFIG.DEFAULT_PORTADA};
        img.onclick=()=>mostrarResultadosBusqueda();
        container.appendChild(img);
    });
    currentRotativaIndex=0;
    if(rotativasInterval) clearInterval(rotativasInterval);
    rotativasInterval=setInterval(()=>{
        const imgs=container.querySelectorAll('img');
        imgs[currentRotativaIndex].classList.remove('active');
        currentRotativaIndex=(currentRotativaIndex+1)%imgs.length;
        imgs[currentRotativaIndex].classList.add('active');
    },4000);
}

function actualizarContador() {
    const contador=document.getElementById('contadorDia');
    if(!contador) return;
    const ahora=new Date();
    const manana=new Date(ahora);
    manana.setDate(manana.getDate()+1);
    manana.setHours(0,0,0,0);
    const diff=manana-ahora;
    const h=Math.floor(diff/3600000);
    const m=Math.floor((diff%3600000)/60000);
    const s=Math.floor((diff%60000)/1000);
    contador.textContent=`Nuevos libros en ${h.toString().padStart(2,'0')}h ${m.toString().padStart(2,'0')}m ${s.toString().padStart(2,'0')}s`;
}

function precargarPortadasClave() {
    librosConPortadas.slice(0,8).forEach(libro=>{
        if(libro.portadas.length>0){
            const link=document.createElement('link');
            link.rel='preload';
            link.as='image';
            link.href=libro.portadas[0];
            document.head.appendChild(link);
        }
    });
}

// --- INICIALIZACION ---
export async function initApp() {
    const splash=document.getElementById('splash');
    const app=document.getElementById('app');
    const MIN_SPLASH_DURATION=2000;
    const MAX_SPLASH_DURATION=5000;
    const startTime=Date.now();

    if(splash) splash.style.display='flex';
    if(app) app.style.display='none';

    loadTheme();
    loadDaltonismMode();
    loadSizeCSS();

    renderRecomendados();
    iniciarRotativas();
    actualizarContador();
    setInterval(actualizarContador,1000);

    const catalogoPromise=cargarCatalogo().catch(err=>{console.error(err); return [];});
    const portadasPromise=cargarPortadasDesdeGitHub().then(data=>{librosConPortadas=data; return data;}).catch(err=>{console.error(err); return [];});

    const forceHideSplash=new Promise(resolve=>setTimeout(resolve,MAX_SPLASH_DURATION));

    try{
        await Promise.race([Promise.all([catalogoPromise,portadasPromise]),forceHideSplash]);
        renderRecomendados();
        iniciarRotativas();
        precargarPortadasClave();
    }catch(e){console.error(e);}
    finally{
        const elapsed=Date.now()-startTime;
        const remaining=Math.max(0,MIN_SPLASH_DURATION-elapsed);
        setTimeout(()=>{
            if(splash) splash.remove();
            if(app) app.style.display='block';
        },remaining);
    }

    // Eventos
    document.querySelector('.theme-toggle')?.addEventListener('click',toggleTheme);
    document.querySelector('.accessibility-toggle')?.addEventListener('click',abrirModalAccesibilidad);
    document.querySelector('.logout-btn')?.addEventListener('click',logoutAdmin);
    document.querySelector('.buscar-btn')?.addEventListener('click',mostrarResultadosBusqueda);

    document.getElementById('buscarInput')?.addEventListener('keypress',debounce(e=>{
        if(e.key==='Enter') mostrarResultadosBusqueda();
    },CONFIG.DEBOUNCE_DELAY));

    const chatSendBtn=document.querySelector('.chat-controls button');
    if(chatSendBtn) chatSendBtn.addEventListener('click',enviarMensaje);

    document.addEventListener('keydown',e=>{
        if(e.key==='Escape') document.querySelectorAll('.modal').forEach(m=>m.style.display='none');
    });
}

// Llamada inicial
initApp();

// js/catalogo.js
// Módulo responsable de cargar, procesar y gestionar el catálogo de libros
// Fuente de datos principal: ./Ejemplares.xml
// Funcionalidades:
//   - Carga y parsing del XML
//   - Integración de portadas desde GitHub (usando Trees API) → PRIORIZADA para web pública
//   - Búsquedas y normalización de texto
//   - Recomendaciones diarias (con fallback a cache local y portada default solo como último recurso)
//   - Renderizado de portadas en modales y grid (portada principal fija + botón para ver todas si hay múltiples)

let catalogo = [];
let librosConPortadas = [];

// Función auxiliar para actualizar librosConPortadas con lo más fresco posible (GitHub o cache)
function actualizarLibrosConPortadas() {
    librosConPortadas = catalogo.map(libro => ({
        id: libro.idRegistro,
        titulo: libro.titulo,
        portadas: libro.portadas || []
    }));
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
            actualizarLibrosConPortadas();
            actualizarSugerenciasBusqueda();
            console.log('Catálogo cargado desde cache local (rápido).');
            return;
        }
    }
    let ultimoError = null;
    for (let intento = 0; intento < reintentosMaximos; intento++) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);
            const response = await fetch('./Ejemplares.xml', { signal: controller.signal });
            clearTimeout(timeoutId);
            if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
            const xmlText = await response.text();
            const xmlDoc = parseXML(xmlText);
            const libros = parseLibros(xmlDoc);
            const librosAgrupados = agruparEjemplares(xmlDoc, libros);
            await mergePortadas(librosAgrupados);
            catalogo = Object.values(librosAgrupados).map(libro => ({
                ...libro,
                idRegistro: libro.idRegistro || libro.id_documento || ''
            }));
            actualizarLibrosConPortadas();
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
    showToast('Catálogo en Mantenimiento, disculpe las molestias.', 'error');
}

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

async function mergePortadas(librosAgrupados) {
    const portadasGuardadas = JSON.parse(localStorage.getItem('portadas_libros') || '{}');
    Object.keys(librosAgrupados).forEach(idRegistro => {
        const portadasPersistidas = portadasGuardadas[idRegistro] || [];
        portadasPersistidas.forEach(portada => {
            if (!librosAgrupados[idRegistro].portadas.includes(portada)) {
                librosAgrupados[idRegistro].portadas.push(portada);
            }
        });
    });
}

async function cargarPortadasDesdeGitHub() {
    try {
        const refRes = await fetch('https://api.github.com/repos/IES-Carpe-Diem/Biblioteca-Hipatia/git/ref/heads/main');
        if (!refRes.ok) throw new Error('Error al obtener ref main');
        const refData = await refRes.json();
        const rootSha = refData.object.sha;

        const treeRes = await fetch(
            `https://api.github.com/repos/IES-Carpe-Diem/Biblioteca-Hipatia/git/trees/${rootSha}?recursive=1`
        );
        if (!treeRes.ok) throw new Error('Error al obtener árbol recursivo');
        const treeData = await treeRes.json();

        const portadasFiles = treeData.tree.filter(item =>
            item.type === 'blob' &&
            item.path.startsWith('portadas/') &&
            /\.(jpe?g|png|webp)$/i.test(item.path)
        );

        let actualizadas = false;
        const portadasGuardadas = JSON.parse(localStorage.getItem('portadas_libros') || '{}');

        portadasFiles.forEach(file => {
            const match = file.path.match(/^portadas\/(.+?)_\d+\.(jpe?g|png|webp)$/i);
            if (match) {
                const idLibro = match[1];
                const timestamp = Date.now();
                const url = `https://cdn.jsdelivr.net/gh/IES-Carpe-Diem/Biblioteca-Hipatia@main/${file.path}?v=${timestamp}`;

                if (!portadasGuardadas[idLibro]) portadasGuardadas[idLibro] = [];
                if (!portadasGuardadas[idLibro].includes(url)) {
                    portadasGuardadas[idLibro].push(url);
                    actualizadas = true;

                    const libro = catalogo.find(l => l.idRegistro === idLibro);
                    if (libro) {
                        libro.portadas = libro.portadas || [];
                        if (!libro.portadas.includes(url)) {
                            libro.portadas.push(url);
                        }
                    }
                }
            }
        });

        if (actualizadas) {
            localStorage.setItem('portadas_libros', JSON.stringify(portadasGuardadas));
            console.log('¡Portadas nuevas detectadas y actualizadas desde GitHub!');
        } else {
            console.log('Portadas ya al día (sin cambios en GitHub).');
        }

        actualizarLibrosConPortadas();
        renderRecomendados();
        precargarPortadasClave();

    } catch (err) {
        console.warn('No se pudieron actualizar portadas desde GitHub (usando cache local):', err.message);
        actualizarLibrosConPortadas();
        renderRecomendados();
    }
}

function normalizarTexto(texto) {
    if (!texto) return '';
    const acentos = {
        'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u',
        'Á': 'A', 'É': 'E', 'Í': 'I', 'Ó': 'O', 'Ú': 'U'
    };
    return texto
        .replace(/[áéíóúÁÉÍÓÚ]/g, match => acentos[match] || match)
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
}

function buscarLibros(query, exactMatch = false) {
    if (!catalogo.length || !query) return [];
    const lowerQuery = normalizarTexto(query);
    if (exactMatch) {
        return catalogo.filter(libro => normalizarTexto(libro.titulo) === lowerQuery);
    }
    return catalogo
        .filter(libro =>
            normalizarTexto(libro.titulo).includes(lowerQuery) ||
            normalizarTexto(libro.autor).includes(lowerQuery) ||
            normalizarTexto(libro.categoria).includes(lowerQuery) ||
            normalizarTexto(libro.signatura).includes(lowerQuery) ||
            normalizarTexto(libro.isbn).includes(lowerQuery)
        )
        .sort((a, b) => (b.copiasDisponibles || 0) - (a.copiasDisponibles || 0));
}

function actualizarSugerenciasBusqueda() {
    const datalist = document.getElementById('sugerenciasBusqueda');
    datalist.innerHTML = catalogo.map(libro => `
        <option value="${libro.titulo}">${libro.autor} - ${libro.categoria} (${libro.copiasDisponibles || 0} disponibles)</option>
    `).join('');
}

// Nuevo flotante para mostrar todas las portadas
function mostrarTodasPortadas(libro) {
    // Crear el flotante si no existe
    let flotante = document.getElementById('portadasFlotante');
    if (!flotante) {
        flotante = document.createElement('div');
        flotante.id = 'portadasFlotante';
        flotante.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.8);
            z-index: 2000;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 20px;
            box-sizing: border-box;
            overflow-y: auto;
        `;
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '✖ Cerrar';
        closeBtn.style.cssText = `
            position: absolute;
            top: 20px;
            right: 20px;
            background: #dc3545;
            color: white;
            border: none;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            font-size: 1.5em;
            cursor: pointer;
        `;
        closeBtn.onclick = () => flotante.remove();
        flotante.appendChild(closeBtn);

        const title = document.createElement('h2');
        title.style.cssText = 'color: white; margin-bottom: 20px;';
        flotante.appendChild(title);

        const grid = document.createElement('div');
        grid.style.cssText = `
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
            gap: 15px;
            max-width: 90%;
        `;
        flotante.appendChild(grid);

        document.body.appendChild(flotante);

        // Cerrar al clic fuera del grid
        flotante.addEventListener('click', (e) => {
            if (e.target === flotante) flotante.remove();
        });
    }

    const title = flotante.querySelector('h2');
    title.textContent = `Todas las portadas de "${libro.titulo}" (${libro.portadas.length})`;

    const grid = flotante.querySelector('div');
    grid.innerHTML = '';

    libro.portadas.forEach(url => {
        const imgContainer = document.createElement('div');
        imgContainer.style.cssText = 'width: 120px; height: 180px; background: #f0f0f0; border-radius: 6px; overflow: hidden; box-shadow: 0 4px 8px rgba(0,0,0,0.2);';
        const img = document.createElement('img');
        img.src = url;
        img.alt = 'Portada adicional';
        img.style.cssText = 'width: 100%; height: 100%; object-fit: cover;';
        img.onerror = () => { img.src = CONFIG.DEFAULT_PORTADA; };
        imgContainer.appendChild(img);
        grid.appendChild(imgContainer);
    });

    flotante.style.display = 'flex';
}

async function renderPortadas(container, idLibro) {
    container.innerHTML = ''; // Limpiar siempre para evitar acumulación
    const libro = catalogo.find(l => l.idRegistro === idLibro);

    // Portada principal fija (primera o default)
    const portadaPrincipal = (libro && libro.portadas && libro.portadas.length > 0) ? libro.portadas[0] : CONFIG.DEFAULT_PORTADA;

    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'position: relative; width: 120px; height: 180px;';

    const img = document.createElement('img');
    img.src = portadaPrincipal;
    img.alt = `Portada principal de ${libro?.titulo || 'el libro'}`;
    img.style.cssText = 'width: 100%; height: 100%; object-fit: cover; border-radius: 6px; box-shadow: 0 4px 8px rgba(0,0,0,0.2);';
    img.onerror = () => { img.src = CONFIG.DEFAULT_PORTADA; };

    wrapper.appendChild(img);

    // Botón para ver todas si hay más de 1
    if (libro && libro.portadas && libro.portadas.length > 1) {
        const btn = document.createElement('button');
        btn.textContent = `Ver todas (${libro.portadas.length})`;
        btn.style.cssText = `
            position: absolute;
            bottom: 8px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0,0,0,0.6);
            color: white;
            border: none;
            border-radius: 4px;
            padding: 4px 8px;
            font-size: 0.8em;
            cursor: pointer;
        `;
        btn.onclick = () => mostrarTodasPortadas(libro);
        wrapper.appendChild(btn);
    }

    container.appendChild(wrapper);
    container.classList.add('loaded');
}

function renderRecomendados() {
    const ahora = new Date();
    const añoMesDia = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-${String(ahora.getDate()).padStart(2, '0')}`;
    const claveCache = `recomendados_${añoMesDia}`;
    const cache = JSON.parse(localStorage.getItem(claveCache) || 'null');
    const diaMes = String(ahora.getDate()).padStart(2, '0');
    const mesNum = String(ahora.getMonth() + 1).padStart(2, '0');
    const año = ahora.getFullYear();
    document.getElementById('tituloRecomendados').textContent = `Libros destacados de ${diaMes}/${mesNum}/${año}📖`;

    let seleccionados = [];
    if (cache && cache.libros && cache.fecha === añoMesDia) {
        seleccionados = cache.libros.map(id => catalogo.find(l => l.idRegistro === id)).filter(Boolean);
    }
    if (seleccionados.length < 5 || seleccionados.length === 0) {
        const seed = parseInt(añoMesDia.replace(/-/g, ''), 10);
        const seededRandom = (function(s) {
            let state = s;
            return function() {
                state = (state * 1664525 + 1013904223) % 2147483647;
                return state / 2147483647;
            };
        })(seed);
        const conPortadas = catalogo.filter(l => l.portadas && l.portadas.length > 0);
        const sinPortadas = catalogo.filter(l => !(l.portadas && l.portadas.length > 0));
        const shuffledCon = [...conPortadas].sort(() => seededRandom() - 0.5);
        const shuffledSin = [...sinPortadas].sort(() => seededRandom() - 0.5);
        seleccionados = [...shuffledCon.slice(0, 5), ...shuffledSin.slice(0, 5 - shuffledCon.length)].slice(0, 5);
        localStorage.setItem(claveCache, JSON.stringify({
            fecha: añoMesDia,
            libros: seleccionados.map(l => l.idRegistro)
        }));
    }

    const grid = document.getElementById('recomendadosGrid');
    grid.innerHTML = seleccionados.map(libro => {
        const portadaSrc = (libro.portadas && libro.portadas.length > 0) ? libro.portadas[0] : CONFIG.DEFAULT_PORTADA;
        return `
            <img src="${portadaSrc}" alt="Portada de ${libro.titulo}"
                 data-id="${libro.idRegistro}" onclick="openSearchForBook('${libro.idRegistro}')"
                 loading="lazy" onerror="this.src='${CONFIG.DEFAULT_PORTADA}'">
        `;
    }).join('');

    if (seleccionados.length === 0) {
        grid.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">No hay libros en el catálogo hoy.</p>';
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
            link.imagesizes = '120px';
            link.imagesrcset = `${libro.portadas[0]} 1x`;
            document.head.appendChild(link);
        }
    });
}

function openSearchForBook(idLibro) {
    const libro = catalogo.find(l => l.idRegistro === idLibro);
    if (libro) {
        searchQuery = libro.titulo;
        searchResults = buscarLibros(searchQuery);
        currentPageSearch = 1;
        abrirModal();
        mostrarResultadosModal();
    } else {
        showToast('Libro no encontrado en el catálogo.', 'warning');
    }
}
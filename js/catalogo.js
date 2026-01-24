// js/catalogo.js
// Módulo responsable de cargar, procesar y gestionar el catálogo de libros
// Fuente de datos principal: ./Ejemplares.xml
// Funcionalidades:
//   - Carga y parsing del XML
//   - Integración de portadas desde GitHub (usando Trees API)
//   - Búsquedas y normalización de texto
//   - Recomendaciones diarias y portadas rotativas (con mejoras: más lento + pausa al hover)
//   - Renderizado de portadas en modales y grid

let catalogo = [];
let librosConPortadas = [];
let rotativasInterval = null;
let currentRotativaIndex = 0;

async function cargarCatalogo(reintentosMaximos = CONFIG.RETRY_MAX) {
    const cacheVersion = 'catalog-v1';
    const cachedCatalogo = localStorage.getItem('catalogo');
    const cachedVersion = localStorage.getItem('catalogoVersion');
    const cachedTimestamp = localStorage.getItem('catalogoTimestamp');
    if (cachedCatalogo && cachedVersion === cacheVersion && cachedTimestamp) {
        const timestamp = parseInt(cachedTimestamp, 10);
        if (Date.now() - timestamp < CONFIG.CACHE_DURATION) {
            catalogo = JSON.parse(cachedCatalogo);
            actualizarSugerenciasBusqueda();
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
            librosConPortadas = catalogo.map(libro => ({
                id: libro.idRegistro,
                titulo: libro.titulo,
                portadas: libro.portadas
            }));
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
                console.log(`Reintentando en ${delay / 1000}s...`);
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

        if (treeData.truncated) {
            console.warn('Árbol truncado (>100.000 entradas) – improbable en tu repo');
        }

        const portadasFiles = treeData.tree.filter(item =>
            item.type === 'blob' &&
            item.path.startsWith('portadas/') &&
            /\.(jpe?g|png|webp)$/i.test(item.path)
        );

        console.log(`Detectadas ${portadasFiles.length} portadas en total`);

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
                }

                const libro = catalogo.find(l => l.idRegistro === idLibro);
                if (libro) {
                    libro.portadas = libro.portadas || [];
                    if (!libro.portadas.includes(url)) {
                        libro.portadas.push(url);
                    }
                }
            }
        });

        localStorage.setItem('portadas_libros', JSON.stringify(portadasGuardadas));

        librosConPortadas = catalogo.map(l => ({
            id: l.idRegistro,
            titulo: l.titulo,
            portadas: portadasGuardadas[l.idRegistro] || []
        })).filter(l => l.portadas.length > 0);

        console.log('Portadas cargadas correctamente con Git Trees API');

        renderRecomendados();
        iniciarRotativas();

    } catch (err) {
        console.error('Error cargando portadas (Trees API):', err);
        showToast('Problema al cargar todas las portadas. Algunas podrían no verse.', 'warning');
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

async function renderPortadas(container, idLibro) {
    const libro = catalogo.find(l => l.idRegistro === idLibro);
    if (!libro || !libro.portadas || libro.portadas.length === 0) {
        const defaultImg = document.createElement('img');
        defaultImg.src = CONFIG.DEFAULT_PORTADA;
        defaultImg.alt = 'Portada no disponible';
        defaultImg.className = 'default-placeholder';
        defaultImg.style.cssText = 'width:100%; height:100%; object-fit:cover; border-radius:6px;';
        container.appendChild(defaultImg);
        container.classList.add('loaded');
        return;
    }
    const slider = document.createElement('div');
    slider.className = 'portada-slider';
    container.appendChild(slider);
    const loadImagePromises = libro.portadas.map((url, index) =>
        new Promise((resolve) => {
            const img = new Image();
            img.src = url;
            img.alt = '';
            img.className = 'portada-img';
            img.crossOrigin = 'anonymous';
            img.loading = 'lazy';
            img.onload = () => resolve({ img, index, success: true });
            img.onerror = () => {
                const saved = JSON.parse(localStorage.getItem('portadas_libros') || '{}');
                if (saved[idLibro]) {
                    saved[idLibro] = saved[idLibro].filter(u => u !== url);
                    localStorage.setItem('portadas_libros', JSON.stringify(saved));
                }
                resolve({ index, success: false });
            };
            setTimeout(() => {
                if (!img.complete) resolve({ index, success: false });
            }, 5000);
        })
    );
    const results = await Promise.all(loadImagePromises);
    const validImages = results.filter(r => r.success && r.img).map(r => ({ img: r.img, index: r.index }));
    if (validImages.length === 0) {
        slider.remove();
        const defaultImg = document.createElement('img');
        defaultImg.src = CONFIG.DEFAULT_PORTADA;
        defaultImg.alt = 'Portada no disponible';
        defaultImg.className = 'default-placeholder';
        defaultImg.style.cssText = 'width:100%; height:100%; object-fit:cover; border-radius:6px;';
        container.appendChild(defaultImg);
        container.classList.add('loaded');
        return;
    }
    validImages.forEach((item, i) => {
        item.img.style.display = 'block';
        if (i === 0) item.img.classList.add('active');
        slider.appendChild(item.img);
    });
    if (validImages.length >= 1) {
        slider.classList.add('portada-slider-3d');
        const angle = 360 / validImages.length;
        validImages.forEach((item, i) => {
            const img = item.img;
            img.className = 'portada-img-3d';
            if (i === 0) img.classList.add('active');
            img.style.transform = `rotateY(${i * angle}deg) translateZ(80px)`;
            slider.appendChild(img);
        });
        let current = 0;
        const interval = setInterval(() => {
            current = (current + 1) % validImages.length;
            slider.style.transform = `rotateY(${-current * angle}deg)`;
        }, 2500);
        const observer = new MutationObserver(() => {
            if (getComputedStyle(document.getElementById('searchModal')).display === 'none') {
                clearInterval(interval);
                observer.disconnect();
            }
        });
        observer.observe(document.getElementById('searchModal'), { attributes: true });
    }
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
    const conPortadas = librosConPortadas.filter(l => l.portadas.length > 0);
    if (conPortadas.length === 0) {
        document.getElementById('recomendadosGrid').innerHTML = '<p style="text-align: center; color: var(--text-secondary);">No hay portadas disponibles hoy.</p>';
        return;
    }
    let seleccionados = [];
    if (cache && cache.libros && cache.fecha === añoMesDia) {
        seleccionados = cache.libros.map(id =>
            conPortadas.find(l => l.id === id)
        ).filter(Boolean);
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
             data-id="${libro.id}" onclick="openSearchForBook('${libro.id}')"
             loading="lazy" onerror="this.src='${CONFIG.DEFAULT_PORTADA}'">
    `).join('');
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
        img.setAttribute('aria-label', `Portada rotativa ${index + 1} de ${total}: ${libro.titulo}`);
        img.setAttribute('role', 'img');
        img.dataset.id = libro.id;                    // ¡Importante! ID único por libro
        img.className = index === 0 ? 'active' : '';
        img.loading = 'lazy';
        img.onerror = () => { img.src = CONFIG.DEFAULT_PORTADA; };
        img.onclick = () => openSearchForBook(libro.id);  // Cada imagen abre SU libro
        container.appendChild(img);
    });

    currentRotativaIndex = 0;
    let intervalId = setInterval(() => {
        const imgs = container.querySelectorAll('img');
        imgs[currentRotativaIndex].classList.remove('active');
        currentRotativaIndex = (currentRotativaIndex + 1) % imgs.length;
        imgs[currentRotativaIndex].classList.add('active');
    }, 8000);  // 8 segundos → más lento y cómodo

    // Pausa al pasar el ratón (evita sensación de bug / mareo)
    container.addEventListener('mouseenter', () => clearInterval(intervalId));
    container.addEventListener('mouseleave', () => {
        intervalId = setInterval(() => {
            const imgs = container.querySelectorAll('img');
            imgs[currentRotativaIndex].classList.remove('active');
            currentRotativaIndex = (currentRotativaIndex + 1) % imgs.length;
            imgs[currentRotativaIndex].classList.add('active');
        }, 8000);
    });

    rotativasInterval = intervalId;
}

function detenerRotativas() {
    if (rotativasInterval) {
        clearInterval(rotativasInterval);
        rotativasInterval = null;
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
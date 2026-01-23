import { CONFIG } from './config.js';
import { showToast } from './utils.js';

let librosConPortadas = [];

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

export async function cargarPortadasDesdeGitHub() {
    try {
        const refRes = await fetch('https://api.github.com/repos/IES-Carpe-Diem/Biblioteca-Hipatia/git/ref/heads/main');
        if (!refRes.ok) throw new Error('Error al obtener ref main');
        const refData = await refRes.json();
        const rootSha = refData.object.sha;

        const treeRes = await fetch(`https://api.github.com/repos/IES-Carpe-Diem/Biblioteca-Hipatia/git/trees/${rootSha}?recursive=1`);
        if (!treeRes.ok) throw new Error('Error al obtener árbol recursivo');
        const treeData = await treeRes.json();

        const portadasFiles = treeData.tree.filter(item =>
            item.type === 'blob' &&
            item.path.startsWith('portadas/') &&
            /\.(jpe?g|png|webp)$/i.test(item.path)
        );

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

                const libro = window.catalogo.find(l => l.idRegistro === idLibro);
                if (libro) {
                    libro.portadas = libro.portadas || [];
                    if (!libro.portadas.includes(url)) {
                        libro.portadas.push(url);
                    }
                }
            }
        });

        localStorage.setItem('portadas_libros', JSON.stringify(portadasGuardadas));

        librosConPortadas = window.catalogo.map(l => ({
            id: l.idRegistro,
            titulo: l.titulo,
            portadas: portadasGuardadas[l.idRegistro] || []
        })).filter(l => l.portadas.length > 0);

        console.log('Portadas cargadas correctamente con Git Trees API');
    } catch (err) {
        console.error('Error cargando portadas (Trees API):', err);
        showToast('Problema al cargar todas las portadas. Algunas podrían no verse.', 'warning');
    }
}

export async function renderPortadas(container, idLibro) {
    const libro = window.catalogo.find(l => l.idRegistro === idLibro);
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
    slider.className = 'portada-slider-3d';
    container.appendChild(slider);
    const loadImagePromises = libro.portadas.map((url, index) =>
        new Promise((resolve) => {
            const img = new Image();
            img.src = url;
            img.alt = '';
            img.className = 'portada-img-3d';
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
        const angle = 360 / validImages.length;
        validImages.forEach((item, i) => {
            const img = item.img;
            if (i === 0) img.classList.add('active');
            img.style.transform = `rotateY(${i * angle}deg) translateZ(80px)`;
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

export { librosConPortadas };
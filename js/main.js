// js/main.js
// Punto de entrada y orquestación principal de la aplicación
// Inicializa todos los módulos en orden correcto
// Define variables globales compartidas (como toastCount)

window.toastCount = 0;  // Variable global explícita para apilar toasts verticalmente

async function initApp() {
    const MIN_SPLASH_DURATION = 2000;
    const startTime = Date.now();
    loadTheme();
    loadDaltonismMode();
    loadSizeCSS();
    try {
        await cargarCatalogo(CONFIG.RETRY_MAX);
        await cargarPortadasDesdeGitHub();
        const hoy = new Date().toISOString().split('T')[0];
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith('recomendados_') && key !== `recomendados_${hoy}`) {
                localStorage.removeItem(key);
            }
        });
        renderRecomendados();
        precargarPortadasClave();
        actualizarContador();
        setInterval(actualizarContador, 1000);
        const ahora = new Date();
        const manana = new Date(ahora);
        manana.setDate(manana.getDate() + 1);
        manana.setHours(0, 0, 0, 0);
        const tiempoHastaMedianoche = manana - ahora;
        setTimeout(async () => {
            await cargarCatalogo(CONFIG.RETRY_MAX);
            await cargarPortadasDesdeGitHub();
            renderRecomendados();
            showToast('¡Nuevos libros destacados de hoy!', 'success');
        }, tiempoHastaMedianoche);
    } catch (error) {
        console.error('Error en initApp:', error);
        // showToast('Error al cargar la aplicación.', 'error');  // Comentado temporalmente para pruebas
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

    const portadasGuardadas = JSON.parse(localStorage.getItem('portadas_libros') || '{}');
    Object.keys(portadasGuardadas).forEach(id => {
        if (!catalogo.find(l => l.idRegistro === id)) {
            delete portadasGuardadas[id];
        }
    });
    localStorage.setItem('portadas_libros', JSON.stringify(portadasGuardadas));

    agregarMensaje('Libros, autores, sinopsis, resúmenes... Mi magia es poderosa, pregunta. 📖');

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (document.getElementById('searchModal').style.display === 'block') cerrarModal();
            if (document.getElementById('adminModal').style.display === 'block') cerrarModalAdmin();
            if (document.getElementById('favoritosModal').style.display === 'block') cerrarModalFavoritos();
            if (document.getElementById('valoradosModal').style.display === 'block') cerrarModalValorados();
            if (document.getElementById('accessibilityModal').style.display === 'block') cerrarModalAccesibilidad();
        }
    });

    document.getElementById('main-content').focus();
}

initApp();
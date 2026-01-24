// js/main.js
// Punto de entrada y orquestación principal de la aplicación
// Inicializa todos los módulos en orden correcto
// Define variables globales compartidas (como toastCount)

window.toastCount = 0;  // Variable global explícita para apilar toasts verticalmente

async function initApp() {
    // ────────────────────────────────────────────────────────────────
    // ELIMINAR TODO EL CACHE AL ENTRAR → fuerza carga fresca cada vez
    localStorage.removeItem('catalogo');
    localStorage.removeItem('catalogoVersion');
    localStorage.removeItem('catalogoTimestamp');
    localStorage.removeItem('portadas_libros');

    // Limpiar también todas las claves de recomendados (por si acaso)
    Object.keys(localStorage).forEach(key => {
        if (key.startsWith('recomendados_')) {
            localStorage.removeItem(key);
        }
    });

    console.log('Cache eliminado al entrar → carga fresca forzada desde XML y GitHub.');
    // ────────────────────────────────────────────────────────────────

    const MIN_SPLASH_DURATION = 2000;
    const startTime = Date.now();

    loadTheme();
    loadDaltonismMode();
    loadSizeCSS();

    try {
        await cargarCatalogo(CONFIG.RETRY_MAX);
        await cargarPortadasDesdeGitHub();

        renderRecomendados();
        precargarPortadasClave();
        actualizarContador();
        setInterval(actualizarContador, 1000);

        // Programar actualización a medianoche (para el día siguiente)
        const ahora = new Date();
        const manana = new Date(ahora);
        manana.setDate(manana.getDate() + 1);
        manana.setHours(0, 0, 0, 0);
        const tiempoHastaMedianoche = manana - ahora;

        setTimeout(async () => {
            // En medianoche también fuerza fresco (borra cache antes)
            localStorage.removeItem('catalogo');
            localStorage.removeItem('catalogoVersion');
            localStorage.removeItem('catalogoTimestamp');
            localStorage.removeItem('portadas_libros');
            Object.keys(localStorage).forEach(key => {
                if (key.startsWith('recomendados_')) {
                    localStorage.removeItem(key);
                }
            });

            await cargarCatalogo(CONFIG.RETRY_MAX);
            await cargarPortadasDesdeGitHub();
            renderRecomendados();
            showToast('¡Nuevos libros destacados de hoy!', 'success');
        }, tiempoHastaMedianoche);
    } catch (error) {
        console.error('Error en initApp:', error);
        // showToast('Error al cargar la aplicación.', 'error');  // Comentado para pruebas
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

    // Gestión de sesión admin
    const isAdminLogged = localStorage.getItem('adminLogged') === 'true';
    const loginTime = localStorage.getItem('adminLoginTime');
    const LOGIN_DURATION = 24 * 60 * 60 * 1000; // 24 horas
    if (isAdminLogged && loginTime && (Date.now() - parseInt(loginTime) < LOGIN_DURATION)) {
        document.querySelector('.logout-btn').style.display = 'inline-block';
    } else {
        localStorage.removeItem('adminLogged');
        localStorage.removeItem('adminLoginTime');
        localStorage.removeItem('githubToken');
    }

    // Limpieza final de portadas guardadas que ya no existen en catálogo
    const portadasGuardadas = JSON.parse(localStorage.getItem('portadas_libros') || '{}');
    Object.keys(portadasGuardadas).forEach(id => {
        if (!catalogo.find(l => l.idRegistro === id)) {
            delete portadasGuardadas[id];
        }
    });
    localStorage.setItem('portadas_libros', JSON.stringify(portadasGuardadas));

    agregarMensaje('Libros, autores, sinopsis, resúmenes... Mi magia es poderosa, pregunta. 📖');

    // Cerrar modales con ESC
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
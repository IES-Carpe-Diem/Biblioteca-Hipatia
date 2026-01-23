import { CONFIG } from './config.js';
import { showToast } from './utils.js';

async function getUserIP() {
    try {
        const res = await fetch('https://api.ipify.org?format=json', {
            mode: 'cors',
            cache: 'no-cache'
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        return data.ip || 'unknown';
    } catch (err) {
        console.warn('getUserIP falló:', err);
        return 'anon_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    }
}

async function getVotosDiarios(ip) {
    const url = `${CONFIG.WEB_APP_URL}?action=getDailyVotes&ip=${ip}`;
    try {
        const res = await fetch(url);
        const data = await res.json();
        return data.count || 0;
    } catch (err) {
        console.error('Error contando votos diarios:', err);
        return 0;
    }
}

async function eliminarVoto(idLibro, ip) {
    const url = `${CONFIG.WEB_APP_URL}?action=deleteCalificacion&id=${idLibro}&ip=${ip}`;
    try {
        const res = await fetch(url, { method: 'GET' });
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        const text = await res.text();
        if (text.trim().startsWith('<')) throw new Error('El servidor devolvió HTML en lugar de JSON.');
        let data;
        try { data = JSON.parse(text); } catch (e) { throw new Error(`Respuesta no es JSON: ${text.substring(0, 100)}`); }
        if (data.error) {
            showToast(data.error.includes('Acción no válida') ? 'Error de servidor: Redeploya el Web App.' : data.error, 'warning');
            return false;
        }
        if (data.success) {
            showToast('Voto eliminado correctamente.', 'success');
            return true;
        }
        showToast('Respuesta inesperada del servidor.', 'warning');
        return false;
    } catch (err) {
        console.error('Error en eliminarVoto():', err);
        showToast(`Error al eliminar: ${err.message}`, 'error');
        return false;
    }
}

export async function cargarCalificacion(idLibro, promedioId = `promedio-${idLibro}`) {
    const url = `${CONFIG.WEB_APP_URL}?action=getCalificacion&id=${idLibro}`;
    try {
        const res = await fetch(url);
        const data = await res.json();
        const span = document.getElementById(promedioId);
        if (span) {
            span.textContent = data.numVotos > 0
                ? `${data.promedio.toFixed(1)} ★ (${data.numVotos} voto${data.numVotos > 1 ? 's' : ''})`
                : 'Sin votos';
        }
        return data;
    } catch (err) {
        console.error('Error cargando calificación:', err);
    }
}

async function calificarLibro(idLibro, estrellas, titulo, ip) {
    const votosHoy = await getVotosDiarios(ip);
    const LIMITE_DIARIO = 10;
    if (votosHoy >= LIMITE_DIARIO) {
        showToast(`Límite diario alcanzado (${LIMITE_DIARIO} votos). Intenta mañana.`, 'warning');
        return false;
    }
    const url = `${CONFIG.WEB_APP_URL}?action=setCalificacion&id=${idLibro}&estrellas=${estrellas}&titulo=${encodeURIComponent(titulo)}&ip=${ip}`;
    try {
        const res = await fetch(url, { method: 'GET' });
        const data = await res.json();
        if (data.error) {
            showToast(data.error, 'warning');
            return false;
        }
        showToast(`¡Gracias! Voto de ${estrellas}★ guardado. (${votosHoy + 1}/${LIMITE_DIARIO} hoy)`, 'success');
        return true;
    } catch (err) {
        console.error('Error votando:', err);
        showToast('Error al votar. Intenta más tarde.', 'error');
        return false;
    }
}

function showFireworks(container, fullscreen = false) {
    const fireworks = document.createElement('div');
    fireworks.className = `fireworks ${fullscreen ? 'fullscreen' : ''}`;
    fireworks.setAttribute('aria-hidden', 'true');
    if (!fullscreen) {
        container.parentElement.appendChild(fireworks);
    } else {
        document.body.appendChild(fireworks);
    }
    for (let i = 0; i < 30; i++) {
        const particle = document.createElement('div');
        particle.className = 'firework-particle';
        particle.style.left = '50%';
        particle.style.top = '50%';
        particle.style.setProperty('--dx', (Math.random() - 0.5) * (fullscreen ? 400 : 100) + 'px');
        particle.style.setProperty('--dy', (Math.random() - 0.5) * (fullscreen ? 400 : 100) + 'px');
        fireworks.appendChild(particle);
    }
    setTimeout(() => fireworks.remove(), 1200);
}

function showExplosion(container) {
    container.classList.add('explosion');
    container.querySelectorAll('.estrella').forEach((estrella, i) => {
        setTimeout(() => estrella.classList.add('pendiente-eliminar'), i * 50);
    });
    setTimeout(() => {
        container.classList.remove('explosion');
        container.querySelectorAll('.estrella').forEach(s => s.classList.remove('pendiente-eliminar'));
    }, 600);
}

export function initEstrellas() {
    document.querySelectorAll('.estrellas').forEach(container => {
        const idLibro = container.dataset.id;
        const titulo = decodeURIComponent(container.dataset.titulo);
        const estrellas = container.querySelectorAll('.estrella');
        const promedioId = container.closest('#valoradosContent')
            ? `promedio-valorados-${idLibro}`
            : `promedio-${idLibro}`;
        cargarCalificacion(idLibro, promedioId);
        const key = `voto_${idLibro}_local`;
        let seleccionado = parseInt(localStorage.getItem(key)) || -1;
        let modoEliminar = false;
        if (seleccionado > 0) {
            estrellas.forEach((s, i) => {
                if (i < seleccionado) s.classList.add('seleccionada');
            });
        }
        container.addEventListener('mousemove', (e) => {
            if (!e.target.classList.contains('estrella')) return;
            const val = parseInt(e.target.dataset.value);
            estrellas.forEach((s, i) => {
                s.classList.toggle('hover', i < val);
            });
        });
        container.addEventListener('mouseleave', () => {
            estrellas.forEach(s => s.classList.remove('hover'));
        });
        container.addEventListener('click', async (e) => {
            if (!e.target.classList.contains('estrella')) return;
            const val = parseInt(e.target.dataset.value);
            const ip = await getUserIP();
            if (seleccionado > 0 && modoEliminar) {
                const success = await eliminarVoto(idLibro, ip);
                if (success) {
                    localStorage.removeItem(key);
                    seleccionado = -1;
                    modoEliminar = false;
                    estrellas.forEach(s => {
                        s.classList.remove('seleccionada', 'pendiente-eliminar');
                    });
                    container.setAttribute('aria-valuenow', 0);
                    container.setAttribute('aria-label', `Calificación actual: 0 de 5 estrellas para ${titulo}`);
                    cargarCalificacion(idLibro, promedioId);
                    showExplosion(container);
                } else {
                    modoEliminar = false;
                    estrellas.forEach((s, i) => {
                        s.classList.toggle('pendiente-eliminar', i < seleccionado);
                        s.classList.toggle('seleccionada', i < seleccionado);
                    });
                    showToast('No se pudo eliminar el voto.', 'error');
                }
                return;
            }
            if (seleccionado > 0) {
                modoEliminar = true;
                estrellas.forEach((s, i) => {
                    if (i < seleccionado) {
                        s.classList.remove('seleccionada');
                        s.classList.add('pendiente-eliminar');
                    } else {
                        s.classList.remove('pendiente-eliminar');
                    }
                });
                container.setAttribute('aria-label', `Confirmar eliminación de ${seleccionado} estrellas para ${titulo}`);
                showToast('Haz clic de nuevo para confirmar eliminación', 'warning');
                return;
            }
            const votosHoy = await getVotosDiarios(ip);
            if (votosHoy >= 10) {
                showToast(`Límite diario alcanzado (10 votos). Intenta mañana.`, 'warning');
                return;
            }
            const success = await calificarLibro(idLibro, val, titulo, ip);
            if (success) {
                localStorage.setItem(key, val);
                seleccionado = val;
                modoEliminar = false;
                estrellas.forEach((s, i) => {
                    s.classList.toggle('seleccionada', i < val);
                    s.classList.remove('pendiente-eliminar');
                });
                container.setAttribute('aria-valuenow', val);
                container.setAttribute('aria-label', `Calificación actual: ${val} de 5 estrellas para ${titulo}`);
                cargarCalificacion(idLibro, promedioId);
                showFireworks(container, true);
            }
        });
    });
}
import { CONFIG } from './config.js';
import { sanitizeHTML, showToast, dividirTexto, normalizarTexto } from './utils.js';
import { abrirModal } from './search.js';  // o el nombre real que hayas exportado en search.js

let historialMensajes = [];
let cacheRespuestas = JSON.parse(localStorage.getItem('hipatia_cache') || '{}');
let respuestasPendientes = {};
let mensajeActualId = 0;
let MODELO_FUNCIONAL = localStorage.getItem('gemini_modelo_funcional') || null;

function agregarMensaje(texto, esUsuario = false, esTemporal = false, partes = null, mensajeId = null, parteActual = 1, totalPartes = 1, libroBuscado = null, mostrarReservaBtn = false, mostrarSolicitudBtn = false) {
    const chatMensajes = document.getElementById('chatMensajes');
    const mensajes = Array.from(chatMensajes.getElementsByClassName('mensaje'));
    if (mensajes.length > 50) {
        mensajes[0].remove();
    }
    const mensajeDiv = document.createElement('div');
    mensajeDiv.className = `mensaje ${esUsuario ? 'user' : 'bot'}${esTemporal ? ' temporal typing' : ''}`;
    if (esTemporal) {
        mensajeDiv.innerHTML = '<span class="typing-dots">Hipat-IA está buscando en la estantería</span>';
    } else if (!esUsuario && !esTemporal && partes) {
        mensajeDiv.innerHTML = marked.parse(sanitizeHTML(`**${partes[parteActual - 1].tipo.charAt(0).toUpperCase() + partes[parteActual - 1].tipo.slice(1)} (Parte ${parteActual}/${totalPartes})**:\n${partes[parteActual - 1].texto}`));
        if (parteActual < totalPartes) {
            const proseguirBtn = document.createElement('button');
            proseguirBtn.className = 'proseguir-btn';
            proseguirBtn.textContent = 'Proseguir respuesta';
            proseguirBtn.setAttribute('aria-label', `Mostrar la parte ${parteActual + 1} de ${totalPartes} de la respuesta`);
            proseguirBtn.onclick = () => mostrarSiguienteParte(mensajeId, parteActual + 1);
            mensajeDiv.appendChild(proseguirBtn);
        }
        if (libroBuscado) {
            const buscarBtn = document.createElement('button');
            buscarBtn.className = 'buscar-libro-btn';
            buscarBtn.textContent = 'Abrir Catálogo 🔍';
            buscarBtn.setAttribute('aria-label', `Abrir ventana de búsqueda con resultados para ${libroBuscado}`);
            buscarBtn.onclick = () => abrirModal();
            mensajeDiv.appendChild(buscarBtn);
        }
        if (mostrarReservaBtn) {
            const reservaBtn = document.createElement('button');
            reservaBtn.className = 'reserva-libro-btn';
            reservaBtn.textContent = 'Reserva de Libros 📚';
            reservaBtn.setAttribute('aria-label', `Abrir formulario de reserva de libros`);
            reservaBtn.onclick = () => openReservationForm();
            mensajeDiv.appendChild(reservaBtn);
        }
        if (mostrarSolicitudBtn) {
            const solicitudBtn = document.createElement('button');
            solicitudBtn.className = 'solicitud-libro-btn';
            solicitudBtn.textContent = 'Solicitud de Libros Nuevos 🗳️';
            solicitudBtn.setAttribute('aria-label', `Abrir formulario de solicitud de libros nuevos`);
            solicitudBtn.onclick = () => openRequestForm();
            mensajeDiv.appendChild(solicitudBtn);
        }
    } else {
        mensajeDiv.innerHTML = esUsuario ? sanitizeHTML(texto) : marked.parse(sanitizeHTML(texto));
    }
    chatMensajes.appendChild(mensajeDiv);
    chatMensajes.scrollTop = chatMensajes.scrollHeight;
    if (!esTemporal) {
        historialMensajes.push({ role: esUsuario ? 'user' : 'assistant', content: texto });
        if (historialMensajes.length > 6) {
            historialMensajes = historialMensajes.slice(-6);
        }
    }
    return mensajeDiv;
}

function mostrarSiguienteParte(mensajeId, parteActual) {
    const partes = respuestasPendientes[mensajeId];
    if (partes && parteActual <= partes.length) {
        const libroBuscado = partes[0].libroBuscado || null;
        const mostrarReservaBtn = partes[0].texto.includes('[RESERVA]');
        const mostrarSolicitudBtn = partes[0].texto.includes('[SOLICITUD]');
        agregarMensaje('', false, false, partes, mensajeId, parteActual, partes.length, libroBuscado, mostrarReservaBtn, mostrarSolicitudBtn);
    }
}

function formatearResultados(resultados, libroBuscado) {
    if (!resultados.length) {
        return {
            texto: `Quizás haya algo de "${libroBuscado}" en el catálogo. Usa el botón **Solicitud de Libros Nuevos** para proponer el libro si no lo tenemos.`,
            mostrarSolicitudBtn: true,
            libroBuscado
        };
    }
    const libro = resultados[0];
    return {
        texto: `Hay ${libro.copiasTotales || 0} ejemplares totales de "${libro.titulo}", de los cuales ${libro.copiasDisponibles || 0} están disponibles. Usa el botón **Reserva de Libros** para reservarlo. ¿Quieres abrir la ventana de búsqueda para ver más detalles?`,
        mostrarReservaBtn: true,
        libroBuscado
    };
}

function generarRecomendacion(intencion) {
    if (!window.catalogo.length) {
        return {
            texto: 'El catálogo no está disponible ahora mismo. Usa el botón **Solicitud de Libros Nuevos** para proponer un libro. ¿Otro género?',
            libroBuscado: null,
            mostrarSolicitudBtn: true
        };
    }
    let librosFiltrados = window.catalogo;
    let descripcion = '';
    if (intencion === 'recomendacion_fantasia') {
        librosFiltrados = window.catalogo.filter(libro => normalizarTexto(libro.categoria) === 'narrativa');
        descripcion = 'una emocionante obra de narrativa, ideal para amantes de la fantasía y la aventura.';
    } else if (intencion === 'recomendacion_poesia') {
        librosFiltrados = window.catalogo.filter(libro => normalizarTexto(libro.categoria) === 'poesia');
        descripcion = 'un hermoso poemario que captura emociones profundas.';
    } else if (intencion === 'recomendacion_narrativa') {
        librosFiltrados = window.catalogo.filter(libro => normalizarTexto(libro.categoria) === 'narrativa');
        descripcion = 'una novela cautivadora que te sumergirá en una gran historia.';
    } else if (intencion === 'recomendacion_teatro') {
        librosFiltrados = window.catalogo.filter(libro => normalizarTexto(libro.categoria) === 'teatro');
        descripcion = 'una obra teatral fascinante, llena de diálogos y emociones.';
    } else if (intencion === 'recomendacion_comic') {
        librosFiltrados = window.catalogo.filter(libro => normalizarTexto(libro.categoria) === 'cómic');
        descripcion = 'un cómic vibrante con historias visuales emocionantes.';
    } else if (intencion === 'recomendacion_literatura_inglesa') {
        librosFiltrados = window.catalogo.filter(libro => normalizarTexto(libro.categoria) === 'literatura inglesa');
        descripcion = 'una obra en inglés que destaca por su riqueza literaria.';
    } else if (intencion === 'recomendacion_deportes') {
        librosFiltrados = window.catalogo.filter(libro => normalizarTexto(libro.categoria) === 'deportes');
        descripcion = 'un libro apasionante sobre deportes, perfecto para entusiastas.';
    } else {
        const categorias = ['Narrativa', 'Poesía', 'Teatro', 'Literatura inglesa', 'Enciclopedias', 'Cómic', 'Deportes', 'Lecturas Graduadas'];
        const categoriaAleatoria = categorias[Math.floor(Math.random() * categorias.length)];
        librosFiltrados = window.catalogo.filter(libro => normalizarTexto(libro.categoria) === normalizarTexto(categoriaAleatoria));
        descripcion = `una obra destacada de ${categoriaAleatoria.toLowerCase()}, perfecta para explorar algo nuevo.`;
    }
    if (librosFiltrados.length === 0) {
        return {
            texto: `No encontré libros en esa categoría en el catálogo. Usa el botón **Solicitud de Libros Nuevos** para proponer uno. ¿Otro tipo de libro?`,
            libroBuscado: null,
            mostrarSolicitudBtn: true
        };
    }
    const libro = librosFiltrados[Math.floor(Math.random() * librosFiltrados.length)];
    const texto = `Te recomiendo *${libro.titulo}* de ${libro.autor} (${libro.categoria}). Es ${descripcion} Hay ${libro.copiasTotales || 0} ejemplares totales, de los cuales ${libro.copiasDisponibles || 0} están disponibles. Usa el botón **Reserva de Libros** para reservarlo. ¿Quieres abrir la ventana de búsqueda para ver más detalles?`;
    return {
        texto,
        libroBuscado: libro.titulo,
        mostrarReservaBtn: true
    };
}

function detectarIntencion(query) {
    const lowerQuery = normalizarTexto(query);
    if (lowerQuery.includes('cuantos') || lowerQuery.includes('ejemplares') || lowerQuery.includes('copias') || lowerQuery.includes('disponibles') || lowerQuery.includes('libros')) return 'ejemplares';
    if (lowerQuery.includes('sinopsis')) return 'sinopsis';
    if (lowerQuery.includes('resumen')) return 'resumen';
    if (lowerQuery.includes('reseña') || lowerQuery.includes('critica') || lowerQuery.includes('opinion')) return 'reseña';
    if (lowerQuery.includes('recomendaciones') || lowerQuery.includes('recomiendame') || lowerQuery.includes('recomiéndame') || lowerQuery.includes('sugerencias')) return 'recomendaciones';
    if (lowerQuery.includes('fantasia') || lowerQuery.includes('aventura')) return 'recomendacion_fantasia';
    if (lowerQuery.includes('poesia') || lowerQuery.includes('poema')) return 'recomendacion_poesia';
    if (lowerQuery.includes('narrativa') || lowerQuery.includes('novela')) return 'recomendacion_narrativa';
    if (lowerQuery.includes('teatro')) return 'recomendacion_teatro';
    if (lowerQuery.includes('comic') || lowerQuery.includes('cómic')) return 'recomendacion_comic';
    if (lowerQuery.includes('literatura inglesa') || lowerQuery.includes('libros en ingles') || lowerQuery.includes('libros en inglés')) return 'recomendacion_literatura_inglesa';
    if (lowerQuery.includes('deportes')) return 'recomendacion_deportes';
    if (lowerQuery.includes('reservar') || lowerQuery.includes('reserva')) return 'reservas';
    if (lowerQuery.includes('solicitar') || lowerQuery.includes('proponer') || lowerQuery.includes('nuevo libro')) return 'solicitar';
    return 'general';
}

async function probarModelo(modelo, contents) {
    try {
        const response = await fetch(`${CONFIG.BASE_URL}${modelo}:generateContent?key=${CONFIG.API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents })
        });
        if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
        const data = await response.json();
        if (data.error) throw new Error(data.error.message);
        if (data.candidates && data.candidates.length > 0) {
            const contenido = data.candidates[0].content;
            if (contenido && contenido.parts && contenido.parts.length > 0) {
                localStorage.setItem('gemini_modelo_funcional', modelo);
                MODELO_FUNCIONAL = modelo;
                return contenido.parts.map(part => part.text).join(' ');
            }
        }
        return null;
    } catch (error) {
        console.error(`Error con el modelo ${modelo}:`, error);
        return null;
    }
}

async function consultarAPI(mensaje, intencion, contexto) {
    const historialResumido = historialMensajes.length > 4 ?
        `Resumen del historial: El usuario preguntó sobre ${historialMensajes.filter(m => m.role === 'user').map(m => m.content).join(', ')}. Continúa la conversación de forma natural.\n` :
        historialMensajes.map(msg => `${msg.role === 'user' ? 'Usuario' : 'Hipat-IA'}: ${msg.content}`).join('\n');
    const systemPrompt = `Eres Hipat-IA, una bibliotecaria virtual entusiasta del IES Carpe Diem.
    Respondes en español con un tono cálido, dinámico y profesional, como una amiga conocedora de libros. Nunca repitas "Hola, soy Hipat-IA". Usa el catálogo y el historial para respuestas relevantes y naturales.
    **Contexto del catálogo**: ${contexto}
    **Historial de la conversación**: ${historialResumido}
    **Instrucciones**:
    - **Sinopsis**: Da un resumen breve de 100-200 palabras, usando el catálogo si está disponible o conocimiento general. Termina en una oración completa con punto.
    - **Resumen**: Da un resumen breve de 100-200 palabras, estructurado para ser claro y conciso, usando el catálogo si está disponible o conocimiento general. Termina en una oración completa con punto.
    - **Reseña**: Ofrece una opinión crítica de 100-200 palabras, destacando importancia y características. Termina en una oración completa con punto.
    - **General**: Responde en 100-200 palabras con información relevante, clara y completa. Termina en una oración completa con punto.
    - **Reservas**: Indica que se puede reservar un libro usando el botón **Reserva de Libros**. Incluye una señal [RESERVA] al final de la respuesta.
    - **Solicitar un libro**: Indica que se puede proponer un nuevo libro usando el botón **Solicitud de Libros Nuevos**. Incluye una señal [SOLICITUD] al final de la respuesta.
    - Usa emojis (📖, ✨) para un toque amigable.
    - Termina con una pregunta breve, como "¿Otro libro?" o "¿Más detalles?".`;
    const contents = [
        { parts: [{ text: systemPrompt }], role: 'model' },
        ...historialMensajes.map(msg => ({
            parts: [{ text: msg.content }],
            role: msg.role === 'user' ? 'user' : 'model'
        })),
        { parts: [{ text: mensaje }], role: 'user' }
    ];
    let respuesta = null;
    if (!MODELO_FUNCIONAL || MODELO_FUNCIONAL === 'null') {
        showToast('Buscando un modelo de Gemini funcional...', 'warning');
        for (const modelo of CONFIG.MODELOS_A_PROBAR) {
            respuesta = await probarModelo(modelo, contents);
            if (respuesta) {
                showToast(`¡Modelo ${modelo} funciona! Usándose de ahora en adelante.`, 'success');
                break;
            }
        }
        if (!respuesta) {
            respuesta = 'No pude conectar con la API de Gemini, inténtalo más tarde.';
        }
    } else {
        respuesta = await probarModelo(MODELO_FUNCIONAL, contents);
        if (!respuesta) {
            console.warn(`Modelo guardado ${MODELO_FUNCIONAL} falló, buscando nuevo modelo...`);
            localStorage.removeItem('gemini_modelo_funcional');
            MODELO_FUNCIONAL = null;
            return consultarAPI(mensaje, intencion, contexto);
        }
    }
    return {
        texto: respuesta,
        mostrarReservaBtn: respuesta.includes('[RESERVA]'),
        mostrarSolicitudBtn: respuesta.includes('[SOLICITUD]')
    };
}

export async function enviarMensaje() {
    if (!window.catalogo.length) {
        showToast('El catálogo aún está cargando. Intenta de nuevo en un momento.', 'warning');
        return;
    }
    const mensaje = sanitizeHTML(document.getElementById('chatInput').value.trim());
    if (!mensaje) {
        showToast('Por favor, escribe un mensaje.', 'warning');
        return;
    }
    agregarMensaje(mensaje, true);
    document.getElementById('chatInput').value = '';
    const escribiendoDiv = agregarMensaje('Hipat-IA está buscando en la estantería...', false, true);
    const intencion = detectarIntencion(mensaje);
    const cacheKey = `${intencion}_${normalizarTexto(mensaje)}`;
    const mensajeId = mensajeActualId++;
    if (intencion === 'ejemplares') {
        const libroBuscado = extraerLibroDeConsulta(mensaje);
        if (!libroBuscado) {
            escribiendoDiv.classList.remove('typing');
            setTimeout(() => escribiendoDiv.remove(), 300);
            const respuesta = 'No entendí el título del libro. ¿Puedes especificarlo, por ejemplo, "cuántos ejemplares hay de La Colmena"?';
            agregarMensaje(respuesta);
            return;
        }
        const resultados = buscarLibros(libroBuscado, true);
        escribiendoDiv.classList.remove('typing');
        setTimeout(() => escribiendoDiv.remove(), 300);
        const { texto, mostrarReservaBtn, mostrarSolicitudBtn, libroBuscado: libro } = formatearResultados(resultados, libroBuscado);
        const partes = dividirTexto(texto, 'respuesta');
        respuestasPendientes[mensajeId] = partes;
        agregarMensaje('', false, false, partes, mensajeId, 1, partes.length, libro, mostrarReservaBtn, mostrarSolicitudBtn);
        cacheRespuestas[cacheKey] = texto;
        localStorage.setItem('hipatia_cache', JSON.stringify(cacheRespuestas));
        return;
    }
    if (['recomendaciones', 'recomendacion_fantasia', 'recomendacion_poesia', 'recomendacion_narrativa', 'recomendacion_teatro', 'recomendacion_comic', 'recomendacion_literatura_inglesa', 'recomendacion_deportes'].includes(intencion)) {
        escribiendoDiv.classList.remove('typing');
        setTimeout(() => escribiendoDiv.remove(), 300);
        const { texto, libroBuscado, mostrarReservaBtn, mostrarSolicitudBtn } = generarRecomendacion(intencion);
        const partes = dividirTexto(texto, 'recomendacion');
        respuestasPendientes[mensajeId] = partes;
        agregarMensaje('', false, false, partes, mensajeId, 1, partes.length, libroBuscado, mostrarReservaBtn, mostrarSolicitudBtn);
        cacheRespuestas[cacheKey] = texto;
        localStorage.setItem('hipatia_cache', JSON.stringify(cacheRespuestas));
        return;
    }
    if (intencion === 'reservas') {
        escribiendoDiv.classList.remove('typing');
        setTimeout(() => escribiendoDiv.remove(), 300);
        const texto = `Puedes reservar un libro usando el botón **Reserva de Libros**. ¿Quieres buscar un libro específico?`;
        const partes = dividirTexto(texto, 'respuesta');
        respuestasPendientes[mensajeId] = partes;
        agregarMensaje('', false, false, partes, mensajeId, 1, partes.length, null, true, false);
        cacheRespuestas[cacheKey] = texto;
        localStorage.setItem('hipatia_cache', JSON.stringify(cacheRespuestas));
        return;
    }
    if (intencion === 'solicitar') {
        escribiendoDiv.classList.remove('typing');
        setTimeout(() => escribiendoDiv.remove(), 300);
        const texto = `Puedes proponer un libro nuevo usando el botón **Solicitud de Libros Nuevos**. ¿Qué libro te gustaría sugerir?`;
        const partes = dividirTexto(texto, 'respuesta');
        respuestasPendientes[mensajeId] = partes;
        agregarMensaje('', false, false, partes, mensajeId, 1, partes.length, null, false, true);
        cacheRespuestas[cacheKey] = texto;
        localStorage.setItem('hipatia_cache', JSON.stringify(cacheRespuestas));
        return;
    }
    if (cacheRespuestas[cacheKey]) {
        escribiendoDiv.classList.remove('typing');
        setTimeout(() => escribiendoDiv.remove(), 300);
        const partes = dividirTexto(cacheRespuestas[cacheKey], intencion);
        respuestasPendientes[mensajeId] = partes;
        agregarMensaje('', false, false, partes, mensajeId, 1, partes.length, null, cacheRespuestas[cacheKey].includes('[RESERVA]'), cacheRespuestas[cacheKey].includes('[SOLICITUD]'));
        return;
    }
    const resultadosCatalogo = buscarLibros(mensaje);
    let contexto = '';
    if (resultadosCatalogo.length > 0) {
        contexto = `Resultados del catálogo de la Biblioteca Hipatia:\n${resultadosCatalogo.map((libro, index) => `
            - **Título**: ${libro.titulo}
            **Autor**: ${libro.autor}
            **Categoría**: ${libro.categoria}
            **Tejuelo**: ${libro.signatura}
            **Ejemplares totales**: ${libro.copiasTotales}
            **Disponibles**: ${libro.copiasDisponibles}
        `).join('\n')}\n\n`;
    } else if (!window.catalogo.length) {
        contexto = 'El catálogo no está disponible, pero puedo ofrecer sinopsis o recomendaciones generales. Usa el botón **Solicitud de Libros Nuevos** para proponer un libro.\n\n';
    }
    const { texto, mostrarReservaBtn, mostrarSolicitudBtn } = await consultarAPI(mensaje, intencion, contexto);
    escribiendoDiv.classList.remove('typing');
    setTimeout(() => escribiendoDiv.remove(), 300);
    const partes = dividirTexto(texto, intencion);
    respuestasPendientes[mensajeId] = partes;
    agregarMensaje('', false, false, partes, mensajeId, 1, partes.length, null, mostrarReservaBtn, mostrarSolicitudBtn);
    cacheRespuestas[cacheKey] = texto;
    localStorage.setItem('hipatia_cache', JSON.stringify(cacheRespuestas));
}

export async function generarSinopsis(titulo, autor, idRegistro) {
    const cacheKey = `sinopsis_${normalizarTexto(titulo)}_${normalizarTexto(autor)}`;
    if (cacheRespuestas[cacheKey]) {
        return { texto: cacheRespuestas[cacheKey], mostrarReservaBtn: false, mostrarSolicitudBtn: false };
    }
    const systemPrompt = `Eres Hipat-IA, una bibliotecaria virtual del IES Carpe Diem.
    Proporciona una sinopsis breve (100-200 palabras) del libro "${titulo}" de ${autor}.
    Si no conoces el libro, genera una sinopsis creativa basada en el título y el contexto general.
    Termina con una oración completa con punto. Usa un tono cálido y atractivo, con emojis.`;
    const contents = [
        { parts: [{ text: systemPrompt }], role: 'model' },
        { parts: [{ text: `Dame la sinopsis de "${titulo}" de ${autor}.` }], role: 'user' }
    ];
    let respuesta = null;
    if (!MODELO_FUNCIONAL || MODELO_FUNCIONAL === 'null') {
        showToast('Buscando un modelo de Gemini funcional...', 'warning');
        for (const modelo of CONFIG.MODELOS_A_PROBAR) {
            respuesta = await probarModelo(modelo, contents);
            if (respuesta) {
                showToast(`¡Modelo ${modelo} funciona! Usándose de ahora en adelante.`, 'success');
                break;
            }
        }
        if (!respuesta) {
            respuesta = 'No pude conectar con la API de Gemini, inténtalo más tarde.';
        }
    } else {
        respuesta = await probarModelo(MODELO_FUNCIONAL, contents);
        if (!respuesta) {
            console.warn(`Modelo guardado ${MODELO_FUNCIONAL} falló, buscando nuevo modelo...`);
            localStorage.removeItem('gemini_modelo_funcional');
            MODELO_FUNCIONAL = null;
            return generarSinopsis(titulo, autor, idRegistro);
        }
    }
    cacheRespuestas[cacheKey] = respuesta;
    localStorage.setItem('hipatia_cache', JSON.stringify(cacheRespuestas));
    return { texto: respuesta, mostrarReservaBtn: false, mostrarSolicitudBtn: false };
}

export async function mostrarSinopsis(idRegistro, titulo, autor) {
    const sinopsisDiv = document.getElementById(`sinopsis-${idRegistro}`);
    sinopsisDiv.innerHTML = '<p style="font-style: italic; color: var(--text-secondary);">Generando sinopsis...</p>';
    sinopsisDiv.style.display = 'block';
    const { texto } = await generarSinopsis(titulo, autor, idRegistro);
    const mensajeId = mensajeActualId++;
    const partes = dividirTexto(texto, 'sinopsis');
    respuestasPendientes[mensajeId] = partes;
    sinopsisDiv.innerHTML = marked.parse(sanitizeHTML(`**Sinopsis (Parte 1/${partes.length})**:\n${partes[0].texto}`));
    if (partes.length > 1) {
        const proseguirBtn = document.createElement('button');
        proseguirBtn.className = 'proseguir-btn';
        proseguirBtn.textContent = 'Proseguir sinopsis';
        proseguirBtn.onclick = () => mostrarSiguienteParteSinopsis(idRegistro, mensajeId, 2, partes);
        sinopsisDiv.appendChild(proseguirBtn);
    }
}

function mostrarSiguienteParteSinopsis(idRegistro, mensajeId, parteActual, partes) {
    const sinopsisDiv = document.getElementById(`sinopsis-${idRegistro}`);
    if (parteActual <= partes.length) {
        sinopsisDiv.innerHTML = marked.parse(sanitizeHTML(`**Sinopsis (Parte ${parteActual}/${partes.length})**:\n${partes[parteActual - 1].texto}`));
        if (parteActual < partes.length) {
            const proseguirBtn = document.createElement('button');
            proseguirBtn.className = 'proseguir-btn';
            proseguirBtn.textContent = 'Proseguir sinopsis';
            proseguirBtn.onclick = () => mostrarSiguienteParteSinopsis(idRegistro, mensajeId, parteActual + 1, partes);
            sinopsisDiv.appendChild(proseguirBtn);
        }
    }
}

function extraerLibroDeConsulta(query) {
    const lowerQuery = normalizarTexto(query);
    const match = lowerQuery.match(/(?:de|sobre)\s+(.+)$/i);
    if (match && match[1]) {
        return match[1].trim();
    }
    return lowerQuery.replace(/(cuantos|ejemplares|copias|disponibles|libros)/gi, '').trim();
}
// js/chat.js - Versión COMPLETA y mejorada (enero 2026)
// Todas las mejoras solicitadas integradas:
// - DOMPurify para seguridad estricta (obligatorio cargar la librería)
// - Fallback offline con ~24 libros muy prestados en institutos españoles
// - Botón "Nueva conversación" + función reiniciarConversacion
// - División de texto respetando oraciones (más natural)
// - Limpieza automática del caché
// - Prompt más flexible y natural
// - Indicador de escritura amigable
// - Llamada centralizada a Gemini con mejor fallback
// - Todo el código original preservado y mejorado

// Dependencias externas OBLIGATORIAS (añadir en HTML antes de este script):
// <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
// <script src="https://cdnjs.cloudflare.com/ajax/libs/dompurify/3.1.6/purify.min.js"></script>

let respuestasPendientes = {};
let mensajeActualId = 0;
let historialMensajes = [];
let cacheRespuestas = JSON.parse(localStorage.getItem('hipatia_cache')) || {};
let MODELO_FUNCIONAL = localStorage.getItem('gemini_modelo_funcional') || null;

// Fallback offline - libros más prestados/leídos en institutos españoles 2024-2026
const FALLBACK_SINOPSIS = {
    "el quijote": "Don Quijote de la Mancha, de Miguel de Cervantes, narra las aventuras de un hidalgo que enloquece por los libros de caballerías y se convierte en caballero andante junto a Sancho Panza. Una obra maestra sobre ilusión, realidad y amistad. 📖✨",
    "cien años de soledad": "Gabriel García Márquez cuenta la historia de la familia Buendía en Macondo a lo largo de siete generaciones, llena de realismo mágico, amor, soledad y ciclos repetidos. 🌿🌀 Clásico imprescindible.",
    "invisible": "Eloy Moreno escribe sobre un niño que se siente invisible en su entorno, sufriendo bullying y aislamiento. Una historia emotiva y necesaria sobre empatía y acoso escolar. ❤️",
    "mentira": "Care Santos presenta una trama de suspense juvenil donde los secretos y las mentiras de un grupo de amigos salen a la luz. Adictiva y con giros constantes. 🔥",
    "una corte de rosas y espinas": "Sarah J. Maas inicia una saga de fantasía romántica con Feyre, una cazadora que termina en un mundo de hadas. Muy popular entre adolescentes por su romance y acción. 🌹",
    "twisted love": "Ana Huang escribe un romance enemies-to-lovers intenso y adictivo. Ideal para quienes buscan lecturas con tensión emocional y química. 💥",
    "anhelo": "Tracy Wolff presenta un instituto lleno de vampiros, brujos y dragones. Grace llega y descubre secretos peligrosos. Saga Crave, muy leída en 2024-2025. 🧛‍♀️",
    "naruto": "Masashi Kishimoto cuenta la historia de Naruto Uzumaki, un ninja que sueña con ser Hokage mientras lleva dentro al zorro de nueve colas. Manga más prestado en muchas bibliotecas. 🍥",
    "my hero academia": "Kohei Horikoshi sigue a Izuku Midoriya en un mundo donde casi todos tienen superpoderes. Acción, amistad y superación personal. 💪",
    "one piece": "Eiichiro Oda narra las aventuras de Monkey D. Luffy y su tripulación pirata en busca del tesoro One Piece. El manga más longevo y prestado. 🏴‍☠️",
    "spy x family": "Spy familiar con comedia, acción y ternura. Twilight, Anya y Yor forman una familia falsa con misiones secretas. Muy querido. 🕵️‍♂️",
    "el niño con el pijama de rayas": "John Boyne cuenta una historia trágica e inocente desde la mirada de un niño durante el Holocausto. Lectura obligatoria en muchos institutos. 😢",
    "la casa de bernarda alba": "Federico García Lorca muestra la represión en una casa dominada por Bernarda y sus hijas. Drama intenso sobre libertad y deseo. 🎭",
    "romeo y julieta": "William Shakespeare. Amor trágico entre dos jóvenes de familias enfrentadas. Clásico eterno en lecturas escolares. 💔",
    "el perfume": "Patrick Süskind. Historia oscura de un asesino obsesionado con crear el perfume perfecto. Lectura frecuente en bachillerato. 🖤",
    "rebelion en la granja": "George Orwell. Fábula sobre poder y corrupción usando animales en una granja. Muy usada en clases de ética y literatura. 🐷",
    "1984": "George Orwell. Distopía sobre vigilancia totalitaria y pérdida de libertad. Clásico moderno en institutos. 👁️",
    "habitos atomicos": "James Clear. Libro de no ficción sobre cómo crear buenos hábitos y eliminar los malos. Muy prestado en sección de autoayuda juvenil. ⚡",
    "el problema de los tres cuerpos": "Liu Cixin. Ciencia ficción dura con contacto extraterrestre y física avanzada. Creció mucho tras la serie de Netflix. 🌌",
    "dune": "Frank Herbert. Épica de ciencia ficción sobre política, ecología y profecías en el planeta desierto. Renovado por las películas. 🪐",
    "el principito": "Antoine de Saint-Exupéry. Cuento filosófico sobre un niño que viaja por planetas y aprende sobre la vida, el amor y la amistad. Lectura universal. 🌟",
    "cronica de una muerte anunciada": "Gabriel García Márquez. Relato periodístico-novelado sobre un asesinato anunciado que nadie impide. Muy usado en literatura hispanoamericana. ⚖️",
    "como agua para chocolate": "Laura Esquivel. Historia de amor y cocina mágica en el México revolucionario. Realismo mágico y recetas intercaladas. 🍲❤️",
    "el perfume historia de un asesino": "Patrick Süskind. Novela oscura sobre un asesino obsesionado con olores. Muy leída en bachillerato. 🖤"
};

// ─── Utilidades ─────────────────────────────────────────────────
function normalizarTexto(str) {
    return (str || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function limpiarCacheSiEsNecesario(maxEntradas = 400) {
    if (Object.keys(cacheRespuestas).length <= maxEntradas) return;
    const claves = Object.keys(cacheRespuestas).sort().reverse().slice(0, 200);
    const nuevoCache = {};
    claves.forEach(k => nuevoCache[k] = cacheRespuestas[k]);
    cacheRespuestas = nuevoCache;
    localStorage.setItem('hipatia_cache', JSON.stringify(cacheRespuestas));
    console.info("[Hipat-IA] Caché limpiado → ~200 entradas");
}

limpiarCacheSiEsNecesario();

// ─── División inteligente de texto (respeta oraciones) ──────────
function dividirTexto(texto, tipo = 'respuesta', maxLongitud = 480) {
    if (!texto || texto.length <= maxLongitud) {
        return [{ tipo, texto: texto?.trim() || '' }];
    }

    const partes = [];
    const oraciones = texto.match(/[^.!?…]+[.!?…]+(?:\s+|$)/gs) || [texto];
    let bloque = '';

    for (const oracion of oraciones) {
        if ((bloque + oracion).length > maxLongitud && bloque.trim()) {
            partes.push({ tipo, texto: bloque.trim() });
            bloque = oracion;
        } else {
            bloque += oracion;
        }
    }
    if (bloque.trim()) partes.push({ tipo, texto: bloque.trim() });

    return partes;
}

// ─── Llamada centralizada a Gemini ──────────────────────────────
async function llamarGemini(contents) {
    const modelos = MODELO_FUNCIONAL ? [MODELO_FUNCIONAL, ...CONFIG.MODELOS_A_PROBAR.filter(m => m !== MODELO_FUNCIONAL)] : CONFIG.MODELOS_A_PROBAR;

    for (const modelo of modelos) {
        try {
            const res = await fetch(`${CONFIG.BASE_URL}${modelo}:generateContent?key=${CONFIG.API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents })
            });
            if (!res.ok) continue;

            const data = await res.json();
            if (data.error || !data?.candidates?.[0]?.content?.parts?.[0]?.text) continue;

            const texto = data.candidates[0].content.parts.map(p => p.text).join('').trim();
            localStorage.setItem('gemini_modelo_funcional', modelo);
            MODELO_FUNCIONAL = modelo;
            return texto;
        } catch (err) {
            console.warn(`[Gemini] Modelo ${modelo} falló:`, err);
        }
    }
    return null;
}

// ─── Generar sinopsis ───────────────────────────────────────────
async function generarSinopsis(titulo, autor, idRegistro) {
    const cacheKey = `sinopsis_${normalizarTexto(titulo)}_${normalizarTexto(autor)}`;
    if (cacheRespuestas[cacheKey]) {
        return { texto: cacheRespuestas[cacheKey], mostrarReservaBtn: false, mostrarSolicitudBtn: false };
    }

    const clave = normalizarTexto(titulo);
    if (FALLBACK_SINOPSIS[clave]) {
        const texto = FALLBACK_SINOPSIS[clave];
        cacheRespuestas[cacheKey] = texto;
        localStorage.setItem('hipatia_cache', JSON.stringify(cacheRespuestas));
        limpiarCacheSiEsNecesario();
        return { texto, mostrarReservaBtn: false, mostrarSolicitudBtn: false };
    }

    const systemPrompt = `Eres Hipat-IA, bibliotecaria virtual del IES Carpe Diem.
Tono cálido, cercano y juvenil. Usa emojis con moderación 📚✨
Proporciona una sinopsis natural de "${titulo}" de ${autor} (80–180 palabras aprox.).
Si no lo conoces, crea una creativa pero verosímil. Termina con punto.`;

    const contents = [
        { parts: [{ text: systemPrompt }], role: 'model' },
        { parts: [{ text: `Sinopsis de "${titulo}" de ${autor}` }], role: 'user' }
    ];

    let texto = await llamarGemini(contents);
    if (!texto) {
        texto = `Lo siento, no puedo conectar con la API ahora 😔. ¿Quieres buscar otro libro en el catálogo?`;
    }

    cacheRespuestas[cacheKey] = texto;
    localStorage.setItem('hipatia_cache', JSON.stringify(cacheRespuestas));
    limpiarCacheSiEsNecesario();

    return { texto, mostrarReservaBtn: false, mostrarSolicitudBtn: false };
}

// ─── Mostrar sinopsis en catálogo ───────────────────────────────
async function mostrarSinopsis(idRegistro, titulo, autor) {
    const sinopsisDiv = document.getElementById(`sinopsis-${idRegistro}`);
    sinopsisDiv.innerHTML = '<p style="font-style: italic; color: var(--text-secondary);">Generando sinopsis...</p>';
    sinopsisDiv.style.display = 'block';

    const { texto } = await generarSinopsis(titulo, autor, idRegistro);
    const mensajeId = mensajeActualId++;
    const partes = dividirTexto(texto, 'sinopsis');
    respuestasPendientes[mensajeId] = partes;

    sinopsisDiv.innerHTML = DOMPurify.sanitize(marked.parse(`**Sinopsis (Parte 1/${partes.length})**:\n${partes[0].texto}`));

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
    if (parteActual > partes.length) return;

    sinopsisDiv.innerHTML = DOMPurify.sanitize(marked.parse(`**Sinopsis (Parte ${parteActual}/${partes.length})**:\n${partes[parteActual - 1].texto}`));

    if (parteActual < partes.length) {
        const proseguirBtn = document.createElement('button');
        proseguirBtn.className = 'proseguir-btn';
        proseguirBtn.textContent = 'Proseguir sinopsis';
        proseguirBtn.onclick = () => mostrarSiguienteParteSinopsis(idRegistro, mensajeId, parteActual + 1, partes);
        sinopsisDiv.appendChild(proseguirBtn);
    }
}

// ─── Agregar mensaje al chat ────────────────────────────────────
function agregarMensaje(texto, esUsuario = false, esTemporal = false, partes = null, mensajeId = null, parteActual = 1, totalPartes = 1, libroBuscado = null, mostrarReservaBtn = false, mostrarSolicitudBtn = false) {
    const chatMensajes = document.getElementById('chatMensajes');
    const mensajes = Array.from(chatMensajes.getElementsByClassName('mensaje'));
    if (mensajes.length > 60) mensajes[0].remove();

    const mensajeDiv = document.createElement('div');
    mensajeDiv.className = `mensaje ${esUsuario ? 'user' : 'bot'}${esTemporal ? ' temporal typing' : ''}`;

    let contenido = '';
    if (esTemporal) {
        contenido = '<span class="typing-dots">Hipat-IA está buscando en las estanterías 📚…</span>';
    } else if (partes) {
        const parte = partes[parteActual - 1];
        contenido = `**${parte.tipo.charAt(0).toUpperCase() + parte.tipo.slice(1)} (Parte ${parteActual}/${totalPartes})**:\n${parte.texto}`;
    } else {
        contenido = texto;
    }

    if (!esTemporal) {
        let html;
        if (esUsuario) {
            html = typeof sanitizeHTML === 'function' ? sanitizeHTML(texto) : DOMPurify.sanitize(texto);
        } else {
            html = DOMPurify.sanitize(marked.parse(contenido));
        }
        mensajeDiv.innerHTML = html;
    } else {
        mensajeDiv.innerHTML = contenido;
    }

    if (!esUsuario && !esTemporal) {
        if (partes && parteActual < totalPartes) {
            const proseguirBtn = document.createElement('button');
            proseguirBtn.className = 'proseguir-btn';
            proseguirBtn.textContent = 'Continuar →';
            proseguirBtn.onclick = () => mostrarSiguienteParte(mensajeId, parteActual + 1);
            mensajeDiv.appendChild(proseguirBtn);
        }

        if (libroBuscado) {
            const buscarBtn = document.createElement('button');
            buscarBtn.className = 'buscar-libro-btn';
            buscarBtn.textContent = 'Abrir Catálogo 🔍';
            buscarBtn.onclick = () => abrirBuscadorLibro(libroBuscado);
            mensajeDiv.appendChild(buscarBtn);
        }

        if (mostrarReservaBtn) {
            const reservaBtn = document.createElement('button');
            reservaBtn.className = 'reserva-libro-btn';
            reservaBtn.textContent = 'Reserva de Libros 📚';
            reservaBtn.onclick = () => openReservationForm?.();
            mensajeDiv.appendChild(reservaBtn);
        }

        if (mostrarSolicitudBtn) {
            const solicitudBtn = document.createElement('button');
            solicitudBtn.className = 'solicitud-libro-btn';
            solicitudBtn.textContent = 'Solicitud de Libros Nuevos 🗳️';
            solicitudBtn.onclick = () => openRequestForm?.();
            mensajeDiv.appendChild(solicitudBtn);
        }
    }

    chatMensajes.appendChild(mensajeDiv);
    chatMensajes.scrollTop = chatMensajes.scrollHeight;

    if (!esTemporal) {
        historialMensajes.push({ role: esUsuario ? 'user' : 'assistant', content: texto });
        if (historialMensajes.length > 10) historialMensajes = historialMensajes.slice(-10);
    }

    return mensajeDiv;
}

function mostrarSiguienteParte(mensajeId, parteActual) {
    const partes = respuestasPendientes[mensajeId];
    if (!partes || parteActual > partes.length) return;

    const libroBuscado = partes[0]?.libroBuscado || null;
    const mostrarReservaBtn = partes.some(p => p.texto.includes('[RESERVA]'));
    const mostrarSolicitudBtn = partes.some(p => p.texto.includes('[SOLICITUD]'));

    agregarMensaje('', false, false, partes, mensajeId, parteActual, partes.length, libroBuscado, mostrarReservaBtn, mostrarSolicitudBtn);
}

// ─── Formatear resultados de búsqueda de ejemplares ─────────────
function formatearResultados(resultados, libroBuscado) {
    if (!resultados.length) {
        return {
            texto: `No encontré "${libroBuscado}" en el catálogo. Usa el botón **Solicitud de Libros Nuevos** para proponerlo. ¿Otro título?`,
            mostrarSolicitudBtn: true,
            libroBuscado
        };
    }
    const libro = resultados[0];
    return {
        texto: `Hay ${libro.copiasTotales || 0} ejemplares totales de "${libro.titulo}", de los cuales ${libro.copiasDisponibles || 0} están disponibles. Usa el botón **Reserva de Libros** para reservarlo. ¿Quieres más detalles?`,
        mostrarReservaBtn: true,
        libroBuscado: libro.titulo
    };
}

// ─── Generar recomendación ──────────────────────────────────────
function generarRecomendacion(intencion) {
    if (!catalogo.length) {
        return {
            texto: 'El catálogo no está disponible ahora mismo. Usa el botón **Solicitud de Libros Nuevos** para proponer un libro. ¿Otro género?',
            libroBuscado: null,
            mostrarSolicitudBtn: true
        };
    }

    let librosFiltrados = catalogo;
    let descripcion = '';

    if (intencion === 'recomendacion_fantasia') {
        librosFiltrados = catalogo.filter(libro => normalizarTexto(libro.categoria) === 'narrativa');
        descripcion = 'una emocionante obra de narrativa, ideal para amantes de la fantasía y la aventura.';
    } else if (intencion === 'recomendacion_poesia') {
        librosFiltrados = catalogo.filter(libro => normalizarTexto(libro.categoria) === 'poesia');
        descripcion = 'un hermoso poemario que captura emociones profundas.';
    } else if (intencion === 'recomendacion_narrativa') {
        librosFiltrados = catalogo.filter(libro => normalizarTexto(libro.categoria) === 'narrativa');
        descripcion = 'una novela cautivadora que te sumergirá en una gran historia.';
    } else if (intencion === 'recomendacion_teatro') {
        librosFiltrados = catalogo.filter(libro => normalizarTexto(libro.categoria) === 'teatro');
        descripcion = 'una obra teatral fascinante, llena de diálogos y emociones.';
    } else if (intencion === 'recomendacion_comic') {
        librosFiltrados = catalogo.filter(libro => normalizarTexto(libro.categoria) === 'cómic');
        descripcion = 'un cómic vibrante con historias visuales emocionantes.';
    } else if (intencion === 'recomendacion_literatura_inglesa') {
        librosFiltrados = catalogo.filter(libro => normalizarTexto(libro.categoria) === 'literatura inglesa');
        descripcion = 'una obra en inglés que destaca por su riqueza literaria.';
    } else if (intencion === 'recomendacion_deportes') {
        librosFiltrados = catalogo.filter(libro => normalizarTexto(libro.categoria) === 'deportes');
        descripcion = 'un libro apasionante sobre deportes, perfecto para entusiastas.';
    } else {
        const categorias = ['Narrativa', 'Poesía', 'Teatro', 'Literatura inglesa', 'Enciclopedias', 'Cómic', 'Deportes', 'Lecturas Graduadas'];
        const categoriaAleatoria = categorias[Math.floor(Math.random() * categorias.length)];
        librosFiltrados = catalogo.filter(libro => normalizarTexto(libro.categoria) === normalizarTexto(categoriaAleatoria));
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

// ─── Detectar intención ─────────────────────────────────────────
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

// ─── Consultar API Gemini (prompt mejorado) ─────────────────────
async function consultarAPI(mensaje, intencion, contexto) {
    const historialResumido = historialMensajes.length > 4 ?
        `Resumen del historial: El usuario preguntó sobre ${historialMensajes.filter(m => m.role === 'user').map(m => m.content).join(', ')}. Continúa la conversación de forma natural.\n` :
        historialMensajes.map(msg => `${msg.role === 'user' ? 'Usuario' : 'Hipat-IA'}: ${msg.content}`).join('\n');

    const systemPrompt = `Eres Hipat-IA, una bibliotecaria virtual entusiasta del IES Carpe Diem.
Respondes en español con un tono cálido, dinámico y profesional, como una amiga conocedora de libros.
Usa el catálogo y el historial para respuestas relevantes y naturales.
**Contexto del catálogo**: ${contexto}
**Historial de la conversación**: ${historialResumido}
**Instrucciones**:
- Responde de forma natural: corta y directa cuando la pregunta es sencilla, más elaborada (80–180 palabras) solo en sinopsis, reseñas y recomendaciones profundas.
- Usa emojis con moderación (📖, ✨).
- Incluye [RESERVA] o [SOLICITUD] solo cuando sea muy relevante para activar botones.
- Termina casi siempre con una pregunta breve para continuar la charla.`;

    const contents = [
        { parts: [{ text: systemPrompt }], role: 'model' },
        ...historialMensajes.map(msg => ({
            parts: [{ text: msg.content }],
            role: msg.role === 'user' ? 'user' : 'model'
        })),
        { parts: [{ text: mensaje }], role: 'user' }
    ];

    let respuesta = await llamarGemini(contents);

    if (!respuesta) {
        respuesta = 'Lo siento, no puedo conectar con la API ahora mismo 😔. ¿Intentamos otra cosa o buscas en el catálogo?';
    }

    return {
        texto: respuesta,
        mostrarReservaBtn: respuesta.includes('[RESERVA]'),
        mostrarSolicitudBtn: respuesta.includes('[SOLICITUD]')
    };
}

// ─── Extraer libro de consulta ──────────────────────────────────
function extraerLibroDeConsulta(query) {
    const lowerQuery = normalizarTexto(query);
    const match = lowerQuery.match(/(?:de|sobre)\s+(.+)$/i);
    if (match && match[1]) return match[1].trim();
    return lowerQuery.replace(/(cuantos|ejemplares|copias|disponibles|libros)/gi, '').trim();
}

// ─── Enviar mensaje (lógica completa) ───────────────────────────
async function enviarMensaje() {
    if (!catalogo.length) {
        showToast('El catálogo aún está cargando. Intenta de nuevo en un momento.', 'warning');
        return;
    }

    let mensaje = document.getElementById('chatInput').value.trim();
    if (!mensaje) {
        showToast('Por favor, escribe un mensaje.', 'warning');
        return;
    }

    mensaje = typeof sanitizeHTML === 'function' ? sanitizeHTML(mensaje) : DOMPurify.sanitize(mensaje);
    agregarMensaje(mensaje, true);
    document.getElementById('chatInput').value = '';

    const escribiendoDiv = agregarMensaje('', false, true);
    const intencion = detectarIntencion(mensaje);
    const cacheKey = `${intencion}_${normalizarTexto(mensaje)}`;
    const mensajeId = mensajeActualId++;

    if (intencion === 'ejemplares') {
        const libroBuscado = extraerLibroDeConsulta(mensaje);
        if (!libroBuscado) {
            escribiendoDiv.classList.remove('typing');
            setTimeout(() => escribiendoDiv.remove(), 300);
            agregarMensaje('No entendí el título del libro. ¿Puedes especificarlo, por ejemplo, "cuántos ejemplares hay de La Colmena"?');
            return;
        }
        const resultados = buscarLibros(libroBuscado, true);
        escribiendoDiv.classList.remove('typing');
        setTimeout(() => escribiendoDiv.remove(), 300);
        const { texto, mostrarReservaBtn, mostrarSolicitudBtn, libroBuscado: libro } = formatearResultados(resultados, libroBuscado);
        const partes = dividirTexto(texto, 'respuesta');
        respuestasPendientes[mensajeId] = partes.map(p => ({ ...p, libroBuscado: libro }));
        agregarMensaje('', false, false, partes, mensajeId, 1, partes.length, libro, mostrarReservaBtn, mostrarSolicitudBtn);
        cacheRespuestas[cacheKey] = texto;
        localStorage.setItem('hipatia_cache', JSON.stringify(cacheRespuestas));
        limpiarCacheSiEsNecesario();
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
        limpiarCacheSiEsNecesario();
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
        limpiarCacheSiEsNecesario();
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
        limpiarCacheSiEsNecesario();
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
        contexto = `Resultados del catálogo de la Biblioteca Hipatia:\n${resultadosCatalogo.map(libro => `
            - **Título**: ${libro.titulo}
            **Autor**: ${libro.autor}
            **Categoría**: ${libro.categoria}
            **Tejuelo**: ${libro.signatura}
            **Ejemplares totales**: ${libro.copiasTotales}
            **Disponibles**: ${libro.copiasDisponibles}
        `).join('\n')}\n\n`;
    } else if (!catalogo.length) {
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
    limpiarCacheSiEsNecesario();
}

// ─── Nueva conversación ─────────────────────────────────────────
function reiniciarConversacion() {
    historialMensajes = [];
    respuestasPendientes = {};
    document.getElementById('chatMensajes').innerHTML = '';
    agregarMensaje("¡Hola de nuevo! 📚✨ Soy Hipat-IA, ¿en qué te puedo ayudar hoy?", false);
}

// ─── Inicialización ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    // Conectar botón de nueva conversación (añade este botón en tu HTML)
    const btnNueva = document.getElementById('nueva-conversacion');
    if (btnNueva) btnNueva.addEventListener('click', reiniciarConversacion);

    // Mensaje de bienvenida inicial
    if (!document.querySelector('#chatMensajes .mensaje')) {
        agregarMensaje("¡Hola! 📚 Soy Hipat-IA, tu bibliotecaria virtual del IES Carpe Diem. ¿Qué libro buscas hoy o en qué te ayudo?", false);
    }
});

// Manejo de Enter (tu debounce original)
const handleChatKeypress = debounce((event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        enviarMensaje();
    }
}, CONFIG.DEBOUNCE_DELAY);

// Asignar al input
document.getElementById('chatInput')?.addEventListener('keydown', handleChatKeypress);
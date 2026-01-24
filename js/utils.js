// js/utils.js
// Funciones de utilidad generales y reutilizables
// Incluye: debounce, sanitización HTML, toast notifications, focus trap para modales
// No depende de otros módulos propios (solo de DOMPurify externo)

function debounce(func, delay) {
    let timeoutId;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(null, args), delay);
    };
}

function sanitizeHTML(str) {
    return DOMPurify.sanitize(str);
}

function showToast(message, type = 'success') {
    const toastContainer = document.createElement('div');
    toastContainer.className = `toast ${type}`;
    toastContainer.style.position = 'fixed';
    toastContainer.style.bottom = `${20 + (toastCount * 60)}px`;
    toastContainer.style.right = '20px';
    toastContainer.style.padding = '15px';
    toastContainer.style.borderRadius = '4px';
    toastContainer.style.boxShadow = 'var(--shadow)';
    toastContainer.style.zIndex = 10000 + toastCount;
    toastContainer.style.minWidth = '300px';
    toastContainer.style.animation = 'slideInRight 0.3s ease-out';
    toastContainer.setAttribute('role', 'alert');
    toastContainer.setAttribute('aria-live', 'polite');
    toastContainer.textContent = message;
    document.body.appendChild(toastContainer);
    toastCount++;
    setTimeout(() => {
        toastContainer.remove();
        toastCount--;
    }, 5000);
}

function setupFocusTrap(modalId, focusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])') {
    const modal = document.getElementById(modalId);
    const modalContent = modal.querySelector('#' + modalId.replace('Modal', 'ModalContent'));
    const firstFocusable = modalContent.querySelector(focusableSelector);
    const focusableElements = modalContent.querySelectorAll(focusableSelector);
    const lastFocusable = focusableElements[focusableElements.length - 1];
    if (!firstFocusable) return;
    firstFocusable.focus();
    const handleKeydown = (e) => {
        if (e.key === 'Tab') {
            if (e.shiftKey && document.activeElement === firstFocusable) {
                e.preventDefault();
                lastFocusable.focus();
            } else if (!e.shiftKey && document.activeElement === lastFocusable) {
                e.preventDefault();
                firstFocusable.focus();
            }
        }
    };
    modal.addEventListener('keydown', handleKeydown);
    const cleanup = () => {
        modal.removeEventListener('keydown', handleKeydown);
    };
    modal._focusTrapCleanup = cleanup;
    return { firstFocusable, lastFocusable };
}

function cleanupFocusTrap(modalId) {
    const modal = document.getElementById(modalId);
    if (modal && modal._focusTrapCleanup) {
        modal._focusTrapCleanup();
        delete modal._focusTrapCleanup;
    }
}
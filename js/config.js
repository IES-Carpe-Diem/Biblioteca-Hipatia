export const CONFIG = {
    CACHE_DURATION: 24 * 60 * 60 * 1000,
    PAGE_SIZE: 5,
    RETRY_MAX: 3,
    DEBOUNCE_DELAY: 300,
    ADMIN_USER: "admin",
    ADMIN_PASS: "hipatia2025",
    API_KEY: 'AIzaSyDGka0E9qnSRjvZMG1g1O6DarLSJU4EJyE',
    BASE_URL: 'https://generativelanguage.googleapis.com/v1beta/models/',
    MODELOS_A_PROBAR: [
        'gemini-2.5-flash',
        'gemini-2.5-pro',
        'gemini-2.0-flash',
        'gemini-1.5-flash-latest',
        'gemini-1.5-pro-latest'
    ],
    GITHUB_API_URL: 'https://api.github.com/repos/IES-Carpe-Diem/Biblioteca-Hipatia/contents/portadas/',
    DEFAULT_PORTADA: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwIiBoZWlnaHQ9IjE4MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIiBzdHJva2U9IiNhYWEiIHN0cm9rZS13aWR0aD0iMiIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5Qb3J0YWRhIG5vIGRpc3BvbmlibGU8L3RleHQ+PC9zdmc+',
    WEB_APP_URL: 'https://script.google.com/macros/s/AKfycby283Cbhy1uOkPmnnmxztRCVGhqGsbqJFfqwkuawvupViPlJ-fXOQM0RbRgm7n-m0kYEg/exec',
    FORMS: {
        RESERVA: 'https://docs.google.com/forms/d/e/1FAIpQLSeTUAdMIEZz0lP2qflcZgfIP2zhsU4sYJoQZYoJcmvUZRAQnw/viewform?usp=header',
        RESEÑA: 'https://docs.google.com/forms/d/e/1FAIpQLScbwLhvODSn6s5oP_GOdVhtUtojdiDUOBe5O2pJexUW5VT-Fw/viewform?usp=header',
        SOLICITUD: 'https://docs.google.com/forms/d/e/1FAIpQLSf_VH-Wmf7SC7geWNwoLhX1aqc_xy1LQ-fp-SFYdlOYIbTE-g/viewform?usp=header',
        DONACIONES: 'https://forms.gle/GobAksYs7vpXY8HG6'
    }
};

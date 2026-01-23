import { showToast } from './utils.js';

export function toggleTheme() {
    const body = document.body;
    const isDark = body.getAttribute('data-theme') === 'dark';
    const newTheme = isDark ? 'light' : 'dark';
    body.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    const themeBtn = document.querySelector('.theme-toggle');
    themeBtn.textContent = newTheme === 'dark' ? '☀️' : '🌙';
    showToast(newTheme === 'dark' ? 'Modo oscuro activado' : 'Modo claro activado', 'success');
}

export function loadTheme() {
    const saved = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const defaultTheme = saved || (prefersDark ? 'dark' : 'light');
    document.body.setAttribute('data-theme', defaultTheme);
    const themeBtn = document.querySelector('.theme-toggle');
    themeBtn.textContent = defaultTheme === 'dark' ? '☀️' : '🌙';
}
export function initTheme() {
    const savedTheme = localStorage.getItem('app-theme') || 'auto';
    applyTheme(savedTheme);
}

export function applyTheme(theme) {
    localStorage.setItem('app-theme', theme);
    const root = document.documentElement;

    if (theme === 'auto') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        root.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    } else {
        root.setAttribute('data-theme', theme);
    }
}
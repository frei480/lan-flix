/**
 * i18n configuration for LAN-FLIX
 * Uses i18next for internationalization
 */

window.__translations = {};
window.__currentLang = 'ru';

async function initI18n() {
    const savedLang = localStorage.getItem('language');
    if (savedLang) {
        window.__currentLang = savedLang;
    } else {
        const browserLang = navigator.language || navigator.userLanguage;
        if (browserLang && browserLang.startsWith('ru')) {
            window.__currentLang = 'ru';
        } else {
            window.__currentLang = 'en';
        }
        localStorage.setItem('language', window.__currentLang);
    }
    
    await loadTranslations(window.__currentLang);
    updateAllTranslations();
    updateLanguageButtons();
}

async function loadTranslations(lng) {
    try {
        const response = await fetch(`/static/locales/${lng}.json`);
        if (!response.ok) {
            if (lng !== 'en') {
                const enResponse = await fetch('/static/locales/en.json');
                window.__translations = await enResponse.json();
            }
            return;
        }
        window.__translations = await response.json();
    } catch (e) {
        console.error('Error loading translations:', e);
        try {
            const enResponse = await fetch('/static/locales/en.json');
            window.__translations = await enResponse.json();
        } catch (e2) {
            console.error('Error loading fallback translations:', e2);
        }
    }
}

function t(key, options) {
    let value = getNestedValue(window.__translations, key);
    
    if (value === undefined) {
        return key;
    }
    
    if (typeof value === 'string' && options) {
        value = interpolate(value, options);
    }
    
    return value || key;
}

function getNestedValue(obj, path) {
    return path.split('.').reduce((acc, part) => acc && acc[part], obj);
}

function interpolate(str, options) {
    if (!str) return str;
    return str.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
        return options[varName] !== undefined ? options[varName] : match;
    });
}

async function changeLanguage(lng) {
    window.__currentLang = lng;
    localStorage.setItem('language', lng);
    
    await loadTranslations(lng);
    updateAllTranslations();
    updateLanguageButtons();
    
    document.dispatchEvent(new CustomEvent('languageChanged', { detail: { language: lng } }));
}

function updateAllTranslations() {
    const elements = document.querySelectorAll('[data-i18n]');
    elements.forEach(el => {
        const key = el.getAttribute('data-i18n');
        el.textContent = t(key);
    });
    
    const elementsWithPlaceholder = document.querySelectorAll('[data-i18n-placeholder]');
    elementsWithPlaceholder.forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        el.placeholder = t(key);
    });
    
    const elementsWithTitle = document.querySelectorAll('[data-i18n-title]');
    elementsWithTitle.forEach(el => {
        const key = el.getAttribute('data-i18n-title');
        el.title = t(key);
    });
    
    updateDynamicTranslations();
}

function updateDynamicTranslations() {
    const searchInput = document.getElementById('hero-search-input');
    if (searchInput) {
        searchInput.placeholder = t('hero.search.placeholder');
    }
    
    const searchResultsTitle = document.getElementById('search-results-title');
    if (searchResultsTitle) {
        searchResultsTitle.textContent = t('search.results');
    }
    
    const tabs = document.querySelectorAll('.category-tab');
    if (tabs[0]) tabs[0].textContent = t('tabs.allVideos');
    if (tabs[1]) tabs[1].textContent = t('tabs.myLists');
    
    const backBtn = document.getElementById('back-btn');
    if (backBtn) backBtn.innerHTML = '← ' + t('buttons.backToBrowse');
    
    const sectionHandle = document.querySelector('.content-section-handle span');
    if (sectionHandle) sectionHandle.textContent = t('section.videosPlaylists');
    
    const homeLink = document.querySelector('.home-link');
    if (homeLink) homeLink.textContent = t('nav.home');
}

function getCurrentLanguage() {
    return window.__currentLang;
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initI18n);
} else {
    initI18n();
}

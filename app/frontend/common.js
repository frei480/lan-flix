
/**
 * Базовый URL для API бэкенда.
 * @constant {string}
 */
const BACKEND_URL = '/api';

// Fallback для функции перевода, если i18n не загружен
if (typeof t === 'undefined') {
    window.t = function(key, options) {
        // Простой fallback: возвращаем ключ или подставляем значения
        if (options) {
            return key.replace(/\{(\w+)\}/g, (match, p1) => options[p1] || match);
        }
        return key;
    };
}

// Fallback для updateDynamicTranslations, если i18n не загружен
if (typeof updateDynamicTranslations === 'undefined') {
    window.updateDynamicTranslations = function() {
        // Пустая функция, ничего не делает
    };
}

function updateLanguageButtons() {
    const currentLang = localStorage.getItem('language') || 'ru';
    const buttons = document.querySelectorAll('.lang-btn');
    buttons.forEach(btn => {
        if (btn.textContent.toLowerCase() === currentLang) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

document.addEventListener('languageChanged', function(e) {
    updateDynamicTranslations();
    updateLanguageButtons();
});

/**
 * Массив всех загруженных видео.
 * @type {Array<Object>}
 */
let allVideos = [];

/**
 * Массив всех плейлистов.
 * @type {Array<Object>}
 */
let allPlaylists = [];

/**
 * Текущий воспроизводимый видео ID.
 * @type {number|null}
 */
let currentVideoId = null;

/**
 * Текущий открытый плейлист ID.
 * @type {number|null}
 */
let currentPlaylistId = null;

/**
 * Текущий вид контента: 'all', 'playlists', 'playlist_detail', 'filter'.
 * @type {string}
 */
let currentView = 'all';

/**
 * Таймер задержки для предпросмотра видео.
 * @type {number|undefined}
 */
let hoverDelay;

/**
 * Таймер для автоматического остановки предпросмотра.
 * @type {number|null}
 */
let previewTimeout = null;

/**
 * Текущий элемент видео для предпросмотра.
 * @type {HTMLVideoElement|null}
 */
let currentPreviewVideo = null;

/**
 * Количество пропущенных видео при пагинации.
 * @type {number}
 */
let skip=0;

/**
 * Лимит видео за один запрос.
 * @constant {number}
 */
const limit=20;

/**
 * Флаг загрузки видео.
 * @type {boolean}
 */
let isLoading=false;

/**
 * Флаг наличия дополнительных видео для загрузки.
 * @type {boolean}
 */
let hasMore=true;

document.addEventListener('DOMContentLoaded', function() {
    console.log('DOMContentLoaded start');
    initInfiniteScroll();
    updateLanguageButtons();
    initClipboardCopy(); // Инициализация кнопки clipboard-copy
    const params = getUrlParams();
    console.log('URL params:', params);
    const videoRow = document.getElementById('video-row');
    if (videoRow) {
        videoRow.addEventListener('wheel', (e) => {
            if (e.deltaY !== 0) {
                e.preventDefault();
                videoRow.scrollLeft += e.deltaY;
            }
        }, { passive: false });
    }

    // Если есть параметр playlist, не загружаем все видео, сразу показываем плейлист
    if (params.playlist) {
        console.log('Playlist param detected, setting currentView to playlist_detail');
        currentView = 'playlist_detail';
        // Загружаем плейлисты, затем показываем нужный
        fetchPlaylists().then(() => {
            console.log('Playlists fetched, calling showPlaylistVideos for', params.playlist);
            // Небольшая задержка для гарантии, что DOM готов
            setTimeout(() => showPlaylistVideos(params.playlist), 0);
        });
        // Параметр video обрабатываем отдельно (если есть и video, и playlist - приоритет у playlist)
        if (params.video) {
            setTimeout(() => playVideo(params.video, params.t), 1000);
        }
    } else {
        console.log('No playlist param, loading videos and playlists as usual');
        // Нет playlist, загружаем видео и плейлисты как обычно
        fetchVideos();
        fetchPlaylists();
        // Обрабатываем параметр video (если есть)
        if (params.video) {
            setTimeout(() => playVideo(params.video, params.t), 500);
        }
    }
    console.log('DOMContentLoaded end');
});

/**
 * Инициализирует бесконечную прокрутку для загрузки видео по мере скролла.
 * Использует Intersection Observer для отслеживания видимости якоря загрузки.
 */
function initInfiniteScroll() {
    const row = document.getElementById('video-row');
    const loaderAnchor = document.getElementById('row-loader');

    // Если отсутствуют необходимые элементы (например, на админской странице), выходим
    if (!row || !loaderAnchor) return;

    const options = {
        root: row,
        rootMargin: '0px 300px 0px 0px', // Начинаем загрузку за 300px до того, как якорь покажется справа
        threshold: 0.1
    };
    const observer = new IntersectionObserver((entries) => {

        if (entries[0].isIntersecting && !isLoading && hasMore && currentView=='all')  {
            fetchVideos();
        }
    }, options);
    observer.observe(loaderAnchor);
}

/**
 * Показывает модальное окно сканирования видео.
 */
function showScanModal() {
    const modal = document.getElementById('scan-modal');
    if (modal) modal.classList.add('active');
}

/**
 * Закрывает модальное окно сканирования видео.
 */
function closeScanModal() {
    const modal = document.getElementById('scan-modal');
    if (modal) modal.classList.remove('active');
}

/**
 * Сканирует и загружает видео с сервера.
 * Показывает индикатор загрузки, отправляет POST-запрос и обновляет интерфейс.
 * @async
 */
async function scanAndLoadVideos() {
    closeScanModal();
    const container = document.getElementById('video-container');
    if (container) {
        container.innerHTML = '<div class="loader"></div>';
    }
    
    try {
        const response = await fetch(`${BACKEND_URL}/videos/scan-and-load/`, { method: 'POST' });
        const data = await response.json();
        alert(t('messages.videosLoaded', { count: data.length }));
        fetchVideos();
        fetchPlaylists();
    } catch (error) {
        console.error(t('errors.scanLoad'), error);
        alert(t('errors.scanLoadDetails'));
        fetchVideos();
    }
}

/**
 * Загружает видео с сервера с пагинацией.
 * Обновляет состояние загрузки, добавляет новые видео в allVideos и отрисовывает их.
 * @async
 */
async function fetchVideos() {
    if (isLoading || !hasMore || currentView !== 'all') return;
    isLoading=true;
    
    const loader = document.getElementById('row-loader');
    if (loader) loader.classList.add('loading');
    
    try {
        const response = await fetch(`${BACKEND_URL}/videos/?skip=${skip}&limit=${limit}`);
        const newVideos = await response.json();
        
        if (newVideos.length < limit) {
            hasMore = false;
        }
        if (newVideos.length > 0) {
            renderItems(newVideos, 'video', true);
            allVideos.push(...newVideos);
            skip += newVideos.length;
        }
    } catch (error) {
        console.error(t('errors.loadVideos'), error);
        const row = document.getElementById('video-row');
        if (row && skip === 0) {
            row.innerHTML = `<p class="no-videos">${t('errors.loadVideos')}</p>`;
        }
    } finally {
        isLoading=false;
        if(loader) loader.classList.remove('loading');
    }
}

/**
 * Загружает информацию о конкретном видео по его ID.
 * @async
 * @param {number} videoId - ID видео.
 * @returns {Promise<Object|undefined>} Объект видео или undefined в случае ошибки.
 */
async function fetchVideo(videoId) {
    const container = document.getElementById('video-container');
    try {
        const response = await fetch(`${BACKEND_URL}/videos/${videoId}`);
        let video = await response.json();
        return video;   
    } catch (error) {
        console.error(t('errors.loadVideo'), error);
        container.innerHTML = `<p class="no-videos">${t('errors.loadVideo')}</p>`;
    }
}

/**
 * Загружает список плейлистов с сервера и сохраняет в allPlaylists.
 * @async
 */
async function fetchPlaylists() {
    try {
        const response = await fetch(`${BACKEND_URL}/playlists/`);
        allPlaylists = await response.json();
    } catch (error) {
        console.error('Error fetching playlists:', error);
    }
}

/**
 * Переключает вид на список плейлистов.
 * Обновляет текущий вид, активирует секцию контента и отрисовывает плейлисты.
 */
function showPlaylists() {
    currentView = 'playlists';

    const anchor = document.getElementById('scroll-anchor');
    document.querySelector('.content-section').classList.add('active');
    

    updateTabs('playlists');
    document.getElementById('back-btn').style.display = 'none';
    document.getElementById('playlist-name').innerHTML = '';

    renderItems(allPlaylists, 'playlist', false);

}

/**
 * Загружает и отображает видео конкретного плейлиста.
 * @async
 * @param {number} playlistId - ID плейлиста.
 */
async function showPlaylistVideos(playlistId) {
    try {
        const response = await fetch(`${BACKEND_URL}/playlists/${playlistId}`);
        const playlist = await response.json();
        
        currentView = 'playlist_detail';
        currentPlaylistId = playlistId; // Сохраняем ID текущего плейлиста

        toggleContentSection();
        updateTabs('playlists');
        document.getElementById('back-btn').style.display = 'flex';
        
        renderPlaylistName(playlist);
        
        // Обновляем значение clipboard-copy
        updateClipboardValue();
        
        // ВЫЗОВ: тип 'video', append = false
        renderItems(playlist.videos, 'video', false);
    } catch (error) {
        console.error('Error:', error);
    }
}

/**
 * Отрисовывает название плейлиста и кнопку копирования, используя шаблон из HTML.
 * @param {Object} playlist - Объект плейлиста с полем name.
 */
function renderPlaylistName(playlist) {
    const template = document.getElementById('playlist-name-template');
    
    const clone = template.content.cloneNode(true);
    const container = document.getElementById('playlist-name');
    container.innerHTML = '';
    container.appendChild(clone);
    
    // Заполняем данные
    const titleElement = container.querySelector('.playlist-title');
    const buttonElement = container.querySelector('.playlist-copy-button');
    if (titleElement) {
        titleElement.textContent = playlist.name;
    }
    if (buttonElement) {
        const label = t('buttons.copyPlaylistLink');
        buttonElement.setAttribute('aria-label', label);
        buttonElement.setAttribute('title', label);
    }
}

/**
 * Переключает видимость секции контента.
 */
function toggleContentSection() {
    document.querySelector('.content-section').classList.toggle('active');
}

/**
 * Возвращает к списку плейлистов из детального просмотра плейлиста.
 */
function goBack() {
    currentView = 'playlists';
    currentPlaylistId = null; // Сбрасываем ID текущего плейлиста
    document.getElementById('playlist-name').innerHTML = '';
    document.getElementById('back-btn').style.display = 'none';
    updateClipboardValue(); // Обновляем значение clipboard-copy
    showPlaylists();
}

/**
 * Создает DOM-элемент карточки видео.
 * @param {Object} item - Объект видео с полями id и title.
 * @param {number} [startTime=0] - Время начала предпросмотра в секундах.
 * @returns {HTMLDivElement} Созданный элемент карточки.
 */
function createVideoCard(item, startTime = 0) {
    const card = document.createElement('div');
    card.className = 'video-card';
    card.addEventListener('click', () => playVideo(item.id));
    card.addEventListener('mouseenter', (e) => startPreview(item.id, card, startTime || 5));
    card.addEventListener('mouseleave', () => stopPreview());
        
    card.innerHTML = `
    <div class="video-card-placeholder">
        <span style="font-size: 48px;">🎬</span>
    </div>
    <div class="video-card-overlay">
        <div class="video-card-title"></div>
    </div>
`;
    card.querySelector('.video-card-title').textContent = item.title;
    
    return card;
}

/**
 * Отрисовывает элементы (видео или плейлисты) в строке.
 * @param {Array<Object>} items - Массив элементов для отрисовки.
 * @param {string} [type='video'] - Тип элементов: 'video' или 'playlist'.
 * @param {boolean} [append=false] - Если true, элементы добавляются к существующим, иначе строка очищается.
 */
function renderItems(items, type = 'video', append = false) {
    const row = document.getElementById('video-row');
    const loaderAnchor = document.getElementById('row-loader');

    // Если row отсутствует (например, на админской странице), выходим
    if (!row) return;

    // 1. Если не режим добавления (append), очищаем всё, кроме якоря
    if (!append) {
        row.querySelectorAll('.video-card, .playlist-card, .no-videos').forEach(el => el.remove());
        row.scrollLeft = 0; // Сбрасываем скролл в начало
    }

    // 2. Если данных нет
    if (!items || items.length === 0) {
        if (!append) {
            row.insertAdjacentHTML('afterbegin', `<p class="no-videos">No ${type}s found.</p>`);
        }
        return;
    }
    const fragment = document.createDocumentFragment();
    // 3. Генерируем HTML для каждого элемента
    items.forEach(item => {
        if (type === 'video') {
            const card = createVideoCard(item);
            fragment.appendChild(card);
        } else if (type === 'playlist') {
            const card = document.createElement('div');
            card.className = 'playlist-card';
            card.addEventListener('click', () => showPlaylistVideos(item.id));
            card.innerHTML = `
                <div class="playlist-card" onclick="showPlaylistVideos(${item.id})">
                    <div class="playlist-card-icon">📁</div>
                    <div class="playlist-card-title"></div>
                    <div class="playlist-card-count"></div>
                </div>`;
            card.querySelector('.playlist-card-title').textContent = item.name;
            card.querySelector('.playlist-card-count').textContent = `${item.video_count || 0} videos`;
            fragment.appendChild(card);
        }
    });
    // Вставляем строго перед якорем, если якорь существует, иначе в конец row
    if (loaderAnchor) {
        row.insertBefore(fragment, loaderAnchor);
    } else {
        row.appendChild(fragment);
    }
}


/**
 * Воспроизводит видео в модальном окне.
 * @async
 * @param {number} videoId - ID видео.
 * @param {number} [startTime=0] - Время начала воспроизведения в секундах.
 */
async function playVideo(videoId, startTime = 0) {
    const modal = document.getElementById('video-modal');
    const player = document.getElementById('video-player');
    const title = document.getElementById('modal-title');
    const srt = document.getElementById('video-subtitles');
    if (!modal || !player) {
        console.error('Modal or player element not found');
        return;
    }
    const existingTrack = player.querySelector('track');
    if(existingTrack) existingTrack.remove();
    
    const video = await fetchVideo(videoId); //allVideos.find(v => v.id === videoId);
    if (!video) {
        console.error('Video not found or fetch failed');
        return;
    }
    const trackpath = video.filepath.replace('/app/videos', '/static/transcriptions').replace(/\.[^/.]+$/, '.vtt');
    const response = await fetch(trackpath);
    if (response.ok) {
        const track = document.createElement('track', {method: 'HEAD'});
        track.kind = 'subtitles';
        track.label = 'Русский';
        track.srclang = 'ru';
        track.src = trackpath;
        player.appendChild(track);
    } else {
        console.log('No subtitles found');
    }

    if (video) {
        title.textContent = video.title;
    }

    // Сохраняем текущий ID видео для функции поделиться
    currentVideoId = videoId;
    
    // Обновляем кнопку поделиться каждый раз когда видео загружается
    setupShareButton();
    
    // Обновляем значение clipboard-copy
    updateClipboardValue();

    const streamUrl = `${BACKEND_URL}/videos/${videoId}/stream`;
    player.src = streamUrl;

    player.addEventListener('loadedmetadata', function onLoad() {
        player.removeEventListener('loadedmetadata', onLoad);

        if (startTime && !isNaN(startTime)) {
            player.currentTime = startTime;
        }

        const playPromise = player.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {
            }).catch(error => {
                console.error('Playback failed:', error);
                // Autoplay may be blocked, try muted autoplay
                console.log('Trying muted autoplay...');
                player.muted = false;
                player.play().catch(e => console.error('Muted autoplay also failed:', e));
            });
        }
    });
    
    player.addEventListener('error', (e) => {
        console.error('Player error:', e, player.error);
    });
    
    modal.classList.add('active');
    srt.innerHTML='';
    if (video.transcription) {
        const fragments = document.createDocumentFragment();
        /* Регулярное выражение:
        // (?:^|\n)  - начало строки ИЛИ перенос строки (чтобы поймать первый таймкод или последующие)
        // (?=...)   - позитивный просмотр вперед (не потребляет символы, просто проверяет условие)
        // \d{1,2}   - 1 или 2 цифры (часы или минуты)
        // :         - двоеточие
        // \d{2}     - 2 цифры (минуты или секунды)
        // (?::\d{2})? - опциональная группа :секунды (для формата ЧЧ:ММ:СС)
        // \s+       - один или более пробелов после времени
        */
        const regex = /(?:^|\n)(?=\d{1,2}:\d{2}(?::\d{2})?\s+)/;
        video.transcription.split(regex).forEach(
            chapter => {
                const timestamp = extractTimestamp(chapter);                
                const paragraph = document.createElement('p');
                paragraph.style.whiteSpace = 'pre-line';
                paragraph.className = 'search-result-card';
                paragraph.addEventListener('click', () => player.currentTime=timestamp || 0 );                
                paragraph.innerHTML = chapter;
                fragments.appendChild(paragraph);
            }
        );
        srt.appendChild(fragments);
    }
}

/**
 * Закрывает модальное окно видео и останавливает воспроизведение.
 */
function closeModal() {
    const modal = document.getElementById('video-modal');
    const player = document.getElementById('video-player');
    player.pause();
    player.src = '';
    const track = player.querySelector('track');
    if (track) track.remove();
    modal.classList.remove('active');
}

/**
 * Форматирует время в секундах в строку формата MM:SS или H:MM:SS
 * @param {number} seconds - Время в секундах
 * @returns {string} Отформатированное время
 */
function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
        return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${minutes}:${String(secs).padStart(2, '0')}`;
}

/**
 * Генерирует ссылку для совместного использования видео с временной меткой
 * @returns {string} URL для совместного использования
 */
function generateShareLink() {
    if (!currentVideoId) return '';
    
    const player = document.getElementById('video-player');
    const currentTime = Math.floor(player.currentTime);
    
    // Получаем текущий URL без параметров
    const baseUrl = window.location.origin + window.location.pathname;
    
    // Формируем URL с параметрами
    const shareUrl = `${baseUrl}?video=${currentVideoId}&t=${currentTime}`;
    
    return shareUrl;
}

/**
 * Генерирует ссылку на текущий открытый плейлист
 * @returns {string} URL плейлиста
 */
function generatePlaylistLink() {
    if (!currentPlaylistId) return '';
    
    const baseUrl = window.location.origin + window.location.pathname;
    const playlistUrl = `${baseUrl}?playlist=${currentPlaylistId}`;
    return playlistUrl;
}

/**
 * Копирует ссылку на текущий плейлист в буфер обмена
 */
async function copyPlaylistLink() {
    const playlistUrl = generatePlaylistLink();
    
    if (!playlistUrl) {
        alert('No playlist is currently open');
        return;
    }
    
    const button = document.querySelector('.playlist-copy-button');
    await copyLink(playlistUrl, button, t('buttons.playlistLinkCopied'));
}

/**
 * Копирует текст в буфер обмена с использованием Clipboard API или fallback
 * @param {string} text - Текст для копирования
 * @returns {Promise<boolean>} Успешность копирования
 */
async function copyToClipboard(text) {
    // Функция для копирования через современный Clipboard API
    async function copyWithClipboardAPI(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
            return true;
        }
        return false;
    }
    
    // Функция для копирования через устаревший document.execCommand
    function copyWithExecCommand(text) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
            const successful = document.execCommand('copy');
            document.body.removeChild(textArea);
            return successful;
        } catch (err) {
            document.body.removeChild(textArea);
            return false;
        }
    }
    
    try {
        if (navigator.clipboard) {
            try {
                await navigator.clipboard.writeText(text);
                return true;
            } catch (e) {
                console.warn('Clipboard API error, falling back to execCommand:', e);
                return copyWithExecCommand(text);
            }
        } else {
            console.warn('Clipboard API not available, using execCommand');
            return copyWithExecCommand(text);
        }
    } catch (error) {
        console.error('Failed to copy to clipboard:', error);
        return false;
    }
}

/**
 * Показывает обратную связь об успешном копировании на указанном элементе
 * @param {boolean} success - Успешность копирования
 * @param {HTMLElement} feedbackElement - Элемент для отображения обратной связи (опционально)
 * @param {string} successText - Текст при успехе (опционально)
 */
function showCopyFeedback(success, feedbackElement = null, successText = null) {
    if (success) {
        if (feedbackElement) {
            const originalHTML = feedbackElement.innerHTML;
            feedbackElement.innerHTML = `<span class="share-icon">✓</span><span class="share-text">${successText || t('buttons.shareSuccess')}</span>`;
            feedbackElement.classList.add('copied');
            setTimeout(() => {
                feedbackElement.classList.remove('copied');
                feedbackElement.innerHTML = originalHTML;
            }, 2000);
        } else {
            // Если элемент не передан, просто показываем alert
            //alert('Ссылка скопирована!');
        }
    } else {
        alert('Не удалось скопировать ссылку. Пожалуйста, скопируйте вручную.');
    }
}

/**
 * Копирует указанный URL в буфер обмена и показывает обратную связь.
 * @param {string} url - URL для копирования.
 * @param {HTMLElement} feedbackElement - Элемент для обратной связи (опционально).
 * @param {string} successText - Текст успеха (опционально).
 * @returns {Promise<boolean>} Успешность операции.
 */
async function copyLink(url, feedbackElement = null, successText = null) {
    if (!url) {
        alert('No link to copy');
        return false;
    }
    
    const success = await copyToClipboard(url);
    showCopyFeedback(success, feedbackElement, successText);
    return success;
}

/**
 * Обновляет значение атрибута 'value' элемента <clipboard-copy> в зависимости от текущего контекста
 */
function updateClipboardValue() {
    const clipboardButton = document.querySelector('clipboard-copy');
    if (!clipboardButton) return;
    
    if (currentPlaylistId) {
        clipboardButton.setAttribute('value', generatePlaylistLink());
    } else if (currentVideoId) {
        clipboardButton.setAttribute('value', generateShareLink());
    } else {
        clipboardButton.setAttribute('value', '');
    }
}

/**
 * Инициализирует обработчик клика для элемента <clipboard-copy>
 */
function initClipboardCopy() {
    const clipboardButton = document.querySelector('clipboard-copy');
    if (!clipboardButton) return;
    
    // Удаляем предыдущий обработчик, чтобы избежать дублирования
    clipboardButton.removeEventListener('click', handleClipboardCopyClick);
    clipboardButton.addEventListener('click', handleClipboardCopyClick);
}

/**
 * Обработчик клика на элемент <clipboard-copy>
 * @param {Event} event - Событие клика
 */
function handleClipboardCopyClick(event) {
    event.preventDefault();
    copyShareLink(); // Используем общую функцию копирования
}

/**
 * Копирует ссылку (видео с временной меткой или плейлист) в буфер обмена и показывает обратную связь
 */
async function copyShareLink() {
    let url = '';
    let feedbackElement = null;
    let successText = null;
    
    // Определяем контекст: плейлист или видео
    // Приоритет у видео, если оно воспроизводится (даже если открыт плейлист)
    if (currentVideoId) {
        url = generateShareLink();
        feedbackElement = document.querySelector('.share-button');
        successText = t('buttons.shareSuccess') || 'Link copied!';
    } else if (currentPlaylistId) {
        url = generatePlaylistLink();
        feedbackElement = document.querySelector('.playlist-copy-button');
        successText = t('buttons.playlistLinkCopied');
    }
    
    if (!url) {
        alert(currentPlaylistId ? 'No playlist is currently open' : 'Please play a video first');
        return;
    }
    
    await copyLink(url, feedbackElement, successText);
}

/**
 * Обновляет состояние кнопки поделиться при воспроизведении видео
 */
function updateShareButtonTime() {
    const shareButton = document.querySelector('.share-button');
    
    if (!shareButton || !currentVideoId) return;
    // Кнопка просто остается видимой и активной
}

/**
 * Инициализирует обновление времени на кнопке при проигрывании видео
 */
function setupShareButton() {
    const player = document.getElementById('video-player');
    
    if (!player) return;
    
    // Удаляем старые слушатели
    player.removeEventListener('timeupdate', updateShareButtonTime);
    
    // Устанавливаем новый слушатель для обновления времени
    player.addEventListener('timeupdate', updateShareButtonTime);
    
    // Обновляем время сразу
    updateShareButtonTime();
}

/**
 * Парсит параметры URL и возвращает объект с ними
 * @returns {Object} Объект с параметрами (video, t)
 */
function getUrlParams() {
    const params = new URLSearchParams(window.location.search);
    return {
        video: params.get('video') ? parseInt(params.get('video'), 10) : null,
        playlist: params.get('playlist') ? parseInt(params.get('playlist'), 10) : null,
        t: params.get('t') ? parseInt(params.get('t'), 10) : 0
    };
}

/**
 * Обрабатывает параметры URL при загрузке страницы
 */
function handleUrlParams() {
    const params = getUrlParams();
    
    if (params.video) {
        setTimeout(() => {
            playVideo(params.video, params.t);
        }, 500);
    } else if (params.playlist) {
        setTimeout(() => {
            showPlaylistVideos(params.playlist);
        }, 500);
    } else {
        console.log('No video parameter in URL');
    }
}

const heroSearchInput = document.getElementById('hero-search-input');
if (heroSearchInput) {
    heroSearchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            heroSearch();
        }
    });

    heroSearchInput.addEventListener('blur', function() {
        setTimeout(() => {
            const heroResults = document.getElementById('hero-results');
            if (heroResults) heroResults.classList.remove('active');
        }, 200);
    });

    heroSearchInput.addEventListener('focus', function() {
        const results = document.getElementById('hero-results');
        if (results && results.children.length > 0) {
            results.classList.add('active');
        }
    });
}

/**
 * Выполняет поиск видео по запросу и отображает результаты.
 * Уменьшает герой-секцию, показывает секцию результатов и загружает данные с сервера.
 */
function heroSearch() {
    const query = document.getElementById('hero-search-input').value;
    if (!query) return;

    document.querySelector('.hero').classList.add('small');

    const resultsSection = document.getElementById('search-results-section');
    const resultsList = document.getElementById('search-results-list');
    const resultsTitle = document.getElementById('search-results-title');
    
    resultsTitle.textContent = `Search Results for "${query}"`;
    resultsList.innerHTML = '<div style="padding: 20px; text-align: center;">Searching...</div>';
    resultsSection.classList.add('active');

    fetch(`${BACKEND_URL}/search/?query=${encodeURIComponent(query)}`)
        .then(response => response.json())
        .then(results => {
            if (results.length === 0) {
                resultsList.innerHTML = '<div style="padding: 20px; text-align: center; color: #aaa;">No results found</div>';
                return;
            }
            
            const fragment = document.createDocumentFragment();
            results.forEach(result => {
                const snippet = result.snippet || '';
                const timestamp = extractTimestamp(snippet);
                const searchResultCard = document.createElement('div');
                searchResultCard.className = 'search-result-card';
                searchResultCard.addEventListener('click', () => playVideo(result.id, timestamp || 0));
                const videoCard = createVideoCard(result, timestamp || 0);

                const infoDiv = document.createElement('div');
                infoDiv.className = 'search-result-info';
                infoDiv.innerHTML = `
                    <div class="search-result-card-title"></div>
                    <div class="search-result-card-snippet"></div>
                `;
                infoDiv.querySelector('.search-result-card-title').textContent = result.title;
                infoDiv.querySelector('.search-result-card-snippet').textContent = snippet;
                searchResultCard.appendChild(videoCard);
                searchResultCard.appendChild(infoDiv);
                searchResultCard.addEventListener('mouseenter', (e) => startPreview(result.id, videoCard, timestamp || 0));
                searchResultCard.addEventListener('mouseleave', () => stopPreview());
                
                fragment.appendChild(searchResultCard);
            });
            resultsList.appendChild(fragment);
        })
        .catch(error => {
            console.error(t('errors.search'), error);
            resultsList.innerHTML = `<div style="padding: 20px; text-align: center; color: #aaa;">${t('errors.search')}</div>`;
        });
}

/**
 * Очищает результаты поиска и восстанавливает герой-секцию.
 */
function clearSearch() {
    document.getElementById('search-results-section').classList.remove('active');
    document.getElementById('hero-search-input').value = '';
    document.querySelector('.hero').classList.remove('small');
}

/**
 * Закрывает выпадающий список результатов поиска в герое.
 */
function closeHeroResults() {
    document.getElementById('hero-results').classList.remove('active');
}

/**
 * Фильтрует видео по категории (например, 'all', 'playlists' или текстовой категории).
 * @param {string} category - Категория для фильтрации.
 * @param {HTMLElement} element - Элемент вкладки, который был кликнут (для подсветки).
 */
function filterCategory(category, element) {
    const section = document.querySelector('.content-section');
    if (!section.classList.contains('active')) {
        section.classList.add('active');
    }
    
    updateTabs(category, element);

    if (category === 'all') {
        currentView = 'all';

        // Если видео уже были загружены ранее
        if (allVideos.length > 0) {
            renderItems(allVideos, 'video', false);
        } else {
            // Если массив пуст (первый запуск), вызываем загрузку
            skip = 0;
            hasMore = true;
            fetchVideos();
        }
    } else {
        // Логика фильтрации по категориям
        currentView = 'filter';
        const filtered = allVideos.filter(v => 
            v.title.toLowerCase().includes(category.toLowerCase())
        );
        renderItems(filtered, 'video', false);
    }
}

/**
 * Обновляет активное состояние вкладок категорий.
 * @param {string} activeTab - Активная вкладка ('all', 'playlists' и т.д.).
 * @param {HTMLElement} [clickedElement] - Элемент вкладки, который был кликнут (для подсветки).
 */
function updateTabs(activeTab, clickedElement) {
    const tabs = document.querySelectorAll('.category-tab');
    tabs.forEach(tab => tab.classList.remove('active'));
    if (clickedElement) {
        clickedElement.classList.add('active');
    } else {
        tabs.forEach(tab => {
            const text = tab.textContent.toLowerCase();
            if ((activeTab === 'all' && text.includes(t('tabs.allVideos').toLowerCase())) ||
                (activeTab === 'playlists' && text.includes(t('tabs.myLists').toLowerCase()))) {
                tab.classList.add('active');
            }
        });
    }
}

const videoModal = document.getElementById('video-modal');
if (videoModal) {
    videoModal.addEventListener('click', function(e) {
        if (e.target === this) {
            closeModal();
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {

    const scanModal = document.getElementById('scan-modal');
    if (scanModal) {
        scanModal.addEventListener('click', function(e) {
            if (e.target === this) {
                closeScanModal();
            }
        });
    }
});

/**
 * Извлекает временную метку из текста в формате MM:SS.
 * @param {string} text - Текст, возможно содержащий временную метку.
 * @returns {number|null} Время в секундах или null, если метка не найдена.
 */
function extractTimestamp(text) {
    if (!text) return null;

    // Ищем первое вхождение формата 00:00 или 00:00:00    
    let match = text.match(/\b(\d{1,2}):(\d{2}):?(\d{2})?\b/);
    if (!match) return null;
        
    const [, a,b,c] = match.map(Number);
    if (c) {
       return a * 3600 + b * 60 + c;
    } else {
       return a * 60 + b;
    }
    
}

/**
 * Запускает предпросмотр видео с задержкой 300 мс.
 * @param {number} videoId - ID видео.
 * @param {HTMLElement} element - Элемент, на котором происходит наведение.
 * @param {number} [startTime=5] - Время начала предпросмотра в секундах.
 */
function startPreview(videoId, element, startTime = 5) {
    hoverDelay = setTimeout(() => {
        actuallyStartPreview(videoId, element, startTime);
    }, 300); // старт через 300мс
}

/**
 * Фактически начинает предпросмотр видео: создает элемент video и воспроизводит с указанного времени.
 * @param {number} videoId - ID видео.
 * @param {HTMLElement} element - Родительский элемент для вставки видео.
 * @param {number} [currentTime=5] - Время начала предпросмотра в секундах.
 */
function actuallyStartPreview(videoId, element, currentTime=5) {
    stopPreview();

    const video = document.createElement('video');
    video.src = `${BACKEND_URL}/videos/${videoId}/stream`;
    video.muted = true;
    video.autoplay = true;
    video.playsInline = true;
    video.style.position = 'absolute';
    video.style.top = '0';
    video.style.left = '0';
    video.style.width = '100%';
    video.style.height = '100%';
    video.style.objectFit = 'cover';
    video.style.zIndex = '5';

    element.appendChild(video);
    currentPreviewVideo = video;

    video.addEventListener('loadedmetadata', () => {
        video.currentTime = currentTime;
        video.play();
    });

    previewTimeout = setTimeout(stopPreview, 5000);
}

/**
 * Останавливает предпросмотр видео, очищает таймеры и удаляет элемент video.
 */
function stopPreview() {
    clearTimeout(hoverDelay);

    if (previewTimeout) {
        clearTimeout(previewTimeout);
        previewTimeout = null;
    }

    if (currentPreviewVideo) {
        currentPreviewVideo.pause();
        currentPreviewVideo.remove();
        currentPreviewVideo = null;
    }
}

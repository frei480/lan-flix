
/**
 * Базовый URL для API бэкенда.
 * @constant {string}
 */
const BACKEND_URL = '/api';

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
    initInfiniteScroll();
    fetchVideos();
    fetchPlaylists();
    const videoRow = document.getElementById('video-row');
        if (videoRow) {
            videoRow.addEventListener('wheel', (e) => {
                if (e.deltaY !== 0) {
                    e.preventDefault();
                    videoRow.scrollLeft += e.deltaY;
                }
            }, { passive: false });
        }

});

/**
 * Инициализирует бесконечную прокрутку для загрузки видео по мере скролла.
 * Использует Intersection Observer для отслеживания видимости якоря загрузки.
 */
function initInfiniteScroll() {
    const row = document.getElementById('video-row');
    const loaderAnchor = document.getElementById('row-loader');

    const options = {
        root: row, 
        rootMargin: '0px 300px 0px 0px', // Начинаем загрузку за 300px до того, как якорь покажется справа
        threshold: 0.1
    };
    const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && !isLoading && hasMore && currentView=='all')  {
            console.log('Fetching more videos...');
            fetchVideos();
        }
    }, options);
    if (loaderAnchor) observer.observe(loaderAnchor);
}

/**
 * Показывает модальное окно сканирования видео.
 */
function showScanModal() {
    document.getElementById('scan-modal').classList.add('active');
}

/**
 * Закрывает модальное окно сканирования видео.
 */
function closeScanModal() {
    document.getElementById('scan-modal').classList.remove('active');
}

/**
 * Сканирует и загружает видео с сервера.
 * Показывает индикатор загрузки, отправляет POST-запрос и обновляет интерфейс.
 * @async
 */
async function scanAndLoadVideos() {
    closeScanModal();
    const container = document.getElementById('video-container');
    container.innerHTML = '<div class="loader"></div>';
    
    try {
        const response = await fetch(`${BACKEND_URL}/videos/scan-and-load/`, { method: 'POST' });
        const data = await response.json();
        alert(`Loaded/Updated ${data.length} videos.`);
        fetchVideos();
        fetchPlaylists();
    } catch (error) {
        console.error('Error scanning and loading videos:', error);
        alert('Error scanning and loading videos. Check console for details.');
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
        console.error('Error fetching videos:', error);
        const row = document.getElementById('video-row');
        if (row && skip === 0) {
            row.innerHTML = '<p class="no-videos">Error loading videos.</p>';
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
        console.error('Error fetching video info:', error);
        container.innerHTML = '<p class="no-videos">Error loading video. Make sure the backend is running.</p>';
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
    document.getElementById('playlist-name').innerHTML = ``;

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

        document.getElementById('back-btn').style.display = 'flex';
        document.getElementById('playlist-name').innerHTML = `<h2>${playlist.name}</h2>`;
        
        // ВЫЗОВ: тип 'video', append = false
        renderItems(playlist.videos, 'video', false);
    } catch (error) {
        console.error('Error:', error);
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
    document.getElementById('playlist-name').innerHTML = ` `;
    document.getElementById('back-btn').style.display = 'none';
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
    // Вставляем строго перед якорем
    row.insertBefore(fragment, loaderAnchor);
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
    if(player.querySelector('track')) player.querySelector('track').remove();
    
    const video = await fetchVideo(videoId); //allVideos.find(v => v.id === videoId);
    const trackpath = video.filepath.replace('/app/videos', '/static/transcriptions').replace(/\.[^/.]+$/, '.vtt');
    const response = await fetch(trackpath);
    if (response.ok) {
        const track = document.createElement('track', {method: 'HEAD'});
        track.kind = 'subtitles';
        track.label = 'Русский';
        track.srclang = 'ru';
        track.src = trackpath;
        player.appendChild(track);
    }else{
        player.querySelector('track').remove();
    }


    if (video) {
        title.textContent = video.title;
    }

    player.src = `${BACKEND_URL}/videos/${videoId}/stream`;

    player.addEventListener('loadedmetadata', function onLoad() {
        player.removeEventListener('loadedmetadata', onLoad);

        if (startTime && !isNaN(startTime)) {
            player.currentTime = startTime;
        }

        player.play();
    });
    modal.classList.add('active');
    
    if (video.transcription) {
        srt.innerText = video.transcription;
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
    player.querySelector('track').remove();
    modal.classList.remove('active');
}

document.getElementById('hero-search-input').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        heroSearch();
    }
});

document.getElementById('hero-search-input').addEventListener('blur', function() {
    setTimeout(() => {
        document.getElementById('hero-results').classList.remove('active');
    }, 200);
});

document.getElementById('hero-search-input').addEventListener('focus', function() {
    const results = document.getElementById('hero-results');
    if (results.children.length > 0) {
        results.classList.add('active');
    }
});

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
            console.error('Error searching:', error);
            resultsList.innerHTML = '<div style="padding: 20px; text-align: center; color: #aaa;">Error searching</div>';
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
            if ((activeTab === 'all' && text.includes('all videos')) ||
                (activeTab === 'playlists' && text.includes('my lists'))) {
                tab.classList.add('active');
            }
        });
    }
}

document.getElementById('video-modal').addEventListener('click', function(e) {
    if (e.target === this) {
        closeModal();
    }
});

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

    // Ищем первое вхождение формата 00:00
    const match = text.match(/\b(\d{2}):(\d{2})\b/);

    if (!match) return null;

    const minutes = parseInt(match[1], 10);
    const seconds = parseInt(match[2], 10);

    return minutes * 60 + seconds;
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

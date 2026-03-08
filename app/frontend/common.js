const BACKEND_URL = '/api';
let allVideos = [];
let allPlaylists = [];
let currentView = 'all';
let hoverDelay;
let previewTimeout = null;
let currentPreviewVideo = null;
let skip=0;
const limit=20;
let isLoading=false;
let hasMore=true;

document.addEventListener('DOMContentLoaded', function() {
    initInfiniteScroll();
    fetchVideos();
    fetchPlaylists();

    document.addEventListener('wheel', function(e) {
        if (e.target.classList.contains('video-row') || e.target.closest('.video-row')) {
                const row = e.target.classList.contains('video-row') ? e.target : e.target.closest('.video-row');
                if (e.deltaY !== 0) {
                    e.preventDefault();
                    row.scrollLeft += e.deltaY;
                }            
        }
    }, { passive: false });
});

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
function showScanModal() {
    document.getElementById('scan-modal').classList.add('active');
}

function closeScanModal() {
    document.getElementById('scan-modal').classList.remove('active');
}

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
            skip+=limit;
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

async function fetchPlaylists() {
    try {
        const response = await fetch(`${BACKEND_URL}/playlists/`);
        allPlaylists = await response.json();
    } catch (error) {
        console.error('Error fetching playlists:', error);
    }
}

function showPlaylists() {
    currentView = 'playlists';

    const anchor = document.getElementById('scroll-anchor');
    document.querySelector('.content-section').classList.add('active');
    

    updateTabs('playlists');
    document.getElementById('back-btn').style.display = 'none';
    document.getElementById('playlist-name').innerHTML = ``;

    renderItems(allPlaylists, 'playlist', false);

}

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

function toggleContentSection() {
    document.querySelector('.content-section').classList.toggle('active');
}

function goBack() {
    currentView = 'playlists';
    document.getElementById('playlist-name').innerHTML = ` `;
    document.getElementById('back-btn').style.display = 'none';
    showPlaylists();
}

function displayVideos(videos) {
    const row = document.getElementById('video-row');
    
    row.querySelectorAll('.video-card').forEach(card => card.remove());

    if (videos.length === 0) {
        row.insertAdjacentHTML('afterbegin', `<p class="no-videos">No videos found. Click "+ Add Videos" to scan and load videos.</p>`);
        return;
    }
    appendVideos(videos);
}
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

    // 3. Генерируем HTML для каждого элемента
    items.forEach(item => {
        let html = '';
        if (type === 'video') {
            html = `
                <div class="video-card" onclick="playVideo(${item.id})"
                    onmouseenter="startPreview(${item.id}, this)"
                    onmouseleave="stopPreview()">
                    <div style="width: 100%; height: 100%; background: linear-gradient(45deg, #333, #444); display: flex; align-items: center; justify-content: center;">
                        <span style="font-size: 48px;">🎬</span>
                    </div>
                    <div class="video-card-overlay">
                        <div class="video-card-title">${item.title}</div>
                    </div>
                </div>`;
        } else if (type === 'playlist') {
            html = `
                <div class="playlist-card" onclick="showPlaylistVideos(${item.id})">
                    <div class="playlist-card-icon">📁</div>
                    <div class="playlist-card-title">${item.name}</div>
                    <div class="playlist-card-count">${item.video_count || 0} videos</div>
                </div>`;
        }
        
        // Вставляем строго перед якорем
        loaderAnchor.insertAdjacentHTML('beforebegin', html);
    });
}
function appendVideos(videos) {
    const anchor = document.getElementById('scroll-anchor');

    videos.forEach(video => {
        const card = document.createElement('div');
        card.className = 'video-card';
        card.onclick = () => playVideo(video.id);
        card.onmouseenter = (e) => startPreview(video.id, card);
        card.onmouseleave = () => stopPreview();
        
        card.innerHTML = `
            <div style="width: 100%; height: 100%; background: linear-gradient(45deg, #333, #444); display: flex; align-items: center; justify-content: center;">
                <span style="font-size: 48px;">🎬</span>
            </div>
            <div class="video-card-overlay">
                <div class="video-card-title">${video.title}</div>
            </div>
        `;
        
        // Вставляем карточку ПЕРЕД якорем
        anchor.insertAdjacentHTML('beforebegin', card.outerHTML);
    });
}

async function playVideo(videoId, startTime = 0) {
    const modal = document.getElementById('video-modal');
    const player = document.getElementById('video-player');
    const title = document.getElementById('modal-title');
    const srt = document.getElementById('video-subtitles');

    const video = await fetchVideo(videoId); //allVideos.find(v => v.id === videoId);
    
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
    
    let html = ``;
    if (video.transcription) {
        html +=`<p>${video.transcription.replace(/\n/g, '<br>')}</p>`;
    }
    srt.innerHTML = html;
}

function closeModal() {
    const modal = document.getElementById('video-modal');
    const player = document.getElementById('video-player');
    player.pause();
    player.src = '';
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

            let html = '';
            results.forEach(result => {
                const snippet = result.snippet || '';
                const timestamp = extractTimestamp(snippet);

                html += `
                    <div class="search-result-card" 
                        onclick="playVideo(${result.id}, ${timestamp || 0})">
                        <div class="video-card" onmouseenter="startPreview(${result.id}, this, ${timestamp || 0})"
                        onmouseleave="stopPreview()">
                            <span style="font-size: 24px;">🎬</span>
                        </div>
                        <div class="search-result-info">
                            <div class="search-result-card-title">${result.title}</div>
                            <div class="search-result-card-snippet">${snippet}</div>
                        </div>
                    </div>
                `;
            });
            resultsList.innerHTML = html;
        })
        .catch(error => {
            console.error('Error searching:', error);
            resultsList.innerHTML = '<div style="padding: 20px; text-align: center; color: #aaa;">Error searching</div>';
        });
}

function clearSearch() {
    document.getElementById('search-results-section').classList.remove('active');
    document.getElementById('hero-search-input').value = '';
    document.querySelector('.hero').classList.remove('small');
}

function closeHeroResults() {
    document.getElementById('hero-results').classList.remove('active');
}

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

        document.getElementById('scan-modal').addEventListener('click', function(e) {
            if (e.target === this) {
                closeScanModal();
            }
        });

        function extractTimestamp(text) {
            if (!text) return null;

            // Ищем первое вхождение формата 00:00
            const match = text.match(/\b(\d{2}):(\d{2})\b/);

            if (!match) return null;

            const minutes = parseInt(match[1], 10);
            const seconds = parseInt(match[2], 10);

            return minutes * 60 + seconds;
        }
        
        

function startPreview(videoId, element) {
    hoverDelay = setTimeout(() => {
        actuallyStartPreview(videoId, element);
    }, 300); // старт через 300мс
}

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
        

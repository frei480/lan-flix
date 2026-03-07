const BACKEND_URL = '/api';
let allVideos = [];
let allPlaylists = [];
let currentView = 'all';
let hoverDelay;
let previewTimeout = null;
let currentPreviewVideo = null;
        document.addEventListener('DOMContentLoaded', function() {
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
            const container = document.getElementById('video-container');
            try {
                const response = await fetch(`${BACKEND_URL}/videos/`);
                allVideos = await response.json();
                if (currentView === 'all') {
                    displayVideos(allVideos);
                }
            } catch (error) {
                console.error('Error fetching videos:', error);
                container.innerHTML = '<p class="no-videos">Error loading videos. Make sure the backend is running.</p>';
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
            document.querySelector('.content-section').classList.add('active');
            const tabs = document.querySelectorAll('.category-tab');
            tabs.forEach(tab => tab.classList.remove('active'));
            tabs.forEach(tab => {
                if (tab.textContent.toLowerCase().includes('my lists')) {
                    tab.classList.add('active');
                }
            });
            document.getElementById('back-btn').style.display = 'none';
            
            const container = document.getElementById('video-container');
            
            if (allPlaylists.length === 0) {
                container.innerHTML = `
                    <div class="video-row">
                        <p class="no-videos">No playlists found. Create playlists on the main page.</p>
                    </div>
                `;
                return;
            }

            let html = `
                <div class="video-row">
            `;

            allPlaylists.forEach(playlist => {
                html += `
                    <div class="playlist-card" onclick="showPlaylistVideos(${playlist.id})">
                        <div class="playlist-card-icon">📁</div>
                        <div class="playlist-card-title">${playlist.name}</div>
                        <div class="playlist-card-count">${playlist.video_count || 0} videos</div>
                    </div>
                `;
            });

            html += '</div>';
            container.innerHTML = html;
        }

        async function showPlaylistVideos(playlistId) {
            try {
                const response = await fetch(`${BACKEND_URL}/playlists/${playlistId}`);
                const playlist = await response.json();
                
                currentView = 'playlist';
                document.getElementById('back-btn').style.display = 'flex';
                
                const container = document.getElementById('video-container');
                
                if (!playlist.videos || playlist.videos.length === 0) {
                    container.innerHTML = `
                        <h2>${playlist.name}</h2>
                        <div class="video-row">
                            <p class="no-videos">No videos in this playlist.</p>
                        </div>
                    `;
                    return;
                }

                let html = `
                    <h2>${playlist.name}</h2>
                    <div class="video-row">
                `;

                playlist.videos.forEach(video => {
                    html += `
                        <div class="video-card" onclick="playVideo(${video.id})"
                        onmouseenter="startPreview(${video.id}, this)"
                            onmouseleave="stopPreview()">
                            <div style="width: 100%; height: 100%; background: linear-gradient(45deg, #333, #444); display: flex; align-items: center; justify-content: center;">
                                <span style="font-size: 48px;">🎬</span>
                            </div>
                            <div class="video-card-overlay">
                                <div class="video-card-title">${video.title}</div>
                            </div>
                        </div>
                    `;
                });

                html += '</div>';
                container.innerHTML = html;
            } catch (error) {
                console.error('Error fetching playlist videos:', error);
            }
        }

        function toggleContentSection() {
            document.querySelector('.content-section').classList.toggle('active');
        }

        function goBack() {
            currentView = 'playlists';
            document.getElementById('back-btn').style.display = 'none';
            showPlaylists();
        }

        function displayVideos(videos) {
            const container = document.getElementById('video-container');
            
            if (videos.length === 0) {
                container.innerHTML = `
                    <div class="video-row">
                        <p class="no-videos">No videos found. Click "+ Add Videos" to scan and load videos.</p>
                    </div>
                `;
                return;
            }

            let html = `
                <div class="video-row">
            `;

            videos.forEach(video => {
                html += `
                    <div class="video-card" onclick="playVideo(${video.id})"
                        onmouseenter="startPreview(${video.id}, this)"
                        onmouseleave="stopPreview()">
                        <div style="width: 100%; height: 100%; background: linear-gradient(45deg, #333, #444); display: flex; align-items: center; justify-content: center;">
                            <span style="font-size: 48px;">🎬</span>
                        </div>
                        <div class="video-card-overlay">
                            <div class="video-card-title">${video.title}</div>
                        </div>
                    </div>
                `;
            });

            html += '</div>';
            container.innerHTML = html;
        }

        function playVideo(videoId, startTime = 0) {
            const modal = document.getElementById('video-modal');
            const player = document.getElementById('video-player');
            const title = document.getElementById('modal-title');
            const srt = document.getElementById('video-subtitles');

            const video = allVideos.find(v => v.id === videoId);
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
            currentView = category;
            document.getElementById('back-btn').style.display = 'none';
            updateTabs(category, element);

            if (category === 'all') {
                displayVideos(allVideos);
            } else {
                const filtered = allVideos.filter(v => 
                    v.title.toLowerCase().includes(category)
                );
                displayVideos(filtered);
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
        

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements (Original + New Player Elements) ---
    const releasesGrid = document.getElementById('releases-grid');
    const playerModal = document.getElementById('player-modal');
    const modalCloseBtn = document.getElementById('modal-close-btn');
    const modalAlbumImg = document.getElementById('modal-album-img');
    const modalTitle = document.getElementById('modal-title');
    const modalCatalog = document.getElementById('modal-catalog');
    const modalTracklist = document.getElementById('modal-tracklist');
    const modalLinks = document.getElementById('modal-links');
    
    // The audio element is the same
    const audioPlayer = document.getElementById('audio-player'); 
    
    // The now playing bar and its new components
    const nowPlayingBar = document.getElementById('now-playing-bar');
    const playerArtImg = document.getElementById('player-art-img');
    const playerTrackTitle = document.getElementById('player-track-title');
    const playerTrackArtist = document.getElementById('player-track-artist');
    const prevBtn = document.getElementById('prev-btn');
    const playPauseBtn = document.getElementById('play-pause-btn');
    const nextBtn = document.getElementById('next-btn');
    const currentTimeEl = document.getElementById('current-time');
    const totalDurationEl = document.getElementById('total-duration');
    const progressBar = document.getElementById('progress-bar');
    const progressBarContainer = document.getElementById('progress-bar-container');


    // --- State and Constants ---
    const VISIBLE_CLASS = 'visible';
    const PLAYING_CLASS = 'playing';
    let releasesMap = new Map();
    // New state for the advanced player
    let playlist = [];
    let currentTrackIndex = -1;
    let isPlaying = false;


    // --- Original Functions (Largely Unchanged) ---
    const createReleaseElement = (release) => {
        const releaseElement = document.createElement('div');
        releaseElement.className = 'release-item';
        releaseElement.dataset.releaseId = release.id;

        const img = document.createElement('img');
        img.src = release.imageUrl;
        img.alt = `Album cover for ${release.title}`;
        img.loading = 'lazy';
        img.decoding = 'async';

        const title = document.createElement('h3');
        title.textContent = release.title;

        const catalogInfo = document.createElement('p');
        catalogInfo.textContent = release.catalogInfo;

        releaseElement.append(img, title, catalogInfo);
        return releaseElement;
    };

    const populateModal = (release) => {
        // We'll add the releaseId to the modal for reference
        playerModal.dataset.releaseId = release.id; 
        modalAlbumImg.src = release.imageUrl;
        modalAlbumImg.alt = `Album cover for ${release.title}`;
        modalTitle.textContent = release.title;
        modalCatalog.textContent = release.catalogInfo;

        const tracklistFragment = document.createDocumentFragment();
        release.tracklist.forEach((track, index) => {
            const li = document.createElement('li');
            // Use track index for the new player logic
            li.dataset.trackIndex = index; 
            li.innerHTML = `<div><span class="modal-track-number">${String(index + 1).padStart(2, '0')}.</span> ${track}</div>`;
            tracklistFragment.appendChild(li);
        });
        modalTracklist.replaceChildren(tracklistFragment);

        const linksHTML = Object.entries(release.links)
            .map(([platform, url]) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${platform.toUpperCase()}</a>`)
            .join('');
        modalLinks.innerHTML = linksHTML;
        
        updateTrackHighlight(); // Highlight the playing track if this modal is re-opened
    };

    const openModal = (releaseId) => {
        const release = releasesMap.get(releaseId);
        if (!release) return;

        populateModal(release);
        playerModal.classList.add(VISIBLE_CLASS);
        playerModal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
    };

    const closeModal = () => {
        playerModal.classList.remove(VISIBLE_CLASS);
        playerModal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
        // Note: We no longer stop the music when closing the modal.
        // The user can control it from the persistent player bar.
    };
    
    const loadReleases = async () => {
        try {
            const response = await fetch('./releases.json');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const releasesData = await response.json();

            if (releasesData.length === 0) {
                releasesGrid.textContent = 'No tapes found.';
                return;
            }

            const fragment = document.createDocumentFragment();
            releasesData.forEach(release => {
                releasesMap.set(release.id, release);
                fragment.appendChild(createReleaseElement(release));
            });
            releasesGrid.replaceChildren(fragment);
        } catch (error) {
            releasesGrid.textContent = 'Error loading tapes. See console for details.';
            console.error("Could not load releases:", error);
        }
    };

    // --- NEW Advanced Player Functions ---
    const formatTime = (seconds) => {
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    };
    
    const updateProgress = () => {
        const { duration, currentTime } = audioPlayer;
        if (duration) {
            const progressPercent = (currentTime / duration) * 100;
            progressBar.style.transform = `scaleX(${progressPercent / 100})`;
            currentTimeEl.textContent = formatTime(currentTime);
            totalDurationEl.textContent = formatTime(duration);
        }
    };
    
    const setProgress = (e) => {
        const width = progressBarContainer.clientWidth;
        const clickX = e.offsetX;
        const duration = audioPlayer.duration;
        if(duration) {
            audioPlayer.currentTime = (clickX / width) * duration;
        }
    };

    const updatePlayerUI = () => {
        if (currentTrackIndex < 0) return;
        const track = playlist[currentTrackIndex];
        const release = releasesMap.get(track.releaseId);
        
        playerArtImg.src = release.imageUrl;
        playerTrackTitle.textContent = track.title;
        playerTrackArtist.textContent = release.artist; // Get artist from the release
        
        playPauseBtn.classList.toggle(PLAYING_CLASS, isPlaying);
        playPauseBtn.setAttribute('aria-label', isPlaying ? 'Pause' : 'Play');
        
        updateTrackHighlight();
    };
    
    const updateTrackHighlight = () => {
        modalTracklist.querySelectorAll('li').forEach(li => li.classList.remove(PLAYING_CLASS));

        if (playlist.length > 0 && playerModal.classList.contains(VISIBLE_CLASS)) {
            const currentTrack = playlist[currentTrackIndex];
            if (playerModal.dataset.releaseId === currentTrack.releaseId) {
                const trackElement = modalTracklist.querySelector(`li[data-track-index="${currentTrack.trackIndex}"]`);
                if (trackElement) {
                    trackElement.classList.add(PLAYING_CLASS);
                }
            }
        }
    };

    const playAudio = () => {
        if (currentTrackIndex === -1 && playlist.length > 0) {
            loadTrack(0); // Start with the first track if nothing is loaded
        } else {
            isPlaying = true;
            audioPlayer.play();
            updatePlayerUI();
        }
    };
    
    const pauseAudio = () => {
        isPlaying = false;
        audioPlayer.pause();
        updatePlayerUI();
    };

    const loadTrack = (trackIndex) => {
        currentTrackIndex = trackIndex;
        const track = playlist[currentTrackIndex];
        audioPlayer.src = track.audioSrc;
        playAudio();
    };

    const playNext = () => {
        if (playlist.length === 0) return;
        const newIndex = (currentTrackIndex + 1) % playlist.length;
        loadTrack(newIndex);
    };

    const playPrev = () => {
        if (playlist.length === 0) return;
        const newIndex = (currentTrackIndex - 1 + playlist.length) % playlist.length;
        loadTrack(newIndex);
    };

    const handlePlayPause = () => {
        if (isPlaying) {
            pauseAudio();
        } else {
            playAudio();
        }
    };


    // --- Event Listeners (Original + New) ---

    releasesGrid.addEventListener('click', (e) => {
        const releaseItem = e.target.closest('.release-item[data-release-id]');
        if (releaseItem) {
            openModal(releaseItem.dataset.releaseId);
        }
    });

    modalTracklist.addEventListener('click', (e) => {
        const trackItem = e.target.closest('li[data-track-index]');
        if (trackItem) {
            const releaseId = playerModal.dataset.releaseId;
            const release = releasesMap.get(releaseId);
            const clickedTrackIndex = parseInt(trackItem.dataset.trackIndex, 10);
            
            // Build a new playlist from the clicked album
            playlist = release.tracklist.map((trackName, index) => ({
                title: trackName,
                audioSrc: release.audioSrc[index],
                releaseId: release.id,
                trackIndex: index
            }));

            nowPlayingBar.classList.add(VISIBLE_CLASS);
            loadTrack(clickedTrackIndex);
        }
    });

    modalCloseBtn.addEventListener('click', closeModal);

    playerModal.addEventListener('click', (e) => {
        if (e.target === playerModal) {
            closeModal();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === "Escape" && playerModal.classList.contains(VISIBLE_CLASS)) {
            closeModal();
        }
    });

    // New Player Control Listeners
    playPauseBtn.addEventListener('click', handlePlayPause);
    nextBtn.addEventListener('click', playNext);
    prevBtn.addEventListener('click', playPrev);
    audioPlayer.addEventListener('timeupdate', updateProgress);
    audioPlayer.addEventListener('ended', playNext);
    audioPlayer.addEventListener('loadedmetadata', updateProgress);
    progressBarContainer.addEventListener('click', setProgress);


    // --- Initialization ---
    loadReleases();
});
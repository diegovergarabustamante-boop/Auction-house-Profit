(() => {
    let musicTracks = [];

    let currentAudio = null;
    let isMusicPlaying = false;
    let currentTrackIndex = -1;
    let currentVolume = 10;
    let animationInterval = null;
    let progressInterval = null;

    async function ensurePlaylistLoaded() {
        if (musicTracks.length) return true;
        try {
            const resp = await fetch('/api/music-list/');
            const data = await resp.json();
            if (data.ok && Array.isArray(data.tracks)) {
                musicTracks = data.tracks.map(t => t.url);
                // Shuffle playlist once for random order
                for (let i = musicTracks.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [musicTracks[i], musicTracks[j]] = [musicTracks[j], musicTracks[i]];
                }
            }
        } catch (e) {
            console.log('Error fetching music list:', e);
        }
        return musicTracks.length > 0;
    }

    async function playRandomMusic() {
        const hasTracks = await ensurePlaylistLoaded();
        if (!hasTracks) return;
        if (currentAudio) {
            currentAudio.pause();
            currentAudio.currentTime = 0;
        }

        // Start at a random position in the shuffled list on first play
        if (currentTrackIndex === -1) {
            currentTrackIndex = Math.floor(Math.random() * musicTracks.length);
        }
        const selectedTrack = musicTracks[currentTrackIndex];

        currentAudio = new Audio(selectedTrack);
        currentAudio.volume = currentVolume / 100;
        currentAudio.loop = false;

        currentAudio.addEventListener('ended', () => {
            if (isMusicPlaying) setTimeout(playNext, 500);
        });

        currentAudio.addEventListener('error', () => {
            if (isMusicPlaying) setTimeout(playNext, 500);
        });

        currentAudio.play().catch(error => {
            console.log('❌ Error reproduciendo música:', error.message);
        });

        isMusicPlaying = true;
        updateMusicButton();
        updateCurrentTrackDisplay(selectedTrack);
        startVisualizerAnimation();
        startProgressUpdates();
        saveMusicPreferences();
    }

    function stopMusic() {
        if (currentAudio) {
            currentAudio.pause();
            currentAudio.currentTime = 0;
        }
        isMusicPlaying = false;
        updateMusicButton();
        stopVisualizerAnimation();
        stopProgressUpdates();
        saveMusicPreferences();
        saveTrackState();
    }

    function toggleMusic() {
        if (isMusicPlaying) {
            stopMusic();
        } else {
            playRandomMusic();
        }
    }

    function updateMusicButton() {
        const btn = document.getElementById('music-toggle-btn');
        if (!btn) return;
        btn.textContent = isMusicPlaying ? '⏸ Pause' : '▶ Play';
        btn.style.backgroundColor = isMusicPlaying ? '#f44336' : '#4CAF50';
    }

    function loadMusicPreferences() {
        try {
            const saved = localStorage.getItem('wowMusicPreferences');
            if (saved) {
                const prefs = JSON.parse(saved);
                currentVolume = prefs.volume ?? 10;
            }
        } catch (error) {
            console.log('Error cargando preferencias:', error);
        }
    }

    function saveTrackState() {
        try {
            if (!currentAudio) return;
            const state = {
                url: currentAudio.src,
                index: currentTrackIndex,
                time: currentAudio.currentTime || 0
            };
            localStorage.setItem('wowMusicTrackState', JSON.stringify(state));
        } catch (error) {
            console.log('Error guardando estado de canción:', error);
        }
    }

    function loadTrackState() {
        try {
            const saved = localStorage.getItem('wowMusicTrackState');
            if (saved) {
                return JSON.parse(saved);
            }
        } catch (error) {
            console.log('Error cargando estado de canción:', error);
        }
        return null;
    }

    function saveMusicPreferences() {
        try {
            const prefs = { volume: currentVolume };
            localStorage.setItem('wowMusicPreferences', JSON.stringify(prefs));
            saveTrackState();
        } catch (error) {
            console.log('Error guardando preferencias:', error);
        }
    }

    function updateVolume(newVolume) {
        currentVolume = newVolume;
        if (currentAudio) currentAudio.volume = currentVolume / 100;
        const slider = document.getElementById('volume-slider');
        const value = document.getElementById('volume-value');
        if (slider) slider.value = currentVolume;
        if (value) value.textContent = `${currentVolume}%`;
        saveMusicPreferences();
    }

    function startVisualizerAnimation() {
        const bars = document.querySelectorAll('#track-bars .bar');
        if (animationInterval) clearInterval(animationInterval);
        animationInterval = setInterval(() => {
            bars.forEach(bar => {
                const height = Math.random() * 20 + 5;
                bar.style.height = `${height}px`;
            });
        }, 200);
        const viz = document.getElementById('music-visualizer');
        if (viz) viz.style.display = 'block';
    }

    function stopVisualizerAnimation() {
        if (animationInterval) {
            clearInterval(animationInterval);
            animationInterval = null;
        }
        document.querySelectorAll('#track-bars .bar').forEach(bar => {
            bar.style.height = '5px';
        });
        const viz = document.getElementById('music-visualizer');
        if (viz) viz.style.display = 'none';
    }

    function formatTime(totalSeconds) {
        const s = Math.floor(totalSeconds || 0);
        const m = Math.floor(s / 60);
        const r = s % 60;
        return `${m}:${r.toString().padStart(2, '0')}`;
    }

    function updateProgressUI() {
        const fill = document.getElementById('music-progress-fill');
        const curEl = document.getElementById('fp-current-time');
        const durEl = document.getElementById('fp-duration');
        if (!currentAudio || !fill || !curEl || !durEl) return;
        const cur = currentAudio.currentTime || 0;
        const dur = currentAudio.duration || 0;
        const pct = dur > 0 ? (cur / dur) * 100 : 0;
        fill.style.width = `${pct}%`;
        curEl.textContent = formatTime(cur);
        durEl.textContent = formatTime(dur);
    }

    function startProgressUpdates() {
        stopProgressUpdates();
        progressInterval = setInterval(updateProgressUI, 250);
        currentAudio?.addEventListener('timeupdate', updateProgressUI);
        currentAudio?.addEventListener('loadedmetadata', updateProgressUI);
    }

    function stopProgressUpdates() {
        if (progressInterval) {
            clearInterval(progressInterval);
            progressInterval = null;
        }
        if (currentAudio) {
            currentAudio.removeEventListener('timeupdate', updateProgressUI);
            currentAudio.removeEventListener('loadedmetadata', updateProgressUI);
        }
    }

    function seekAtClientX(clientX) {
        const bar = document.getElementById('music-progress');
        if (!bar || !currentAudio || !currentAudio.duration) return;
        const rect = bar.getBoundingClientRect();
        const ratio = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
        currentAudio.currentTime = ratio * currentAudio.duration;
        updateProgressUI();
    }

    function playNext() {
        if (!musicTracks.length) return;
        currentTrackIndex = (currentTrackIndex + 1) % musicTracks.length;
        const next = musicTracks[currentTrackIndex];
        if (currentAudio) {
            currentAudio.pause();
            currentAudio.currentTime = 0;
        }
        currentAudio = new Audio(next);
        currentAudio.volume = currentVolume / 100;
        currentAudio.loop = false;
        currentAudio.addEventListener('ended', () => { if (isMusicPlaying) setTimeout(playNext, 500); });
        currentAudio.play().catch(err => console.log('Play error:', err?.message || err));
        isMusicPlaying = true;
        updateMusicButton();
        updateCurrentTrackDisplay(next);
        startVisualizerAnimation();
        startProgressUpdates();
    }

    function playPrev() {
        if (!musicTracks.length) return;
        currentTrackIndex = (currentTrackIndex - 1 + musicTracks.length) % musicTracks.length;
        const prev = musicTracks[currentTrackIndex];
        if (currentAudio) {
            currentAudio.pause();
            currentAudio.currentTime = 0;
        }
        currentAudio = new Audio(prev);
        currentAudio.volume = currentVolume / 100;
        currentAudio.loop = false;
        currentAudio.addEventListener('ended', () => { if (isMusicPlaying) setTimeout(playNext, 500); });
        currentAudio.play().catch(err => console.log('Play error:', err?.message || err));
        isMusicPlaying = true;
        updateMusicButton();
        updateCurrentTrackDisplay(prev);
        startVisualizerAnimation();
        startProgressUpdates();
    }

    function updateCurrentTrackDisplay(trackPath) {
        const trackNameElement = document.getElementById('current-track-name');
        if (!trackNameElement || !trackPath) return;
        try {
            const parts = trackPath.split('/');
            const file = parts[parts.length - 1];
            const base = file.replace(/\.[^.]+$/, '');
            trackNameElement.textContent = base.replace(/[_-]+/g, ' ');
        } catch (e) {
            // ignore
        }
    }

    // Autoplay message removed: playback only on user interaction

    function playSound(soundName) {
        const sounds = {
            cash: null
        };
        try {
            if (sounds[soundName] && sounds[soundName] !== '/static/market/sounds/cash.mp3') {
                const audio = new Audio(sounds[soundName]);
                audio.volume = 0.3;
                audio.play().catch(playGeneratedSound);
            } else {
                playGeneratedSound();
            }
        } catch (error) {
            playGeneratedSound();
        }
    }

    function playGeneratedSound() {
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            const filter = audioContext.createBiquadFilter();

            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(3000, audioContext.currentTime);

            oscillator.frequency.setValueAtTime(400, audioContext.currentTime);
            oscillator.frequency.linearRampToValueAtTime(700, audioContext.currentTime + 0.08);
            oscillator.frequency.linearRampToValueAtTime(500, audioContext.currentTime + 0.15);
            oscillator.type = 'sine';

            gainNode.gain.setValueAtTime(0, audioContext.currentTime);
            gainNode.gain.linearRampToValueAtTime(0.08, audioContext.currentTime + 0.03);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);

            oscillator.connect(filter);
            filter.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.2);
        } catch (error) {
            console.log('Generated sound failed:', error);
        }
    }

    async function restorePreviousTrack() {
        const state = loadTrackState();
        if (!state || !state.url) return;
        const hasTracks = await ensurePlaylistLoaded();
        if (!hasTracks) return;
        const trackIdx = musicTracks.findIndex(t => t === state.url);
        if (trackIdx === -1) return;
        currentTrackIndex = trackIdx;
        currentAudio = new Audio(state.url);
        currentAudio.volume = currentVolume / 100;
        currentAudio.currentTime = state.time;
        currentAudio.addEventListener('ended', () => { if (isMusicPlaying) setTimeout(playNext, 500); });
        currentAudio.addEventListener('error', () => { if (isMusicPlaying) setTimeout(playNext, 500); });
        updateCurrentTrackDisplay(state.url);
        startProgressUpdates();
    }

    document.addEventListener('DOMContentLoaded', () => {
        loadMusicPreferences();

        const volumeSlider = document.getElementById('volume-slider');
        if (volumeSlider) {
            volumeSlider.value = currentVolume;
            volumeSlider.addEventListener('input', e => updateVolume(parseInt(e.target.value, 10)));
        }

        updateVolume(currentVolume);
        // Restore previous track if available
        restorePreviousTrack();
        // No auto-play on load; wait for user interaction

        document.getElementById('music-toggle-btn')?.addEventListener('click', toggleMusic);
        document.getElementById('music-next-btn')?.addEventListener('click', () => {
            if (!musicTracks.length) { playRandomMusic(); return; }
            playNext();
        });
        document.getElementById('music-prev-btn')?.addEventListener('click', () => {
            if (!musicTracks.length) { playRandomMusic(); return; }
            playPrev();
        });
        const progress = document.getElementById('music-progress');
        if (progress) {
            progress.addEventListener('click', (e) => seekAtClientX(e.clientX));
            let isDown = false;
            progress.addEventListener('mousedown', (e) => { isDown = true; seekAtClientX(e.clientX); });
            progress.addEventListener('mouseup', () => { isDown = false; });
            progress.addEventListener('mousemove', (e) => { if (isDown) seekAtClientX(e.clientX); });
            progress.addEventListener('mouseleave', () => { isDown = false; });
        }

        // Listen for Saul Goodman background trigger
        window.addEventListener('playGoodman', async (evt) => {
            if (!isMusicPlaying) return;
            const url = evt.detail?.url || '/static/market/music/goodman.mp3';
            if (currentAudio) {
                currentAudio.pause();
                currentAudio.currentTime = 0;
            }
            currentAudio = new Audio(url);
            currentAudio.volume = currentVolume / 100;
            currentAudio.loop = false;
            currentAudio.addEventListener('ended', () => { if (isMusicPlaying) setTimeout(playNext, 500); });
            currentAudio.addEventListener('error', (e) => { if (isMusicPlaying) setTimeout(playNext, 500); });
            currentAudio.play().catch(err => console.log('Play error:', err?.message || err));
            updateCurrentTrackDisplay(url);
            startVisualizerAnimation();
            startProgressUpdates();
        });
    });

    window.App = window.App || {};
    window.App.audio = { playSound, toggleMusic, playNext, playPrev };
})();

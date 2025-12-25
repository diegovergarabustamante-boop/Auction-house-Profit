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
            showAutoplayMessage();
            if (isMusicPlaying) setTimeout(playRandomMusic, 1000);
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
                isMusicPlaying = prefs.wasPlaying ?? false;
            }
        } catch (error) {
            console.log('Error cargando preferencias:', error);
        }
    }

    function saveMusicPreferences() {
        try {
            const prefs = { volume: currentVolume, wasPlaying: isMusicPlaying };
            localStorage.setItem('wowMusicPreferences', JSON.stringify(prefs));
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
        currentAudio.play().catch(showAutoplayMessage);
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
        currentAudio.play().catch(showAutoplayMessage);
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

    function showAutoplayMessage() {
        if (document.getElementById('autoplay-message')) return;
        const message = document.createElement('div');
        message.id = 'autoplay-message';
        message.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #f59e0b;
            color: white;
            padding: 15px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 1000;
            max-width: 300px;
            font-size: 14px;
            cursor: pointer;
        `;
        message.innerHTML = `
            <strong>🎵 Música bloqueada</strong><br>
            Los navegadores bloquean la reproducción automática. 
            Haz clic en "Play Music" para iniciar.
            <span style="float: right; font-weight: bold;">×</span>
        `;
        message.addEventListener('click', () => message.remove());
        setTimeout(() => message.parentNode && message.remove(), 10000);
        document.body.appendChild(message);
    }

    function playSound(soundName) {
        const sounds = {
            cash: '/static/market/sounds/vo_goblinmale_threaten_01.ogg'
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

    document.addEventListener('DOMContentLoaded', () => {
        loadMusicPreferences();

        const volumeSlider = document.getElementById('volume-slider');
        if (volumeSlider) {
            volumeSlider.value = currentVolume;
            volumeSlider.addEventListener('input', e => updateVolume(parseInt(e.target.value, 10)));
        }

        updateVolume(currentVolume);

        if (isMusicPlaying) {
            setTimeout(() => playRandomMusic(), 500);
        }

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
            window.addEventListener('mouseup', () => { isDown = false; });
            progress.addEventListener('mousemove', (e) => { if (isDown) seekAtClientX(e.clientX); });
        }
    });

    window.App = window.App || {};
    window.App.audio = { playSound, toggleMusic, playNext, playPrev };
})();

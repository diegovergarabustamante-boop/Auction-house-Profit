(() => {
    const musicTracks = [
        '/static/market/music/mus_80_goblingreed_a.mp3',
        '/static/market/music/mus_80_goblingreed_c.mp3',
        '/static/market/music/mus_80_motherlode_d.mp3',
        '/static/market/music/mus_80_motherlode_e.mp3',
        '/static/market/music/mus_80_motherlode_h.mp3'
    ];

    const trackNames = {
        '/static/market/music/mus_80_goblingreed_a.mp3': 'Goblin Greed A',
        '/static/market/music/mus_80_goblingreed_c.mp3': 'Goblin Greed C',
        '/static/market/music/mus_80_motherlode_d.mp3': 'Motherlode D',
        '/static/market/music/mus_80_motherlode_e.mp3': 'Motherlode E',
        '/static/market/music/mus_80_motherlode_h.mp3': 'Motherlode H'
    };

    let currentAudio = null;
    let isMusicPlaying = false;
    let currentTrackIndex = -1;
    let currentVolume = 10;
    let animationInterval = null;

    function playRandomMusic() {
        if (!musicTracks.length) return;
        if (currentAudio) {
            currentAudio.pause();
            currentAudio.currentTime = 0;
        }

        let randomIndex;
        do {
            randomIndex = Math.floor(Math.random() * musicTracks.length);
        } while (musicTracks.length > 1 && randomIndex === currentTrackIndex);

        currentTrackIndex = randomIndex;
        const selectedTrack = musicTracks[randomIndex];

        currentAudio = new Audio(selectedTrack);
        currentAudio.volume = currentVolume / 100;
        currentAudio.loop = false;

        currentAudio.addEventListener('ended', () => {
            if (isMusicPlaying) setTimeout(playRandomMusic, 1000);
        });

        currentAudio.addEventListener('error', () => {
            if (isMusicPlaying) setTimeout(playRandomMusic, 1000);
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
        btn.textContent = isMusicPlaying ? '🎵 Pause Music' : '🎵 Play Music';
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

    function updateCurrentTrackDisplay(trackPath) {
        const trackNameElement = document.getElementById('current-track-name');
        if (trackNameElement && trackNames[trackPath]) {
            trackNameElement.textContent = trackNames[trackPath];
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
            setTimeout(playRandomMusic, 500);
        }

        document.getElementById('music-toggle-btn')?.addEventListener('click', toggleMusic);
    });

    window.App = window.App || {};
    window.App.audio = { playSound, toggleMusic };
})();

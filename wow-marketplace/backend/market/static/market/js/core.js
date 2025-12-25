(() => {
    // Core bootstrap: expone CSRF y namespace global
    const csrfInput = document.querySelector('[name=csrfmiddlewaretoken]');
    window.App = window.App || {};
    window.App.csrf = csrfInput?.value || '';

    // Background rotation with fade every 60s; random start and random next (no immediate repeat)
    const backgrounds = [
        'url("https://cdnb.artstation.com/p/assets/covers/images/001/621/567/large/tim-moreels-nomarmosetviewericon.jpg")',
        'url("https://media1.tenor.com/m/3J4hRqiyeSgAAAAd/saulgoodman.gif")',
        'url("https://media1.tenor.com/m/sHQ-pT6yhg8AAAAC/spongebob-spongebob-meme.gif")',
        'url("https://media1.tenor.com/m/spgJsx_4cdoAAAAd/me-atrapaste-es-cine.gif")',
        'url("https://media1.tenor.com/m/k5BTUcSUKMQAAAAd/xd-dies-of-death.gif")',
        'url("https://media1.tenor.com/m/jqhZW_ACkWIAAAAd/momazos-diego-squidward.gif")',
        'url("https://media.tenor.com/V6jqxJCfYC4AAAAi/bussin-it-down-spongey-bob-me-boy.gif")',
        'url("https://media1.tenor.com/m/LcQNUPrHt4sAAAAC/fresh-orc-smile-wow-world-of-warcraft-purge-wcb.gif")',
        'url("https://media1.tenor.com/m/7SO-GR-eTqYAAAAd/garrosh-orgrimmar.gif")',
        'url("https://media1.tenor.com/m/4D75yMGLh24AAAAC/peace-later.gif")',
        'url("https://media1.tenor.com/m/hvh0ucb7o-4AAAAd/sonic-devil.gif")',
        'url("https://media1.tenor.com/m/JRJPU6H35PwAAAAd/spider-man-spider-man-web-of-shadows.gif")',
        'url("https://media1.tenor.com/m/_Zlm80sUQC4AAAAd/spiderman-negro-spiderman-triste.gif")',
        'url("https://media1.tenor.com/m/HwkPm6f1yzIAAAAd/yuimetal.gif")',
        'url("https://media1.tenor.com/m/2cFMeeskpv0AAAAC/dbz-fusion-dance.gif")',
        'url("https://media1.tenor.com/m/TmbNLu_okcUAAAAd/grey-matter-ben10.gif")',
        'url("https://media1.tenor.com/m/8hhcv8w_1uUAAAAd/bugs-bunny.gif")',
        'url("https://media1.tenor.com/m/_1tDr_uE8OQAAAAd/dance-weekend-vibe.gif")',
        'url("https://media1.tenor.com/m/Jpw_s2N6Nh8AAAAd/ai-sponge-moderators-ai.gif")',
        'url("https://media.tenor.com/lF9mqxWdAY0AAAAj/carl-wheezer-shaggy.gif")'
    ];
    const SAUL_BACKGROUND_URL = 'https://media1.tenor.com/m/3J4hRqiyeSgAAAAd/saulgoodman.gif';
    let bgIndex = Math.floor(Math.random() * backgrounds.length);
    
    // Animaciones de transición disponibles
    const animations = [
        'fade-animation',
        'slide-top-animation',
        'slide-bottom-animation',
        'slide-left-animation',
        'slide-right-animation',
        'zoom-in-animation',
        'zoom-out-animation',
        'rotate-animation',
        'blur-animation',
        'bounce-animation',
        'diagonal-animation'
    ];
    
    function pickRandomAnimation() {
        return animations[Math.floor(Math.random() * animations.length)];
    }

    // Extract raw URL from css url() format
    function rawUrlFromCss(urlCss) {
        const match = urlCss.match(/url\("(.+?)"\)/);
        return match ? match[1] : urlCss;
    }

    // Load image and get natural dimensions
    function getImageNaturalSize(url) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
            img.onerror = () => resolve({ width: 1, height: 1 });
            img.src = url;
        });
    }

    // Determine size mode based on image aspect ratio vs viewport
    function chooseSizeByAspect(imgWidth, imgHeight) {
        const viewportRatio = window.innerWidth / window.innerHeight;
        const imageRatio = imgWidth / imgHeight;
        const diff = Math.abs(viewportRatio - imageRatio);
        
        // If ratio difference is > 0.15, use cover (fill screen); else use contain (see full content)
        if (diff > 0.15) {
            console.log('🖼️ Aspect difference too large (' + diff.toFixed(2) + '), using cover');
            return 'cover';
        } else {
            console.log('🖼️ Aspect ratio close (' + diff.toFixed(2) + '), using contain');
            return 'contain';
        }
    }

    // Determine background-size based on file type and content
    function computeBgSizeFor(urlCss) {
        const rawUrl = rawUrlFromCss(urlCss);
        // GIFs typically need dynamic sizing; images might use cover
        if (rawUrl.toLowerCase().includes('.gif')) {
            return 'dynamic'; // Will be calculated later
        }
        return 'cover'; // Default for static images
    }

    function ensureFader() {
        let fader = document.getElementById('bg-fader');
        if (!fader) {
            fader = document.createElement('div');
            fader.id = 'bg-fader';
            document.body.appendChild(fader);
        }
        return fader;
    }

    const applyBg = async (idx) => {
        try {
            const bgUrl = backgrounds[idx % backgrounds.length];
            const rawUrl = rawUrlFromCss(bgUrl);
            console.log('🔄 Intento de cambio de fondo → [' + idx + '] ' + rawUrl);
            
            // Apply image immediately
            document.body.style.setProperty('--bg-image', bgUrl);
            
            // Get natural size for GIFs
            const sizeMode = computeBgSizeFor(bgUrl);
            let finalSize = sizeMode;
            let width = '?', height = '?';
            
            if (sizeMode === 'dynamic') {
                const dims = await getImageNaturalSize(rawUrl);
                width = dims.width;
                height = dims.height;
                finalSize = chooseSizeByAspect(width, height);
                console.log('ℹ️ Tamaño elegido para fader: ' + finalSize + ' (img ' + width + 'x' + height + ')');
            }
            
            document.body.style.setProperty('--bg-size', finalSize);
            console.log('✅ Fondo aplicado → [' + idx + '] ' + rawUrl + ' | size: ' + finalSize + ' (img ' + width + 'x' + height + ')');
        } catch (e) {
            console.error('Error applying background:', e);
        }
    };

    function pickRandomNext(current) {
        if (backgrounds.length <= 1) return current;
        let next;
        do {
            next = Math.floor(Math.random() * backgrounds.length);
        } while (next === current);
        return next;
    }

    function rotateWithFade() {
        const fader = ensureFader();
        const nextIndex = pickRandomNext(bgIndex);
        const nextBgUrl = backgrounds[nextIndex % backgrounds.length];
        const nextRawUrl = rawUrlFromCss(nextBgUrl);
        const animation = pickRandomAnimation();
        
        console.log('🔀 Rotación iniciada → [' + nextIndex + '] ' + nextRawUrl);
        console.log('✨ Animación seleccionada: ' + animation);
        
        fader.style.backgroundImage = nextBgUrl;
        // Clear previous animation classes
        fader.className = '';
        
        // Pre-compute size if dynamic
        (async () => {
            const sizeMode = computeBgSizeFor(nextBgUrl);
            let finalSize = sizeMode;
            
            if (sizeMode === 'dynamic') {
                const { width, height } = await getImageNaturalSize(nextRawUrl);
                finalSize = chooseSizeByAspect(width, height);
                console.log('ℹ️ Tamaño elegido para fader: ' + finalSize + ' (img ' + width + 'x' + height + ')');
            }
            
            document.body.style.setProperty('--bg-size', finalSize);
            
            // Apply animation
            fader.classList.add(animation);
            
            setTimeout(() => {
                applyBg(nextIndex);
                // Remove animation and hide fader
                fader.classList.remove(animation);
                fader.style.opacity = '0';
                bgIndex = nextIndex;
                console.log('🔁 Cambio de fondo → [' + nextIndex + '] ' + nextRawUrl);
                
                // Check if rotated to Saul Goodman and if music is active
                const isSaulBg = nextBgUrl.includes(SAUL_BACKGROUND_URL);
                if (isSaulBg) {
                    console.log('🎤 Trigger: Saul Goodman background detected');
                    triggerGoodmanTrack();
                }
            }, 800);
        })();
    }

    function triggerGoodmanTrack() {
        // Dispatch event to trigger goodman track if music is playing
        window.dispatchEvent(new CustomEvent('playGoodman', { detail: { url: '/static/market/music/goodman.mp3' } }));
    }

    document.addEventListener('DOMContentLoaded', () => {
        // Initial random background
        applyBg(bgIndex);
        // Schedule rotations
        setInterval(rotateWithFade, 60_000);
    });
})();

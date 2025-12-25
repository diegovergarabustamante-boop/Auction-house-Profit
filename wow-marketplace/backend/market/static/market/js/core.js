(() => {
    // Core bootstrap: expone CSRF y namespace global
    const csrfInput = document.querySelector('[name=csrfmiddlewaretoken]');
    window.App = window.App || {};
    window.App.csrf = csrfInput?.value || '';

    // Background rotation with fade every 60s; random start and random next (no immediate repeat)
    const backgrounds = [
        'url("https://cdnb.artstation.com/p/assets/covers/images/001/621/567/large/tim-moreels-nomarmosetviewericon.jpg")',
        'url("https://media1.tenor.com/m/3J4hRqiyeSgAAAAd/saulgoodman.gif")'
    ];
    let bgIndex = Math.floor(Math.random() * backgrounds.length);

    function ensureFader() {
        let fader = document.getElementById('bg-fader');
        if (!fader) {
            fader = document.createElement('div');
            fader.id = 'bg-fader';
            document.body.appendChild(fader);
        }
        return fader;
    }

    const applyBg = (idx) => {
        try {
            document.body.style.setProperty('--bg-image', backgrounds[idx % backgrounds.length]);
        } catch (e) {}
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
        fader.style.backgroundImage = backgrounds[nextIndex];
        fader.style.opacity = '1';
        setTimeout(() => {
            applyBg(nextIndex);
            fader.style.opacity = '0';
            bgIndex = nextIndex;
        }, 800);
    }

    document.addEventListener('DOMContentLoaded', () => {
        // Initial random background
        applyBg(bgIndex);
        // Schedule rotations
        setInterval(rotateWithFade, 60_000);
    });
})();

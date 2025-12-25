(() => {
    document.addEventListener('DOMContentLoaded', () => {
        const playSound = window.App?.audio?.playSound;
        document.querySelectorAll('.collapsible').forEach(title => {
            title.addEventListener('click', () => {
                const container = title.nextElementSibling;
                if (!container) return;
                container.style.display = container.style.display === 'none' ? 'block' : 'none';
                title.classList.toggle('active');
                playSound?.('cash');
            });
        });
    });
})();

(() => {
    // Core bootstrap: expone CSRF y namespace global
    const csrfInput = document.querySelector('[name=csrfmiddlewaretoken]');
    window.App = window.App || {};
    window.App.csrf = csrfInput?.value || '';
})();

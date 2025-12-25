(() => {
    const csrf = window.App?.csrf || '';

    function loadConfiguration() {
        try {
            fetch('/api/config/')
                .then(response => response.json())
                .then(data => {
                    if (!data.ok) throw new Error(data.error || 'Error cargando configuración');

                    const config = data.config;
                    const realms = document.getElementById('realms-textarea');
                    const maxRealms = document.getElementById('max-realms-input');
                    const devMode = document.getElementById('dev-mode-checkbox');

                    if (realms) realms.value = config.realms_to_scan.join('\n');
                    if (maxRealms) maxRealms.value = config.max_realms_to_scan;
                    if (devMode) devMode.checked = config.dev_mode;

                    toggleMaxRealmsVisibility();
                })
                .catch(error => {
                    console.error('❌ Error loading configuration:', error);
                    loadDefaultConfiguration();
                });
        } catch (error) {
            console.error('❌ Error loading configuration:', error);
            loadDefaultConfiguration();
        }
    }

    function loadDefaultRealms() {
        if (!confirm('Load default realms?\nThis will replace your current list.')) return;
        const defaultRealms = [
            'Stormrage', 'Area 52', 'Moon Guard',
            'Ragnaros', 'Dalaran', 'Zul\'jin', 'Proudmoore'
        ];
        const realms = document.getElementById('realms-textarea');
        if (realms) realms.value = defaultRealms.join('\n');
    }

    function saveConfiguration() {
        try {
            const realmsText = document.getElementById('realms-textarea')?.value || '';
            const realms = realmsText.split('\n').map(r => r.trim()).filter(Boolean);

            const configData = {
                max_realms_to_scan: parseInt(document.getElementById('max-realms-input')?.value || '0', 10) || 0,
                realms_to_scan: realms,
                dev_mode: !!document.getElementById('dev-mode-checkbox')?.checked
            };

            if (configData.max_realms_to_scan < 0) {
                alert('❌ Max realms to scan must be 0 or positive');
                return;
            }

            if (!configData.realms_to_scan.length) {
                alert('❌ Please add at least one realm to scan');
                return;
            }

            const saveBtn = document.getElementById('save-config-btn');
            const statusDiv = document.getElementById('config-status');
            const originalText = saveBtn?.textContent;

            if (saveBtn) {
                saveBtn.disabled = true;
                saveBtn.textContent = '⏳ Saving...';
            }

            fetch('/api/update-config/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrf
                },
                body: JSON.stringify(configData)
            })
                .then(response => response.json())
                .then(data => {
                    if (!data.ok) throw new Error(data.error || 'Error desconocido');

                    if (statusDiv) {
                        statusDiv.textContent = '✅ Configuration saved successfully';
                        statusDiv.style.backgroundColor = '#10b981';
                        statusDiv.style.color = 'white';
                        statusDiv.style.display = 'block';
                        setTimeout(() => statusDiv.style.display = 'none', 3000);
                    }
                })
                .catch(error => {
                    if (statusDiv) {
                        statusDiv.textContent = `❌ Error: ${error.message}`;
                        statusDiv.style.backgroundColor = '#ef4444';
                        statusDiv.style.color = 'white';
                        statusDiv.style.display = 'block';
                    }
                })
                .finally(() => {
                    if (saveBtn) {
                        saveBtn.disabled = false;
                        saveBtn.textContent = originalText;
                    }
                });
        } catch (error) {
            alert('❌ Error guardando configuración: ' + error.message);
        }
    }

    function loadDefaultConfiguration() {
        const realms = document.getElementById('realms-textarea');
        const maxRealms = document.getElementById('max-realms-input');
        const devMode = document.getElementById('dev-mode-checkbox');
        if (realms) realms.value = '';
        if (maxRealms) maxRealms.value = 0;
        if (devMode) devMode.checked = true;
        toggleMaxRealmsVisibility();
    }

    function resetConfiguration() {
        if (!confirm('Restore all default values?\nThis will include realms, scanning and other settings.')) return;
        loadDefaultConfiguration();
        const statusDiv = document.getElementById('config-status');
        if (statusDiv) {
            statusDiv.textContent = '✅ Valores por defecto restaurados';
            statusDiv.style.backgroundColor = '#3b82f6';
            statusDiv.style.color = 'white';
            statusDiv.style.display = 'block';
            setTimeout(() => statusDiv.style.display = 'none', 2000);
        }
    }

    function toggleMaxRealmsVisibility() {
        const checkbox = document.getElementById('dev-mode-checkbox');
        const maxRealmsRow = document.querySelector('#max-realms-input')?.closest('tr');
        if (!checkbox || !maxRealmsRow) return;
        maxRealmsRow.style.display = checkbox.checked ? 'none' : '';
    }

    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(loadConfiguration, 500);
        document.getElementById('save-config-btn')?.addEventListener('click', saveConfiguration);
        document.getElementById('reset-config-btn')?.addEventListener('click', resetConfiguration);
        document.getElementById('load-default-realms-btn')?.addEventListener('click', loadDefaultRealms);
        document.getElementById('dev-mode-checkbox')?.addEventListener('change', toggleMaxRealmsVisibility);
    });
})();

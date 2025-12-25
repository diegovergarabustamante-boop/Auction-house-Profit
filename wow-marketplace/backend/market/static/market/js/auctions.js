(() => {
    const csrf = window.App?.csrf || '';

    let poller = null;
    let wasRunning = false;

    function startPolling(updateStatus) {
        if (!poller) {
            poller = setInterval(updateStatus, 2000);
            const panel = document.getElementById('auction-status');
            if (panel) panel.style.display = 'block';
        }
    }

    function stopPolling() {
        if (poller) {
            clearInterval(poller);
            poller = null;
        }
        setTimeout(() => {
            const panel = document.getElementById('auction-status');
            if (panel) panel.style.display = 'none';
        }, 5000);
    }

    function buildStatusUpdater(updateBtn) {
        return function updateStatus() {
            fetch('/api/auction-status/')
                .then(r => {
                    if (!r.ok) throw new Error(`HTTP ${r.status}`);
                    return r.json();
                })
                .then(data => {
                    const stateEl = document.getElementById('state');
                    const currentEl = document.getElementById('current');
                    const doneEl = document.getElementById('done');
                    const totalEl = document.getElementById('total');
                    const elapsedEl = document.getElementById('elapsed');
                    const etaEl = document.getElementById('eta');
                    const configInfoEl = document.getElementById('config-info');

                    if (data.running) {
                        wasRunning = true;
                        if (stateEl) stateEl.innerText = 'Running';
                        if (currentEl) currentEl.innerText = data.current || '-';
                        if (doneEl) doneEl.innerText = data.done || 0;
                        if (totalEl) totalEl.innerText = data.total || 0;
                        if (elapsedEl) elapsedEl.innerText = data.elapsed || 0;
                        if (etaEl) etaEl.innerText = data.eta || 0;
                        if (configInfoEl) configInfoEl.textContent = data.config_info || '';
                        if (updateBtn) {
                            updateBtn.disabled = true;
                            updateBtn.textContent = '⏳ Escaneando...';
                        }
                    } else {
                        if (stateEl) stateEl.innerText = 'Idle';
                        if (updateBtn) {
                            updateBtn.disabled = false;
                            updateBtn.textContent = '🔄 Update Auctions';
                        }
                        stopPolling();
                        if (wasRunning) {
                            wasRunning = false;
                            setTimeout(() => location.reload(), 1000);
                        }
                    }
                })
                .catch(error => {
                    console.error('Error polling auction status:', error);
                    stopPolling();
                    if (updateBtn) {
                        updateBtn.disabled = false;
                        updateBtn.textContent = '🔄 Update Auctions';
                    }
                    const stateEl = document.getElementById('state');
                    if (stateEl) stateEl.innerText = 'Error';
                });
        };
    }

    document.addEventListener('DOMContentLoaded', () => {
        const updateBtn = document.getElementById('update-btn');
        if (!updateBtn) return;

        const updateStatus = buildStatusUpdater(updateBtn);

        updateBtn.addEventListener('click', () => {
            updateBtn.disabled = true;
            updateBtn.textContent = '⏳ Iniciando...';

            fetch('/api/update-auctions/', {
                method: 'POST',
                headers: { 'X-CSRFToken': csrf }
            })
                .then(response => {
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);
                    return response.json();
                })
                .then(data => {
                    alert(`✅ Actualización iniciada. Se crearán ${data.created || 0} snapshots`);
                    startPolling(updateStatus);
                })
                .catch(error => {
                    alert('❌ Error al iniciar la actualización: ' + error.message);
                    updateBtn.disabled = false;
                    updateBtn.textContent = '🔄 Update Auctions';
                });
        });
    });
})();

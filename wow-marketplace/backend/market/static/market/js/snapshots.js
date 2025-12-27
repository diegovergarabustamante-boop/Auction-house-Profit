(() => {
    const csrf = window.App?.csrf || '';
    const formatDateToLocal = window.App?.utils?.formatDateToLocal;
    const convertAllDates = window.App?.utils?.convertAllDates;

    function updateArbitrageResults(snapshots) {
        const tableBody = document.querySelector('#arbitrage-results-container tbody');
        if (!tableBody) return;

        if (!snapshots || !snapshots.length) {
            tableBody.innerHTML = '<tr><td colspan="10" style="text-align: center;">No hay snapshots disponibles</td></tr>';
            return;
        }

        tableBody.innerHTML = '';

        snapshots.forEach(s => {
            const row = document.createElement('tr');
            const localDate = formatDateToLocal ? formatDateToLocal(s.created_at) : s.created_at;
            row.innerHTML = `
                <td><input type="checkbox" class="snapshot-check" value="${s.id}"></td>
                <td>${s.blizzard_id || '-'}</td>
                <td>${s.item_name}</td>
                <td>
                    <img src="https://wow.zamimg.com/images/wow/icons/large/inv_misc_rune_01.jpg"
                        alt="${s.item_name} icon"
                        style="width: 50px; height: 50px;">
                </td>
                <td class="date-cell" data-iso-date="${s.created_at}">${localDate}</td>
                <td>${s.best_buy_realm}</td>
                <td>${s.buy_price} g</td>
                <td>${s.best_sell_realm}</td>
                <td>${s.estimated_sell_price} g</td>
                <td class="profit">${s.profit} g</td>
            `;
            tableBody.appendChild(row);
        });

        const selectAllCheckbox = document.getElementById('select-all-snapshots');
        if (selectAllCheckbox) {
            selectAllCheckbox.addEventListener('change', e => {
                document.querySelectorAll('.snapshot-check').forEach(cb => cb.checked = e.target.checked);
            });
        }

        if (convertAllDates) convertAllDates();
    }

    function deleteSelected() {
        const ids = [...document.querySelectorAll('.snapshot-check:checked')].map(cb => cb.value);
        if (!ids.length) return alert('Nada seleccionado');
        if (!confirm('Are you sure to delete selected snapshots? This action cannot be undone.')) return;

        fetch('/api/delete-snapshots/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrf
            },
            body: JSON.stringify({ ids })
        })
            .then(response => response.json())
            .then(data => {
                if (data.deleted > 0) {
                    ids.forEach(id => document.querySelector(`#snapshot-row-${id}`)?.remove());
                    updateArbitrageResults(data.snapshots);
                } else {
                    alert('No se eliminaron snapshots');
                }
            })
            .catch(error => {
                console.error('❌ Error al eliminar los snapshots:', error);
                alert('Hubo un error al eliminar los snapshots.');
            });
    }

    function deleteAllSnapshots() {
        if (!confirm('Eliminar TODOS los snapshots?')) return;
        fetch('/api/delete-all-snapshots/', {
            method: 'POST',
            headers: { 'X-CSRFToken': csrf }
        }).then(() => location.reload());
    }

    document.addEventListener('DOMContentLoaded', () => {
        document.getElementById('delete-selected')?.addEventListener('click', deleteSelected);
        document.getElementById('delete-all')?.addEventListener('click', deleteAllSnapshots);
        document.getElementById('select-all-snapshots')?.addEventListener('change', e => {
            document.querySelectorAll('.snapshot-check').forEach(cb => cb.checked = e.target.checked);
        });

        // Funcionalidad para expandir/colapsar top realms
        document.querySelectorAll('.arbitrage-row').forEach(row => {
            row.addEventListener('click', (e) => {
                // No expandir si se hizo click en el checkbox
                if (e.target.classList.contains('snapshot-check')) return;
                
                const snapshotId = row.dataset.snapshotId;
                const detailsRow = document.getElementById(`top-realms-${snapshotId}`);
                const arrow = row.querySelector('td:nth-child(3) span');
                
                if (detailsRow) {
                    const isVisible = detailsRow.style.display !== 'none';
                    detailsRow.style.display = isVisible ? 'none' : 'table-row';
                    
                    // Cambiar el icono de la flecha
                    if (arrow) {
                        arrow.textContent = isVisible ? '▶' : '▼';
                    }
                }
            });
        });
    });
})();

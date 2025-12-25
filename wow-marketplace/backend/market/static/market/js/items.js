(() => {
    const csrf = window.App?.csrf || '';

    function attachDeleteItemListeners() {
        document.querySelectorAll('.delete-item-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const itemId = e.target.dataset.id;
                if (!itemId) return;
                if (!confirm('Eliminar completamente este item?')) return;

                fetch('/api/delete-item/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': csrf
                    },
                    body: JSON.stringify({ item_id: itemId })
                })
                    .then(r => r.json())
                    .then(data => {
                        if (data.ok) {
                            document.getElementById(`item-row-${itemId}`)?.remove();
                        } else {
                            alert('Error: ' + (data.error || 'No se pudo eliminar'));
                        }
                    });
            });
        });
    }

    function saveTracked() {
        const ids = [...document.querySelectorAll('.item-check:checked')].map(cb => cb.value);
        fetch('/api/update-tracked-items/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrf
            },
            body: JSON.stringify({ item_ids: ids })
        }).then(() => {
            alert('✅ Items a escanear actualizados');
            location.reload();
        });
    }

    function deleteSelectedItems() {
        const ids = [...document.querySelectorAll('.item-check:checked')].map(cb => cb.value);
        if (!ids.length) return alert('Nada seleccionado');
        if (!confirm('Delete selected items?')) return;

        fetch('/api/delete-multiple-items/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrf
            },
            body: JSON.stringify({ item_ids: ids })
        })
            .then(r => r.json())
            .then(data => {
                if (data.ok) {
                    alert(`✅ ${data.deleted_count} items eliminados`);
                    ids.forEach(id => document.getElementById(`item-row-${id}`)?.remove());
                } else {
                    alert('Error: ' + (data.error || 'No se pudieron eliminar'));
                }
            });
    }

    function deleteAllItems() {
        if (!confirm('Eliminar TODOS los items?')) return;
        fetch('/api/delete-all-items/', {
            method: 'POST',
            headers: { 'X-CSRFToken': csrf }
        }).then(() => location.reload());
    }

    document.addEventListener('DOMContentLoaded', () => {
        document.getElementById('select-all-items')?.addEventListener('change', e => {
            document.querySelectorAll('.item-check').forEach(cb => cb.checked = e.target.checked);
        });

        document.getElementById('save-tracked')?.addEventListener('click', saveTracked);
        document.getElementById('delete-selected-items')?.addEventListener('click', deleteSelectedItems);
        document.getElementById('delete-all-items')?.addEventListener('click', deleteAllItems);

        attachDeleteItemListeners();
    });
})();

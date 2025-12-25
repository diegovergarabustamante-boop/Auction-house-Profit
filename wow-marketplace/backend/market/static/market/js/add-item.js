(() => {
    const csrf = window.App?.csrf || '';

    function addItem() {
        try {
            const name = document.getElementById('new-item-name')?.value.trim() || '';
            const prof = document.getElementById('new-item-profession')?.value || '';
            const isDecor = !!document.getElementById('new-item-decor')?.checked;

            if (!name) {
                alert('❌ Por favor, escribe un nombre de item');
                document.getElementById('new-item-name')?.focus();
                return;
            }

            if (name.length > 255) {
                alert('❌ El nombre del item es demasiado largo (máximo 255 caracteres)');
                return;
            }

            const addBtn = document.getElementById('add-item-btn');
            const originalText = addBtn?.textContent;
            if (addBtn) {
                addBtn.disabled = true;
                addBtn.textContent = '⏳ Agregando...';
            }

            fetch('/api/add-item/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrf
                },
                body: JSON.stringify({ name, profession_id: prof, is_decor: isDecor })
            })
                .then(response => {
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);
                    return response.json();
                })
                .then(data => {
                    if (!data.ok) throw new Error(data.error || 'Error desconocido del servidor');
                    alert(`✅ Item "${name}" agregado exitosamente`);
                    const nameInput = document.getElementById('new-item-name');
                    const profSelect = document.getElementById('new-item-profession');
                    const decorCheck = document.getElementById('new-item-decor');
                    if (nameInput) nameInput.value = '';
                    if (profSelect) profSelect.value = '';
                    if (decorCheck) decorCheck.checked = false;
                    setTimeout(() => location.reload(), 1000);
                })
                .catch(error => {
                    alert('❌ Error al agregar el item: ' + error.message);
                })
                .finally(() => {
                    if (addBtn) {
                        addBtn.disabled = false;
                        addBtn.textContent = originalText;
                    }
                });
        } catch (error) {
            alert('❌ Error inesperado: ' + error.message);
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        document.getElementById('add-item-btn')?.addEventListener('click', addItem);
    });
})();

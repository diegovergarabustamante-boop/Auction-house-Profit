(() => {
    const csrf = window.App?.csrf || '';

    let itemsToProcess = [];
    let currentProcessingIndex = 0;
    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    function normalizeProfession(professionName) {
        if (!professionName) return null;

        const professionMap = {
            'alquimia': 'Alchemy',
            'herrería': 'Blacksmithing',
            'encantamiento': 'Enchanting',
            'ingeniería': 'Engineering',
            'herboristería': 'Herbalism',
            'inscripción': 'Inscription',
            'joyería': 'Jewelcrafting',
            'pelambre': 'Leatherworking',
            'minería': 'Mining',
            'desuello': 'Skinning',
            'sastrería': 'Tailoring',
            'cocina': 'Cooking',
            'pesca': 'Fishing',
            'arqueología': 'Archaeology',
            'alchemy': 'Alchemy',
            'blacksmithing': 'Blacksmithing',
            'enchanting': 'Enchanting',
            'engineering': 'Engineering',
            'herbalism': 'Herbalism',
            'inscription': 'Inscription',
            'jewelcrafting': 'Jewelcrafting',
            'leatherworking': 'Leatherworking',
            'mining': 'Mining',
            'skinning': 'Skinning',
            'tailoring': 'Tailoring',
            'cooking': 'Cooking',
            'fishing': 'Fishing',
            'archaeology': 'Archaeology'
        };

        const normalized = professionName.toLowerCase();
        return professionMap[normalized] || professionName;
    }

    const professionKeywords = [
        'alchemy', 'alquimia', 'blacksmithing', 'herrería', 'enchanting', 'encantamiento',
        'engineering', 'ingeniería', 'herbalism', 'herboristería', 'inscription', 'inscripción',
        'jewelcrafting', 'joyería', 'leatherworking', 'pelambre', 'mining', 'minería',
        'skinning', 'desuello', 'tailoring', 'sastrería', 'cooking', 'cocina',
        'fishing', 'pesca', 'archaeology', 'arqueología'
    ];

    function parseTxtContent(content) {
        const lines = content.split('\n');
        const items = [];

        lines.forEach((line, index) => {
            const trimmedLine = line.trim();
            if (!trimmedLine || trimmedLine.startsWith('#')) return;
            if (trimmedLine.length > 255) return;

            const parts = trimmedLine.split(',').map(part => part.trim());
            if (parts.length === 0) return;

            let itemName = parts[0];
            let isDecor = false;
            let profession = null;

            for (let i = 1; i < parts.length; i++) {
                const part = parts[i].toLowerCase();
                if (part === 'decor') {
                    isDecor = true;
                } else if (professionKeywords.includes(part) && !profession) {
                    profession = normalizeProfession(parts[i]);
                } else if (i === 1) {
                    itemName += `, ${parts[i]}`;
                }
            }

            if (!itemName) return;

            items.push({
                name: itemName,
                isDecor,
                profession,
                originalLine: trimmedLine,
                lineNumber: index + 1
            });
        });

        const decorCount = items.filter(item => item.isDecor).length;
        const professionCount = items.filter(item => item.profession).length;
        console.log(`📊 Resumen parsing: ${items.length} items, ${decorCount} decorativos, ${professionCount} con profesión`);

        return items;
    }

    function handleFileSelect(event) {
        try {
            const file = event.target.files?.[0];
            if (!file) return;

            if (!file.name.endsWith('.txt')) {
                alert('❌ Solo se permiten archivos .txt');
                event.target.value = '';
                return;
            }

            if (file.size > 100 * 1024) {
                alert('❌ El archivo es demasiado grande (máximo 100KB)');
                event.target.value = '';
                return;
            }

            const reader = new FileReader();

            reader.onload = (e) => {
                try {
                    const content = e.target?.result;
                    itemsToProcess = parseTxtContent(String(content));

                    if (!itemsToProcess.length) {
                        alert('❌ No se encontraron items válidos en el archivo');
                        const info = document.getElementById('file-info');
                        if (info) info.style.display = 'none';
                        return;
                    }

                    const fileInfo = document.getElementById('file-info');
                    if (!fileInfo) return;

                    fileInfo.style.display = 'block';
                    document.getElementById('file-name').textContent = file.name;
                    document.getElementById('item-count').textContent = itemsToProcess.length;

                    const withProfession = itemsToProcess.filter(item => item.profession).length;
                    const withDecor = itemsToProcess.filter(item => item.isDecor).length;

                    const details = document.createElement('div');
                    details.id = 'file-details';
                    details.style.cssText = 'font-size: 0.8em; margin-top: 5px; color: #a5b4fc;';
                    details.innerHTML = `<div>📊 ${withProfession} con profesión | ${withDecor} decorativos</div>`;

                    const existing = document.getElementById('file-details');
                    if (!existing) {
                        fileInfo.appendChild(details);
                    } else {
                        existing.innerHTML = details.innerHTML;
                    }

                    successCount = 0;
                    errorCount = 0;
                    skippedCount = 0;
                    currentProcessingIndex = 0;
                } catch (parseError) {
                    alert('❌ Error al leer el archivo: ' + parseError.message);
                    const info = document.getElementById('file-info');
                    if (info) info.style.display = 'none';
                }
            };

            reader.onerror = () => {
                alert('❌ Error al leer el archivo');
                const info = document.getElementById('file-info');
                if (info) info.style.display = 'none';
            };

            reader.readAsText(file, 'UTF-8');
        } catch (error) {
            alert('❌ Error inesperado al cargar el archivo: ' + error.message);
        }
    }

    function processTxtFile() {
        try {
            if (!itemsToProcess?.length) {
                alert('❌ No hay items para procesar. Primero carga un archivo TXT válido.');
                return;
            }

            if (itemsToProcess.length > 100) {
                const confirmProcess = confirm(`⚠️ You are about to process ${itemsToProcess.length} items. This may take time.\nContinue?`);
                if (!confirmProcess) return;
            }

            const processingStatus = document.getElementById('processing-status');
            if (processingStatus) processingStatus.style.display = 'block';
            const successEl = document.getElementById('success-count');
            const errorEl = document.getElementById('error-count');
            if (successEl) successEl.style.display = 'none';
            if (errorEl) errorEl.style.display = 'none';

            const skippedElement = document.getElementById('skipped-count');
            if (skippedElement) skippedElement.remove();

            successCount = 0;
            errorCount = 0;
            skippedCount = 0;
            currentProcessingIndex = 0;

            const loadBtn = document.getElementById('load-txt-btn');
            const fileInput = document.getElementById('txt-file-input');
            if (loadBtn) {
                loadBtn.disabled = true;
                loadBtn.textContent = '⏳ Procesando...';
            }
            if (fileInput) fileInput.disabled = true;

            processNextItem();
        } catch (error) {
            alert('❌ Error al iniciar el procesamiento: ' + error.message);
        }
    }

    function processNextItem() {
        if (currentProcessingIndex >= itemsToProcess.length) {
            finishProcessing();
            return;
        }

        const item = itemsToProcess[currentProcessingIndex];

        try {
            const progressText = document.getElementById('progress-text');
            if (progressText) {
                progressText.textContent = `${currentProcessingIndex + 1}/${itemsToProcess.length} completados`;
            }

            const data = {
                name: item.name,
                is_decor: item.isDecor,
                profession_name: item.profession || ''
            };

            fetch('/api/add-item/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrf
                },
                body: JSON.stringify(data)
            })
                .then(response => {
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);
                    return response.json();
                })
                .then(data => {
                    if (data.ok) {
                        const profMsg = data.profession_name ? ` [${data.profession_name}]` : '';
                        if (data.created_item === false) {
                            skippedCount++;
                            console.log(`⏭️ Item ya existente: ${item.name}${item.isDecor ? ' (Decor)' : ''}${profMsg}`);
                        } else {
                            successCount++;
                            console.log(`✅ Item añadido: ${item.name}${item.isDecor ? ' (Decor)' : ''}${profMsg}`);
                        }
                    } else {
                        errorCount++;
                        console.error(`❌ Error en línea ${item.lineNumber}: ${item.originalLine} - ${data.error || 'Error desconocido'}`);
                    }

                    currentProcessingIndex++;
                    const delay = data.created_item === false ? 50 : 150;
                    setTimeout(processNextItem, delay);
                })
                .catch(error => {
                    errorCount++;
                    console.error(`❌ Error en línea ${item.lineNumber}: ${item.originalLine}`, error);
                    currentProcessingIndex++;
                    setTimeout(processNextItem, 150);
                });
        } catch (error) {
            errorCount++;
            console.error(`❌ Error en línea ${item.lineNumber}: "${item.originalLine}" - Error: ${error.message}`);
            currentProcessingIndex++;
            setTimeout(processNextItem, 150);
        }
    }

    function finishProcessing() {
        try {
            const successElement = document.getElementById('success-count');
            const errorElement = document.getElementById('error-count');

            if (successElement?.querySelector('span')) {
                successElement.querySelector('span').textContent = successCount;
            }
            if (errorElement?.querySelector('span')) {
                errorElement.querySelector('span').textContent = errorCount;
            }

            if (skippedCount > 0 && successElement && errorElement) {
                const skippedElement = document.createElement('div');
                skippedElement.id = 'skipped-count';
                skippedElement.style.cssText = 'color: #ffc107; margin-top: 5px; display: block;';
                skippedElement.innerHTML = `⏭️ <span>${skippedCount}</span> items ya existían`;
                successElement.parentNode.insertBefore(skippedElement, errorElement);
            }

            if (successElement) successElement.style.display = successCount > 0 ? 'block' : 'none';
            if (errorElement) errorElement.style.display = errorCount > 0 ? 'block' : 'none';

            const loadBtn = document.getElementById('load-txt-btn');
            const fileInput = document.getElementById('txt-file-input');
            if (loadBtn) {
                loadBtn.disabled = false;
                loadBtn.textContent = '📁 Cargar y Procesar TXT';
            }
            if (fileInput) fileInput.disabled = false;

            const txtInput = document.getElementById('txt-file-input');
            const fileInfo = document.getElementById('file-info');
            if (txtInput) txtInput.value = '';
            if (fileInfo) fileInfo.style.display = 'none';

            let message = `✅ **Procesamiento completado**\n\n`;
            message += `**Resultados:**\n`;
            if (successCount > 0) message += `✓ ${successCount} items añadidos exitosamente\n`;
            if (skippedCount > 0) message += `⏭️ ${skippedCount} items ya existían (activados)\n`;
            if (errorCount > 0) message += `✗ ${errorCount} errores\n`;
            if (successCount === 0 && skippedCount === 0 && errorCount === 0) message += `ℹ️ No se procesó ningún item`;

            alert(message);
            if (successCount > 0) setTimeout(() => location.reload(), 1500);
        } catch (error) {
            alert('❌ Error al finalizar el procesamiento: ' + error.message);
        }
    }

    function downloadTemplate() {
        const template = `# ==========================================
# PLANTILLA PARA CARGAR MÚLTIPLES ITEMS
# ==========================================
#
# INSTRUCCIONES:
# - Un item por línea
# - Máximo 255 caracteres por línea
# - Líneas que comienzan con # son comentarios
# - Líneas vacías se ignoran
#
# FORMATOS ACEPTADOS:
# 1. Item normal: 
#    "Nombre del item"
#
# 2. Item decorativo: 
#    "Nombre del item,decor"
#
# 3. Item con profesión: 
#    "Nombre del item,Enchanting"
#    "Nombre del item,Jewelcrafting"
#    "Nombre del item,Alquimia" (español también funciona)
#
# 4. Item decorativo con profesión: 
#    "Nombre del item,decor,Enchanting"
#    "Nombre del item,decor,Jewelcrafting"
#    "Nombre del item,decor,Alquimia"
#
# NOTA: El orden es importante:
# - Primero el nombre
# - Luego "decor" si es decorativo (opcional)
# - Luego la profesión (opcional)
#
# PROFESIONES SOPORTADAS (inglés o español):
# - Alchemy / Alquimia
# - Blacksmithing / Herrería
# - Enchanting / Encantamiento
# - Engineering / Ingeniería
# - Herbalism / Herboristería
# - Inscription / Inscripción
# - Jewelcrafting / Joyería
# - Leatherworking / Pelambre
# - Mining / Minería
# - Skinning / Desuello
# - Tailoring / Sastrería
# - Cooking / Cocina
# - Fishing / Pesca
# - Archaeology / Arqueología
#
# EJEMPLOS VÁLIDOS:
# ==========================================

# Items normales
Sword of the Valiant
Shield of Eternal Protection
Potion of Healing

# Items decorativos
Golden Statue,decor
Ancient Tapestry,decor
Crystal Prism,decor

# Items con profesión (inglés)
Enchanted Vellum,Enchanting
Golden Necklace,Jewelcrafting
Mithril Bar,Blacksmithing
Netherweave Cloth,Tailoring

# Items con profesión (español)
Poción de maná,Alquimia
Armadura de cuero,Pelambre
Varita encantada,Encantamiento

# Items decorativos con profesión
Enchanted Crystal,decor,Enchanting
Jeweled Crown,decor,Jewelcrafting
Ornate Shield,decor,Blacksmithing

# Items decorativos con profesión (español)
Tótem decorativo,decor,Alquimia
Estatua joyada,decor,Joyería

# Combinaciones complejas
Heavy Mithril Axe,Blacksmithing
Enchanted Mithril Axe,decor,Enchanting
Enchanted Golden Ring,decor,Jewelcrafting

# Puedes añadir tantos items como necesites
Último item de ejemplo
Otro item decorativo final,decor,Jewelcrafting`;

        try {
            const blob = new Blob([template], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'plantilla_items_wow.txt';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            alert('✅ Plantilla descargada correctamente');
        } catch (error) {
            alert('❌ Error al descargar la plantilla: ' + error.message);
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        document.getElementById('load-txt-btn')?.addEventListener('click', processTxtFile);
        document.getElementById('txt-file-input')?.addEventListener('change', handleFileSelect);
        document.getElementById('download-template-btn')?.addEventListener('click', downloadTemplate);
    });
})();

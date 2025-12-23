document.addEventListener("DOMContentLoaded", () => {
    const csrf = document.querySelector("[name=csrfmiddlewaretoken]").value;
    
    // ===================== VARIABLES GLOBALES =====================
    let itemsToProcess = [];
    let currentProcessingIndex = 0;
    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;
    
    // ===================== FUNCIONES AUXILIARES =====================
    function formatDateToLocal(isoDateString) {
        if (!isoDateString) return '-';
        
        try {
            const date = new Date(isoDateString);
            
            if (isNaN(date.getTime())) {
                console.error('Fecha inválida:', isoDateString);
                return 'Fecha inválida';
            }
            
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            
            return `${day}/${month} ${hours}:${minutes}`;
        } catch (error) {
            console.error('Error formateando fecha:', error, isoDateString);
            return 'Error';
        }
    }
    
    function convertAllDates() {
        try {
            const dateCells = document.querySelectorAll('.date-cell[data-iso-date]');
            
            dateCells.forEach(cell => {
                const isoDate = cell.getAttribute('data-iso-date');
                const localDate = formatDateToLocal(isoDate);
                cell.textContent = localDate;
            });
        } catch (error) {
            console.error('Error convirtiendo fechas:', error);
        }
    }
    
    convertAllDates();
    
    // ===================== FUNCIONES PARA PROCESAR TXT =====================
    // Mapeo de profesiones (inglés/español a inglés estándar)
    function normalizeProfession(professionName) {
        if (!professionName) return null;
        
        const professionMap = {
            // Español a Inglés
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
            
            // Inglés (varias formas)
            'alchemy': 'Alchemy',
            'alquimia': 'Alchemy',
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
    
    // Lista de palabras clave para profesiones (para validación)
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
            
            // Ignorar líneas vacías y comentarios
            if (!trimmedLine || trimmedLine.startsWith('#')) {
                return;
            }
            
            // Validar longitud máxima
            if (trimmedLine.length > 255) {
                console.warn(`Línea ${index + 1}: Nombre demasiado largo, omitiendo`);
                return;
            }
            
            // Parsear la línea separando por comas
            const parts = trimmedLine.split(',').map(part => part.trim());
            
            if (parts.length === 0) {
                console.warn(`Línea ${index + 1}: Línea vacía después de trim, omitiendo`);
                return;
            }
            
            let itemName = parts[0];
            let isDecor = false;
            let profession = null;
            
            // Analizar las partes restantes (a partir del índice 1)
            for (let i = 1; i < parts.length; i++) {
                const part = parts[i].toLowerCase();
                
                // Verificar si es "decor"
                if (part === 'decor') {
                    isDecor = true;
                }
                // Verificar si es una profesión
                else if (professionKeywords.includes(part)) {
                    if (!profession) { // Solo tomar la primera profesión encontrada
                        profession = normalizeProfession(parts[i]); // Usar el texto original para normalizar
                    }
                }
                // Si no es ni decor ni profesión conocida, y es la primera parte adicional
                // podría ser un error del usuario, pero lo agregamos al nombre
                else if (i === 1) {
                    // Podría ser un nombre con coma, lo agregamos al nombre principal
                    itemName += `, ${parts[i]}`;
                }
            }
            
            // Validar que el nombre no esté vacío
            if (!itemName) {
                console.warn(`Línea ${index + 1}: Nombre de item vacío, omitiendo`);
                return;
            }
            
            items.push({
                name: itemName,
                isDecor: isDecor,
                profession: profession,
                originalLine: trimmedLine,
                lineNumber: index + 1
            });
        });
        
        // Resumen de parsing
        const decorCount = items.filter(item => item.isDecor).length;
        const professionCount = items.filter(item => item.profession).length;
        console.log(`📊 Resumen parsing: ${items.length} items, ${decorCount} decorativos, ${professionCount} con profesión`);
        
        return items;
    }
    
    // ===================== EVENT LISTENERS PARA TXT =====================
    document.getElementById('load-txt-btn')?.addEventListener('click', processTxtFile);
    document.getElementById('txt-file-input')?.addEventListener('change', handleFileSelect);
    document.getElementById('download-template-btn')?.addEventListener('click', downloadTemplate);

    function handleFileSelect(event) {
        try {
            const file = event.target.files[0];
            if (!file) return;
            
            // Validar tipo de archivo
            if (!file.name.endsWith('.txt')) {
                alert('❌ Solo se permiten archivos .txt');
                event.target.value = '';
                return;
            }
            
            // Validar tamaño (max 100KB)
            if (file.size > 100 * 1024) {
                alert('❌ El archivo es demasiado grande (máximo 100KB)');
                event.target.value = '';
                return;
            }
            
            const reader = new FileReader();
            
            reader.onload = function(e) {
                try {
                    const content = e.target.result;
                    itemsToProcess = parseTxtContent(content);
                    
                    if (itemsToProcess.length === 0) {
                        alert('❌ No se encontraron items válidos en el archivo');
                        document.getElementById('file-info').style.display = 'none';
                        return;
                    }
                    
                    // Mostrar información del archivo
                    document.getElementById('file-info').style.display = 'block';
                    document.getElementById('file-name').textContent = file.name;
                    document.getElementById('item-count').textContent = itemsToProcess.length;
                    
                    // Contar items con profesión y decor
                    const withProfession = itemsToProcess.filter(item => item.profession).length;
                    const withDecor = itemsToProcess.filter(item => item.isDecor).length;
                    
                    // Mostrar detalles adicionales
                    const details = document.createElement('div');
                    details.id = 'file-details';
                    details.style.cssText = 'font-size: 0.8em; margin-top: 5px; color: #a5b4fc;';
                    details.innerHTML = `
                        <div>📊 ${withProfession} con profesión | ${withDecor} decorativos</div>
                    `;
                    
                    const fileInfo = document.getElementById('file-info');
                    if (!document.getElementById('file-details')) {
                        fileInfo.appendChild(details);
                    } else {
                        document.getElementById('file-details').innerHTML = details.innerHTML;
                    }
                    
                    // Resetear contadores
                    successCount = 0;
                    errorCount = 0;
                    skippedCount = 0;
                    currentProcessingIndex = 0;
                    
                    console.log(`📄 ${itemsToProcess.length} items encontrados en el archivo`);
                    
                } catch (parseError) {
                    alert('❌ Error al leer el archivo: ' + parseError.message);
                    document.getElementById('file-info').style.display = 'none';
                }
            };
            
            reader.onerror = function() {
                alert('❌ Error al leer el archivo');
                document.getElementById('file-info').style.display = 'none';
            };
            
            reader.readAsText(file, 'UTF-8');
            
        } catch (error) {
            alert('❌ Error inesperado al cargar el archivo: ' + error.message);
        }
    }

    function processTxtFile() {
        try {
            if (!itemsToProcess || itemsToProcess.length === 0) {
                alert('❌ No hay items para procesar. Primero carga un archivo TXT válido.');
                return;
            }
            
            if (itemsToProcess.length > 100) {
                if (!confirm(`⚠️ Vas a procesar ${itemsToProcess.length} items. Esto puede tomar tiempo.\n¿Continuar?`)) {
                    return;
                }
            }
            
            // Mostrar estado de procesamiento
            const processingStatus = document.getElementById('processing-status');
            processingStatus.style.display = 'block';
            document.getElementById('success-count').style.display = 'none';
            document.getElementById('error-count').style.display = 'none';
            
            // Limpiar detalles anteriores de skipped
            const skippedElement = document.getElementById('skipped-count');
            if (skippedElement) skippedElement.remove();
            
            // Resetear contadores
            successCount = 0;
            errorCount = 0;
            skippedCount = 0;
            currentProcessingIndex = 0;
            
            // Deshabilitar botón mientras se procesa
            const loadBtn = document.getElementById('load-txt-btn');
            const fileInput = document.getElementById('txt-file-input');
            loadBtn.disabled = true;
            fileInput.disabled = true;
            loadBtn.textContent = '⏳ Procesando...';
            
            // Procesar el primer item
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
            // Actualizar texto de progreso
            document.getElementById('progress-text').textContent = 
                `${currentProcessingIndex + 1}/${itemsToProcess.length} completados`;
            
            // Preparar datos para enviar
            const data = {
                name: item.name,
                is_decor: item.isDecor,
                profession_name: item.profession || ''  // Enviar nombre de profesión si existe
            };
            
            // Enviar solicitud para añadir el item
            fetch("/api/add-item/", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRFToken": csrf
                },
                body: JSON.stringify(data)
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                if (data.ok) {
                    if (data.created_item === false) {
                        skippedCount++;
                        const profMsg = data.profession_name ? ` [${data.profession_name}]` : '';
                        console.log(`⏭️ Item ya existente: ${item.name}${item.isDecor ? ' (Decor)' : ''}${profMsg}`);
                    } else {
                        successCount++;
                        const profMsg = data.profession_name ? ` [${data.profession_name}]` : '';
                        console.log(`✅ Item añadido: ${item.name}${item.isDecor ? ' (Decor)' : ''}${profMsg}`);
                    }
                } else {
                    errorCount++;
                    console.error(`❌ Error en línea ${item.lineNumber}: ${item.originalLine} - ${data.error || 'Error desconocido'}`);
                }
                
                // Procesar siguiente item
                currentProcessingIndex++;
                
                // Pausa ajustable basada en si el item ya existía
                const delay = (data.created_item === false) ? 50 : 150;
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
            // Mostrar resultados
            const successElement = document.getElementById('success-count');
            const errorElement = document.getElementById('error-count');
            
            successElement.querySelector('span').textContent = successCount;
            errorElement.querySelector('span').textContent = errorCount;
            
            // Mostrar también skipped si hay
            if (skippedCount > 0) {
                const skippedElement = document.createElement('div');
                skippedElement.id = 'skipped-count';
                skippedElement.style.cssText = 'color: #ffc107; margin-top: 5px; display: block;';
                skippedElement.innerHTML = `⏭️ <span>${skippedCount}</span> items ya existían`;
                successElement.parentNode.insertBefore(skippedElement, errorElement);
            }
            
            successElement.style.display = successCount > 0 ? 'block' : 'none';
            errorElement.style.display = errorCount > 0 ? 'block' : 'none';
            
            // Habilitar botones
            const loadBtn = document.getElementById('load-txt-btn');
            const fileInput = document.getElementById('txt-file-input');
            loadBtn.disabled = false;
            fileInput.disabled = false;
            loadBtn.textContent = '📁 Cargar y Procesar TXT';
            
            // Limpiar input de archivo
            document.getElementById('txt-file-input').value = '';
            document.getElementById('file-info').style.display = 'none';
            
            // Mostrar resumen detallado
            let message = `✅ **Procesamiento completado**\n\n`;
            message += `**Resultados:**\n`;
            
            if (successCount > 0) {
                message += `✓ ${successCount} items añadidos exitosamente\n`;
            }
            
            if (skippedCount > 0) {
                message += `⏭️ ${skippedCount} items ya existían (activados)\n`;
            }
            
            if (errorCount > 0) {
                message += `✗ ${errorCount} errores\n`;
            }
            
            if (successCount === 0 && skippedCount === 0 && errorCount === 0) {
                message += `ℹ️ No se procesó ningún item`;
            }
            
            alert(message);
            
            // Recargar la página para ver los nuevos items
            if (successCount > 0) {
                setTimeout(() => {
                    location.reload();
                }, 1500);
            }
            
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
    
    // ===================== CONFIGURATION FUNCTIONS =====================
    function loadConfiguration() {
        try {
            console.log('🔧 Cargando configuración...');
            fetch("/api/config/")
                .then(response => response.json())
                .then(data => {
                    if (data.ok) {
                        const config = data.config;
                        
                        // Cargar reinos principales
                        renderRealmsList(config.primary_realms);
                        
                        // Cargar otros valores
                        document.getElementById('max-realms-input').value = config.max_realms_to_scan;
                        document.getElementById('dev-mode-checkbox').checked = config.dev_mode;
                        document.getElementById('region-select').value = config.region;
                        document.getElementById('locale-select').value = config.locale;
                        
                        console.log('✅ Configuración cargada:', config);
                    } else {
                        console.error('❌ Error cargando configuración:', data.error);
                        loadDefaultConfiguration();
                    }
                })
                .catch(error => {
                    console.error('❌ Error de conexión cargando configuración:', error);
                    loadDefaultConfiguration();
                });
        } catch (error) {
            console.error('❌ Error cargando configuración:', error);
            loadDefaultConfiguration();
        }
    }
    
    function renderRealmsList(realms) {
        const container = document.getElementById('realms-list');
        if (!container) return;
        
        container.innerHTML = '';
        
        if (!realms || realms.length === 0) {
            container.innerHTML = '<div style="color: #94a3b8; font-style: italic; padding: 10px;">No hay reinos configurados</div>';
            return;
        }
        
        realms.forEach((realm, index) => {
            const realmDiv = document.createElement('div');
            realmDiv.className = 'realm-item';
            realmDiv.style.cssText = `
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 8px 12px;
                margin-bottom: 5px;
                background-color: #2d3748;
                border-radius: 5px;
                border-left: 4px solid #4299e1;
            `;
            
            realmDiv.innerHTML = `
                <div style="display: flex; align-items: center;">
                    <span style="color: #cbd5e0; font-weight: bold; min-width: 30px;">${index + 1}.</span>
                    <span style="margin-left: 10px; color: #e2e8f0; font-size: 1em;">${realm}</span>
                </div>
                <div>
                    <button class="move-up-btn" data-index="${index}" ${index === 0 ? 'disabled' : ''} 
                            style="background: none; border: none; color: #a0aec0; cursor: pointer; font-size: 1.2em; 
                                   padding: 5px; border-radius: 3px;" 
                            title="Mover arriba">
                        ⬆️
                    </button>
                    <button class="move-down-btn" data-index="${index}" ${index === realms.length - 1 ? 'disabled' : ''} 
                            style="background: none; border: none; color: #a0aec0; cursor: pointer; font-size: 1.2em; 
                                   padding: 5px; border-radius: 3px; margin-left: 5px;" 
                            title="Mover abajo">
                        ⬇️
                    </button>
                    <button class="remove-realm-btn" data-realm="${realm}" 
                            style="background: none; border: none; color: #fc8181; cursor: pointer; font-size: 1.2em; 
                                   padding: 5px; border-radius: 3px; margin-left: 10px;" 
                            title="Eliminar reino">
                        🗑️
                    </button>
                </div>
            `;
            
            container.appendChild(realmDiv);
        });
        
        // Añadir event listeners a los botones
        attachRealmListeners();
    }
    
    function attachRealmListeners() {
        // Botón para añadir nuevo reino
        document.getElementById('add-realm-btn')?.addEventListener('click', addNewRealm);
        
        // Permitir añadir con Enter
        document.getElementById('new-realm-input')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') addNewRealm();
        });
        
        // Botón para cargar reinos por defecto
        document.getElementById('load-default-realms-btn')?.addEventListener('click', loadDefaultRealms);
        
        // Botones de mover y eliminar (delegación de eventos)
        document.getElementById('realms-list')?.addEventListener('click', (e) => {
            if (e.target.closest('.remove-realm-btn')) {
                const realm = e.target.closest('.remove-realm-btn').dataset.realm;
                removeRealm(realm);
            } else if (e.target.closest('.move-up-btn')) {
                const index = parseInt(e.target.closest('.move-up-btn').dataset.index);
                moveRealm(index, -1);
            } else if (e.target.closest('.move-down-btn')) {
                const index = parseInt(e.target.closest('.move-down-btn').dataset.index);
                moveRealm(index, 1);
            }
        });
    }
    
    function addNewRealm() {
        const input = document.getElementById('new-realm-input');
        const realmName = input.value.trim();
        
        if (!realmName) {
            alert('❌ Por favor, escribe un nombre de reino');
            input.focus();
            return;
        }
        
        // Obtener lista actual
        const realms = getCurrentRealms();
        
        // Verificar si ya existe (case-insensitive)
        const normalizedRealm = realmName.toLowerCase();
        if (realms.some(r => r.toLowerCase() === normalizedRealm)) {
            alert(`❌ El reino "${realmName}" ya está en la lista`);
            input.value = '';
            input.focus();
            return;
        }
        
        // Añadir al final de la lista
        realms.push(realmName);
        renderRealmsList(realms);
        
        input.value = '';
        input.focus();
        
        console.log(`✅ Reino añadido: ${realmName}`);
    }
    
    function removeRealm(realmName) {
        if (!confirm(`¿Eliminar el reino "${realmName}" de la lista?`)) return;
        
        const realms = getCurrentRealms();
        const newRealms = realms.filter(r => r !== realmName);
        renderRealmsList(newRealms);
        
        console.log(`✅ Reino eliminado: ${realmName}`);
    }
    
    function moveRealm(index, direction) {
        const realms = getCurrentRealms();
        if (index < 0 || index >= realms.length) return;
        
        const newIndex = index + direction;
        if (newIndex < 0 || newIndex >= realms.length) return;
        
        // Intercambiar posiciones
        [realms[index], realms[newIndex]] = [realms[newIndex], realms[index]];
        renderRealmsList(realms);
    }
    
    function getCurrentRealms() {
        const realmDivs = document.querySelectorAll('#realms-list .realm-item');
        const realms = [];
        
        realmDivs.forEach(div => {
            const realmSpan = div.querySelector('span:nth-child(2)');
            if (realmSpan) {
                realms.push(realmSpan.textContent.trim());
            }
        });
        
        return realms;
    }
    
    function loadDefaultRealms() {
        if (!confirm('¿Cargar los reinos principales por defecto?\nEsto reemplazará tu lista actual.')) return;
        
        const defaultRealms = [
            "Stormrage", "Area 52", "Moon Guard",
            "Ragnaros", "Dalaran", "Zul'jin", "Proudmoore"
        ];
        
        renderRealmsList(defaultRealms);
        console.log('✅ Reinos por defecto cargados');
    }
    
    function saveConfiguration() {
        try {
            const configData = {
                max_realms_to_scan: parseInt(document.getElementById('max-realms-input').value) || 0,
                primary_realms: getCurrentRealms(),
                dev_mode: document.getElementById('dev-mode-checkbox').checked,
                region: document.getElementById('region-select').value,
                locale: document.getElementById('locale-select').value
            };
            
            // Validar
            if (configData.max_realms_to_scan < 0) {
                alert('❌ El número de reinos a escanear debe ser 0 o positivo');
                return;
            }
            
            const saveBtn = document.getElementById('save-config-btn');
            const originalText = saveBtn.textContent;
            saveBtn.disabled = true;
            saveBtn.textContent = "⏳ Guardando...";
            
            const statusDiv = document.getElementById('config-status');
            
            fetch("/api/update-config/", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRFToken": csrf
                },
                body: JSON.stringify(configData)
            })
            .then(response => response.json())
            .then(data => {
                if (data.ok) {
                    statusDiv.textContent = "✅ Configuración guardada exitosamente";
                    statusDiv.style.backgroundColor = "#10b981";
                    statusDiv.style.color = "white";
                    statusDiv.style.display = "block";
                    
                    setTimeout(() => {
                        statusDiv.style.display = "none";
                    }, 3000);
                    
                    console.log('✅ Configuración guardada:', configData);
                } else {
                    throw new Error(data.error || "Error desconocido");
                }
            })
            .catch(error => {
                statusDiv.textContent = `❌ Error: ${error.message}`;
                statusDiv.style.backgroundColor = "#ef4444";
                statusDiv.style.color = "white";
                statusDiv.style.display = "block";
                
                console.error('❌ Error guardando configuración:', error);
            })
            .finally(() => {
                saveBtn.disabled = false;
                saveBtn.textContent = originalText;
            });
            
        } catch (error) {
            alert('❌ Error guardando configuración: ' + error.message);
        }
    }
    
    function resetConfiguration() {
        if (!confirm('¿Restaurar todos los valores por defecto?\nEsto incluirá reinos principales, escaneo e idioma.')) return;
        
        loadDefaultRealms();
        document.getElementById('max-realms-input').value = 0;
        document.getElementById('dev-mode-checkbox').checked = true;
        document.getElementById('region-select').value = "us";
        document.getElementById('locale-select').value = "en_US";
        
        const statusDiv = document.getElementById('config-status');
        statusDiv.textContent = "✅ Valores por defecto restaurados";
        statusDiv.style.backgroundColor = "#3b82f6";
        statusDiv.style.color = "white";
        statusDiv.style.display = "block";
        
        setTimeout(() => {
            statusDiv.style.display = "none";
        }, 2000);
        
        console.log('✅ Configuración restablecida a valores por defecto');
    }
    
    function loadDefaultConfiguration() {
        renderRealmsList([
            "Stormrage", "Area 52", "Moon Guard",
            "Ragnaros", "Dalaran", "Zul'jin", "Proudmoore"
        ]);
        document.getElementById('max-realms-input').value = 0;
        document.getElementById('dev-mode-checkbox').checked = true;
        document.getElementById('region-select').value = "us";
        document.getElementById('locale-select').value = "en_US";
    }

    // ===================== EVENT LISTENERS FOR CONFIG =====================
    // Cargar configuración al inicio
    setTimeout(() => {
        loadConfiguration();
    }, 500);
    
    // Guardar configuración
    document.getElementById('save-config-btn')?.addEventListener('click', saveConfiguration);
    
    // Resetear configuración
    document.getElementById('reset-config-btn')?.addEventListener('click', resetConfiguration);
    
    // ===================== Update Auctions Polling =====================
    const updateBtn = document.getElementById("update-btn");
    let poller = null, wasRunning = false;
    
    function startPolling() {
        if (!poller) {
            poller = setInterval(updateStatus, 2000);
            // Mostrar panel de estado
            document.getElementById("auction-status").style.display = "block";
        }
    }
    
    function stopPolling() {
        if (poller) {
            clearInterval(poller);
            poller = null;
        }
        // Ocultar panel de estado después de 5 segundos
        setTimeout(() => {
            document.getElementById("auction-status").style.display = "none";
        }, 5000);
    }
    
    function updateStatus() {
        fetch("/api/auction-status/")
        .then(r => {
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            return r.json();
        })
        .then(data => {
            const stateEl = document.getElementById("state"),
                  currentEl = document.getElementById("current"),
                  doneEl = document.getElementById("done"),
                  totalEl = document.getElementById("total"),
                  elapsedEl = document.getElementById("elapsed"),
                  etaEl = document.getElementById("eta"),
                  configInfoEl = document.getElementById("config-info");
            
            if (data.running) {
                wasRunning = true;
                stateEl.innerText = "Running";
                currentEl.innerText = data.current || "-";
                doneEl.innerText = data.done || 0;
                totalEl.innerText = data.total || 0;
                elapsedEl.innerText = data.elapsed || 0;
                etaEl.innerText = data.eta || 0;
                configInfoEl.textContent = data.config_info || "";
                updateBtn.disabled = true;
                updateBtn.textContent = "⏳ Escaneando...";
            } else {
                stateEl.innerText = "Idle";
                updateBtn.disabled = false;
                updateBtn.textContent = "🔄 Update Auctions";
                stopPolling();
                if (wasRunning) {
                    wasRunning = false;
                    setTimeout(() => {
                        location.reload();
                    }, 1000);
                }
            }
        })
        .catch(error => {
            console.error('Error polling auction status:', error);
            stopPolling();
            updateBtn.disabled = false;
            updateBtn.textContent = "🔄 Update Auctions";
            document.getElementById("state").innerText = "Error";
        });
    }
    
    updateBtn.addEventListener("click", () => {
        updateBtn.disabled = true;
        updateBtn.textContent = "⏳ Iniciando...";
        
        fetch("/api/update-auctions/", {
            method: "POST",
            headers: { "X-CSRFToken": csrf }
        })
        .then(response => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.json();
        })
        .then(data => {
            alert(`✅ Actualización iniciada. Se crearán ${data.created || 0} snapshots`);
            startPolling();
        })
        .catch(error => {
            alert('❌ Error al iniciar la actualización: ' + error.message);
            updateBtn.disabled = false;
            updateBtn.textContent = "🔄 Update Auctions";
        });
    });
    
    // ===================== Collapsable Tables =====================
    const collapsibleTitles = document.querySelectorAll('.collapsible');
    
    collapsibleTitles.forEach(title => {
        title.addEventListener("click", () => {
            const container = title.nextElementSibling;
            container.style.display = container.style.display === "none" ? "block" : "none";
            title.classList.toggle("active");
        });
    });

    // ===================== Track Items =====================
    document.getElementById("select-all-items")?.addEventListener("change", e => {
        document.querySelectorAll(".item-check").forEach(cb => cb.checked = e.target.checked);
    });
    
    document.getElementById("save-tracked")?.addEventListener("click", () => {
        const ids = [...document.querySelectorAll(".item-check:checked")].map(cb => cb.value);
        fetch("/api/update-tracked-items/", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-CSRFToken": csrf
            },
            body: JSON.stringify({ item_ids: ids })
        }).then(() => {
            alert("✅ Items a escanear actualizados");
            location.reload();
        });
    });
    
    // ===================== Delete Items =====================
    function attachDeleteItemListeners() {
        document.querySelectorAll(".delete-item-btn").forEach(btn => {
            btn.addEventListener("click", (e) => {
                const itemId = e.target.dataset.id;
                if (!confirm("Eliminar completamente este item?")) return;
                
                fetch("/api/delete-item/", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "X-CSRFToken": csrf
                    },
                    body: JSON.stringify({ item_id: itemId })
                })
                .then(r => r.json())
                .then(data => {
                    if (data.ok) {
                        document.getElementById(`item-row-${itemId}`).remove();
                    } else {
                        alert("Error: " + (data.error || "No se pudo eliminar"));
                    }
                });
            });
        });
    }
    
    attachDeleteItemListeners();
    
    // ===================== Delete Selected Items (Items a Escanear) =====================
    document.getElementById("delete-selected-items")?.addEventListener("click", () => {
        const ids = [...document.querySelectorAll(".item-check:checked")].map(cb => cb.value);
        if (!ids.length) return alert("Nada seleccionado");
        
        if (!confirm("¿Eliminar los items seleccionados?")) return;
        
        fetch("/api/delete-multiple-items/", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-CSRFToken": csrf
            },
            body: JSON.stringify({ item_ids: ids })
        })
        .then(r => r.json())
        .then(data => {
            if (data.ok) {
                alert(`✅ ${data.deleted_count} items eliminados`);
                ids.forEach(id => {
                    const row = document.getElementById(`item-row-${id}`);
                    if (row) row.remove();
                });
            } else {
                alert("Error: " + (data.error || "No se pudieron eliminar"));
            }
        });
    });
    
    document.getElementById("delete-all-items")?.addEventListener("click", () => {
        if (!confirm("Eliminar TODOS los items?")) return;
        fetch("/api/delete-all-items/", {
            method: "POST",
            headers: { "X-CSRFToken": csrf }
        })
        .then(() => location.reload());
    });
    
    // ===================== Delete Snapshots =====================
    document.getElementById("delete-selected")?.addEventListener("click", () => {
        const ids = [...document.querySelectorAll(".snapshot-check:checked")].map(cb => cb.value);
        if (!ids.length) return alert("Nada seleccionado");

        const confirmDelete = confirm("¿Estás seguro de eliminar los snapshots seleccionados? Esta acción no se puede deshacer.");

        if (confirmDelete) {
            fetch("/api/delete-snapshots/", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRFToken": csrf
                },
                body: JSON.stringify({ ids })
            })
            .then(response => response.json())
            .then(data => {
                if (data.deleted > 0) {
                    // Eliminar filas visualmente
                    ids.forEach(id => {
                        const row = document.querySelector(`#snapshot-row-${id}`);
                        if (row) row.remove();
                    });
                    
                    // Actualizar la tabla con los resultados más recientes
                    updateArbitrageResults(data.snapshots);
                } else {
                    alert("No se eliminaron snapshots");
                }
            })
            .catch(error => {
                console.error("❌ Error al eliminar los snapshots:", error);
                alert("Hubo un error al eliminar los snapshots.");
            });
        }
    });
    
    document.getElementById("delete-all")?.addEventListener("click", () => {
        if (!confirm("Eliminar TODOS los snapshots?")) return;
        fetch("/api/delete-all-snapshots/", {
            method: "POST",
            headers: { "X-CSRFToken": csrf }
        })
        .then(() => location.reload());
    });
    
    // Función para actualizar la tabla de arbitraje con los nuevos resultados
    function updateArbitrageResults(snapshots) {
        const tableBody = document.querySelector("#arbitrage-results-container tbody");
        
        if (!snapshots || snapshots.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="10" style="text-align: center;">No hay snapshots disponibles</td></tr>';
            return;
        }
        
        tableBody.innerHTML = '';
        
        snapshots.forEach(s => {
            const row = document.createElement("tr");
            
            // Formatear la fecha localmente
            const localDate = formatDateToLocal(s.created_at);
            
            row.innerHTML = `
                <td><input type="checkbox" class="snapshot-check" value="${s.id}"></td>
                <td>${s.blizzard_id || "-"}</td>
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
        
        // Reasignar el event listener para select-all
        const selectAllCheckbox = document.getElementById("select-all-snapshots");
        if (selectAllCheckbox) {
            selectAllCheckbox.addEventListener("change", e => {
                document.querySelectorAll(".snapshot-check").forEach(cb => cb.checked = e.target.checked);
            });
        }
        
        // Convertir fechas nuevamente
        convertAllDates();
    }
    
    // ===================== Add Item (formulario individual) =====================
    document.getElementById("add-item-btn")?.addEventListener("click", () => {
        try {
            const name = document.getElementById("new-item-name").value.trim();
            const prof = document.getElementById("new-item-profession").value;
            const isDecor = document.getElementById("new-item-decor").checked;
            
            if (!name) {
                alert('❌ Por favor, escribe un nombre de item');
                document.getElementById("new-item-name").focus();
                return;
            }
            
            // Validar longitud
            if (name.length > 255) {
                alert('❌ El nombre del item es demasiado largo (máximo 255 caracteres)');
                return;
            }
            
            // Deshabilitar botón durante la solicitud
            const addBtn = document.getElementById("add-item-btn");
            const originalText = addBtn.textContent;
            addBtn.disabled = true;
            addBtn.textContent = "⏳ Agregando...";
            
            fetch("/api/add-item/", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRFToken": csrf
                },
                body: JSON.stringify({ 
                    name, 
                    profession_id: prof, 
                    is_decor: isDecor 
                })
            })
            .then(response => {
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return response.json();
            })
            .then(data => {
                if (data.ok) {
                    alert(`✅ Item "${name}" agregado exitosamente`);
                    document.getElementById("new-item-name").value = "";
                    document.getElementById("new-item-profession").value = "";
                    document.getElementById("new-item-decor").checked = false;
                    
                    // Recargar después de un breve delay
                    setTimeout(() => location.reload(), 1000);
                } else {
                    throw new Error(data.error || "Error desconocido del servidor");
                }
            })
            .catch(error => {
                alert('❌ Error al agregar el item: ' + error.message);
            })
            .finally(() => {
                addBtn.disabled = false;
                addBtn.textContent = originalText;
            });
            
        } catch (error) {
            alert('❌ Error inesperado: ' + error.message);
        }
    });
    
    // Select all snapshots checkbox
    document.getElementById("select-all-snapshots")?.addEventListener("change", e => {
        document.querySelectorAll(".snapshot-check").forEach(cb => cb.checked = e.target.checked);
    });
});
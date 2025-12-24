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
                if (!confirm(`⚠️ You are about to process ${itemsToProcess.length} items. This may take time.\nContinue?`)) {
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
            console.log('🔧 Loading configuration...');
            fetch("/api/config/")
                .then(response => response.json())
                .then(data => {
                    if (data.ok) {
                        const config = data.config;
                        
                        // Cargar reinos a escanear
                        document.getElementById('realms-textarea').value = config.realms_to_scan.join('\n');
                        
                        // Cargar otros valores
                        document.getElementById('max-realms-input').value = config.max_realms_to_scan;
                        document.getElementById('dev-mode-checkbox').checked = config.dev_mode;
                        
                        // Aplicar visibilidad inicial
                        toggleMaxRealmsVisibility();
                        
                        console.log('✅ Configuration loaded:', config);
                    } else {
                        console.error('❌ Error loading configuration:', data.error);
                        loadDefaultConfiguration();
                    }
                })
                .catch(error => {
                    console.error('❌ Connection error loading configuration:', error);
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
            "Stormrage", "Area 52", "Moon Guard",
            "Ragnaros", "Dalaran", "Zul'jin", "Proudmoore"
        ];
        
        document.getElementById('realms-textarea').value = defaultRealms.join('\n');
        console.log('✅ Default realms loaded');
    }
    
    function saveConfiguration() {
        try {
            const realmsText = document.getElementById('realms-textarea').value;
            const realms = realmsText.split('\n').map(r => r.trim()).filter(r => r);
            
            const configData = {
                max_realms_to_scan: parseInt(document.getElementById('max-realms-input').value) || 0,
                realms_to_scan: realms,
                dev_mode: document.getElementById('dev-mode-checkbox').checked
            };
            
            // Validar
            if (configData.max_realms_to_scan < 0) {
                alert('❌ Max realms to scan must be 0 or positive');
                return;
            }
            
            if (configData.realms_to_scan.length === 0) {
                alert('❌ Please add at least one realm to scan');
                return;
            }
            
            const saveBtn = document.getElementById('save-config-btn');
            const originalText = saveBtn.textContent;
            saveBtn.disabled = true;
            saveBtn.textContent = "⏳ Saving...";
            
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
                    statusDiv.textContent = "✅ Configuration saved successfully";
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
        if (!confirm('Restore all default values?\nThis will include realms, scanning and other settings.')) return;
        
        loadDefaultConfiguration();
        
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
        document.getElementById('realms-textarea').value = '';
        document.getElementById('max-realms-input').value = 0;
        document.getElementById('dev-mode-checkbox').checked = true;
        toggleMaxRealmsVisibility();
    }
    
    function toggleMaxRealmsVisibility() {
        const checkbox = document.getElementById('dev-mode-checkbox');
        const maxRealmsRow = document.querySelector('#max-realms-input').closest('tr');
        if (checkbox.checked) {
            maxRealmsRow.style.display = 'none';
        } else {
            maxRealmsRow.style.display = '';
        }
    }
    
    function resetConfiguration() {
        if (!confirm('Restore all default values?\nThis will include realms, scanning and other settings.')) return;
        
        loadDefaultConfiguration();
        
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

    // ===================== EVENT LISTENERS FOR CONFIG =====================
    // Cargar configuración al inicio
    setTimeout(() => {
        loadConfiguration();
    }, 500);
    
    // Guardar configuración
    document.getElementById('save-config-btn')?.addEventListener('click', saveConfiguration);
    
    // Resetear configuración
    document.getElementById('reset-config-btn')?.addEventListener('click', resetConfiguration);
    
    // Cargar reinos por defecto
    document.getElementById('load-default-realms-btn')?.addEventListener('click', loadDefaultRealms);
    
    // Toggle max realms visibility based on dev mode
    document.getElementById('dev-mode-checkbox')?.addEventListener('change', toggleMaxRealmsVisibility);
    
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
        
        if (!confirm("Delete selected items?")) return;
        
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

        const confirmDelete = confirm("Are you sure to delete selected snapshots? This action cannot be undone.");

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
    
    // ===================== BACKGROUND MUSIC =====================
    // Lista de pistas de música (actualiza con tus archivos)
    const musicTracks = [
        '/static/market/music/mus_80_goblingreed_a.mp3',
        '/static/market/music/mus_80_goblingreed_c.mp3',
        '/static/market/music/mus_80_motherlode_d.mp3',
        '/static/market/music/mus_80_motherlode_e.mp3',
        '/static/market/music/mus_80_motherlode_h.mp3'
    ];
    
    // Nombres amigables para los tracks
    const trackNames = {
        '/static/market/music/mus_80_goblingreed_a.mp3': 'Goblin Greed A',
        '/static/market/music/mus_80_goblingreed_c.mp3': 'Goblin Greed C',
        '/static/market/music/mus_80_motherlode_d.mp3': 'Motherlode D',
        '/static/market/music/mus_80_motherlode_e.mp3': 'Motherlode E',
        '/static/market/music/mus_80_motherlode_h.mp3': 'Motherlode H'
    };
    
    let currentAudio = null;
    let isMusicPlaying = false;
    let currentTrackIndex = -1;
    let currentVolume = 10; // Volumen por defecto (10%)
    let animationInterval = null;
    
    // Función para reproducir música aleatoria
    function playRandomMusic() {
        console.log('🎵 playRandomMusic() llamada');
        if (musicTracks.length === 0) {
            console.log('⚠️ No hay pistas de música disponibles');
            return;
        }
        
        // Detener música actual si existe
        if (currentAudio) {
            currentAudio.pause();
            currentAudio.currentTime = 0;
        }
        
        // Seleccionar pista aleatoria (diferente a la actual si es posible)
        let randomIndex;
        do {
            randomIndex = Math.floor(Math.random() * musicTracks.length);
        } while (musicTracks.length > 1 && randomIndex === currentTrackIndex);
        
        currentTrackIndex = randomIndex;
        const selectedTrack = musicTracks[randomIndex];
        
        console.log('🎵 Pista seleccionada:', selectedTrack);
        
        currentAudio = new Audio(selectedTrack);
        currentAudio.volume = currentVolume / 100; // Usar volumen guardado
        currentAudio.loop = false; // No loop individual, cambia a otra
        
        currentAudio.addEventListener('ended', () => {
            // Cuando termine, reproducir otra aleatoria
            if (isMusicPlaying) {
                setTimeout(playRandomMusic, 1000); // Pequeño delay entre pistas
            }
        });
        
        currentAudio.addEventListener('error', () => {
            console.log('Error cargando música:', selectedTrack);
            // Intentar otra pista
            if (isMusicPlaying) {
                setTimeout(playRandomMusic, 1000);
            }
        });
        
        currentAudio.play().catch(error => {
            console.log('❌ Error reproduciendo música (posible bloqueo de autoplay):', error.message);
            console.log('❌ Detalles del error:', error);
            // Mostrar mensaje al usuario sobre autoplay
            showAutoplayMessage();
            // Intentar otra pista
            if (isMusicPlaying) {
                console.log('🔄 Intentando otra pista de música...');
                setTimeout(playRandomMusic, 1000);
            }
        });
        
        isMusicPlaying = true;
        updateMusicButton();
        updateCurrentTrackDisplay(selectedTrack);
        startVisualizerAnimation();
        saveMusicPreferences();
        console.log('✅ Música iniciada exitosamente:', selectedTrack);
    }
    
    // Función para detener música
    function stopMusic() {
        if (currentAudio) {
            currentAudio.pause();
            currentAudio.currentTime = 0;
        }
        isMusicPlaying = false;
        updateMusicButton();
        stopVisualizerAnimation();
        saveMusicPreferences();
        console.log('🎵 Música detenida');
    }
    
    // Función para toggle música
    function toggleMusic() {
        if (isMusicPlaying) {
            stopMusic();
        } else {
            playRandomMusic();
        }
    }
    
    // Función para actualizar el texto del botón
    function updateMusicButton() {
        const btn = document.getElementById('music-toggle-btn');
        if (btn) {
            btn.textContent = isMusicPlaying ? '🎵 Pause Music' : '🎵 Play Music';
            btn.style.backgroundColor = isMusicPlaying ? '#f44336' : '#4CAF50';
        }
    }
    
    // Función para cargar preferencias del usuario
    function loadMusicPreferences() {
        try {
            const saved = localStorage.getItem('wowMusicPreferences');
            if (saved) {
                const prefs = JSON.parse(saved);
                currentVolume = prefs.volume || 10;
                isMusicPlaying = prefs.wasPlaying || false;
                console.log('🎵 Preferencias cargadas:', prefs);
            }
        } catch (error) {
            console.log('Error cargando preferencias:', error);
        }
    }
    
    // Función para guardar preferencias del usuario
    function saveMusicPreferences() {
        try {
            const prefs = {
                volume: currentVolume,
                wasPlaying: isMusicPlaying
            };
            localStorage.setItem('wowMusicPreferences', JSON.stringify(prefs));
            console.log('💾 Preferencias guardadas:', prefs);
        } catch (error) {
            console.log('Error guardando preferencias:', error);
        }
    }
    
    // Función para actualizar el volumen
    function updateVolume(newVolume) {
        currentVolume = newVolume;
        if (currentAudio) {
            currentAudio.volume = currentVolume / 100;
        }
        // Actualizar UI
        document.getElementById('volume-slider').value = currentVolume;
        document.getElementById('volume-value').textContent = currentVolume + '%';
        saveMusicPreferences();
    }
    
    // Función para iniciar animación de las barras
    function startVisualizerAnimation() {
        const bars = document.querySelectorAll('#track-bars .bar');
        if (animationInterval) clearInterval(animationInterval);
        
        animationInterval = setInterval(() => {
            bars.forEach((bar, index) => {
                const height = Math.random() * 20 + 5; // Altura aleatoria entre 5-25px
                bar.style.height = height + 'px';
            });
        }, 200); // Actualizar cada 200ms
        
        document.getElementById('music-visualizer').style.display = 'block';
    }
    
    // Función para detener animación de las barras
    function stopVisualizerAnimation() {
        if (animationInterval) {
            clearInterval(animationInterval);
            animationInterval = null;
        }
        
        // Resetear barras a altura mínima
        const bars = document.querySelectorAll('#track-bars .bar');
        bars.forEach(bar => {
            bar.style.height = '5px';
        });
        
        document.getElementById('music-visualizer').style.display = 'none';
    }
    
    // Función para actualizar el display del track actual
    function updateCurrentTrackDisplay(trackPath) {
        const trackNameElement = document.getElementById('current-track-name');
        if (trackNameElement && trackNames[trackPath]) {
            trackNameElement.textContent = trackNames[trackPath];
        }
    }
    
    // Función para mostrar mensaje sobre autoplay
    function showAutoplayMessage() {
        // Solo mostrar una vez
        if (document.getElementById('autoplay-message')) return;
        
        const message = document.createElement('div');
        message.id = 'autoplay-message';
        message.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #f59e0b;
            color: white;
            padding: 15px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 1000;
            max-width: 300px;
            font-size: 14px;
            cursor: pointer;
        `;
        message.innerHTML = `
            <strong>🎵 Música bloqueada</strong><br>
            Los navegadores bloquean la reproducción automática. 
            Haz clic en "Play Music" para iniciar.
            <span style="float: right; font-weight: bold;">×</span>
        `;
        
        // Cerrar al hacer clic
        message.addEventListener('click', () => {
            message.remove();
        });
        
        // Auto-cerrar después de 10 segundos
        setTimeout(() => {
            if (message.parentNode) {
                message.remove();
            }
        }, 10000);
        
        document.body.appendChild(message);
    }
    
    // Cargar preferencias de música
    loadMusicPreferences();
    
    // Configurar controles de volumen
    const volumeSlider = document.getElementById('volume-slider');
    if (volumeSlider) {
        volumeSlider.value = currentVolume;
        volumeSlider.addEventListener('input', (e) => {
            updateVolume(parseInt(e.target.value));
        });
    }
    
    // Actualizar display inicial del volumen
    updateVolume(currentVolume);
    
    // Si el usuario tenía la música reproduciendo antes, intentar reanudar
    // (aunque probablemente falle por restricciones de autoplay)
    if (isMusicPlaying) {
        console.log('🎵 Intentando reanudar música desde preferencias guardadas...');
        setTimeout(() => {
            playRandomMusic();
        }, 500);
    }
    
    // Event listener para el botón de música
    document.getElementById('music-toggle-btn')?.addEventListener('click', toggleMusic);
    
    // Nota: El autoplay está bloqueado por los navegadores modernos
    // La música solo se inicia con interacción del usuario (clic en el botón)
    
    // ===================== SOUNDS =====================
    // Configuración de sonidos personalizados (efectos de sonido)
    const sounds = {
        cash: '/static/market/sounds/vo_goblinmale_threaten_01.ogg',  // Sonido de goblin para probar OGG
        // Añade más sonidos aquí:
        // click: '/static/market/sounds/click.wav',
        // success: '/static/market/sounds/success.mp3',
    };
    
    // Función para reproducir sonidos personalizados
    function playSound(soundName) {
        try {
            if (sounds[soundName] && sounds[soundName] !== '/static/market/sounds/cash.mp3') {
                // Usar archivo personalizado
                const audio = new Audio(sounds[soundName]);
                audio.volume = 0.3;
                audio.play().catch(() => {
                    // Fallback al sonido generado
                    playGeneratedSound();
                });
            } else {
                // Generar sonido de Sheikah Slate
                playGeneratedSound();
            }
        } catch (error) {
            console.log('Audio not supported, using generated sound');
            playGeneratedSound();
        }
    }
    
    // Función para generar sonido de Sheikah Slate (Zelda)
    function playGeneratedSound() {
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Sonido inspirado en la Sheikah Slate de Zelda
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            const filter = audioContext.createBiquadFilter();
            
            // Filtro para sonido más puro
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(3000, audioContext.currentTime);
            
            // Tono sinusoidal ascendente-descendente (como el "ding" de Zelda)
            oscillator.frequency.setValueAtTime(400, audioContext.currentTime);
            oscillator.frequency.linearRampToValueAtTime(700, audioContext.currentTime + 0.08);
            oscillator.frequency.linearRampToValueAtTime(500, audioContext.currentTime + 0.15);
            oscillator.type = 'sine';
            
            // Envelope suave y bajo volumen
            gainNode.gain.setValueAtTime(0, audioContext.currentTime);
            gainNode.gain.linearRampToValueAtTime(0.08, audioContext.currentTime + 0.03); // Volumen bajo
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
            
            // Conectar
            oscillator.connect(filter);
            filter.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.2);
            
        } catch (error) {
            console.log('Generated sound failed:', error);
        }
    }
    
    // ===================== Collapsable Tables =====================
    const collapsibleTitles = document.querySelectorAll('.collapsible');
    
    collapsibleTitles.forEach(title => {
        title.addEventListener("click", () => {
            const container = title.nextElementSibling;
            container.style.display = container.style.display === "none" ? "block" : "none";
            title.classList.toggle("active");
            
            // Reproducir sonido de Sheikah Slate
            playSound('cash');
        });
    });
});
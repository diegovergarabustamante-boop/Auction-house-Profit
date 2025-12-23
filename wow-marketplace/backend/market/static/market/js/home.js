document.addEventListener("DOMContentLoaded", () => {
    const csrf = document.querySelector("[name=csrfmiddlewaretoken]").value;
    
    // ===================== VARIABLES GLOBALES =====================
    let itemsToProcess = []; // ¡DECLARADA AL INICIO!
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
    
    // ===================== CARGAR MÚLTIPLES ITEMS DESDE TXT =====================
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
                    
                    // Resetear contadores
                    successCount = 0;
                    errorCount = 0;
                    skippedCount = 0;
                    currentProcessingIndex = 0;
                    
                    console.log(`📄 ${itemsToProcess.length} items encontrados en el archivo`);
                    alert(`✅ Se encontraron ${itemsToProcess.length} items para procesar`);
                    
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
            
            // Verificar si tiene ",decor" al final (case insensitive)
            const lowerLine = trimmedLine.toLowerCase();
            let isDecor = false;
            let itemName = trimmedLine;
            
            // Manejar múltiples formas de especificar decor
            if (lowerLine.endsWith(',decor') || lowerLine.endsWith(', decor')) {
                isDecor = true;
                // Extraer el nombre sin la parte decor
                const decorIndex = lowerLine.lastIndexOf(',');
                itemName = trimmedLine.substring(0, decorIndex).trim();
            } else if (lowerLine.includes(',decor') || lowerLine.includes(', decor')) {
                // Si tiene ,decor en cualquier parte (no solo al final)
                isDecor = true;
                itemName = trimmedLine.replace(/,\s*decor/gi, '').trim();
            }
            
            // Validar que el nombre no esté vacío después de quitar ,decor
            if (!itemName) {
                console.warn(`Línea ${index + 1}: Nombre de item vacío, omitiendo`);
                return;
            }
            
            items.push({
                name: itemName,
                isDecor: isDecor,
                originalLine: trimmedLine,
                lineNumber: index + 1
            });
        });
        
        return items;
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
                is_decor: item.isDecor
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
                    if (data.created_item === false && data.message && data.message.includes("ya existente")) {
                        skippedCount++;
                        console.log(`⏭️ Item ya existente (saltado): ${item.name}`);
                    } else {
                        successCount++;
                        console.log(`✅ Item añadido: ${item.name} ${item.isDecor ? '(Decor)' : ''}`);
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
            message += `✓ ${successCount} items añadidos exitosamente\n`;
            
            if (skippedCount > 0) {
                message += `⏭️ ${skippedCount} items ya existían (activados)\n`;
            }
            
            if (errorCount > 0) {
                message += `✗ ${errorCount} errores\n`;
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
# - Item normal: "Nombre del item"
# - Item decorativo: "Nombre del item,decor"
# - También acepta: "Nombre del item, decor" (con espacio)
#
# EJEMPLOS VÁLIDOS:
# ==========================================

# Items normales
Sword of the Valiant
Shield of Eternal Protection
Potion of Healing

# Items decorativos (añadir ,decor al final)
Golden Statue,decor
Ancient Tapestry,decor
Crystal Prism, decor  # También funciona con espacio

# Puedes añadir tantos items como necesites
Último item de ejemplo
Otro item decorativo final,decor`;

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

    // ===================== Update Auctions Polling =====================
    const updateBtn = document.getElementById("update-btn");
    let poller = null, wasRunning = false;
    
    function startPolling() {
        if (!poller) poller = setInterval(updateStatus, 2000);
    }
    
    function stopPolling() {
        if (poller) {
            clearInterval(poller);
            poller = null;
        }
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
                  etaEl = document.getElementById("eta");
            
            if (data.running) {
                wasRunning = true;
                stateEl.innerText = "Running";
                currentEl.innerText = data.current || "-";
                doneEl.innerText = data.done || 0;
                totalEl.innerText = data.total || 0;
                elapsedEl.innerText = data.elapsed || 0;
                etaEl.innerText = data.eta || 0;
                updateBtn.disabled = true;
            } else {
                stateEl.innerText = "Idle";
                updateBtn.disabled = false;
                stopPolling();
                if (wasRunning) location.reload();
            }
        })
        .catch(error => {
            console.error('Error polling auction status:', error);
            stopPolling();
            updateBtn.disabled = false;
            document.getElementById("state").innerText = "Error";
        });
    }
    
    updateBtn.addEventListener("click", () => {
        updateBtn.disabled = true;
        updateBtn.textContent = "🔄 Procesando...";
        
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
    }
    
    // ===================== Add Item =====================
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
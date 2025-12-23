document.addEventListener("DOMContentLoaded", () => {
    const csrf = document.querySelector("[name=csrfmiddlewaretoken]").value;
    
    // Función para formatear fecha ISO a hora local DD/MM HH:MM
    function formatDateToLocal(isoDateString) {
        if (!isoDateString) return '-';
        
        try {
            const date = new Date(isoDateString);
            
            // Verificar si la fecha es válida
            if (isNaN(date.getTime())) {
                console.error('Fecha inválida:', isoDateString);
                return 'Fecha inválida';
            }
            
            // Obtener día, mes, horas y minutos
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0'); // Los meses van de 0-11
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            
            return `${day}/${month} ${hours}:${minutes}`;
        } catch (error) {
            console.error('Error formateando fecha:', error, isoDateString);
            return 'Error';
        }
    }
    
    // Convertir todas las fechas en la página
    function convertAllDates() {
        const dateCells = document.querySelectorAll('.date-cell[data-iso-date]');
        
        dateCells.forEach(cell => {
            const isoDate = cell.getAttribute('data-iso-date');
            if (isoDate && isoDate !== 'None') {
                const localDate = formatDateToLocal(isoDate);
                cell.textContent = localDate;
            } else {
                cell.textContent = '-';
            }
        });
    }
    
    // Convertir fechas cuando se cargue la página
    convertAllDates();
    
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
        .then(r => r.json())
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
        });
    }
    
    updateBtn.addEventListener("click", () => {
        fetch("/api/update-auctions/", {
            method: "POST",
            headers: { "X-CSRFToken": csrf }
        });
        startPolling();
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
        const name = document.getElementById("new-item-name").value.trim();
        const prof = document.getElementById("new-item-profession").value;
        const isDecor = document.getElementById("new-item-decor").checked;
        
        console.log("🚀 Paso 1 - Recogiendo datos del formulario:", { 
            name, 
            profession_id: prof, 
            is_decor: isDecor 
        });
        
        if (!name) return alert("Escribe un nombre de item");
        
        console.log("🚀 Paso 2 - Enviando solicitud a /api/add-item/");
        
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
        .then(r => r.json())
        .then(data => {
            console.log("🚀 Paso 3 - Respuesta del servidor recibida:", data);
            
            if (!data.ok) {
                console.error("❌ Error del servidor:", data.error);
                return alert("Error: " + (data.error || "desconocido"));
            }
            
            console.log("✅ Paso 4 - Item agregado exitosamente");
            document.getElementById("new-item-name").value = "";
            document.getElementById("new-item-profession").value = "";
            document.getElementById("new-item-decor").checked = false;
            
            console.log("🔄 Paso 5 - Recargando la página...");
            location.reload();
        })
        .catch(error => {
            console.error("❌ Error en la solicitud fetch:", error);
            alert("Error al agregar el item");
        });
    });
    
    // ===================== Cargar múltiples items desde TXT =====================
    document.getElementById('load-txt-btn')?.addEventListener('click', processTxtFile);
    document.getElementById('txt-file-input')?.addEventListener('change', handleFileSelect);
    document.getElementById('download-template-btn')?.addEventListener('click', downloadTemplate);

    let itemsToProcess = [];
    let currentProcessingIndex = 0;
    let successCount = 0;
    let errorCount = 0;

    function handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        
        reader.onload = function(e) {
            const content = e.target.result;
            itemsToProcess = parseTxtContent(content);
            
            // Mostrar información del archivo
            document.getElementById('file-info').style.display = 'block';
            document.getElementById('file-name').textContent = file.name;
            document.getElementById('item-count').textContent = itemsToProcess.length;
            
            // Resetear contadores
            successCount = 0;
            errorCount = 0;
            currentProcessingIndex = 0;
            
            console.log(`📄 ${itemsToProcess.length} items encontrados en el archivo`);
        };
        
        reader.readAsText(file);
    }

    function parseTxtContent(content) {
        const lines = content.split('\n');
        const items = [];
        
        lines.forEach((line, index) => {
            const trimmedLine = line.trim();
            if (trimmedLine && !trimmedLine.startsWith('#')) { // Ignorar líneas vacías y comentarios
                // Verificar si tiene ",decor" al final (case insensitive)
                const isDecor = trimmedLine.toLowerCase().endsWith(',decor');
                
                // Extraer el nombre del item (sin ,decor si existe)
                let itemName = trimmedLine;
                if (isDecor) {
                    itemName = trimmedLine.substring(0, trimmedLine.length - 6).trim();
                }
                
                items.push({
                    name: itemName,
                    isDecor: isDecor,
                    originalLine: trimmedLine,
                    lineNumber: index + 1
                });
            }
        });
        
        return items;
    }

    function processTxtFile() {
        if (itemsToProcess.length === 0) {
            alert('❌ No hay items para procesar. Primero carga un archivo TXT.');
            return;
        }
        
        // Mostrar estado de procesamiento
        const processingStatus = document.getElementById('processing-status');
        processingStatus.style.display = 'block';
        document.getElementById('success-count').style.display = 'none';
        document.getElementById('error-count').style.display = 'none';
        
        // Resetear contadores
        successCount = 0;
        errorCount = 0;
        currentProcessingIndex = 0;
        
        // Deshabilitar botón mientras se procesa
        const loadBtn = document.getElementById('load-txt-btn');
        loadBtn.disabled = true;
        loadBtn.textContent = '⏳ Procesando...';
        
        // Procesar el primer item
        processNextItem();
    }

    function processNextItem() {
        if (currentProcessingIndex >= itemsToProcess.length) {
            // Procesamiento completado
            finishProcessing();
            return;
        }
        
        const item = itemsToProcess[currentProcessingIndex];
        
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
        .then(response => response.json())
        .then(data => {
            if (data.ok) {
                successCount++;
                console.log(`✅ Item añadido: ${item.name} ${item.isDecor ? '(Decor)' : ''}`);
            } else {
                errorCount++;
                console.error(`❌ Error en línea ${item.lineNumber}: ${item.originalLine} - ${data.error || 'Error desconocido'}`);
            }
            
            // Procesar siguiente item
            currentProcessingIndex++;
            
            // Pequeña pausa para no sobrecargar el servidor
            setTimeout(processNextItem, 100);
        })
        .catch(error => {
            errorCount++;
            console.error(`❌ Error en línea ${item.lineNumber}: ${item.originalLine}`, error);
            
            currentProcessingIndex++;
            setTimeout(processNextItem, 100);
        });
    }

    function finishProcessing() {
        // Mostrar resultados
        const successElement = document.getElementById('success-count');
        const errorElement = document.getElementById('error-count');
        
        successElement.querySelector('span').textContent = successCount;
        errorElement.querySelector('span').textContent = errorCount;
        
        successElement.style.display = successCount > 0 ? 'block' : 'none';
        errorElement.style.display = errorCount > 0 ? 'block' : 'none';
        
        // Actualizar botón
        const loadBtn = document.getElementById('load-txt-btn');
        loadBtn.disabled = false;
        loadBtn.textContent = '📁 Cargar y Procesar TXT';
        
        // Limpiar input de archivo
        document.getElementById('txt-file-input').value = '';
        
        // Mostrar resumen
        let message = `✅ Procesamiento completado:\n`;
        message += `✓ ${successCount} items añadidos exitosamente\n`;
        if (errorCount > 0) {
            message += `✗ ${errorCount} errores (ver consola para detalles)`;
        }
        
        alert(message);
        
        // Recargar la página para ver los nuevos items
        if (successCount > 0) {
            setTimeout(() => {
                location.reload();
            }, 1500);
        }
    }

    function downloadTemplate() {
        const template = `# Plantilla para cargar múltiples items
# Un item por línea
# Para items decorativos, añade ",decor" al final
# Las líneas que comienzan con # son comentarios
# Las líneas vacías se ignoran

Este es item 1
Este es item 2
Este es item 3,decor
Este es item 4

# Más ejemplos:
Item de ejemplo normal
Otro item decorativo,decor
Último item de prueba`;

        const blob = new Blob([template], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'plantilla_items.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
    
    // Select all snapshots checkbox
    document.getElementById("select-all-snapshots")?.addEventListener("change", e => {
        document.querySelectorAll(".snapshot-check").forEach(cb => cb.checked = e.target.checked);
    });
});
document.addEventListener("DOMContentLoaded", () => {
    const csrf = document.querySelector("[name=csrfmiddlewaretoken]").value;
    
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
    document.querySelectorAll(".delete-item-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const itemId = btn.dataset.id;
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
                if (data.ok) document.getElementById(`item-row-${itemId}`).remove();
                else alert("Error: " + (data.error || "No se pudo eliminar"));
            });
        });
    });
    
    // ===================== Delete Selected Items (Items a Escanear) =====================
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
    } else {
        console.log("Eliminación cancelada");
    }
});

// Función para actualizar la tabla de arbitraje con los nuevos resultados
function updateArbitrageResults(snapshots) {
    const tableBody = document.querySelector("#arbitrage-results-container tbody");
    tableBody.innerHTML = ''; // Limpiar la tabla existente

    snapshots.forEach(s => {
        const row = document.createElement("tr");

        row.innerHTML = `
            <td><input type="checkbox" class="snapshot-check" value="${s.id}"></td>
            <td>${s.blizzard_id || "-"}</td>
            <td>${s.item_name}</td>
            <td>${s.best_buy_realm}</td>
            <td>${s.buy_price} g</td>
            <td>${s.best_sell_realm}</td>
            <td>${s.estimated_sell_price} g</td>
            <td class="profit">${s.profit} g</td>
        `;

        tableBody.appendChild(row);
    });
}

    
    document.getElementById("delete-all-items")?.addEventListener("click", () => {
        if (!confirm("Eliminar TODOS los items?")) return;
        fetch("/api/delete-all-items/", {
            method: "POST",
            headers: { "X-CSRFToken": csrf }
        })
        .then(() => location.reload());
    });
    
    // ===================== Delete Snapshots =====================

    
    document.getElementById("delete-all")?.addEventListener("click", () => {
        if (!confirm("Eliminar TODOS los snapshots?")) return;
        fetch("/api/delete-all-snapshots/", {
            method: "POST",
            headers: { "X-CSRFToken": csrf }
        })
        .then(() => location.reload());
    });
    
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


    
});



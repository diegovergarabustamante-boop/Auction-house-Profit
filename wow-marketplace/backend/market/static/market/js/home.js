document.addEventListener("DOMContentLoaded", () => {
    const csrf = document.querySelector("[name=csrfmiddlewaretoken]").value;

    // ===================== Update Auctions Polling =====================
    const updateBtn = document.getElementById("update-btn");
    let poller = null, wasRunning = false;

    function startPolling() { if (!poller) poller = setInterval(updateStatus, 2000); }
    function stopPolling() { if (poller) { clearInterval(poller); poller = null; } }

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
        fetch("/api/update-auctions/", { method: "POST", headers: { "X-CSRFToken": csrf } });
        startPolling();
    });

    // ===================== Track Items =====================
    document.getElementById("select-all-items")?.addEventListener("change", e => {
        document.querySelectorAll(".item-check").forEach(cb => cb.checked = e.target.checked);
    });

    document.getElementById("save-tracked")?.addEventListener("click", () => {
        const ids = [...document.querySelectorAll(".item-check:checked")].map(cb => cb.value);
        fetch("/api/update-tracked-items/", {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-CSRFToken": csrf },
            body: JSON.stringify({ item_ids: ids })
        }).then(() => { alert("✅ Items a escanear actualizados"); location.reload(); });
    });

    // ===================== Delete Items =====================
    document.querySelectorAll(".delete-item-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const itemId = btn.dataset.id;
            if (!confirm("Eliminar completamente este item?")) return;

            fetch("/api/delete-item/", {
                method: "POST",
                headers: { "Content-Type": "application/json", "X-CSRFToken": csrf },
                body: JSON.stringify({ item_id: itemId })
            }).then(r => r.json())
              .then(data => {
                  if (data.ok) document.getElementById(`item-row-${itemId}`).remove();
                  else alert("Error: " + (data.error || "No se pudo eliminar"));
              });
        });
    });

    document.getElementById("delete-selected-items")?.addEventListener("click", () => {
        const ids = [...document.querySelectorAll(".item-check:checked")].map(cb => cb.value);
        if (!ids.length) return alert("Nada seleccionado");

        fetch("/api/delete-multiple-items/", {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-CSRFToken": csrf },
            body: JSON.stringify({ item_ids: ids })
        }).then(() => location.reload());
    });

    document.getElementById("delete-all-items")?.addEventListener("click", () => {
        if (!confirm("Eliminar TODOS los items?")) return;
        fetch("/api/delete-all-items/", { method: "POST", headers: { "X-CSRFToken": csrf } })
            .then(() => location.reload());
    });

    // ===================== Delete Snapshots =====================
    document.getElementById("select-all-snapshots")?.addEventListener("change", e => {
        document.querySelectorAll(".snapshot-check").forEach(cb => cb.checked = e.target.checked);
    });
    document.getElementById("delete-selected")?.addEventListener("click", () => {
        const ids = [...document.querySelectorAll(".snapshot-check:checked")].map(cb => cb.value);
        if (!ids.length) return alert("Nada seleccionado");
        fetch("/api/delete-snapshots/", {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-CSRFToken": csrf },
            body: JSON.stringify({ ids })
        }).then(() => location.reload());
    });
    document.getElementById("delete-all")?.addEventListener("click", () => {
        if (!confirm("Eliminar TODOS los snapshots?")) return;
        fetch("/api/delete-all-snapshots/", { method: "POST", headers: { "X-CSRFToken": csrf } })
            .then(() => location.reload());
    });

    // ===================== Add Item =====================
    document.getElementById("add-item-btn")?.addEventListener("click", () => {
        const name = document.getElementById("new-item-name").value.trim();
        const prof = document.getElementById("new-item-profession").value;
        if (!name) return alert("Escribe un nombre de item");

        fetch("/api/add-item/", {  // ✅ endpoint correcto
            method: "POST",
            headers: { "Content-Type": "application/json", "X-CSRFToken": csrf },
            body: JSON.stringify({ name, profession_id: prof })
        })
        .then(r => r.json())
        .then(data => {
            if (!data.ok) return alert("Error: " + (data.error || "desconocido"));
            document.getElementById("new-item-name").value = "";
            document.getElementById("new-item-profession").value = "";
            location.reload();
        });
    });
});

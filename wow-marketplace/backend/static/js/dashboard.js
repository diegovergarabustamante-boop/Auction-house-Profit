fetch("/api/arbitrage/top/")
  .then(res => res.json())
  .then(data => {
    const tbody = document.querySelector("#arb-table tbody");

    data.forEach(row => {
      const tr = document.createElement("tr");

      tr.innerHTML = `
        <td>${row.item}</td>
        <td>${row.buy_realm}</td>
        <td>${row.sell_realm}</td>
        <td>${row.sell_price.toFixed(2)}</td>
        <td class="profit">${row.profit.toFixed(2)}</td>
      `;

      tbody.appendChild(tr);
    });
  });

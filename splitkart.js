const participants = ['Siva', 'Medicherla Sai', 'Chitti Sai', 'Eemani Sai'];
const STORAGE_KEY = 'splitkart-expenses';
const items = [];

const predefinedItemNames = [
  'Potato', 'Tomato', 'Brinjal', 'Ladies Finger', 'Ivy Guard',
  'Flowers', 'Bitter Guard', 'Ginger', 'Garlic', 'Leafy Vegetables','Bottle Guard','Raddish'
];

function renderHeader() {
  const row = document.querySelector('#headerRow tr');
  participants.forEach(p => {
    const th = document.createElement('th');
    th.className = 'hide-mobile text-center';
    th.textContent = p;
    row.insertBefore(th, row.lastElementChild);
  });
}

function renderTable() {
  const tbody = document.getElementById('itemsBody');
  tbody.innerHTML = '';
  items.forEach((item, index) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${item.name}</td>
      <td>₹${item.amount}</td>
      <td>${item.payer}</td>
      ${participants.map(p => `<td class="text-center">${item.quantities[p] || 0}</td>`).join('')}
      <td class="text-center">
        <button class="btn btn-sm btn-danger" onclick="deleteItem(${index})">✖️</button>
      </td>
    `;
    tbody.appendChild(row);
  });
}

function saveToLocal() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function loadFromLocal() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        items.length = 0;
        items.push(...parsed);
      }
    } catch {}
  }
}

function deleteItem(index) {
  items.splice(index, 1);
  saveToLocal();
  renderTable();
}

function confirmClear() {
  localStorage.removeItem(STORAGE_KEY);
  items.length = 0;
  renderTable();
  document.getElementById('result').innerHTML = '';
  bootstrap.Modal.getInstance(document.getElementById('confirmClearModal')).hide();
}

function buildModalFields() {
  const payerSelect = document.getElementById('modalPayer');
  payerSelect.innerHTML = '<option value="">-- Choose --</option>' +
    participants.map(p => `<option value="${p}">${p}</option>`).join('');

  const qtyContainer = document.getElementById('modalQuantities');
  qtyContainer.innerHTML = '';
  participants.forEach(p => {
    const col = document.createElement('div');
    col.className = 'col-sm-6 mb-2';
    col.innerHTML = `
      <label class="form-label small">${p}</label>
      <input type="number" class="form-control modal-qty" step="0.25" min="0" data-name="${p}" />
    `;
    qtyContainer.appendChild(col);
  });

  const datalist = document.getElementById('itemSuggestions');
  if (datalist) {
    datalist.innerHTML = '';
    predefinedItemNames.forEach(name => {
      const option = document.createElement('option');
      option.value = name;
      datalist.appendChild(option);
    });
  }
}

function validateModal() {
  const name = document.getElementById('modalItem').value.trim();
  const amount = parseFloat(document.getElementById('modalAmount').value);
  const payer = document.getElementById('modalPayer').value;
  const qtyInputs = document.querySelectorAll('.modal-qty');

  let isValid = !!name && Number.isInteger(amount) && payer;
  let hasQty = false;

  qtyInputs.forEach(input => {
    const val = parseFloat(input.value);
    input.classList.remove('was-invalid');
    if (val) {
      if (val % 0.25 !== 0) {
        input.classList.add('was-invalid');
        isValid = false;
      } else {
        hasQty = true;
      }
    }
  });

  document.getElementById('modalSave').disabled = !(isValid && hasQty);
}

document.getElementById('expenseModal').addEventListener('show.bs.modal', () => {
  buildModalFields();
  document.getElementById('modalItem').value = '';
  document.getElementById('modalAmount').value = '';
  document.getElementById('modalPayer').value = '';
  setTimeout(() => document.getElementById('modalItem').focus(), 200);
});

document.getElementById('expenseForm').addEventListener('input', validateModal);

document.getElementById('expenseForm').addEventListener('submit', e => {
  e.preventDefault();
  const name = document.getElementById('modalItem').value.trim();
  const amount = parseFloat(document.getElementById('modalAmount').value);
  const payer = document.getElementById('modalPayer').value;
  const qtys = {};
  document.querySelectorAll('.modal-qty').forEach(input => {
    const n = input.dataset.name;
    const q = parseFloat(input.value);
    if (q && q % 0.25 === 0) qtys[n] = q;
  });

  items.push({ name, amount, payer, quantities: qtys });
  bootstrap.Modal.getInstance(document.getElementById('expenseModal')).hide();
  saveToLocal();
  renderTable();
});

function calculateSimplifiedTransactions(balancesObj) {
  const balances = Object.fromEntries(Object.entries(balancesObj).map(([k, v]) => [k, +v.toFixed(2)]));
  const transactions = [];

  const debtors = Object.entries(balances).filter(([_, b]) => b < -0.01).sort((a, b) => a[1] - b[1]);
  const creditors = Object.entries(balances).filter(([_, b]) => b > 0.01).sort((a, b) => b[1] - a[1]);

  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const [debtor, dAmt] = debtors[i];
    const [creditor, cAmt] = creditors[j];
    const amt = Math.min(-dAmt, cAmt);

    transactions.push({ from: debtor, to: creditor, amount: parseFloat(amt.toFixed(2)) });
    debtors[i][1] += amt;
    creditors[j][1] -= amt;

    if (Math.abs(debtors[i][1]) < 0.01) i++;
    if (creditors[j][1] < 0.01) j++;
  }

  return transactions;
}

function calculateSplit() {
  if (items.length === 0) {
    alert("📭 No expenses added yet. Please add at least one entry to calculate the split.");
    return;
  }

  const balances = {};
  participants.forEach(p => balances[p] = 0);

  let grandTotal = 0;
  let valid = true;

  items.forEach(item => {
    const { amount, payer, quantities } = item;
    const totalQty = Object.values(quantities).reduce((s, q) => s + q, 0);
    if (!Number.isInteger(amount) || totalQty === 0) {
      valid = false;
      return;
    }

    const rate = amount / totalQty;
    for (const [p, qty] of Object.entries(quantities)) {
      balances[p] -= qty * rate;
    }

    balances[payer] += amount;
    grandTotal += amount;
  });

  if (!valid) {
    alert("⚠️ Please ensure amounts are whole and at least one quantity is entered.");
    return;
  }

  const simplified = calculateSimplifiedTransactions(balances);
  let shareMessage = `🛒 *SplitKart Summary*\nTotal Spent: ₹${grandTotal.toFixed(0)}\n\n💸 *Settlements:*\n`;
  let result = `<div class="alert alert-info"><strong>Total Spent:</strong> ₹${grandTotal.toFixed(0)}</div>`;
  result += `<h5>Who Owes Whom</h5><ul class="list-group">`;

  if (simplified.length === 0) {
    result += `<li class="list-group-item">All settled up! 🎉</li>`;
    shareMessage += `Everyone is settled. 🎉\n`;
  } else {
    simplified.forEach(({ from, to, amount }) => {
      const line = `${from} owes ₹${amount.toFixed(2)} to ${to}`;
      result += `<li class="list-group-item">${line}</li>`;
      shareMessage += `• ${line}\n`;
    });
  }

  shareMessage += `\n📦 *Items Purchased:*\n`;
  items.forEach(item => {
    shareMessage += `• *${item.name}* – ₹${item.amount} (Paid by ${item.payer})\n`;
    const lines = Object.entries(item.quantities)
      .filter(([_, q]) => q > 0)
      .map(([name, q]) => `   - ${name}: ${q}`);
    shareMessage += lines.join('\n') + '\n';
  });

  result += `</ul>`;
  result += `<div class="mt-3 text-center">
    <a class="btn btn-success w-100 d-inline-flex align-items-center justify-content-center gap-2"
       href="https://wa.me/?text=${encodeURIComponent(shareMessage)}" target="_blank">
      <img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" width="20" height="20" alt="WhatsApp" />
      Share on WhatsApp
    </a>
  </div>`;

  document.getElementById('result').innerHTML = result;
}

document.addEventListener('DOMContentLoaded', () => {
  renderHeader();
  loadFromLocal();
  renderTable();
});

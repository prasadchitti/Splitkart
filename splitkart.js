const participants = ['Siva', 'Medicherla Sai', 'Chitti Sai', 'Eemani Sai'];
let currentGroup = null;
let items = [];
let unsubscribe = null;

function normalizeGroupName(name) {
  const trimmed = name.trim().toLowerCase();
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}
function renderHeader() {
  const row = document.querySelector('#headerRow tr');
  row.innerHTML = `
    <th>Item</th><th>Amount</th><th>Payer</th>
    ${participants.map(p => `<th class="hide-mobile text-center">${p}</th>`).join('')}
    <th>Action</th>`;
}
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast text-bg-${type} border-0 toast-animated show`;
  toast.setAttribute('role', 'alert');
  toast.setAttribute('aria-live', 'assertive');
  toast.setAttribute('aria-atomic', 'true');
  Object.assign(toast.style, {
    position: 'fixed',
    top: '1rem',
    right: '1rem',
    zIndex: 1055,
    minWidth: '260px',
    boxShadow: '0 0.25rem 0.75rem rgba(0,0,0,0.15)'
  });
  toast.innerHTML = `
    <div class="d-flex">
      <div class="toast-body">${message}</div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
    </div>`;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.classList.remove('show');
    toast.classList.add('hide');
    setTimeout(() => toast.remove(), 500);
  }, 3000);
}

// 🔁 Real-time listener
function loadGroup(name) {
  if (unsubscribe) unsubscribe(); // cleanup old listener
  currentGroup = name;
  renderHeader();
  unsubscribe = db.collection('groups').doc(name).onSnapshot(doc => {
    const data = doc.data();
    if (data?.expenses) {
      items = data.expenses;
      renderTable();
    }
  });
}

// 🔥 Save updated expense list
function saveToFirestore() {
  if (!currentGroup) return;
  db.collection('groups').doc(currentGroup).update({ expenses: items });
}

// ➕ Create group (modal)
document.getElementById('createGroupBtn').addEventListener('click', () => {
  const rawName = document.getElementById('newGroupName').value;
  const name = normalizeGroupName(rawName);

  if (name.length < 3) {
    showToast("⚠️ Group name must be at least 3 characters.", "warning");
    return;
  }

  db.collection('groups').doc(name).get().then(doc => {
    if (doc.exists) {
      showToast("⚠️ Group already exists.", "warning");
    } else {
      db.collection('groups').doc(name).set({
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        expenses: []
      }).then(() => {
        bootstrap.Modal.getInstance(document.getElementById('groupCreateModal'))?.hide();
        fetchAllGroups(() => {
          document.getElementById('groupSelector').value = name;
          loadGroup(name);
          showToast("✅ Group created successfully!", "success");
        });
      });
    }
  });
});

// 🧠 Populate group dropdown
function fetchAllGroups(callback = () => {}) {
  db.collection('groups').get().then(snapshot => {
    const selector = document.getElementById('groupSelector');
    selector.innerHTML = `<option value="">-- Select Expense Group --</option>`;
    const groups = [];
    snapshot.forEach(doc => groups.push(doc.id));
    groups.sort();
    groups.forEach(name => {
      selector.innerHTML += `<option value="${name}">${name}</option>`;
    });
    selector.innerHTML += `<option value="__new__">➕ Create New Group</option>`;
    callback();
  });
}

// 🔁 Table UI
function renderTable() {
  const tbody = document.getElementById('itemsBody');
  tbody.innerHTML = '';
  items.forEach((item, index) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${item.name}</td>
      <td>₹${item.amount}</td>
      <td>${item.payer}</td>
      ${participants.map(p => `<td class="hide-mobile text-center">${item.quantities[p] || 0}</td>`).join('')}
      <td class="text-center">
        <button class="btn btn-sm btn-danger" onclick="deleteItem(${index})">✖️</button>
      </td>`;
    tbody.appendChild(row);
  });
}

function deleteItem(index) {
  items.splice(index, 1);
  saveToFirestore();
}

function confirmClear() {
  if (!currentGroup) return;
  if (items.length === 0) {
    showToast("⚠️ Nothing to delete.");
    bootstrap.Modal.getInstance(document.getElementById('confirmClearModal'))?.hide();
    return;
  }
  db.collection('groups').doc(currentGroup).update({ expenses: [] }).then(() => {
    showToast("✅ All expenses cleared.");
    bootstrap.Modal.getInstance(document.getElementById('confirmClearModal'))?.hide();
  });
}

document.getElementById('groupSelector').addEventListener('change', e => {
  const value = e.target.value;
  if (value === '__new__') {
    document.getElementById('newGroupName').value = '';
    new bootstrap.Modal(document.getElementById('groupCreateModal')).show();
  } else {
    loadGroup(value);
  }
});

document.addEventListener('DOMContentLoaded', () => {
  renderHeader();
  fetchAllGroups(); // 🟢 this loads groups into dropdown
});

// 👉 Show and populate modal when "Add Expense" is clicked
document.getElementById('addExpenseBtn').addEventListener('click', () => {
  if (!currentGroup) {
    showToast("⚠️ Please select a group before adding expenses.");
    return;
  }
  buildModalFields();
  document.getElementById('modalItem').value = '';
  document.getElementById('modalAmount').value = '';
  document.getElementById('modalPayer').value = '';
  const modal = new bootstrap.Modal(document.getElementById('expenseModal'));
  modal.show();
  setTimeout(() => document.getElementById('modalItem').focus(), 200);
});

// 👉 Build dynamic fields for participants
function buildModalFields() {
  document.getElementById('modalPayer').innerHTML =
    '<option value="">-- Choose --</option>' +
    participants.map(p => `<option value="${p}">${p}</option>`).join('');

  const container = document.getElementById('modalQuantities');
  container.innerHTML = '';
  participants.forEach(p => {
    const div = document.createElement('div');
    div.className = 'col-sm-6 mb-2';
    div.innerHTML = `
      <label class="form-label small">${p}</label>
      <input type="tel" inputmode="decimal" pattern="[0-9]+(\.[0-9]{1,2})?" 
       class="form-control modal-qty" data-name="${p}" />
`;
      // <input type="tel" inputmode="numeric" pattern="[0-9]*" class="form-control modal-qty" data-name="${p}" />

    container.appendChild(div);
  });
}

// 👉 Validate modal inputs
document.getElementById('expenseForm').addEventListener('input', () => {
  const name = document.getElementById('modalItem').value.trim();
  const amount = parseFloat(document.getElementById('modalAmount').value);
  const payer = document.getElementById('modalPayer').value;
  const qtyInputs = document.querySelectorAll('.modal-qty');

  let valid = !!name && Number.isInteger(amount) && payer;
  let hasQty = false;

  qtyInputs.forEach(input => {
    const val = parseFloat(input.value);
    input.classList.remove('was-invalid');
    if (val) {
      if (val % 0.25 !== 0) {
        input.classList.add('was-invalid');
        valid = false;
      } else {
        hasQty = true;
      }
    }
  });

  document.getElementById('modalSave').disabled = !(valid && hasQty);
});

// 👉 Submit expense to Firestore
document.getElementById('expenseForm').addEventListener('submit', e => {
  e.preventDefault();
  const name = document.getElementById('modalItem').value.trim();
  const amount = parseFloat(document.getElementById('modalAmount').value);
  const payer = document.getElementById('modalPayer').value;

  const qtys = {};
  document.querySelectorAll('.modal-qty').forEach(input => {
    const p = input.dataset.name;
    const q = parseFloat(input.value);
    if (q && q % 0.25 === 0) qtys[p] = q;
  });

  items.push({ name, amount, payer, quantities: qtys });
  saveToFirestore();
  bootstrap.Modal.getInstance(document.getElementById('expenseModal')).hide();
});
// 📊 Calculate who owes whom
function calculateSimplifiedTransactions(balancesObj) {
  const balances = Object.fromEntries(
    Object.entries(balancesObj).map(([k, v]) => [k, +v.toFixed(2)])
  );
  const transactions = [];
  const debtors = Object.entries(balances).filter(([_, b]) => b < -0.01).sort((a, b) => a[1] - b[1]);
  const creditors = Object.entries(balances).filter(([_, b]) => b > 0.01).sort((a, b) => b[1] - a[1]);

  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const [debtor, dAmt] = debtors[i];
    const [creditor, cAmt] = creditors[j];
    const amt = Math.min(-dAmt, cAmt);

    transactions.push({ from: debtor, to: creditor, amount: +amt.toFixed(2) });
    debtors[i][1] += amt;
    creditors[j][1] -= amt;

    if (Math.abs(debtors[i][1]) < 0.01) i++;
    if (creditors[j][1] < 0.01) j++;
  }

  return transactions;
}

// 🧮 Main split logic
function calculateSplit() {
  if (!items.length) {
    alert("📭 No expenses to split.");
    return;
  }

  const balances = Object.fromEntries(participants.map(p => [p, 0]));
  let grandTotal = 0;
  let valid = true;

  items.forEach(({ amount, payer, quantities }) => {
    const totalQty = Object.values(quantities).reduce((s, q) => s + q, 0);
    if (!Number.isInteger(amount) || totalQty === 0) {
      valid = false;
      return;
    }
    const rate = amount / totalQty;
    for (const [p, q] of Object.entries(quantities)) {
      balances[p] -= q * rate;
    }
    balances[payer] += amount;
    grandTotal += amount;
  });

  if (!valid) {
    alert("⚠️ Please correct invalid entries before calculating.");
    return;
  }

  const simplified = calculateSimplifiedTransactions(balances);
  let result = `<div class="alert alert-info"><strong>Total Spent:</strong> ₹${grandTotal.toFixed(0)}</div>`;
  result += `<h5>Who Owes Whom</h5><ul class="list-group">`;

  if (!simplified.length) {
    result += `<li class="list-group-item">All settled up! 🎉</li>`;
  } else {
    simplified.forEach(({ from, to, amount }) => {
      result += `<li class="list-group-item">${from} owes ₹${amount.toFixed(2)} to ${to}</li>`;
    });
  }

  result += `</ul><div class="mt-3 text-center">
    <a class="btn btn-success w-100 d-inline-flex align-items-center justify-content-center gap-2"
       href="https://wa.me/?text=${encodeURIComponent(generateShareMessage(grandTotal, simplified))}" target="_blank">
      <img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" width="20" height="20" alt="WhatsApp" />
      Share on WhatsApp
    </a>
  </div>`;

  document.getElementById('result').innerHTML = result;
}

// 📝 Format WhatsApp summary
function generateShareMessage(grandTotal, simplified) {
  let msg = `🛒 *SplitKart Summary*\nTotal Spent: ₹${grandTotal}\n\n💸 *Settlements:*\n`;
  if (!simplified.length) {
    msg += `Everyone is settled. 🎉\n`;
  } else {
    simplified.forEach(({ from, to, amount }) => {
      msg += `• ${from} owes ₹${amount.toFixed(2)} to ${to}\n`;
    });
  }

  msg += `\n📦 *Items Purchased:*\n`;
  items.forEach(item => {
    msg += `• *${item.name}* – ₹${item.amount} (Paid by ${item.payer})\n`;
    Object.entries(item.quantities)
      .filter(([_, q]) => q > 0)
      .forEach(([name, q]) => {
        msg += `   - ${name}: ${q}\n`;
      });
  });

  return msg;
}


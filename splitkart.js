const participants = ['Siva', 'Medicherla Sai', 'Chitti Sai', 'Eemani Sai'];


let currentGroup = null;
let items = [];

function normalizeGroupName(name) {
  const trimmed = name.trim().toLowerCase();
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}


// 👉 Group Management
function normalizeGroupName(name) {
  const trimmed = name.trim().toLowerCase();
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

document.getElementById('createGroupBtn').addEventListener('click', () => {
  let rawName = document.getElementById('newGroupName').value;
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





function loadGroup(name) {
  currentGroup = name;
  if (!name) return;
  db.collection('groups').doc(name).get().then(doc => {
    if (doc.exists) {
      items = doc.data().expenses || [];
      renderTable();
    } else {
      alert('Group not found');
    }
  });
}

function fetchAllGroups(callback = () => {}) {
  db.collection('groups').get().then(snapshot => {
    const selector = document.getElementById('groupSelector');
    selector.innerHTML = `<option value="">-- Select Expense Group --</option>`;

    let groups = [];
    snapshot.forEach(doc => groups.push(doc.id));
    groups.sort();

    groups.forEach(name => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      selector.appendChild(opt);
    });

    // Add Create New
    const createOpt = document.createElement('option');
    createOpt.value = '__new__';
    createOpt.textContent = '➕ Create New Group';
    selector.appendChild(createOpt);

    callback();
  });
}


function confirmDeleteGroup(name) {
  const modal = new bootstrap.Modal(document.getElementById('deleteGroupModal'));
  modal.show();

  document.getElementById('confirmDeleteGroupBtn').onclick = () => {
    db.collection('groups').doc(name).delete().then(() => {
      if (currentGroup === name) {
        currentGroup = null;
        items = [];
        document.getElementById('result').innerHTML = '';
        renderTable();
      }
      modal.hide();
      fetchAllGroups();
      showToast(`🗑️ Group '${name}' deleted.`, 'success');
    }).catch(() => {
      showToast("❌ Failed to delete group.", 'danger');
    });
  };
}



function saveToFirestore() {
  if (!currentGroup) return;
  db.collection('groups').doc(currentGroup).update({ expenses: items });
}

// 👉 UI Rendering
function renderHeader() {
  const row = document.querySelector('#headerRow tr');
  row.innerHTML = `
    <th>Item</th><th>Amount</th><th>Payer</th>
    ${participants.map(p => `<th class="hide-mobile text-center">${p}</th>`).join('')}
    <th>Action</th>`;
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
  renderTable();
}

function confirmClear() {
  if (!currentGroup) return;

  if (items.length === 0) {
    showToast("⚠️ Nothing to delete in this group.");
    const modal = bootstrap.Modal.getInstance(document.getElementById('confirmClearModal'));
    modal?.hide();
    return;
  }

  db.collection('groups').doc(currentGroup).update({ expenses: [] }).then(() => {
    items.length = 0;
    renderTable();
    document.getElementById('result').innerHTML = '';
    const modal = bootstrap.Modal.getInstance(document.getElementById('confirmClearModal'));
    modal?.hide();
    showToast("✅ Group expenses cleared successfully!");
  });
}


function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast text-bg-${type} border-0 toast-animated show`;
  toast.setAttribute('role', 'alert');
  toast.setAttribute('aria-live', 'assertive');
  toast.setAttribute('aria-atomic', 'true');

  toast.style.position = 'fixed';
  toast.style.top = '1rem';
  toast.style.right = '1rem';
  toast.style.zIndex = 1055;
  toast.style.minWidth = '260px';
  toast.style.boxShadow = '0 0.25rem 0.75rem rgba(0,0,0,0.15)';

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



// 👉 Modal & Form Handling
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
      <input type="number" class="form-control modal-qty" step="0.25" min="0" data-name="${p}" />`;
    container.appendChild(div);
  });

  const datalist = document.getElementById('itemSuggestions');
  datalist.innerHTML = '';
  predefinedItemNames.forEach(name => {
    const option = document.createElement('option');
    option.value = name;
    datalist.appendChild(option);
  });
}

function validateModal() {
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
}

// 👉 Expense Submission
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
    const p = input.dataset.name;
    const q = parseFloat(input.value);
    if (q && q % 0.25 === 0) qtys[p] = q;
  });

  items.push({ name, amount, payer, quantities: qtys });
  bootstrap.Modal.getInstance(document.getElementById('expenseModal')).hide();
  saveToFirestore();
  renderTable();
});

// 👉 Split Calculation (unchanged)
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

    transactions.push({ from: debtor, to: creditor, amount: +amt.toFixed(2) });
    debtors[i][1] += amt;
    creditors[j][1] -= amt;

    if (Math.abs(debtors[i][1]) < 0.01) i++;
    if (creditors[j][1] < 0.01) j++;
  }

  return transactions;
}

function calculateSplit() {
  if (!items.length) {
    alert("📭 No expenses yet.");
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
    for (const [p, q] of Object.entries(quantities)) {
      balances[p] -= q * rate;
    }
    balances[payer] += amount;
    grandTotal += amount;
  });

  if (!valid) {
    alert("⚠️ Invalid entries.");
    return;
  }

  const simplified = calculateSimplifiedTransactions(balances);
  let result = `<div class="alert alert-info"><strong>Total Spent:</strong> ₹${grandTotal.toFixed(0)}</div>`;
  result += `<h5>Who Owes Whom</h5><ul class="list-group">`;

  if (simplified.length === 0) {
    result += `<li class="list-group-item">All settled up! 🎉</li>`;
  } else {
    simplified.forEach(({ from, to, amount }) => {
      result += `<li class="list-group-item">${from} owes ₹${amount.toFixed(2)} to ${to}</li>`;
    });
  }

  result += `</ul>`;
  result += `<div class="mt-3 text-center">
    <a class="btn btn-success w-100 d-inline-flex align-items-center justify-content-center gap-2"
       href="https://wa.me/?text=${encodeURIComponent(generateShareMessage(grandTotal, simplified))}" target="_blank">
      <img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" width="20" height="20" alt="WhatsApp" />
      Share on WhatsApp
    </a>
  </div>`;

  document.getElementById('result').innerHTML = result;
}

function generateShareMessage(grandTotal, simplified) {
  let message = `🛒 *SplitKart Summary*\nTotal Spent: ₹${grandTotal}\n\n💸 *Settlements:*\n`;
  if (simplified.length === 0) {
    message += `Everyone is settled. 🎉\n`;
  } else {
    simplified.forEach(({ from, to, amount }) => {
      message += `• ${from} owes ₹${amount.toFixed(2)} to ${to}\n`;
    });
  }

  message += `\n📦 *Items Purchased:*\n`;
  items.forEach(item => {
    message += `• *${item.name}* – ₹${item.amount} (Paid by ${item.payer})\n`;
    const lines = Object.entries(item.quantities)
      .filter(([_, q]) => q > 0)
      .map(([name, q]) => `   - ${name}: ${q}`);
    message += lines.join('\n') + '\n';
  });

  return message;
}

// 🔁 Initialize everything on load
document.addEventListener('DOMContentLoaded', () => {
  renderHeader();
  fetchAllGroups();
});

document.getElementById('addExpenseBtn').addEventListener('click', () => {
  if (!currentGroup) {
    showToast("⚠️ Please select a group before adding expenses.");
    return;
  }

  const modal = new bootstrap.Modal(document.getElementById('expenseModal'));
  modal.show();
});

document.getElementById('clearAllBtn').addEventListener('click', () => {
  if (!currentGroup) {
    showToast("⚠️ Please select a group first.", "warning");
    return;
  }

  const modal = new bootstrap.Modal(document.getElementById('confirmClearModal'));
  modal.show();
});

document.getElementById('groupSelector').addEventListener('change', e => {
  const value = e.target.value;
  if (value === '__new__') {
    document.getElementById('newGroupName').value = '';
    const modal = new bootstrap.Modal(document.getElementById('groupCreateModal'));
    modal.show();
    return;
  }

  loadGroup(value);
});

// Show confirmation modal
document.getElementById('deleteGroupBtn').addEventListener('click', () => {
  if (!currentGroup) {
    showToast("⚠️ Please select a group to delete.", "warning");
    return;
  }
  const modal = new bootstrap.Modal(document.getElementById('deleteGroupModal'));
  modal.show();
});

// Handle deletion confirmation
document.getElementById('confirmDeleteGroupBtn').addEventListener('click', () => {
  if (!currentGroup) return;

  db.collection('groups').doc(currentGroup).delete().then(() => {
    currentGroup = null;
    items = [];
    document.getElementById('groupSelector').value = '';
    document.getElementById('result').innerHTML = '';
    renderTable();
    fetchAllGroups();

    bootstrap.Modal.getInstance(document.getElementById('deleteGroupModal'))?.hide();
    showToast("🗑️ Group deleted successfully.", "success");
  }).catch(err => {
    showToast("❌ Failed to delete group. Try again.", "danger");
  });
});




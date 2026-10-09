import { state } from '../state/store.js';
import { supabase } from '../config/supabase.js';
import { formatInr } from '../utils/crypto.js';

export function renderAccountsView() {
  const content = document.getElementById('main-content');
  const titleEl = document.getElementById('page-title');
  if (titleEl) titleEl.innerText = 'Accounts & Reports';

  const totalIncome = state.payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const totalExpenses = state.expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const netProfit = totalIncome - totalExpenses;

  content.innerHTML = `
    <!-- Finance Highlights -->
    <div class="metrics-grid">
      <div class="metric-card">
        <span class="metric-title">Total Revenue Collected</span>
        <div class="metric-value" style="color: var(--alert-green); margin-top: 10px;">${formatInr(totalIncome)}</div>
        <span class="metric-subtitle">${state.payments.length} transactions recorded</span>
      </div>

      <div class="metric-card">
        <span class="metric-title">Total Operational Expenses</span>
        <div class="metric-value" style="color: var(--alert-red); margin-top: 10px;">${formatInr(totalExpenses)}</div>
        <span class="metric-subtitle">Rent, salaries, maintenance</span>
      </div>

      <div class="metric-card">
        <span class="metric-title">Net Gym Profit</span>
        <div class="metric-value" style="color: ${netProfit >= 0 ? 'var(--alert-green)' : 'var(--alert-red)'}; margin-top: 10px;">
          ${formatInr(netProfit)}
        </div>
        <span class="metric-subtitle">Audited financial balance</span>
      </div>
    </div>

    <!-- Actions Bar -->
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 12px; width: 100%;">
      <h3 style="font-size: 18px; margin: 0;">Recent Payments & Ledger</h3>
      <div style="display: flex; gap: 8px; flex-wrap: wrap; width: 100%; max-width: 360px;">
        <button class="btn-secondary" style="flex: 1;" onclick="window.recordExpenseModal()"><i data-lucide="plus"></i> Add Expense</button>
        <button class="btn-primary" style="flex: 1;" onclick="window.exportCsv()"><i data-lucide="download"></i> Export CSV</button>
      </div>
    </div>

    <!-- Desktop Table View -->
    <div class="data-table-container desktop-table-view">
      <table class="data-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Type</th>
            <th>Amount</th>
            <th>Mode</th>
            <th>Note</th>
          </tr>
        </thead>
        <tbody>
          ${state.payments.slice(0, 15).map(p => `
            <tr>
              <td>${new Date(p.created_at || Date.now()).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
              <td><span class="alert-tag yellow" style="font-size: 10px;">${p.type}</span></td>
              <td><strong style="color: var(--alert-green);">${formatInr(p.amount)}</strong></td>
              <td>${p.mode}</td>
              <td style="color: var(--text-muted);">${p.note || 'Membership payment'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <!-- Mobile Transaction Cards -->
    <div class="transaction-mobile-cards">
      ${state.payments.length === 0 ? `
        <div class="metric-card" style="text-align: center; padding: 32px;">
          <p style="color: var(--text-muted); font-size: 13px;">No transactions recorded yet.</p>
        </div>
      ` : state.payments.slice(0, 15).map(p => `
        <div class="transaction-mobile-card">
          <div>
            <div style="font-size: 14px; font-weight: 800; color: #ffffff;">${p.note || 'Membership payment'}</div>
            <div style="font-size: 11px; color: var(--text-muted); margin-top: 3px;">
              ${new Date(p.created_at || Date.now()).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} &bull; <span style="text-transform: uppercase;">${p.mode}</span>
            </div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 16px; font-weight: 800; color: var(--alert-green);">${formatInr(p.amount)}</div>
            <span class="alert-tag yellow" style="font-size: 9px; padding: 2px 6px; margin-top: 4px; display: inline-block;">Received</span>
          </div>
        </div>
      `).join('')}
    </div>
  `;

  lucide.createIcons();
}

window.recordExpenseModal = () => {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'expense-modal';

  modal.innerHTML = `
    <div class="modal-card">
      <div class="modal-header">
        <h2>Record Expense</h2>
        <button class="close-btn" onclick="document.getElementById('expense-modal').remove()"><i data-lucide="x"></i></button>
      </div>

      <div class="form-group">
        <label class="form-label">Category</label>
        <select id="exp-category" class="form-select">
          <option value="rent">Rent</option>
          <option value="electricity">Electricity / Utilities</option>
          <option value="salary">Staff Salary</option>
          <option value="equipment">Equipment Maintenance</option>
          <option value="other">Other</option>
        </select>
      </div>

      <div class="form-group">
        <label class="form-label">Amount (₹)</label>
        <input type="number" id="exp-amount" class="form-input" required placeholder="5000" />
      </div>

      <div class="form-group">
        <label class="form-label">Note / Reference</label>
        <input type="text" id="exp-note" class="form-input" placeholder="e.g. Paid via Bank Transfer" />
      </div>

      <div style="display: flex; justify-content: flex-end; gap: 12px; margin-top: 24px;">
        <button class="btn-secondary" onclick="document.getElementById('expense-modal').remove()">Cancel</button>
        <button class="btn-primary" id="save-expense-btn">Record Expense</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  lucide.createIcons();

  document.getElementById('save-expense-btn').addEventListener('click', async () => {
    const category = document.getElementById('exp-category').value;
    const amount = Number(document.getElementById('exp-amount').value) || 0;
    const note = document.getElementById('exp-note').value.trim();

    const newExp = {
      id: 'exp_' + Date.now(),
      title: note || category,
      category,
      amount,
      spent_on: new Date().toISOString().split('T')[0],
      payment_mode: 'bank_transfer'
    };

    state.expenses.unshift(newExp);
    if (state.user && !state.isDemoMode) {
      await supabase.from('expenses').insert(newExp);
    }

    document.getElementById('expense-modal').remove();
    renderAccountsView();
  });
};

window.exportCsv = () => {
  let csv = "Date,Type,Amount,Mode,Note\n";
  state.payments.forEach(p => {
    csv += `"${p.paid_on || p.created_at}","${p.type}","${p.amount}","${p.mode}","${p.note || ''}"\n`;
  });
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Shape_Gym_Accounts_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
};

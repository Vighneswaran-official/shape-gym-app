import { state, loadDashboardData } from '../state/store.js';
import { supabase } from '../config/supabase.js';
import { formatInr } from '../utils/crypto.js';

export function renderPlansView() {
  const content = document.getElementById('main-content');
  const titleEl = document.getElementById('page-title');
  if (titleEl) titleEl.innerText = 'Membership Plans';

  content.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; flex-wrap: wrap; gap: 12px;">
      <p style="color: var(--text-secondary); font-size: 13px; margin: 0;">
        Snapshot Protection Active: Editing a plan definition never alters past subscription contracts.
      </p>
      <button class="btn-primary" id="add-plan-btn">
        <i data-lucide="plus"></i> Create Plan
      </button>
    </div>

    <div class="renewals-grid">
      ${state.plans.map(p => `
        <div class="metric-card" style="border-color: ${p.is_active ? 'var(--border-subtle)' : 'rgba(255, 255, 255, 0.05)'};">
          <div class="metric-header">
            <div>
              <h3 style="font-size: 18px; margin-bottom: 2px;">${p.name}</h3>
              <span style="color: var(--text-muted); font-size: 12px;">${p.duration_days} Days Duration</span>
            </div>
            <span class="alert-tag ${p.is_active ? 'yellow' : 'expired'}" style="font-size: 10px;">
              ${p.is_active ? 'Active' : 'Deactivated'}
            </span>
          </div>

          <div class="metric-value" style="color: var(--primary); margin: 16px 0 8px;">
            ${formatInr(p.fee)}
          </div>

          <p style="color: var(--text-secondary); font-size: 12px; margin-bottom: 20px;">
            ${p.description || 'Full gym and program access included.'}
          </p>

          <div style="display: flex; gap: 8px;">
            <button class="btn-sm btn-call" onclick="window.editPlan('${p.id}')">
              <i data-lucide="edit"></i> Edit Rate
            </button>
            <button class="btn-sm btn-call" onclick="window.togglePlanActive('${p.id}', ${!p.is_active})">
              ${p.is_active ? 'Deactivate' : 'Activate'}
            </button>
          </div>
        </div>
      `).join('')}
    </div>
  `;

  lucide.createIcons();

  document.getElementById('add-plan-btn').addEventListener('click', () => {
    window.openPlanModal();
  });
}

window.openPlanModal = (plan = null) => {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'plan-modal';

  modal.innerHTML = `
    <div class="modal-card">
      <div class="modal-header">
        <h2>${plan ? 'Edit Plan' : 'Create Membership Plan'}</h2>
        <button class="close-btn" onclick="document.getElementById('plan-modal').remove()"><i data-lucide="x"></i></button>
      </div>

      <div class="form-group">
        <label class="form-label">Plan Name</label>
        <input type="text" id="modal-plan-name" class="form-input" value="${plan?.name || ''}" placeholder="e.g. 3 Months" required />
      </div>

      <div class="form-group">
        <label class="form-label">Duration (Days)</label>
        <input type="number" id="modal-plan-days" class="form-input" value="${plan?.duration_days || 90}" required />
      </div>

      <div class="form-group">
        <label class="form-label">Fee (INR ₹)</label>
        <input type="number" id="modal-plan-fee" class="form-input" value="${plan?.fee || 4999}" required />
      </div>

      <div class="form-group">
        <label class="form-label">Description</label>
        <textarea id="modal-plan-desc" class="form-textarea" rows="2">${plan?.description || ''}</textarea>
      </div>

      <div style="display: flex; justify-content: flex-end; gap: 12px; margin-top: 24px;">
        <button class="btn-secondary" onclick="document.getElementById('plan-modal').remove()">Cancel</button>
        <button class="btn-primary" id="save-plan-btn">Save Plan</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  lucide.createIcons();

  document.getElementById('save-plan-btn').addEventListener('click', async () => {
    const name = document.getElementById('modal-plan-name').value.trim();
    const duration_days = Number(document.getElementById('modal-plan-days').value) || 90;
    const fee = Number(document.getElementById('modal-plan-fee').value) || 4999;
    const description = document.getElementById('modal-plan-desc').value.trim();

    if (plan) {
      plan.name = name;
      plan.duration_days = duration_days;
      plan.fee = fee;
      plan.description = description;
      if (state.user && !state.isDemoMode) {
        await supabase.from('membership_plans').update({ name, duration_days, fee, description }).eq('id', plan.id);
      }
    } else {
      const newPlan = { id: 'plan_' + Date.now(), name, duration_days, fee, description, is_active: true };
      state.plans.push(newPlan);
      if (state.user && !state.isDemoMode) {
        await supabase.from('membership_plans').insert(newPlan);
      }
    }

    document.getElementById('plan-modal').remove();
    renderPlansView();
  });
};

window.editPlan = (planId) => {
  const plan = state.plans.find(p => p.id === planId);
  if (plan) window.openPlanModal(plan);
};

window.togglePlanActive = async (planId, active) => {
  const plan = state.plans.find(p => p.id === planId);
  if (plan) {
    plan.is_active = active;
    if (state.user && !state.isDemoMode) {
      await supabase.from('membership_plans').update({ is_active: active }).eq('id', planId);
    }
    renderPlansView();
  }
};

import { state, computeDashboardMetrics } from '../state/store.js';
import { supabase } from '../config/supabase.js';
import { formatInr } from '../utils/crypto.js';
import confetti from 'canvas-confetti';

/**
 * WhatsApp reminder sender
 */
export function sendWhatsAppReminder(name, phone, planName, endDate, balance) {
  const cleanPhone = phone.length === 10 ? `91${phone}` : phone;
  const dateStr = endDate ? new Date(endDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'soon';
  const duesMsg = balance > 0 ? ` Outstanding balance: ${formatInr(balance)}.` : '';
  const text = encodeURIComponent(`Hello ${name}! 👋 This is a reminder from Shape Fitness Club. Your ${planName} membership expires on ${dateStr}.${duesMsg} Please visit the front desk to renew your subscription! 💪`);
  window.open(`https://api.whatsapp.com/send?phone=${cleanPhone}&text=${text}`, '_blank');
}

/**
 * Renewal Modal Component
 * Appends renewal cycle to member's continuous renewal history
 */
export function openRenewalModal(memberId, memberName, carriedBalance = 0, planId = null, onCompleteCallback) {
  const existingModal = document.getElementById('renewal-modal');
  if (existingModal) existingModal.remove();

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'renewal-modal';

  const defaultPlan = state.plans.find(p => p.id === planId) || state.plans[0];
  const totalDue = (defaultPlan?.fee || 0) + carriedBalance;

  modal.innerHTML = `
    <div class="modal-card" style="max-width: 480px;">
      <div class="modal-sheet-handle"></div>
      <div class="modal-header">
        <div>
          <h2 style="font-size: 18px; font-weight: 800; color: #fff;">Renew Membership</h2>
          <p style="color: var(--primary); font-size: 13px; font-weight: 700; margin-top: 4px;">${memberName}</p>
        </div>
        <button class="close-btn" onclick="document.getElementById('renewal-modal').remove()">
          <i data-lucide="x"></i>
        </button>
      </div>

      ${carriedBalance > 0 ? `
        <div style="background: rgba(245, 158, 11, 0.15); border: 1px solid var(--alert-yellow); padding: 12px; border-radius: 10px; margin-bottom: 16px; font-size: 13px; color: var(--alert-yellow);">
          ⚠️ Previous balance of <strong>${formatInr(carriedBalance)}</strong> will carry forward into this renewal.
        </div>
      ` : ''}

      <div class="form-group">
        <label class="form-label">Select Renewal Plan</label>
        <select id="renewal-plan-select" class="form-select">
          ${state.plans.map(p => `
            <option value="${p.id}" ${p.id === defaultPlan?.id ? 'selected' : ''}>
              ${p.name} (${p.duration_days} Days) - ${formatInr(p.fee)}
            </option>
          `).join('')}
        </select>
      </div>

      <div class="form-group">
        <label class="form-label">Amount Paid Now (₹)</label>
        <input type="number" id="renewal-paid-amount" class="form-input" value="${totalDue}" />
      </div>

      <div class="form-group">
        <label class="form-label">Payment Mode</label>
        <select id="renewal-payment-mode" class="form-select">
          <option value="UPI" selected>UPI (GPay / PhonePe / Paytm)</option>
          <option value="Cash">Cash</option>
          <option value="Card">Debit / Credit Card</option>
        </select>
      </div>

      <div style="display: flex; gap: 10px; margin-top: 24px;">
        <button class="btn-secondary" style="flex: 1; justify-content: center;" onclick="document.getElementById('renewal-modal').remove()">Cancel</button>
        <button class="btn-primary" style="flex: 1.5; justify-content: center;" id="confirm-renew-btn">Confirm Renewal</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  lucide.createIcons();

  document.getElementById('confirm-renew-btn').addEventListener('click', async () => {
    const selectedPlanId = document.getElementById('renewal-plan-select').value;
    const plan = state.plans.find(p => p.id === selectedPlanId);
    const amountPaid = Number(document.getElementById('renewal-paid-amount').value) || 0;
    const mode = document.getElementById('renewal-payment-mode').value;

    const totalAmt = plan.fee + carriedBalance;
    const balance = Math.max(0, totalAmt - amountPaid);

    const startDate = new Date().toISOString().split('T')[0];
    const endDate = new Date(Date.now() + plan.duration_days * 86400000).toISOString().split('T')[0];

    let newSubId = 'sub_' + Date.now();

    if (!state.isDemoMode && state.user) {
      try {
        const { data: subData } = await supabase.from('member_subscriptions').insert({
          member_id: memberId,
          plan_id: plan.id,
          plan_name_snapshot: plan.name,
          fee_snapshot: plan.fee,
          start_date: startDate,
          end_date: endDate,
          amount_due: totalAmt,
          amount_paid: amountPaid,
          balance: balance
        }).select().single();

        if (subData) newSubId = subData.id;

        if (amountPaid > 0 && subData) {
          await supabase.from('payments').insert({
            member_id: memberId,
            subscription_id: subData.id,
            amount: amountPaid,
            mode: mode,
            type: 'subscription_fee',
            note: `Renewal for ${plan.name}${carriedBalance > 0 ? ` (carried forward ${formatInr(carriedBalance)})` : ''}`
          });
        }
      } catch (err) {
        console.warn('Supabase renewal save failed, continuing locally:', err);
      }
    }

    // Update in-memory state
    state.subscriptions.push({
      id: newSubId,
      member_id: memberId,
      plan_id: plan.id,
      plan_name_snapshot: plan.name,
      fee_snapshot: plan.fee,
      start_date: startDate,
      end_date: endDate,
      amount_due: totalAmt,
      amount_paid: amountPaid,
      balance: balance
    });

    if (amountPaid > 0) {
      state.payments.unshift({
        id: 'pay_' + Date.now(),
        member_id: memberId,
        subscription_id: newSubId,
        amount: amountPaid,
        paid_on: startDate,
        mode: mode,
        type: 'subscription_fee'
      });
    }

    // Continuous renewal tracking on member
    const mem = state.members.find(m => m.id === memberId);
    if (mem) {
      if (!mem.renewal_history) mem.renewal_history = [];
      mem.renewal_history.push({
        cycle: mem.renewal_history.length + 1,
        plan_name: plan.name,
        start_date: startDate,
        end_date: endDate,
        renewed_on: startDate,
        fee: plan.fee,
        paid: amountPaid
      });
      mem.is_active = true; // Automatically reactivate
    }

    computeDashboardMetrics();
    confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
    modal.remove();

    if (onCompleteCallback) onCompleteCallback();
    alert(`🎉 Membership for ${memberName} renewed successfully for ${plan.duration_days} days!`);
  });
}

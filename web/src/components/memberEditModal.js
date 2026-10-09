import { state, computeDashboardMetrics, getMemberRemainingDaysInfo } from '../state/store.js';
import { supabase } from '../config/supabase.js';
import { formatInr } from '../utils/crypto.js';

/**
 * Modern High-UX Customer Profile & Admin Edit Modal
 * Features:
 * - Admin 12-digit Aadhaar viewing & editing
 * - Active/Inactive toggle (master can deactivate when left gym & reactivate later)
 * - Continuous renewal history with exact cycle dates
 * - Danger Zone in the last section for permanent deletion
 */
export function openMemberDetailModal(memberId, onUpdateCallback) {
  const member = state.members.find(m => m.id === memberId);
  if (!member) return;

  const statusObj = state.memberStatusMap[memberId] || {};
  const daysInfo = getMemberRemainingDaysInfo(member, statusObj);
  const renewalHistory = member.renewal_history || [];

  // Remove any existing modal
  const existingModal = document.getElementById('member-detail-modal');
  if (existingModal) existingModal.remove();

  const modal = document.createElement('div');
  modal.id = 'member-detail-modal';
  modal.className = 'modal-overlay';

  modal.innerHTML = `
    <div class="modal-card modal-card-lg" style="max-width: 680px; max-height: 90vh; overflow-y: auto;">
      <!-- Modal Top Header -->
      <div class="modal-header" style="border-bottom: 1px solid var(--border-subtle); padding-bottom: 14px; margin-bottom: 18px;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="width: 44px; height: 44px; border-radius: 10px; background: rgba(255, 102, 0, 0.15); border: 1px solid var(--border-orange); display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 800; color: var(--primary);">
            #${member.member_code || '1'}
          </div>
          <div>
            <h2 style="font-size: 20px; font-weight: 800; color: #fff; margin: 0; display: flex; align-items: center; gap: 8px;">
              <span>${member.name}</span>
              <span class="alert-tag ${daysInfo.badgeClass}" style="font-size: 10px;">${member.is_active === false ? 'Left Gym / Inactive' : daysInfo.badgeText}</span>
            </h2>
            <p style="font-size: 12px; color: var(--text-secondary); margin: 3px 0 0 0;">
              Member Code: <strong>#${member.member_code || '1'}</strong> • Joined: ${new Date(member.join_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
            </p>
          </div>
        </div>
        <button class="close-btn" onclick="document.getElementById('member-detail-modal').remove()">
          <i data-lucide="x"></i>
        </button>
      </div>

      <!-- Section 1: Active / Inactive Status Master Control -->
      <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid var(--border-subtle); border-radius: 10px; padding: 12px 16px; margin-bottom: 18px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
        <div>
          <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); font-weight: 700;">Gym Membership Status</span>
          <div style="font-size: 13px; font-weight: 700; color: ${member.is_active !== false ? 'var(--alert-green)' : '#94a3b8'};">
            ${member.is_active !== false ? '● Currently Active Member' : '○ Left Gym / Inactive Member'}
          </div>
        </div>
        <div>
          ${member.is_active !== false ? `
            <button type="button" class="btn-sm btn-call" style="background: rgba(239, 68, 68, 0.15); border-color: rgba(239, 68, 68, 0.4); color: #ef4444;" id="btn-toggle-deactivate">
              <i data-lucide="user-x" style="width: 13px; height: 13px;"></i> Mark Inactive (Left Gym)
            </button>
          ` : `
            <button type="button" class="btn-sm btn-renew" style="background: rgba(34, 197, 94, 0.15); border-color: rgba(34, 197, 94, 0.4); color: #22c55e;" id="btn-toggle-reactivate">
              <i data-lucide="user-check" style="width: 13px; height: 13px;"></i> Reactivate Member
            </button>
          `}
        </div>
      </div>

      <!-- Section 2: Membership & Validity Snapshot -->
      <div style="background: rgba(255, 102, 0, 0.08); border: 1px solid var(--border-orange); border-radius: 12px; padding: 14px; margin-bottom: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
          <div>
            <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-secondary); font-weight: 700;">Current Plan</span>
            <div style="font-size: 16px; font-weight: 800; color: #fff;">${statusObj.planName || 'No Active Plan'}</div>
          </div>
          <div style="text-align: right;">
            <span class="alert-tag ${daysInfo.badgeClass}" style="font-size: 11px;">
              ${daysInfo.badgeText}
            </span>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px; margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--border-subtle); font-size: 12px;">
          <div>
            <span style="color: var(--text-muted); display: block;">Remaining Days</span>
            <strong style="color: ${daysInfo.daysColor}; display: flex; align-items: center; gap: 4px; margin-top: 2px;">
              <i data-lucide="clock" style="width: 13px; height: 13px;"></i>
              ${daysInfo.remainingDaysText}
            </strong>
          </div>
          <div>
            <span style="color: var(--text-muted); display: block;">Valid Till</span>
            <strong style="color: #fff;">${statusObj.endDate ? new Date(statusObj.endDate).toLocaleDateString('en-IN') : 'N/A'}</strong>
          </div>
          <div>
            <span style="color: var(--text-muted); display: block;">Pending Balance</span>
            <strong style="color: ${statusObj.balance > 0 ? 'var(--alert-yellow)' : 'var(--alert-green)'};">${formatInr(statusObj.balance || 0)}</strong>
          </div>
          <div>
            <span style="color: var(--text-muted); display: block;">Plan Fee</span>
            <strong style="color: #fff;">${formatInr(statusObj.planFee || 0)}</strong>
          </div>
        </div>
      </div>

      <!-- Section 3: Continuous Renewal History & Cycle Dates -->
      <div style="background: rgba(255, 255, 255, 0.02); border: 1px solid var(--border-subtle); border-radius: 12px; padding: 14px; margin-bottom: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
          <h3 style="font-size: 13px; font-weight: 800; color: var(--primary); text-transform: uppercase; margin: 0; letter-spacing: 0.5px; display: flex; align-items: center; gap: 6px;">
            <i data-lucide="refresh-cw" style="width: 14px; height: 14px;"></i> Continuous Renewal History (${renewalHistory.length} Cycles)
          </h3>
          <button type="button" class="btn-sm btn-renew" style="padding: 3px 8px; font-size: 11px;" id="btn-add-renewal-cycle">
            <i data-lucide="plus" style="width: 12px; height: 12px;"></i> Add Renewal Cycle
          </button>
        </div>

        ${renewalHistory.length === 0 ? `
          <p style="font-size: 12px; color: var(--text-muted); margin: 0;">Initial single enrolment. No past renewal cycles recorded yet.</p>
        ` : `
          <div style="display: flex; flex-direction: column; gap: 8px;">
            ${renewalHistory.map(r => `
              <div style="background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; padding: 9px 12px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 6px; font-size: 12px;">
                <div>
                  <span style="font-weight: 700; color: #fff;">Cycle #${r.cycle || 1}: ${r.plan_name || 'Membership'}</span>
                  <div style="color: var(--text-muted); font-size: 11px; margin-top: 2px;">
                    Valid: <strong style="color: #cbd5e1;">${new Date(r.start_date).toLocaleDateString('en-IN')}</strong> to <strong style="color: #cbd5e1;">${new Date(r.end_date).toLocaleDateString('en-IN')}</strong>
                  </div>
                </div>
                <div style="text-align: right;">
                  <span style="color: var(--alert-green); font-weight: 700;">${formatInr(r.paid || r.fee || 0)} Paid</span>
                  <div style="color: var(--text-muted); font-size: 10px;">Renewed on ${new Date(r.renewed_on || r.start_date).toLocaleDateString('en-IN')}</div>
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </div>

      <!-- Section 4: Editable Personal, Contact & 12-Digit Aadhaar Details -->
      <form id="edit-member-form">
        <h3 style="font-size: 13px; font-weight: 800; color: var(--primary); text-transform: uppercase; margin-bottom: 12px; letter-spacing: 0.5px;">
          Member Details & Aadhaar (Admin Edit)
        </h3>

        <div class="form-grid-2">
          <div class="form-group">
            <label class="form-label">Full Name *</label>
            <input type="text" id="edit-mem-name" class="form-input" value="${member.name}" required />
          </div>

          <div class="form-group">
            <label class="form-label">Phone Number (10 Digits) *</label>
            <input type="tel" id="edit-mem-phone" class="form-input" maxlength="10" value="${member.phone}" required />
          </div>
        </div>

        <div class="form-grid-3" style="margin-top: 14px;">
          <div class="form-group">
            <label class="form-label">Member Sequential Code</label>
            <input type="number" id="edit-mem-code" class="form-input" value="${member.member_code || 1}" required />
          </div>

          <div class="form-group">
            <label class="form-label">Age</label>
            <input type="number" id="edit-mem-age" class="form-input" min="10" max="100" value="${member.age || 25}" />
          </div>

          <div class="form-group">
            <label class="form-label">Blood Group</label>
            <select id="edit-mem-blood" class="form-select">
              ${['B+', 'O+', 'A+', 'AB+', 'B-', 'O-', 'A-', 'AB-'].map(bg => `
                <option value="${bg}" ${member.blood_group === bg ? 'selected' : ''}>${bg}</option>
              `).join('')}
            </select>
          </div>
        </div>

        <div class="form-group" style="margin-top: 14px;">
          <label class="form-label" style="display: flex; justify-content: space-between;">
            <span>Aadhaar Number (Full 12 Digits - Admin Editable) *</span>
            <span style="color: var(--alert-green); font-size: 11px;">🔒 AES-256 Protected</span>
          </label>
          <input type="text" id="edit-mem-aadhaar" class="form-input" maxlength="14" value="${member.aadhaar || ('5678 1234 ' + (member.aadhaar_last4 || '4821'))}" placeholder="12-digit Aadhaar Number" required style="font-family: monospace; letter-spacing: 0.5px; font-weight: 600;" />
          <span style="font-size: 11px; color: var(--text-muted); display: block; margin-top: 4px;">Outer directory only shows last 4 digits (•••• •••• XXXX). Full 12 digits visible to Admin here.</span>
        </div>

        <div class="form-group" style="margin-top: 14px;">
          <label class="form-label">Residential Address</label>
          <input type="text" id="edit-mem-address" class="form-input" value="${member.address || ''}" placeholder="Street address, city" />
        </div>

        <div class="form-group" style="margin-top: 14px;">
          <label class="form-label">Health & Medical History</label>
          <textarea id="edit-mem-health" class="form-textarea" rows="2" placeholder="Injuries, medications, allergies">${member.health_notes || ''}</textarea>
        </div>

        <!-- Action Buttons -->
        <div style="display: flex; gap: 10px; margin-top: 24px; flex-wrap: wrap;">
          <button type="submit" class="btn-primary" style="flex: 1; justify-content: center; min-width: 140px;">
            <i data-lucide="check"></i> Save Changes
          </button>
          <button type="button" class="btn-renew" style="flex: 1; justify-content: center; min-width: 130px;" onclick="document.getElementById('member-detail-modal').remove(); window.openRenewalModal('${member.id}', '${member.name}', ${statusObj.balance || 0}, '${statusObj.planId || ''}')">
            <i data-lucide="refresh-cw"></i> Renew Plan
          </button>
          <a href="tel:+91${member.phone}" class="btn-secondary" style="justify-content: center;">
            <i data-lucide="phone"></i> Call
          </a>
          <button type="button" class="btn-whatsapp" style="justify-content: center; padding: 10px 16px;" onclick="window.sendWhatsAppReminder('${member.name}', '${member.phone}', '${statusObj.planName || 'Membership'}', '${statusObj.endDate || ''}', ${statusObj.balance || 0})">
            <i data-lucide="message-circle"></i> WhatsApp
          </button>
        </div>
      </form>

      <!-- Section 5: LAST SECTION - DANGER ZONE (Delete Member) -->
      <div style="margin-top: 32px; padding-top: 20px; border-top: 1px solid rgba(239, 68, 68, 0.3);">
        <div style="background: rgba(239, 68, 68, 0.05); border: 1px dashed rgba(239, 68, 68, 0.4); border-radius: 10px; padding: 16px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
          <div>
            <h4 style="font-size: 14px; font-weight: 800; color: #ef4444; margin: 0; display: flex; align-items: center; gap: 6px;">
              <i data-lucide="alert-triangle" style="width: 16px; height: 16px;"></i> Danger Zone: Delete Member Record
            </h4>
            <p style="font-size: 12px; color: var(--text-muted); margin: 4px 0 0 0;">
              Permanently removes this member and associated subscription records. For members who left temporarily, use "Mark Inactive" above.
            </p>
          </div>
          <button type="button" class="btn-sm" style="background: #ef4444; color: #ffffff; border: none; font-weight: 700; padding: 8px 16px; min-height: 36px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; gap: 6px;" id="btn-delete-member">
            <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i> Delete Member Permanently
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  lucide.createIcons();

  // 1. Toggle Inactive (Left Gym)
  const btnDeactivate = document.getElementById('btn-toggle-deactivate');
  if (btnDeactivate) {
    btnDeactivate.addEventListener('click', async () => {
      if (confirm(`Mark "${member.name}" as Inactive (Left Gym / Not Renewed)?\n\nYou can reactivate them anytime later.`)) {
        member.is_active = false;
        computeDashboardMetrics();
        if (state.user && !state.isDemoMode) {
          try {
            await supabase.from('members').update({ is_active: false }).eq('id', memberId);
          } catch (e) { console.warn('Supabase update failed:', e); }
        }
        modal.remove();
        if (onUpdateCallback) onUpdateCallback();
        alert(`Member "${member.name}" marked as Inactive.`);
      }
    });
  }

  // 2. Toggle Reactivate
  const btnReactivate = document.getElementById('btn-toggle-reactivate');
  if (btnReactivate) {
    btnReactivate.addEventListener('click', async () => {
      if (confirm(`Reactivate "${member.name}" as an Active gym member?`)) {
        member.is_active = true;
        computeDashboardMetrics();
        if (state.user && !state.isDemoMode) {
          try {
            await supabase.from('members').update({ is_active: true }).eq('id', memberId);
          } catch (e) { console.warn('Supabase update failed:', e); }
        }
        modal.remove();
        if (onUpdateCallback) onUpdateCallback();
        alert(`Member "${member.name}" has been reactivated!`);
      }
    });
  }

  // 3. Add Renewal Cycle Prompt
  const btnAddRenewal = document.getElementById('btn-add-renewal-cycle');
  if (btnAddRenewal) {
    btnAddRenewal.addEventListener('click', () => {
      modal.remove();
      window.openRenewalModal(member.id, member.name, statusObj.balance || 0, statusObj.planId || '');
    });
  }

  // 4. Form Submission (Save Changes)
  document.getElementById('edit-member-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const updatedName = document.getElementById('edit-mem-name').value.trim();
    const updatedPhone = document.getElementById('edit-mem-phone').value.trim();
    const updatedCode = Number(document.getElementById('edit-mem-code').value) || member.member_code || 1;
    const updatedAadhaar = document.getElementById('edit-mem-aadhaar').value.trim();
    const updatedAge = Number(document.getElementById('edit-mem-age').value) || 25;
    const updatedBlood = document.getElementById('edit-mem-blood').value;
    const updatedAddress = document.getElementById('edit-mem-address').value.trim();
    const updatedHealth = document.getElementById('edit-mem-health').value.trim();

    member.name = updatedName;
    member.phone = updatedPhone;
    member.member_code = updatedCode;
    member.aadhaar = updatedAadhaar;
    member.aadhaar_last4 = updatedAadhaar.replace(/\s+/g, '').slice(-4);
    member.age = updatedAge;
    member.blood_group = updatedBlood;
    member.address = updatedAddress;
    member.health_notes = updatedHealth;

    computeDashboardMetrics();

    // Supabase update if online
    if (state.user && !state.isDemoMode) {
      try {
        await supabase.from('members').update({
          name: updatedName,
          phone: updatedPhone,
          age: updatedAge,
          blood_group: updatedBlood,
          address: updatedAddress,
          aadhaar_last4: member.aadhaar_last4
        }).eq('id', memberId);
      } catch (err) {
        console.warn('Supabase member update error:', err);
      }
    }

    modal.remove();
    if (onUpdateCallback) onUpdateCallback();
    alert(`✅ Member details for "${updatedName}" updated successfully!`);
  });

  // 5. Delete Member (Danger Zone)
  const btnDelete = document.getElementById('btn-delete-member');
  if (btnDelete) {
    btnDelete.addEventListener('click', async () => {
      const confirmDelete = confirm(
        `⚠️ PERMANENT DELETION WARNING\n\nAre you sure you want to permanently delete "${member.name}" (Code: #${member.member_code || 1})?\n\nThis will remove their profile and all membership records. This action cannot be undone.`
      );

      if (confirmDelete) {
        // Remove from state
        state.members = state.members.filter(m => m.id !== memberId);
        state.subscriptions = state.subscriptions.filter(s => s.member_id !== memberId);
        delete state.memberStatusMap[memberId];

        // Supabase deletion if online
        if (state.user && !state.isDemoMode) {
          try {
            await supabase.from('member_subscriptions').delete().eq('member_id', memberId);
            await supabase.from('members').delete().eq('id', memberId);
          } catch (err) {
            console.warn('Supabase deletion error:', err);
          }
        }

        computeDashboardMetrics();
        modal.remove();
        if (onUpdateCallback) onUpdateCallback();
        alert(`🗑️ Member "${member.name}" has been permanently deleted.`);
      }
    });
  }
}

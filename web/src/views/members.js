import { state, getMemberRemainingDaysInfo, computeDashboardMetrics } from '../state/store.js';
import { maskAadhaar, formatInr } from '../utils/crypto.js';
import { exportWeeklyBackupExcel } from '../utils/excel.js';
import { openMemberDetailModal } from '../components/memberEditModal.js';
import { openBulkUpdateModal } from '../components/bulkUpdateModal.js';
import { openRenewalModal, sendWhatsAppReminder } from '../components/renewalModal.js';
import confetti from 'canvas-confetti';

/**
 * Renders the comprehensive Members Directory view
 */
export function renderMembersView() {
  const content = document.getElementById('main-content');
  const titleEl = document.getElementById('page-title');
  if (titleEl) titleEl.innerText = 'Members Directory';

  const query = (state.searchQuery || '').toLowerCase().trim();

  // Search logic supporting: Member Code (#1, 1), Phone (+91, 10 digits), Aadhaar (last 4 or full 12), and Name
  const filtered = state.members.filter(m => {
    if (query) {
      const codeStr = String(m.member_code || '').toLowerCase();
      const codeWithHash = `#${codeStr}`;
      const nameMatch = (m.name || '').toLowerCase().includes(query);
      const phoneMatch = (m.phone || '').includes(query);
      const codeMatch = codeStr === query || codeWithHash === query;
      const aadhaarRaw = (m.aadhaar || '').replace(/\s+/g, '');
      const aadhaarLast4 = (m.aadhaar_last4 || '').toLowerCase();
      const aadhaarMatch = aadhaarRaw.includes(query) || aadhaarLast4.includes(query);

      const matchesSearch = nameMatch || phoneMatch || codeMatch || aadhaarMatch;
      if (!matchesSearch) return false;
    }

    const statusObj = state.memberStatusMap[m.id] || {};
    if (state.memberFilterTab === 'near-expiry') {
      return statusObj.alertStatus === 'critical' || statusObj.alertStatus === 'expiring';
    }
    if (state.memberFilterTab === 'inactive') {
      return statusObj.alertStatus === 'expired' || statusObj.alertStatus === 'inactive' || m.is_active === false;
    }
    if (state.memberFilterTab === 'new-week') {
      if (!m.join_date) return false;
      const jd = new Date(m.join_date);
      const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
      return jd >= sevenDaysAgo;
    }
    if (state.memberFilterTab === 'new-month') {
      if (!m.join_date) return false;
      const jd = new Date(m.join_date);
      const firstDay = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      return jd >= firstDay;
    }
    return true; // 'all'
  });

  const lastBackupStr = localStorage.getItem('shape_last_weekly_backup') || 'Not taken yet';

  content.innerHTML = `
    <!-- Top Action Bar -->
    <div style="display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; width: 100%; align-items: center; justify-content: space-between;">
      <div style="flex: 1; min-width: 260px;">
        <input 
          type="text" 
          id="member-search-input" 
          class="form-input" 
          style="width: 100%;" 
          placeholder="Search by Code (#1, 2), Mobile, Aadhaar, or Name..." 
          value="${state.searchQuery || ''}" 
        />
      </div>
      <div style="display: flex; gap: 10px; flex-wrap: wrap;">
        <button class="btn-secondary" style="flex-shrink: 0;" id="btn-export-excel-backup" title="Download Excel (.xlsx) Backup with All Sheets">
          <i data-lucide="file-spreadsheet" style="color: var(--alert-green);"></i> Weekly Excel Backup
        </button>
        <button class="btn-secondary" style="flex-shrink: 0;" id="btn-open-bulk-update" title="Bulk Update Member Details">
          <i data-lucide="edit-3"></i> Bulk Update
        </button>
        <button class="btn-primary" style="flex-shrink: 0;" onclick="window.navigateTo('admission')">
          <i data-lucide="user-plus"></i> New Member
        </button>
      </div>
    </div>

    <!-- TOP SECTION: Priority Action (Near Expiry & Inactive Members) -->
    <div class="members-top-alerts">
      <div class="members-top-alerts-header">
        <div>
          <div style="font-size: 15px; font-weight: 800; color: var(--text-main); display: flex; align-items: center; gap: 8px;">
            <i data-lucide="alert-triangle" style="color: var(--primary); width: 18px; height: 18px;"></i>
            <span>Attention Required: Near Expiry & Inactive Members</span>
          </div>
          <div style="font-size: 12px; color: var(--text-secondary); margin-top: 2px;">
            Top section summary for immediate renewals, customer edits, and follow-ups.
          </div>
        </div>
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <span class="alert-tag red" style="font-size: 11px;">${state.nearExpiryList.length} Near Expiry</span>
          <span class="alert-tag expired" style="font-size: 11px;">${state.inactiveOrExpiredList.length} Inactive / Left Gym</span>
        </div>
      </div>

      ${(state.nearExpiryList.length === 0 && state.inactiveOrExpiredList.length === 0) ? `
        <div style="padding: 16px; background: rgba(0,0,0,0.3); border-radius: 8px; font-size: 13px; color: var(--alert-green); display: flex; align-items: center; gap: 8px;">
          <i data-lucide="check-circle" style="width: 16px; height: 16px;"></i> All members have active, healthy memberships!
        </div>
      ` : `
        <div class="priority-members-list">
          ${[...state.nearExpiryList, ...state.inactiveOrExpiredList].map(item => `
            <div class="priority-member-card ${item.alertStatus}">
              <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <div>
                  <div style="font-weight: 800; color: #fff; font-size: 14px; display: flex; align-items: center; gap: 6px;">
                    <span style="font-size: 11px; padding: 1px 6px; background: rgba(255,102,0,0.2); border-radius: 4px; color: var(--primary);">#${item.member?.member_code || 1}</span>
                    <span>${item.name}</span>
                  </div>
                  <div style="font-size: 12px; color: var(--text-secondary); margin-top: 2px;">+91 ${item.phone} • ${item.planName}</div>
                </div>
                <span class="alert-tag ${item.alertStatus === 'critical' ? 'red' : item.alertStatus === 'expiring' ? 'yellow' : 'expired'}" style="font-size: 10px;">
                  ${item.alertStatus === 'expired' ? 'Expired' : item.alertStatus === 'inactive' ? 'Left Gym' : `${item.daysRemaining}d left`}
                </span>
              </div>
              <div style="display: flex; gap: 6px; margin-top: 8px;">
                <button class="btn-sm btn-call" style="flex: 1; padding: 6px 8px; font-size: 11px; min-height: 32px;" onclick="window.openMemberDetailModal('${item.memberId}')">
                  <i data-lucide="edit-3" style="width: 13px; height: 13px;"></i> View & Edit
                </button>
                <button class="btn-sm btn-renew" style="flex: 1; padding: 6px 8px; font-size: 11px; min-height: 32px;" onclick="window.openRenewalModal('${item.memberId}', '${item.name}', ${item.balance}, '${item.planId}')">
                  <i data-lucide="refresh-cw" style="width: 13px; height: 13px;"></i> Renew
                </button>
                <button class="btn-sm btn-whatsapp" style="padding: 6px 10px; font-size: 11px; min-height: 32px;" onclick="window.sendWhatsAppReminder('${item.name}', '${item.phone}', '${item.planName}', '${item.endDate}', ${item.balance})">
                  <i data-lucide="message-circle" style="width: 13px; height: 13px;"></i>
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      `}
    </div>

    <!-- Quick Insights & Filter Bar -->
    <div class="members-filter-bar">
      <button class="filter-pill ${state.memberFilterTab === 'all' ? 'active' : ''}" onclick="window.setMemberFilter('all')">
        <i data-lucide="users"></i> All Members (${state.members.length})
      </button>
      <button class="filter-pill ${state.memberFilterTab === 'near-expiry' ? 'active' : ''}" onclick="window.setMemberFilter('near-expiry')">
        <i data-lucide="clock" style="color: var(--alert-yellow);"></i> Near Expiry (${state.nearExpiryList.length})
      </button>
      <button class="filter-pill ${state.memberFilterTab === 'inactive' ? 'active' : ''}" onclick="window.setMemberFilter('inactive')">
        <i data-lucide="user-x" style="color: var(--alert-red);"></i> Inactive / Left (${state.inactiveOrExpiredList.length})
      </button>
      <button class="filter-pill ${state.memberFilterTab === 'new-week' ? 'active' : ''}" onclick="window.setMemberFilter('new-week')">
        <i data-lucide="sparkles" style="color: var(--primary);"></i> Joined This Week (${state.newThisWeekCount})
      </button>
      <button class="filter-pill ${state.memberFilterTab === 'new-month' ? 'active' : ''}" onclick="window.setMemberFilter('new-month')">
        <i data-lucide="calendar" style="color: var(--alert-green);"></i> Joined This Month (${state.newThisMonthCount})
      </button>
    </div>

    <!-- Desktop Table View -->
    <div class="data-table-container desktop-table-view">
      <table class="data-table">
        <thead>
          <tr>
            <th style="width: 70px;">Code</th>
            <th>Member Name</th>
            <th>Phone</th>
            <th>Aadhaar (Last 4)</th>
            <th>Blood</th>
            <th>Renewals</th>
            <th>Status & Remaining Days</th>
            <th>Joined On</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${filtered.length === 0 ? `
            <tr>
              <td colspan="9" style="text-align: center; color: var(--text-muted); padding: 40px;">
                <p style="margin-bottom: 14px;">No members found matching the selected filter or search query.</p>
                <button class="btn-primary" onclick="window.navigateTo('admission')">
                  <i data-lucide="user-plus"></i> Enroll New Member
                </button>
              </td>
            </tr>
          ` : filtered.map(m => {
            const statusObj = state.memberStatusMap[m.id] || {};
            const daysInfo = getMemberRemainingDaysInfo(m, statusObj);
            const renewalCount = (m.renewal_history && m.renewal_history.length) || 1;
            const isContinuousRenewer = renewalCount > 1;

            return `
              <tr>
                <td>
                  <span style="font-family: monospace; font-size: 13px; font-weight: 800; color: var(--primary); background: rgba(255,102,0,0.12); padding: 3px 7px; border-radius: 6px; border: 1px solid var(--border-orange);">
                    #${m.member_code || 1}
                  </span>
                </td>
                <td>
                  <strong style="color: #fff; font-size: 14px;">${m.name}</strong>
                  <div style="font-size: 11px; color: var(--text-muted);">${statusObj.planName || 'No Plan'}</div>
                </td>
                <td>+91 ${m.phone}</td>
                <td>
                  <!-- Outer Section: Last 4 digits ONLY visible -->
                  <div style="font-family: monospace; letter-spacing: 0.5px; font-weight: 600; color: #e2e8f0;">
                    ${maskAadhaar(m.aadhaar || m.aadhaar_last4)}
                  </div>
                  <div style="font-size: 10px; color: var(--text-muted);">Admin edit for full</div>
                </td>
                <td><span style="color: var(--primary); font-weight: 700;">${m.blood_group || 'N/A'}</span></td>
                <td>
                  ${isContinuousRenewer ? `
                    <span class="alert-tag yellow" style="font-size: 11px; display: inline-flex; align-items: center; gap: 4px;" title="Continually renewing member across ${renewalCount} subscription cycles!">
                      <i data-lucide="refresh-cw" style="width: 11px; height: 11px;"></i> ${renewalCount} Cycles
                    </span>
                  ` : `
                    <span style="font-size: 11px; color: var(--text-muted);">1st Cycle</span>
                  `}
                </td>
                <td>
                  <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 5px;">
                    <span class="alert-tag ${daysInfo.badgeClass}" style="font-size: 11px;">${m.is_active === false ? 'Left Gym' : daysInfo.badgeText}</span>
                    <button class="btn-sm btn-call" style="padding: 3px 8px; font-size: 11px; min-height: 26px;" onclick="window.openMemberDetailModal('${m.id}')" title="Edit Member Profile & Full Aadhaar">
                      <i data-lucide="edit-3" style="width: 12px; height: 12px;"></i> Edit
                    </button>
                  </div>
                  <div style="display: flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 700; color: ${daysInfo.daysColor};">
                    <i data-lucide="clock" style="width: 13px; height: 13px;"></i>
                    <span>${daysInfo.remainingDaysText}</span>
                  </div>
                </td>
                <td>${new Date(m.join_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                <td>
                  <div style="display: flex; gap: 6px;">
                    ${m.is_active === false ? `
                      <button class="btn-sm btn-renew" style="padding: 4px 8px; font-size: 11px; min-height: 28px;" onclick="window.toggleMemberStatus('${m.id}', true)" title="Reactivate Member">
                        <i data-lucide="user-check" style="width: 12px; height: 12px;"></i> Reactivate
                      </button>
                    ` : `
                      <button class="btn-sm btn-call" style="padding: 4px 8px; font-size: 11px; min-height: 28px;" onclick="window.toggleMemberStatus('${m.id}', false)" title="Mark Left / Inactive">
                        <i data-lucide="user-x" style="width: 12px; height: 12px;"></i> Inactive
                      </button>
                    `}
                    <a href="tel:+91${m.phone}" class="btn-sm btn-call" style="padding: 4px 8px; font-size: 11px; min-height: 28px;" title="Call Member">
                      <i data-lucide="phone" style="width: 12px; height: 12px;"></i> Call
                    </a>
                    <button class="btn-sm btn-whatsapp" style="padding: 4px 8px; font-size: 11px; min-height: 28px;" onclick="window.sendWhatsAppReminder('${m.name}', '${m.phone}', '${statusObj.planName || 'Membership'}', '${statusObj.endDate || ''}', ${statusObj.balance || 0})" title="WhatsApp">
                      <i data-lucide="message-circle" style="width: 12px; height: 12px;"></i>
                    </button>
                  </div>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>

    <!-- Mobile Responsive Member Cards (100% Phone Auto-fit) -->
    <div class="member-mobile-cards">
      ${filtered.length === 0 ? `
        <div class="metric-card" style="text-align: center; padding: 32px;">
          <p style="color: var(--text-muted); font-size: 13px; margin-bottom: 14px;">No members found matching filter or query.</p>
          <button class="btn-primary" onclick="window.navigateTo('admission')">
            <i data-lucide="user-plus"></i> Enroll New Member
          </button>
        </div>
      ` : filtered.map(m => {
        const statusObj = state.memberStatusMap[m.id] || {};
        const daysInfo = getMemberRemainingDaysInfo(m, statusObj);
        const renewalCount = (m.renewal_history && m.renewal_history.length) || 1;
        const isContinuousRenewer = renewalCount > 1;

        return `
          <div class="member-mobile-card">
            <!-- Header Row with Member Code, Name, Status & Edit -->
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-family: monospace; font-size: 13px; font-weight: 800; color: var(--primary); background: rgba(255,102,0,0.12); padding: 3px 7px; border-radius: 6px; border: 1px solid var(--border-orange); flex-shrink: 0;">
                  #${m.member_code || 1}
                </span>
                <div>
                  <div style="font-size: 16px; font-weight: 800; color: #ffffff;">${m.name}</div>
                  <div style="font-size: 13px; color: var(--text-secondary); margin-top: 1px;">+91 ${m.phone} • ${statusObj.planName || 'Plan'}</div>
                </div>
              </div>
              <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
                <span class="alert-tag ${daysInfo.badgeClass}" style="font-size: 10px;">${m.is_active === false ? 'Left Gym' : daysInfo.badgeText}</span>
                <button class="btn-sm btn-call" style="padding: 4px 8px; font-size: 11px; min-height: 28px;" onclick="window.openMemberDetailModal('${m.id}')" title="Edit Member Profile & Full Aadhaar">
                  <i data-lucide="edit-3" style="width: 12px; height: 12px;"></i> Edit
                </button>
              </div>
            </div>

            <!-- Continuous Renewer Banner (if applicable) -->
            ${isContinuousRenewer ? `
              <div style="background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.25); border-radius: 6px; padding: 4px 10px; margin-top: 8px; display: flex; align-items: center; justify-content: space-between; font-size: 11px; color: var(--alert-yellow);">
                <span style="display: flex; align-items: center; gap: 5px; font-weight: 700;">
                  <i data-lucide="award" style="width: 13px; height: 13px;"></i> Loyal Member (${renewalCount} Cycles)
                </span>
                <span style="font-size: 10px; color: var(--text-muted);">Continually renewing</span>
              </div>
            ` : ''}

            <!-- Dedicated Remaining Days Highlight Row -->
            <div style="background: rgba(255, 255, 255, 0.04); border: 1px solid var(--border-subtle); border-radius: 8px; padding: 7px 12px; display: flex; justify-content: space-between; align-items: center; margin-top: 8px;">
              <span style="font-size: 11px; color: var(--text-muted); text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px; display: flex; align-items: center; gap: 5px;">
                <i data-lucide="hourglass" style="width: 13px; height: 13px; color: var(--primary);"></i> Remaining Days
              </span>
              <span style="font-size: 12px; font-weight: 800; color: ${daysInfo.daysColor}; display: flex; align-items: center; gap: 4px;">
                <i data-lucide="clock" style="width: 13px; height: 13px;"></i>
                ${daysInfo.remainingDaysText}
              </span>
            </div>

            <!-- Aadhaar (Last 4 Only in Outer Section), Blood & Joined -->
            <div style="display: flex; justify-content: space-between; font-size: 12px; color: var(--text-muted); border-top: 1px solid var(--border-subtle); padding-top: 8px; flex-wrap: wrap; gap: 6px; margin-top: 8px;">
              <span>Aadhaar: <strong style="font-family: monospace; color: #cbd5e1;">${maskAadhaar(m.aadhaar || m.aadhaar_last4)}</strong></span>
              <span>Blood: <strong style="color: var(--primary);">${m.blood_group || 'N/A'}</strong></span>
              <span>Joined: ${new Date(m.join_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
            </div>

            <!-- Quick Action Buttons -->
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px; margin-top: 8px;">
              ${m.is_active === false ? `
                <button class="btn-sm btn-renew" style="justify-content: center;" onclick="window.toggleMemberStatus('${m.id}', true)">
                  <i data-lucide="user-check"></i> Active
                </button>
              ` : `
                <button class="btn-sm btn-call" style="justify-content: center;" onclick="window.toggleMemberStatus('${m.id}', false)">
                  <i data-lucide="user-x"></i> Inactive
                </button>
              `}
              <a href="tel:+91${m.phone}" class="btn-sm btn-call" style="justify-content: center;">
                <i data-lucide="phone"></i> Call
              </a>
              <button class="btn-sm btn-whatsapp" style="justify-content: center;" onclick="window.sendWhatsAppReminder('${m.name}', '${m.phone}', '${statusObj.planName || 'Membership'}', '${statusObj.endDate || ''}', ${statusObj.balance || 0})">
                <i data-lucide="message-circle"></i> WhatsApp
              </button>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;

  lucide.createIcons();

  // Search input event
  const searchInput = document.getElementById('member-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      renderMembersView();
      // Keep focus on search input
      const newInput = document.getElementById('member-search-input');
      if (newInput) {
        newInput.focus();
        newInput.setSelectionRange(newInput.value.length, newInput.value.length);
      }
    });
  }

  // Weekly Excel Backup Button
  const btnExport = document.getElementById('btn-export-excel-backup');
  if (btnExport) {
    btnExport.addEventListener('click', () => {
      const filename = exportWeeklyBackupExcel(state);
      const now = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
      localStorage.setItem('shape_last_weekly_backup', now);
      confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
      alert(`✅ Weekly Excel Backup Downloaded!\n\nFile: ${filename}\n\nContains 3 full sheets:\n1. Members Directory (with full admin data)\n2. Subscriptions & Renewal History\n3. Financial & Operational Summary`);
    });
  }

  // Bulk Update Button
  const btnBulk = document.getElementById('btn-open-bulk-update');
  if (btnBulk) {
    btnBulk.addEventListener('click', () => {
      openBulkUpdateModal(renderMembersView);
    });
  }
}

// Global helper for opening member edit modal from window
window.openMemberDetailModal = (memberId) => {
  openMemberDetailModal(memberId, renderMembersView);
};

// Global helper for toggle active / inactive
window.toggleMemberStatus = (memberId, newStatus) => {
  const member = state.members.find(m => m.id === memberId);
  if (!member) return;

  const actionText = newStatus ? 'Reactivate' : 'Mark as Inactive (Left Gym)';
  if (confirm(`${actionText} for "${member.name}"?`)) {
    member.is_active = newStatus;
    computeDashboardMetrics();
    renderMembersView();
    alert(`Member "${member.name}" is now ${newStatus ? 'Active' : 'Inactive (Left Gym)'}.`);
  }
};

window.setMemberFilter = (tab) => {
  state.memberFilterTab = tab;
  renderMembersView();
};

window.openRenewalModal = (memberId, memberName, balance, planId) => {
  openRenewalModal(memberId, memberName, balance, planId, renderMembersView);
};

window.sendWhatsAppReminder = sendWhatsAppReminder;

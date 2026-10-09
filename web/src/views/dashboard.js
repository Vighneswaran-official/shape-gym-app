import { state } from '../state/store.js';
import { formatInr } from '../utils/crypto.js';

export function renderDashboardView() {
  const content = document.getElementById('main-content');
  const titleEl = document.getElementById('page-title');
  if (titleEl) titleEl.innerText = 'Dashboard Overview';

  // Compute Today's collection
  const todayStr = new Date().toISOString().split('T')[0];
  const todayCollection = state.payments
    .filter(p => p.paid_on === todayStr)
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  content.innerHTML = `
    <!-- Top Metrics Grid -->
    <div class="metrics-grid">
      <div class="metric-card" style="cursor: pointer;" onclick="state.memberFilterTab = 'all'; window.navigateTo('members');">
        <div class="metric-header">
          <span class="metric-title">Total Members</span>
          <div class="metric-icon-box" style="background: rgba(255, 87, 34, 0.15); color: var(--primary);">
            <i data-lucide="users"></i>
          </div>
        </div>
        <div class="metric-value">${state.members.length}</div>
        <div class="metric-subtitle">${state.activeCount} active subscriptions • Click to view</div>
      </div>

      <div class="metric-card">
        <div class="metric-header">
          <span class="metric-title">Today's Collection</span>
          <div class="metric-icon-box" style="background: rgba(34, 197, 94, 0.15); color: var(--alert-green);">
            <i data-lucide="indian-rupee"></i>
          </div>
        </div>
        <div class="metric-value" style="color: var(--alert-green);">${formatInr(todayCollection)}</div>
        <div class="metric-subtitle">Cash, UPI & Card payments today</div>
      </div>

      <div class="metric-card" style="cursor: pointer;" onclick="state.memberFilterTab = 'near-expiry'; window.navigateTo('members');">
        <div class="metric-header">
          <span class="metric-title">Renewals Due</span>
          <div class="metric-icon-box" style="background: rgba(239, 68, 68, 0.15); color: var(--alert-red);">
            <i data-lucide="clock"></i>
          </div>
        </div>
        <div class="metric-value" style="color: var(--alert-red);">${state.renewalsDue.length}</div>
        <div class="metric-subtitle">Requires front-desk action • Click to view</div>
      </div>

      <div class="metric-card">
        <div class="metric-header">
          <span class="metric-title">Pending Dues</span>
          <div class="metric-icon-box" style="background: rgba(245, 158, 11, 0.15); color: var(--alert-yellow);">
            <i data-lucide="alert-triangle"></i>
          </div>
        </div>
        <div class="metric-value" style="color: var(--alert-yellow);">${formatInr(state.totalPendingDues)}</div>
        <div class="metric-subtitle">Carried-forward member balances</div>
      </div>

      <div class="metric-card" style="cursor: pointer;" onclick="state.memberFilterTab = 'new-week'; window.navigateTo('members');">
        <div class="metric-header">
          <span class="metric-title">Joined This Week</span>
          <div class="metric-icon-box" style="background: rgba(255, 102, 0, 0.15); color: var(--primary);">
            <i data-lucide="sparkles"></i>
          </div>
        </div>
        <div class="metric-value" style="color: var(--primary);">${state.newThisWeekCount}</div>
        <div class="metric-subtitle">Past 7 days joinees • Click to view</div>
      </div>

      <div class="metric-card" style="cursor: pointer;" onclick="state.memberFilterTab = 'new-month'; window.navigateTo('members');">
        <div class="metric-header">
          <span class="metric-title">Joined This Month</span>
          <div class="metric-icon-box" style="background: rgba(16, 185, 129, 0.15); color: var(--alert-green);">
            <i data-lucide="calendar"></i>
          </div>
        </div>
        <div class="metric-value" style="color: var(--alert-green);">${state.newThisMonthCount}</div>
        <div class="metric-subtitle">Current month joinees • Click to view</div>
      </div>
    </div>

    <!-- Renewals Due Section (Color Coded Cards) -->
    <div class="section-header">
      <div class="section-title">
        <i data-lucide="hourglass" style="color: var(--primary);"></i>
        Renewals Due & Expiring Members
      </div>
      <span style="font-size: 13px; color: var(--text-secondary); font-weight: 600;">
        Yellow (≤7d) • Red (≤3d) • Dark Red (Expired)
      </span>
    </div>

    ${state.renewalsDue.length === 0 ? `
      <div class="metric-card" style="text-align: center; padding: 40px;">
        <i data-lucide="check-circle" style="color: var(--alert-green); width: 44px; height: 44px; margin: 0 auto 12px;"></i>
        <h3>No Renewals Due Today!</h3>
        <p style="color: var(--text-secondary); font-size: 13px; margin-top: 4px;">All members have active, up-to-date subscriptions.</p>
      </div>
    ` : `
      <div class="renewals-grid">
        ${state.renewalsDue.map(item => {
          let cardClass = 'yellow-alert';
          let tagText = `${item.daysRemaining} days left`;
          let tagClass = 'yellow';

          if (item.alertStatus === 'expired') {
            cardClass = 'expired-alert';
            tagText = `Expired (${Math.abs(item.daysRemaining)}d ago)`;
            tagClass = 'expired';
          } else if (item.alertStatus === 'critical') {
            cardClass = 'red-alert';
            tagText = item.daysRemaining === 0 ? 'Expires Today!' : `${item.daysRemaining} days left (Critical)`;
            tagClass = 'red';
          }

          return `
            <div class="renewal-card ${cardClass}">
              <div class="renewal-header">
                <div>
                  <div class="renewal-name">${item.name}</div>
                  <div class="renewal-phone">+91 ${item.phone} • Plan: ${item.planName}</div>
                </div>
                <span class="alert-tag ${tagClass}">${tagText}</span>
              </div>

              <div class="renewal-details">
                <div>
                  <span style="color: var(--text-muted); font-size: 11px;">Expires On</span>
                  <div style="font-weight: 600;">${new Date(item.endDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</div>
                </div>
                <div>
                  <span style="color: var(--text-muted); font-size: 11px;">Pending Balance</span>
                  <div style="font-weight: 700; color: ${item.balance > 0 ? 'var(--alert-yellow)' : 'var(--alert-green)'};">
                    ${formatInr(item.balance)}
                  </div>
                </div>
                <div>
                  <span style="color: var(--text-muted); font-size: 11px;">Plan Fee</span>
                  <div style="font-weight: 600;">${formatInr(item.planFee)}</div>
                </div>
              </div>

              <div class="renewal-actions">
                <a href="tel:+91${item.phone}" class="btn-sm btn-call">
                  <i data-lucide="phone"></i> Call
                </a>

                <button class="btn-sm btn-whatsapp" onclick="window.sendWhatsAppReminder('${item.name}', '${item.phone}', '${item.planName}', '${item.endDate}', ${item.balance})">
                  <i data-lucide="message-circle"></i> WhatsApp
                </button>

                <button class="btn-sm btn-renew" onclick="window.openRenewalModal('${item.memberId}', '${item.name}', ${item.balance}, '${item.planId}')">
                  <i data-lucide="refresh-cw"></i> Renew
                </button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `}
  `;

  lucide.createIcons();
}

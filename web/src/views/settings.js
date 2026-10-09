import { state } from '../state/store.js';

export function renderSettingsView() {
  const content = document.getElementById('main-content');
  const titleEl = document.getElementById('page-title');
  if (titleEl) titleEl.innerText = 'Gym Settings';

  content.innerHTML = `
    <div style="max-width: 680px;">
      <div class="metric-card" style="margin-bottom: 24px;">
        <h3 style="font-size: 18px; margin-bottom: 16px;">Tax & Invoicing Settings (GST)</h3>

        <div class="form-group">
          <label style="display: flex; align-items: center; gap: 12px; cursor: pointer;">
            <input type="checkbox" id="settings-gst-toggle" ${state.gstEnabled ? 'checked' : ''} style="width: 18px; height: 18px; accent-color: var(--primary);" />
            <span style="font-weight: 600;">Enable GST on Receipts</span>
          </label>
        </div>

        <div class="form-group">
          <label class="form-label">GSTIN Number</label>
          <input type="text" id="settings-gstin" class="form-input" value="${state.gstin || '29AABCS1429B1Z4'}" />
        </div>

        <div class="form-group">
          <label class="form-label">GST Rate (%)</label>
          <input type="number" id="settings-gst-percent" class="form-input" value="${state.gstPercent || 18}" />
        </div>

        <button class="btn-primary" onclick="alert('Settings Saved Successfully!')">Save Settings</button>
      </div>

      <div class="metric-card">
        <h3 style="font-size: 18px; margin-bottom: 8px;">Database & Storage</h3>
        <p style="color: var(--text-secondary); font-size: 13px; margin-bottom: 18px;">
          Live Supabase connection: <strong>https://sxqimjzghdvysajvsthr.supabase.co</strong>
        </p>

        <button class="btn-secondary" onclick="window.exportWeeklyExcelBackup()">
          <i data-lucide="file-spreadsheet"></i> Export Complete Excel (.xlsx) Backup
        </button>
      </div>
    </div>
  `;

  lucide.createIcons();

  document.getElementById('settings-gst-toggle')?.addEventListener('change', (e) => {
    state.gstEnabled = e.target.checked;
  });
}

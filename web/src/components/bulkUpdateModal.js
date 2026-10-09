import { state, computeDashboardMetrics } from '../state/store.js';
import { exportBulkUpdateTemplate, parseBulkExcelFile } from '../utils/excel.js';
import { supabase } from '../config/supabase.js';

/**
 * Bulk Member Update Modal
 * Provides:
 * 1. Live Inline Spreadsheet Grid for rapid bulk editing of names, phones, status, blood, aadhaar
 * 2. Excel (.xlsx / .csv) Upload & Template Download
 */
export function openBulkUpdateModal(onUpdateCallback) {
  const existingModal = document.getElementById('bulk-update-modal');
  if (existingModal) existingModal.remove();

  const modal = document.createElement('div');
  modal.id = 'bulk-update-modal';
  modal.className = 'modal-overlay';

  modal.innerHTML = `
    <div class="modal-card modal-card-lg" style="max-width: 900px; max-height: 90vh; overflow-y: auto;">
      <!-- Modal Header -->
      <div class="modal-header" style="border-bottom: 1px solid var(--border-subtle); padding-bottom: 14px; margin-bottom: 16px;">
        <div>
          <h2 style="font-size: 20px; font-weight: 800; color: #fff; display: flex; align-items: center; gap: 8px;">
            <i data-lucide="edit-3" style="color: var(--primary);"></i> Bulk Member Data Editor
          </h2>
          <p style="font-size: 12px; color: var(--text-secondary); margin-top: 3px;">
            Update multiple members simultaneously via the quick grid below or upload an Excel spreadsheet.
          </p>
        </div>
        <button class="close-btn" onclick="document.getElementById('bulk-update-modal').remove()">
          <i data-lucide="x"></i>
        </button>
      </div>

      <!-- Excel Import / Export Bar -->
      <div style="background: rgba(255, 102, 0, 0.08); border: 1px solid var(--border-orange); border-radius: 10px; padding: 12px 16px; margin-bottom: 18px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
        <div>
          <strong style="color: #fff; font-size: 13px;">Excel (.xlsx) Import & Export</strong>
          <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">Export pre-filled spreadsheet, edit in Excel, and upload here.</div>
        </div>
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <button type="button" class="btn-secondary" id="btn-download-bulk-template" style="padding: 6px 12px; font-size: 12px;">
            <i data-lucide="download"></i> Download Template (.xlsx)
          </button>
          <label class="btn-primary" style="padding: 6px 14px; font-size: 12px; cursor: pointer; display: flex; align-items: center; gap: 6px; margin: 0;">
            <i data-lucide="upload"></i> Upload Excel File
            <input type="file" id="bulk-excel-file-input" accept=".xlsx, .xls, .csv" style="display: none;" />
          </label>
        </div>
      </div>

      <!-- Quick Inline Spreadsheet Grid -->
      <div style="margin-bottom: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <h3 style="font-size: 13px; font-weight: 800; color: var(--text-main); text-transform: uppercase; letter-spacing: 0.5px; margin: 0;">
            Quick Inline Member Grid (${state.members.length} Members)
          </h3>
          <span style="font-size: 11px; color: var(--text-muted);">Tip: Edit cells directly and click "Save Bulk Changes"</span>
        </div>

        <div style="overflow-x: auto; border: 1px solid var(--border-subtle); border-radius: 8px; background: rgba(0,0,0,0.3);">
          <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
            <thead>
              <tr style="background: rgba(255,255,255,0.04); text-align: left; color: var(--text-muted); border-bottom: 1px solid var(--border-subtle);">
                <th style="padding: 10px 8px; width: 60px;">Code</th>
                <th style="padding: 10px 8px; min-width: 140px;">Full Name</th>
                <th style="padding: 10px 8px; min-width: 110px;">Phone (10 Digits)</th>
                <th style="padding: 10px 8px; min-width: 140px;">Aadhaar (12 Digits)</th>
                <th style="padding: 10px 8px; width: 80px;">Blood</th>
                <th style="padding: 10px 8px; width: 60px;">Age</th>
                <th style="padding: 10px 8px; min-width: 110px;">Status</th>
              </tr>
            </thead>
            <tbody id="bulk-members-tbody">
              ${state.members.map((m, idx) => `
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);" data-member-id="${m.id}">
                  <td style="padding: 6px 8px;">
                    <input type="number" class="form-input bulk-code" value="${m.member_code || (idx + 1)}" style="padding: 4px 6px; font-size: 12px; width: 55px;" />
                  </td>
                  <td style="padding: 6px 8px;">
                    <input type="text" class="form-input bulk-name" value="${m.name || ''}" style="padding: 4px 8px; font-size: 12px;" required />
                  </td>
                  <td style="padding: 6px 8px;">
                    <input type="tel" maxlength="10" class="form-input bulk-phone" value="${m.phone || ''}" style="padding: 4px 8px; font-size: 12px;" required />
                  </td>
                  <td style="padding: 6px 8px;">
                    <input type="text" maxlength="14" class="form-input bulk-aadhaar" value="${m.aadhaar || ('5678 1234 ' + (m.aadhaar_last4 || '4821'))}" style="padding: 4px 8px; font-size: 12px; font-family: monospace;" />
                  </td>
                  <td style="padding: 6px 8px;">
                    <select class="form-select bulk-blood" style="padding: 4px 6px; font-size: 12px; width: 75px;">
                      ${['B+', 'O+', 'A+', 'AB+', 'B-', 'O-', 'A-', 'AB-'].map(bg => `
                        <option value="${bg}" ${m.blood_group === bg ? 'selected' : ''}>${bg}</option>
                      `).join('')}
                    </select>
                  </td>
                  <td style="padding: 6px 8px;">
                    <input type="number" min="10" max="100" class="form-input bulk-age" value="${m.age || 25}" style="padding: 4px 6px; font-size: 12px; width: 60px;" />
                  </td>
                  <td style="padding: 6px 8px;">
                    <select class="form-select bulk-status" style="padding: 4px 6px; font-size: 12px; width: 105px; color: ${m.is_active !== false ? 'var(--alert-green)' : '#94a3b8'};">
                      <option value="true" ${m.is_active !== false ? 'selected' : ''}>Active</option>
                      <option value="false" ${m.is_active === false ? 'selected' : ''}>Inactive (Left)</option>
                    </select>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Bottom Actions -->
      <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;">
        <button type="button" class="btn-secondary" onclick="document.getElementById('bulk-update-modal').remove()">
          Cancel
        </button>
        <button type="button" class="btn-primary" id="btn-save-bulk-changes" style="padding: 10px 24px;">
          <i data-lucide="save"></i> Save All Bulk Changes
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  lucide.createIcons();

  // 1. Download Template Button
  document.getElementById('btn-download-bulk-template').addEventListener('click', () => {
    exportBulkUpdateTemplate(state.members);
  });

  // 2. Upload Excel File Handler
  const fileInput = document.getElementById('bulk-excel-file-input');
  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const records = await parseBulkExcelFile(file);
      if (!records || records.length === 0) {
        alert('No member records could be read from the uploaded file.');
        return;
      }

      let updatedCount = 0;
      records.forEach(rec => {
        // Match by member code or phone number
        const existing = state.members.find(m =>
          (rec.member_code && String(m.member_code) === String(rec.member_code)) ||
          (rec.phone && m.phone === rec.phone)
        );

        if (existing) {
          if (rec.name) existing.name = rec.name;
          if (rec.phone) existing.phone = rec.phone;
          if (rec.aadhaar) {
            existing.aadhaar = rec.aadhaar;
            existing.aadhaar_last4 = rec.aadhaar.replace(/\s+/g, '').slice(-4);
          }
          if (rec.blood_group) existing.blood_group = rec.blood_group;
          if (rec.age) existing.age = rec.age;
          if (rec.is_active !== undefined) existing.is_active = rec.is_active;
          if (rec.address) existing.address = rec.address;
          if (rec.health_notes) existing.health_notes = rec.health_notes;
          updatedCount++;
        }
      });

      computeDashboardMetrics();
      modal.remove();
      if (onUpdateCallback) onUpdateCallback();
      alert(`✅ Excel Bulk Update Applied!\n\nSuccessfully updated ${updatedCount} member records from "${file.name}".`);
    } catch (err) {
      alert(`Error reading Excel file: ${err.message}`);
    }
  });

  // 3. Save Bulk Grid Changes
  document.getElementById('btn-save-bulk-changes').addEventListener('click', async () => {
    const rows = document.querySelectorAll('#bulk-members-tbody tr');
    let updatedCount = 0;

    rows.forEach(row => {
      const memberId = row.dataset.memberId;
      const mem = state.members.find(m => m.id === memberId);
      if (!mem) return;

      const code = Number(row.querySelector('.bulk-code').value) || mem.member_code;
      const name = row.querySelector('.bulk-name').value.trim();
      const phone = row.querySelector('.bulk-phone').value.trim();
      const aadhaar = row.querySelector('.bulk-aadhaar').value.trim();
      const blood = row.querySelector('.bulk-blood').value;
      const age = Number(row.querySelector('.bulk-age').value) || mem.age;
      const isActive = row.querySelector('.bulk-status').value === 'true';

      if (name && phone) {
        mem.member_code = code;
        mem.name = name;
        mem.phone = phone;
        mem.aadhaar = aadhaar;
        mem.aadhaar_last4 = aadhaar.replace(/\s+/g, '').slice(-4);
        mem.blood_group = blood;
        mem.age = age;
        mem.is_active = isActive;
        updatedCount++;
      }
    });

    computeDashboardMetrics();

    // Supabase update if online
    if (state.user && !state.isDemoMode) {
      try {
        for (const m of state.members) {
          await supabase.from('members').update({
            name: m.name,
            phone: m.phone,
            age: m.age,
            blood_group: m.blood_group,
            aadhaar_last4: m.aadhaar_last4
          }).eq('id', m.id);
        }
      } catch (err) {
        console.warn('Supabase bulk sync warning:', err);
      }
    }

    modal.remove();
    if (onUpdateCallback) onUpdateCallback();
    alert(`✅ Bulk Update Saved!\n\nSuccessfully updated ${updatedCount} member records.`);
  });
}

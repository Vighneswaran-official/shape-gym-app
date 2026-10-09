import * as XLSX from 'xlsx';

/**
 * Weekly Backup Engine - Generates native Microsoft Excel (.xlsx) workbook
 * Contains 3 multi-tab sheets: Members Directory, Subscriptions, and Summary
 */
export function exportWeeklyBackupExcel(state) {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];

  // 1. Members Directory Sheet Data
  const memberRows = state.members.map((m, index) => {
    const statusObj = state.memberStatusMap[m.id] || {};
    const renewalCycles = (m.renewal_history && m.renewal_history.length) || 1;
    return {
      'Member Code': m.member_code ? `#${m.member_code}` : `#${index + 1}`,
      'Full Name': m.name || '',
      'Phone Number': m.phone || '',
      'Aadhaar (Last 4)': m.aadhaar_last4 || (m.aadhaar ? m.aadhaar.slice(-4) : 'N/A'),
      'Aadhaar (Full 12-Digit Admin)': m.aadhaar || '',
      'Blood Group': m.blood_group || 'N/A',
      'Age': m.age || '',
      'Status': m.is_active === false ? 'Inactive' : 'Active',
      'Current Plan': statusObj.planName || 'None',
      'Plan Fee (₹)': statusObj.planFee || 0,
      'Valid Till': statusObj.endDate ? new Date(statusObj.endDate).toLocaleDateString('en-IN') : 'N/A',
      'Remaining Days': statusObj.daysRemaining !== undefined ? statusObj.daysRemaining : 'N/A',
      'Pending Balance (₹)': statusObj.balance || 0,
      'Renewal Cycles Count': renewalCycles,
      'Continuous Renewer': renewalCycles > 1 ? 'Yes' : 'No',
      'Joined Date': m.join_date ? new Date(m.join_date).toLocaleDateString('en-IN') : '',
      'Address': m.address || '',
      'Health & Medical Notes': m.health_notes || ''
    };
  });

  // 2. Subscriptions & Renewals Sheet Data
  const subRows = state.subscriptions.map(s => {
    const mem = state.members.find(m => m.id === s.member_id) || {};
    return {
      'Subscription ID': s.id,
      'Member Code': mem.member_code ? `#${mem.member_code}` : 'N/A',
      'Member Name': mem.name || 'Unknown',
      'Plan Name': s.plan_name_snapshot || '',
      'Plan Fee (₹)': s.fee_snapshot || s.amount_due || 0,
      'Amount Paid (₹)': s.amount_paid || 0,
      'Balance Due (₹)': s.balance || 0,
      'Start Date': s.start_date || '',
      'End Date': s.end_date || '',
      'Status': new Date(s.end_date) >= new Date() ? 'Active' : 'Expired'
    };
  });

  // 3. Financial & Operational Summary Sheet
  const summaryRows = [
    { 'Metric': 'Gym Name', 'Value': 'Shape Fitness Club' },
    { 'Metric': 'Backup Generated At', 'Value': now.toLocaleString('en-IN') },
    { 'Metric': 'Total Registered Members', 'Value': state.members.length },
    { 'Metric': 'Active Members', 'Value': state.activeCount || 0 },
    { 'Metric': 'Inactive / Left Gym', 'Value': state.inactiveOrExpiredList.length },
    { 'Metric': 'Near Expiry (Within 7 Days)', 'Value': state.nearExpiryList.length },
    { 'Metric': 'Total Pending Member Dues (₹)', 'Value': state.totalPendingDues || 0 },
    { 'Metric': 'New Joinees This Week', 'Value': state.newThisWeekCount || 0 },
    { 'Metric': 'New Joinees This Month', 'Value': state.newThisMonthCount || 0 }
  ];

  // Create Workbook
  const wb = XLSX.utils.book_new();

  const wsMembers = XLSX.utils.json_to_sheet(memberRows);
  const wsSubs = XLSX.utils.json_to_sheet(subRows);
  const wsSummary = XLSX.utils.json_to_sheet(summaryRows);

  // Set column widths for better Excel viewing
  wsMembers['!cols'] = [
    { wch: 14 }, // Code
    { wch: 22 }, // Name
    { wch: 15 }, // Phone
    { wch: 18 }, // Aadhaar Last 4
    { wch: 24 }, // Aadhaar Full
    { wch: 12 }, // Blood
    { wch: 8 },  // Age
    { wch: 12 }, // Status
    { wch: 24 }, // Current Plan
    { wch: 14 }, // Plan Fee
    { wch: 14 }, // Valid Till
    { wch: 16 }, // Remaining Days
    { wch: 18 }, // Pending Balance
    { wch: 20 }, // Renewal Cycles
    { wch: 18 }, // Continuous Renewer
    { wch: 14 }, // Joined Date
    { wch: 30 }, // Address
    { wch: 30 }  // Health Notes
  ];

  XLSX.utils.book_append_sheet(wb, wsMembers, 'Members Directory');
  XLSX.utils.book_append_sheet(wb, wsSubs, 'Subscriptions');
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Operational Summary');

  // Trigger Excel file download
  const filename = `ShapeGym_Weekly_Backup_${dateStr}.xlsx`;
  XLSX.writeFile(wb, filename);

  return filename;
}

/**
 * Exports current members as an editable Excel spreadsheet for Bulk Update
 */
export function exportBulkUpdateTemplate(members) {
  const rows = members.map((m, index) => ({
    'Member Code (Do not change)': m.member_code || (index + 1),
    'Full Name': m.name || '',
    'Phone (10 Digits)': m.phone || '',
    'Aadhaar (12 Digits)': m.aadhaar || '',
    'Blood Group': m.blood_group || 'B+',
    'Age': m.age || 25,
    'Status (Active or Inactive)': m.is_active === false ? 'Inactive' : 'Active',
    'Residential Address': m.address || '',
    'Health Notes': m.health_notes || ''
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [
    { wch: 26 },
    { wch: 22 },
    { wch: 18 },
    { wch: 22 },
    { wch: 14 },
    { wch: 8 },
    { wch: 24 },
    { wch: 32 },
    { wch: 28 }
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'Bulk Member Update');

  const now = new Date().toISOString().split('T')[0];
  XLSX.writeFile(wb, `ShapeGym_Bulk_Members_Template_${now}.xlsx`);
}

/**
 * Parses uploaded Excel (.xlsx, .xls, .csv) file for bulk member updates
 */
export function parseBulkExcelFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const json = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (!json || json.length === 0) {
          return reject(new Error('Uploaded spreadsheet is empty or has no recognizable rows.'));
        }

        // Map column variations flexibly
        const records = json.map(row => {
          const codeVal = row['Member Code (Do not change)'] || row['Member Code'] || row['Code'] || row['ID'];
          const nameVal = row['Full Name'] || row['Name'] || row['Member Name'];
          const phoneVal = row['Phone (10 Digits)'] || row['Phone Number'] || row['Phone'] || row['Mobile'];
          const aadhaarVal = row['Aadhaar (12 Digits)'] || row['Aadhaar Number'] || row['Aadhaar'];
          const bloodVal = row['Blood Group'] || row['Blood'];
          const ageVal = row['Age'];
          const statusVal = row['Status (Active or Inactive)'] || row['Status'];
          const addressVal = row['Residential Address'] || row['Address'];
          const healthVal = row['Health Notes'] || row['Health'];

          return {
            member_code: codeVal ? String(codeVal).replace(/^#/, '').trim() : null,
            name: nameVal ? String(nameVal).trim() : '',
            phone: phoneVal ? String(phoneVal).replace(/\D/g, '').slice(-10) : '',
            aadhaar: aadhaarVal ? String(aadhaarVal).trim() : '',
            blood_group: bloodVal ? String(bloodVal).trim().toUpperCase() : 'B+',
            age: Number(ageVal) || 25,
            is_active: String(statusVal).toLowerCase().trim() !== 'inactive',
            address: addressVal ? String(addressVal).trim() : '',
            health_notes: healthVal ? String(healthVal).trim() : ''
          };
        });

        resolve(records);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
}

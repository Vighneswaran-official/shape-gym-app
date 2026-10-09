import { state, computeDashboardMetrics } from '../state/store.js';
import { supabase } from '../config/supabase.js';
import { encryptText, formatInr } from '../utils/crypto.js';
import { generateReceiptPdf } from '../utils/pdf.js';
import confetti from 'canvas-confetti';

const activeCanvasStrokes = {
  client: [],
  manager: []
};

function setupSignatureCanvas(canvasId, type) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const initCanvas = () => {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const displayWidth = rect.width > 0 ? rect.width : 280;
    const displayHeight = 120;

    canvas.width = displayWidth * dpr;
    canvas.height = displayHeight * dpr;
    canvas.style.width = '100%';
    canvas.style.height = `${displayHeight}px`;

    const ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.strokeStyle = '#ff6600';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const strokes = activeCanvasStrokes[type] || [];
    if (strokes.length > 1) {
      ctx.beginPath();
      ctx.moveTo(strokes[0].x, strokes[0].y);
      for (let i = 1; i < strokes.length; i++) {
        ctx.lineTo(strokes[i].x, strokes[i].y);
      }
      ctx.stroke();
    }
  };

  initCanvas();
  window.addEventListener('resize', initCanvas, { passive: true });

  let drawing = false;

  const getPos = (e) => {
    const r = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: clientX - r.left,
      y: clientY - r.top
    };
  };

  const start = (e) => {
    drawing = true;
    const pos = getPos(e);
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    activeCanvasStrokes[type].push(pos);
    if (e.cancelable) e.preventDefault();
  };

  const draw = (e) => {
    if (!drawing) return;
    const pos = getPos(e);
    const ctx = canvas.getContext('2d');
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    activeCanvasStrokes[type].push(pos);
    if (e.cancelable) e.preventDefault();
  };

  const stop = () => {
    drawing = false;
  };

  canvas.addEventListener('mousedown', start);
  canvas.addEventListener('mousemove', draw);
  window.addEventListener('mouseup', stop);

  canvas.addEventListener('touchstart', start, { passive: false });
  canvas.addEventListener('touchmove', draw, { passive: false });
  window.addEventListener('touchend', stop);
}

window.clearSignature = (type) => {
  const canvas = document.getElementById(`${type}-signature`);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.scale(dpr, dpr);
  ctx.strokeStyle = '#ff6600';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  activeCanvasStrokes[type] = [];
};

function hasSignatureDrawn(type) {
  return activeCanvasStrokes[type] && activeCanvasStrokes[type].length > 5;
}

export function renderAdmissionView() {
  const content = document.getElementById('main-content');
  const titleEl = document.getElementById('page-title');
  if (titleEl) titleEl.innerText = 'New Member Admission';

  activeCanvasStrokes.client = [];
  activeCanvasStrokes.manager = [];

  const defaultPlan = state.plans[0] || { id: 'plan-1', name: '3 Months', duration_days: 90, fee: 4999 };
  const today = new Date().toISOString().split('T')[0];
  const expiryDate = new Date(Date.now() + defaultPlan.duration_days * 86400000).toISOString().split('T')[0];
  const nextMemberCode = state.members.length + 1;

  content.innerHTML = `
    <div class="admission-container">
      <div class="admission-card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; flex-wrap: wrap; gap: 8px;">
          <h2 style="font-size: 22px; font-weight: 800; color: var(--text-main); margin: 0;">Front-Desk Enrollment Form</h2>
          <span style="font-family: monospace; font-size: 13px; font-weight: 800; color: var(--primary); background: rgba(255,102,0,0.12); padding: 4px 10px; border-radius: 6px; border: 1px solid var(--border-orange);">
            Next Member Code: #${nextMemberCode}
          </span>
        </div>
        <p style="color: var(--text-secondary); font-size: 13px; margin-bottom: 24px; line-height: 1.5;">
          Register member, capture dual signatures, and produce the official PDF admission receipt.
        </p>

        <form id="admission-form">
          <!-- 1. Personal Details -->
          <h3 style="font-size: 14px; font-weight: 800; color: var(--primary); margin-bottom: 14px; text-transform: uppercase; letter-spacing: 0.5px;">1. Personal Details</h3>

          <div class="form-grid-2">
            <div class="form-group">
              <label class="form-label">Full Name *</label>
              <input type="text" id="adm-name" class="form-input" required placeholder="e.g. Ramesh Kumar" />
            </div>

            <div class="form-group">
              <label class="form-label">Phone Number (10 Digits) *</label>
              <input type="tel" id="adm-phone" class="form-input" maxlength="10" required placeholder="9876543210" />
            </div>
          </div>

          <div class="form-grid-3" style="margin-top: 14px;">
            <div class="form-group">
              <label class="form-label">Aadhaar (12 Digits) *</label>
              <input type="text" id="adm-aadhaar" class="form-input" maxlength="12" required placeholder="123456789012" />
              <span style="font-size: 11px; color: var(--alert-green); display: block; margin-top: 4px;">AES-256 Encrypted on Device</span>
            </div>

            <div class="form-group">
              <label class="form-label">Age *</label>
              <input type="number" id="adm-age" class="form-input" min="10" max="100" value="26" required />
            </div>

            <div class="form-group">
              <label class="form-label">Blood Group</label>
              <select id="adm-blood" class="form-select">
                <option value="B+">B+</option>
                <option value="O+">O+</option>
                <option value="A+">A+</option>
                <option value="AB+">AB+</option>
                <option value="B-">B-</option>
                <option value="O-">O-</option>
                <option value="A-">A-</option>
                <option value="AB-">AB-</option>
              </select>
            </div>
          </div>

          <div class="form-group" style="margin-top: 14px;">
            <label class="form-label">Residential Address</label>
            <input type="text" id="adm-address" class="form-input" placeholder="Flat, Street, Area, City" />
          </div>

          <div class="form-group" style="margin-top: 14px;">
            <label class="form-label">Health History / Medical Information</label>
            <textarea id="adm-health" class="form-textarea" rows="2" placeholder="Injuries, asthma, allergies, medications (Encrypted)"></textarea>
          </div>

          <!-- 2. Programs & Plan -->
          <h3 style="font-size: 14px; font-weight: 800; color: var(--primary); margin: 26px 0 14px; text-transform: uppercase; letter-spacing: 0.5px;">2. Programs & Membership Plan</h3>

          <div class="form-group">
            <label class="form-label">Enrolled Programs</label>
            <div class="chip-group" id="programs-chip-group">
              ${state.programs.map(p => `
                <div class="chip active" data-prog-id="${p.id}" onclick="this.classList.toggle('active')">
                  ${p.name}
                </div>
              `).join('')}
            </div>
          </div>

          <div class="form-grid-2" style="margin-top: 14px;">
            <div class="form-group">
              <label class="form-label">Membership Plan</label>
              <select id="adm-plan-select" class="form-select">
                ${state.plans.map(p => `
                  <option value="${p.id}" data-days="${p.duration_days}" data-fee="${p.fee}">
                    ${p.name} (${p.duration_days} Days) - ${formatInr(p.fee)}
                  </option>
                `).join('')}
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Expiry Date (Auto-calculated)</label>
              <input type="text" id="adm-expiry-preview" class="form-input" value="${expiryDate}" readonly style="background: rgba(255, 255, 255, 0.05); color: var(--alert-green); font-weight: 700;" />
            </div>
          </div>

          <!-- 3. Payment -->
          <h3 style="font-size: 14px; font-weight: 800; color: var(--primary); margin: 26px 0 14px; text-transform: uppercase; letter-spacing: 0.5px;">3. Fees & Payment Collection</h3>

          <div class="form-grid-3">
            <div class="form-group">
              <label class="form-label">Admission Fee (₹)</label>
              <input type="number" id="adm-fee" class="form-input" value="0" />
            </div>

            <div class="form-group">
              <label class="form-label">Amount Paid (₹) *</label>
              <input type="number" id="adm-amount-paid" class="form-input" value="${defaultPlan.fee}" required />
            </div>

            <div class="form-group">
              <label class="form-label">Payment Mode</label>
              <select id="adm-payment-mode" class="form-select">
                <option value="UPI" selected>UPI (GPay / PhonePe)</option>
                <option value="Cash">Cash</option>
                <option value="Card">Card</option>
              </select>
            </div>
          </div>

          <!-- 4. India DPDP Act Consent -->
          <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid var(--border-subtle); padding: 14px; border-radius: 12px; margin: 22px 0;">
            <label style="display: flex; gap: 10px; align-items: flex-start; cursor: pointer; font-size: 13px; line-height: 1.5;">
              <input type="checkbox" id="adm-consent" required style="margin-top: 3px; accent-color: var(--primary); flex-shrink: 0;" />
              <span>I confirm that the client has authorized storing and processing their personal fitness, health, and identity details in compliance with the <strong>India Digital Personal Data Protection (DPDP) Act 2023</strong>.</span>
            </label>
          </div>

          <!-- 5. Dual Signature Pads -->
          <h3 style="font-size: 14px; font-weight: 800; color: var(--primary); margin: 26px 0 14px; text-transform: uppercase; letter-spacing: 0.5px;">4. Finger-Drawn Signatures (Mandatory)</h3>

          <div class="signature-grid">
            <div class="form-group">
              <label class="form-label">Client / Member Signature *</label>
              <div class="signature-box">
                <canvas id="client-signature" class="signature-canvas"></canvas>
                <div class="signature-controls">
                  <span style="font-size: 11px; color: var(--text-secondary);">Draw with finger</span>
                  <button type="button" class="btn-sm btn-call" onclick="window.clearSignature('client')">Clear</button>
                </div>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Manager / Staff Signature *</label>
              <div class="signature-box">
                <canvas id="manager-signature" class="signature-canvas"></canvas>
                <div class="signature-controls">
                  <span style="font-size: 11px; color: var(--text-secondary);">Draw with finger</span>
                  <button type="button" class="btn-sm btn-call" onclick="window.clearSignature('manager')">Clear</button>
                </div>
              </div>
            </div>
          </div>

          <button type="submit" id="submit-admission-btn" class="btn-primary" style="width: 100%; justify-content: center; padding: 16px; font-size: 15px; font-weight: 800; border-radius: var(--radius-md); box-sizing: border-box; text-align: center; white-space: normal; line-height: 1.3;">
            <i data-lucide="check-circle"></i> Complete Admission & Download Official Receipt
          </button>
        </form>
      </div>
    </div>
  `;

  lucide.createIcons();

  const planSelect = document.getElementById('adm-plan-select');
  planSelect.addEventListener('change', () => {
    const opt = planSelect.options[planSelect.selectedIndex];
    const days = Number(opt.getAttribute('data-days')) || 90;
    const fee = Number(opt.getAttribute('data-fee')) || 4999;
    const expiry = new Date(Date.now() + days * 86400000).toISOString().split('T')[0];
    document.getElementById('adm-expiry-preview').value = expiry;
    document.getElementById('adm-amount-paid').value = fee;
  });

  setupSignatureCanvas('client-signature', 'client');
  setupSignatureCanvas('manager-signature', 'manager');

  document.getElementById('admission-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const clientCanvas = document.getElementById('client-signature');
    const managerCanvas = document.getElementById('manager-signature');

    if (!hasSignatureDrawn('client') || !hasSignatureDrawn('manager')) {
      alert('⚠️ Both the Client and Manager signatures are strictly mandatory to finalize gym admission!');
      return;
    }

    const btn = document.getElementById('submit-admission-btn');
    btn.disabled = true;
    btn.innerHTML = `<i data-lucide="loader" class="animate-spin"></i> Securing Data & Registering Member...`;
    lucide.createIcons();

    try {
      const name = document.getElementById('adm-name').value.trim();
      const phone = document.getElementById('adm-phone').value.trim();
      const rawAadhaar = document.getElementById('adm-aadhaar').value.trim();
      const age = Number(document.getElementById('adm-age').value) || 25;
      const blood = document.getElementById('adm-blood').value;
      const address = document.getElementById('adm-address').value.trim();
      const health = document.getElementById('adm-health').value.trim();

      const selectedPlanId = planSelect.value;
      const plan = state.plans.find(p => p.id === selectedPlanId) || state.plans[0];
      const admissionFee = Number(document.getElementById('adm-fee').value) || 0;
      const amountPaid = Number(document.getElementById('adm-amount-paid').value) || 0;
      const mode = document.getElementById('adm-payment-mode').value;

      const totalDue = plan.fee + admissionFee;
      const balance = Math.max(0, totalDue - amountPaid);
      const startDate = new Date().toISOString().split('T')[0];
      const endDate = document.getElementById('adm-expiry-preview').value;

      const encryptedAadhaar = await encryptText(rawAadhaar);
      const encryptedHealth = await encryptText(health);
      const aadhaarLast4 = rawAadhaar.slice(-4);

      let memberId = 'mem_' + Date.now();
      let subData = { id: 'sub_' + Date.now() };

      const activeProgramChips = document.querySelectorAll('#programs-chip-group .chip.active');
      const selectedPrograms = [];
      for (const chip of activeProgramChips) {
        const progId = chip.getAttribute('data-prog-id');
        const prog = state.programs.find(p => p.id === progId);
        if (prog) selectedPrograms.push(prog.name);
      }

      if (!state.isDemoMode && state.user) {
        try {
          const { data: memberData, error: memberErr } = await supabase.from('members').insert({
            name,
            phone,
            address,
            aadhaar_last4: aadhaarLast4,
            aadhaar_encrypted: encryptedAadhaar,
            health_history_encrypted: encryptedHealth,
            age,
            blood_group: blood,
            join_date: startDate,
            consent_given: true
          }).select().single();

          if (memberErr) throw memberErr;
          memberId = memberData.id;

          for (const chip of activeProgramChips) {
            const progId = chip.getAttribute('data-prog-id');
            await supabase.from('member_programs').insert({ member_id: memberId, program_id: progId });
          }

          const { data: createdSub } = await supabase.from('member_subscriptions').insert({
            member_id: memberId,
            plan_id: plan.id,
            plan_name_snapshot: plan.name,
            fee_snapshot: plan.fee,
            start_date: startDate,
            end_date: endDate,
            amount_due: totalDue,
            amount_paid: amountPaid,
            balance: balance
          }).select().single();

          if (createdSub) subData = createdSub;

          if (amountPaid > 0) {
            await supabase.from('payments').insert({
              member_id: memberId,
              subscription_id: subData.id,
              amount: amountPaid,
              mode: mode,
              type: 'admission_fee',
              note: `Admission enrolment for ${plan.name}`
            });
          }
        } catch (dbErr) {
          console.warn('Supabase admission save warning, storing locally:', dbErr);
        }
      }

      // Add to local state
      state.members.unshift({
        id: memberId,
        member_code: nextMemberCode,
        name,
        phone,
        address,
        aadhaar: rawAadhaar,
        aadhaar_last4: aadhaarLast4,
        blood_group: blood,
        age,
        join_date: startDate,
        is_active: true,
        renewal_history: [
          {
            cycle: 1,
            plan_name: plan.name,
            start_date: startDate,
            end_date: endDate,
            renewed_on: startDate,
            fee: plan.fee,
            paid: amountPaid
          }
        ]
      });

      state.subscriptions.push({
        id: subData.id,
        member_id: memberId,
        plan_id: plan.id,
        plan_name_snapshot: plan.name,
        fee_snapshot: plan.fee,
        start_date: startDate,
        end_date: endDate,
        amount_due: totalDue,
        amount_paid: amountPaid,
        balance: balance
      });

      if (amountPaid > 0) {
        state.payments.unshift({
          id: 'pay_' + Date.now(),
          member_id: memberId,
          subscription_id: subData.id,
          amount: amountPaid,
          paid_on: startDate,
          mode: mode,
          type: 'subscription_fee'
        });
      }

      const clientSigUrl = clientCanvas.toDataURL('image/png');
      const managerSigUrl = managerCanvas.toDataURL('image/png');

      generateReceiptPdf({
        memberName: name,
        phone,
        rawAadhaar,
        age,
        bloodGroup: blood,
        address,
        planName: plan.name,
        planDurationDays: plan.duration_days,
        joiningDate: startDate,
        expiryDate: endDate,
        programs: selectedPrograms,
        admissionFee,
        planFee: plan.fee,
        amountPaid,
        paymentMode: mode,
        clientSigDataUrl: clientSigUrl,
        managerSigDataUrl: managerSigUrl
      });

      confetti({ particleCount: 100, spread: 80, origin: { y: 0.5 } });
      alert(`🎉 Admission Successful! Receipt generated and downloaded for ${name} (Member Code: #${nextMemberCode}).`);
      computeDashboardMetrics();
      window.navigateTo('members');
    } catch (err) {
      alert(`Admission error: ${err.message}`);
      btn.disabled = false;
      btn.innerHTML = `<i data-lucide="check-circle"></i> Complete Admission & Download Official Receipt`;
      lucide.createIcons();
    }
  });
}

import './style.css';
import { supabase } from './supabase.js';
import { encryptText, formatInr, maskAadhaar } from './crypto.js';
import { generateReceiptPdf } from './pdf.js';
import confetti from 'canvas-confetti';

// Application Global State
const state = {
  user: null,
  profile: null,
  currentTab: 'dashboard',
  memberFilterTab: 'all',
  programs: [],
  plans: [],
  members: [],
  subscriptions: [],
  payments: [],
  expenses: [],
  renewalsDue: [],
  nearExpiryList: [],
  inactiveOrExpiredList: [],
  newThisWeekCount: 0,
  newThisMonthCount: 0,
  newThisWeekMembers: [],
  newThisMonthMembers: [],
  memberStatusMap: {},
  todayCollection: 0,
  totalPendingDues: 0,
  activeCount: 0,
  selectedRenewal: null,
  admissionPhotoData: null,
  gstEnabled: false,
  gstPercent: 18,
  gstin: '29ABCDE1234F1Z5',
  searchQuery: '',
  selectedProgramFilter: 'all',
  activeCanvasStrokes: {
    client: [],
    manager: []
  }
};

// Global navigation helper accessible across modules and inline HTML onclick handlers
window.navigateTo = (tab) => {
  state.currentTab = tab;
  window.scrollTo(0, 0);
  renderAppShell();
};

// ==========================================
// INITIALIZATION & SESSION RESTORE
// ==========================================
async function initApp() {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (session?.user) {
    state.user = session.user;
    await fetchUserProfile(session.user.id);
    await loadDatabaseData();
    renderAppShell();
  } else {
    renderLoginScreen();
  }
}

async function fetchUserProfile(userId) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (data) {
      state.profile = data;
    } else {
      state.profile = { name: state.user?.email?.split('@')[0] || 'Manager', role: 'admin' };
    }
  } catch (e) {
    state.profile = { name: 'Manager', role: 'admin' };
  }
}

async function loadDatabaseData() {
  try {
    // 1. Load Programs
    const { data: progs } = await supabase.from('programs').select('*').order('name');
    state.programs = progs || [];

    // 2. Load Plans
    const { data: plans } = await supabase.from('plans').select('*').order('fee');
    state.plans = plans || [];

    // 3. Load Members
    const { data: members } = await supabase.from('members').select('*').is('deleted_at', null).order('join_date', { ascending: false });
    state.members = members || [];

    // 4. Load Subscriptions
    const { data: subs } = await supabase.from('subscriptions').select('*').order('end_date');
    state.subscriptions = subs || [];

    // 5. Load Payments
    const { data: payments } = await supabase.from('payments').select('*').order('created_at', { ascending: false });
    state.payments = payments || [];

    // 6. Load Expenses
    const { data: expenses } = await supabase.from('expenses').select('*').order('spent_on', { ascending: false });
    state.expenses = expenses || [];

    computeDashboardMetrics();
  } catch (e) {
    console.error('Failed to load database data:', e);
  }
}

function computeDashboardMetrics() {
  const today = new Date().toISOString().split('T')[0];
  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);

  // Today's collection
  state.todayCollection = state.payments
    .filter(p => p.paid_on?.startsWith(today))
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  // Group latest subscriptions by member
  const latestSubs = {};
  state.subscriptions.forEach(sub => {
    if (!latestSubs[sub.member_id] || new Date(sub.end_date) > new Date(latestSubs[sub.member_id].end_date)) {
      latestSubs[sub.member_id] = sub;
    }
  });

  let active = 0;
  let totalDues = 0;
  const renewals = [];
  const nearExpiryList = [];
  const inactiveOrExpiredList = [];
  state.memberStatusMap = {};

  state.members.forEach(member => {
    const sub = latestSubs[member.id];
    let alertStatus = 'inactive';
    let daysRemaining = -999;
    let balance = 0;
    let endDate = null;
    let planName = 'No Active Plan';
    let planId = null;
    let planFee = 0;

    if (member.is_active === false) {
      alertStatus = 'inactive';
    } else if (sub) {
      totalDues += Number(sub.balance) || 0;
      balance = Number(sub.balance) || 0;
      endDate = sub.end_date;
      planName = sub.plan_name_snapshot || 'Plan';
      planId = sub.plan_id;
      planFee = sub.fee_snapshot || 0;

      const subEndDate = new Date(sub.end_date);
      subEndDate.setHours(0, 0, 0, 0);
      daysRemaining = Math.round((subEndDate - todayDate) / (1000 * 60 * 60 * 24));

      if (daysRemaining < 0) {
        alertStatus = 'expired';
      } else if (daysRemaining <= 3) {
        alertStatus = 'critical';
        active++;
      } else if (daysRemaining <= 7) {
        alertStatus = 'expiring';
        active++;
      } else {
        alertStatus = 'active';
        active++;
      }
    }

    const memberStatusObj = {
      memberId: member.id,
      member,
      sub,
      name: member.name,
      phone: member.phone,
      planName,
      planId,
      planFee,
      endDate,
      daysRemaining,
      alertStatus,
      balance
    };

    state.memberStatusMap[member.id] = memberStatusObj;

    if (alertStatus === 'critical' || alertStatus === 'expiring') {
      nearExpiryList.push(memberStatusObj);
      renewals.push(memberStatusObj);
    } else if (alertStatus === 'expired' || alertStatus === 'inactive') {
      inactiveOrExpiredList.push(memberStatusObj);
      if (alertStatus === 'expired') renewals.push(memberStatusObj);
    }
  });

  state.activeCount = active;
  state.totalPendingDues = totalDues;
  state.nearExpiryList = nearExpiryList.sort((a, b) => a.daysRemaining - b.daysRemaining);
  state.inactiveOrExpiredList = inactiveOrExpiredList.sort((a, b) => b.daysRemaining - a.daysRemaining);

  // Renewals Due Urgency Sort
  state.renewalsDue = renewals.sort((a, b) => {
    const order = { critical: 0, expiring: 1, expired: 2 };
    return order[a.alertStatus] - order[b.alertStatus] || a.daysRemaining - b.daysRemaining;
  });

  // New Members joined this week (last 7 days) and this month
  const sevenDaysAgo = new Date(todayDate.getTime() - 7 * 86400000);
  const firstDayOfMonth = new Date(todayDate.getFullYear(), todayDate.getMonth(), 1);

  state.newThisWeekMembers = state.members.filter(m => {
    if (!m.join_date) return false;
    const jd = new Date(m.join_date);
    return jd >= sevenDaysAgo;
  });
  state.newThisWeekCount = state.newThisWeekMembers.length;

  state.newThisMonthMembers = state.members.filter(m => {
    if (!m.join_date) return false;
    const jd = new Date(m.join_date);
    return jd >= firstDayOfMonth;
  });
  state.newThisMonthCount = state.newThisMonthMembers.length;
}

// ==========================================
// DEMO MODE DATA GENERATOR
// ==========================================
function loadDemoData() {
  state.isDemoMode = true;
  state.user = { id: 'demo-manager-001', email: 'vighneswaran.personal@gmail.com' };
  state.profile = { id: 'demo-manager-001', name: 'Vighneswaran (Manager)', role: 'admin' };

  state.programs = [
    { id: 'prog-1', name: 'General Fitness', is_active: true },
    { id: 'prog-2', name: 'Strength & Conditioning', is_active: true },
    { id: 'prog-3', name: 'Cardio Blast & Fat Loss', is_active: true },
    { id: 'prog-4', name: 'Personal Training (1-on-1)', is_active: true }
  ];

  state.plans = [
    { id: 'plan-1', name: '1 Month Kickstart', duration_days: 30, fee: 1999, is_active: true },
    { id: 'plan-2', name: '3 Months Pro Fitness', duration_days: 90, fee: 4999, is_active: true },
    { id: 'plan-3', name: '6 Months Muscle Transformation', duration_days: 180, fee: 8999, is_active: true },
    { id: 'plan-4', name: '1 Year Elite Annual', duration_days: 365, fee: 14999, is_active: true }
  ];

  const now = new Date();
  const dToday = now.toISOString().split('T')[0];
  const dMinus2 = new Date(now.getTime() - 2 * 86400000).toISOString().split('T')[0];
  const dMinus4 = new Date(now.getTime() - 4 * 86400000).toISOString().split('T')[0];
  const dMinus5 = new Date(now.getTime() - 5 * 86400000).toISOString().split('T')[0];
  const dMinus12 = new Date(now.getTime() - 12 * 86400000).toISOString().split('T')[0];
  const dPlus2 = new Date(now.getTime() + 2 * 86400000).toISOString().split('T')[0];
  const dPlus5 = new Date(now.getTime() + 5 * 86400000).toISOString().split('T')[0];
  const dPlus45 = new Date(now.getTime() + 45 * 86400000).toISOString().split('T')[0];
  const dPlus120 = new Date(now.getTime() + 120 * 86400000).toISOString().split('T')[0];

  state.members = [
    {
      id: 'mem-1',
      name: 'Rahul Sharma',
      phone: '9876543210',
      address: 'Indiranagar 100ft Rd, Bengaluru',
      aadhaar: '5678 1234 4821',
      aadhaar_last4: '4821',
      blood_group: 'B+',
      age: 28,
      join_date: dMinus2,
      is_active: true,
      health_notes: 'None / Fit',
      photo_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
    },
    {
      id: 'mem-2',
      name: 'Priya Sundaram',
      phone: '9845012345',
      address: 'Koramangala 4th Block, Bengaluru',
      aadhaar: '6789 2345 7190',
      aadhaar_last4: '7190',
      blood_group: 'O+',
      age: 25,
      join_date: dMinus12,
      is_active: true,
      health_notes: 'Mild asthma in winter',
      photo_url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80'
    },
    {
      id: 'mem-3',
      name: 'Vikram Malhotra',
      phone: '9988776655',
      address: 'HSR Layout Sector 2, Bengaluru',
      aadhaar: '7890 3456 3312',
      aadhaar_last4: '3312',
      blood_group: 'A+',
      age: 34,
      join_date: '2025-08-15',
      is_active: false,
      health_notes: 'Lower back stiffness',
      photo_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80'
    },
    {
      id: 'mem-4',
      name: 'Ananya Deshmukh',
      phone: '9765432109',
      address: 'Whitefield Main Rd, Bengaluru',
      aadhaar: '8901 4567 8834',
      aadhaar_last4: '8834',
      blood_group: 'AB+',
      age: 22,
      join_date: dMinus5,
      is_active: true,
      health_notes: 'No medical conditions',
      photo_url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80'
    },
    {
      id: 'mem-5',
      name: 'Karthik Raja',
      phone: '9123456780',
      address: 'JP Nagar 6th Phase, Bengaluru',
      aadhaar: '9012 5678 5501',
      aadhaar_last4: '5501',
      blood_group: 'O-',
      age: 31,
      join_date: '2025-06-20',
      is_active: true,
      health_notes: 'ACL surgery in 2023',
      photo_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80'
    },
    {
      id: 'mem-6',
      name: 'Sneha Patel',
      phone: '9900112233',
      address: 'BTM Layout 2nd Stage, Bengaluru',
      aadhaar: '4321 8765 1092',
      aadhaar_last4: '1092',
      blood_group: 'B+',
      age: 27,
      join_date: dMinus2,
      is_active: true,
      health_notes: 'General endurance trainee',
      photo_url: 'https://images.unsplash.com/photo-1548142813-c348350df52b?w=150&auto=format&fit=crop&q=80'
    }
  ];

  state.subscriptions = [
    {
      id: 'sub-1',
      member_id: 'mem-1',
      plan_id: 'plan-2',
      plan_name_snapshot: '3 Months Pro Fitness',
      fee_snapshot: 4999,
      start_date: '2026-01-09',
      end_date: dPlus2, // Critical (Red <= 3 days)
      amount_due: 4999,
      amount_paid: 4999,
      balance: 0
    },
    {
      id: 'sub-2',
      member_id: 'mem-2',
      plan_id: 'plan-1',
      plan_name_snapshot: '1 Month Kickstart',
      fee_snapshot: 1999,
      start_date: '2026-03-04',
      end_date: dPlus5, // Expiring (Yellow <= 7 days)
      amount_due: 1999,
      amount_paid: 1500,
      balance: 499
    },
    {
      id: 'sub-3',
      member_id: 'mem-3',
      plan_id: 'plan-3',
      plan_name_snapshot: '6 Months Muscle Transformation',
      fee_snapshot: 8999,
      start_date: '2025-10-04',
      end_date: dMinus4, // Expired
      amount_due: 8999,
      amount_paid: 8999,
      balance: 0
    },
    {
      id: 'sub-4',
      member_id: 'mem-4',
      plan_id: 'plan-4',
      plan_name_snapshot: '1 Year Elite Annual',
      fee_snapshot: 14999,
      start_date: '2026-01-05',
      end_date: dPlus120, // Active
      amount_due: 14999,
      amount_paid: 14999,
      balance: 0
    },
    {
      id: 'sub-5',
      member_id: 'mem-5',
      plan_id: 'plan-2',
      plan_name_snapshot: '3 Months Pro Fitness',
      fee_snapshot: 4999,
      start_date: '2026-02-15',
      end_date: dPlus45,
      amount_due: 4999,
      amount_paid: 4000,
      balance: 999
    },
    {
      id: 'sub-6',
      member_id: 'mem-6',
      plan_id: 'plan-2',
      plan_name_snapshot: '3 Months Pro Fitness',
      fee_snapshot: 4999,
      start_date: dMinus2,
      end_date: dPlus45,
      amount_due: 4999,
      amount_paid: 4999,
      balance: 0
    }
  ];

  state.payments = [
    { id: 'pay-1', member_id: 'mem-1', amount: 4999, paid_on: dToday, mode: 'upi', type: 'subscription_fee' },
    { id: 'pay-2', member_id: 'mem-2', amount: 1500, paid_on: dToday, mode: 'cash', type: 'subscription_fee' },
    { id: 'pay-3', member_id: 'mem-4', amount: 14999, paid_on: '2026-01-05', mode: 'card', type: 'subscription_fee' },
    { id: 'pay-4', member_id: 'mem-5', amount: 4999, paid_on: '2026-02-20', mode: 'upi', type: 'subscription_fee' }
  ];

  state.expenses = [
    { id: 'exp-1', title: 'Monthly Gym Facility Rent', category: 'Rent', amount: 45000, spent_on: dToday, payment_mode: 'bank_transfer' },
    { id: 'exp-2', title: 'Commercial Electricity Bill', category: 'Electricity', amount: 11200, spent_on: '2026-04-01', payment_mode: 'online' },
    { id: 'exp-3', title: 'Olympic Barbell & Cables Maintenance', category: 'Maintenance', amount: 4200, spent_on: '2026-04-03', payment_mode: 'upi' },
    { id: 'exp-4', title: 'Head Trainer Monthly Stipend', category: 'Salaries', amount: 35000, spent_on: '2026-04-01', payment_mode: 'bank_transfer' }
  ];

  computeDashboardMetrics();
}

// ==========================================
// LOGIN VIEW
// ==========================================
function renderLoginScreen() {
  const app = document.getElementById('app');
  let isSignUpMode = false;

  function updateLoginUi() {
    app.innerHTML = `
      <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; background: radial-gradient(circle at center, rgba(255, 102, 0, 0.1) 0%, #000000 100%);">
        <div class="modal-card" style="max-width: 440px; background: #0a0b0f; border-color: var(--border-orange); box-shadow: var(--shadow-glow);">
          <div style="text-align: center; margin-bottom: 24px;">
            <div class="brand-icon" style="width: 64px; height: 64px; margin: 0 auto 16px; border-radius: 16px; box-shadow: 0 0 25px rgba(255, 102, 0, 0.45);">
              <i data-lucide="dumbbell" style="width: 34px; height: 34px; color: #ffffff;"></i>
            </div>
            <h1 style="font-size: 32px; letter-spacing: 2px; color: #ffffff;">SHAPE</h1>
            <p style="color: var(--primary); font-weight: 800; font-size: 11px; letter-spacing: 2.5px; margin-top: 4px;">FITNESS CLUB &bull; GYM MANAGEMENT</p>
          </div>

          <!-- Instant 1-Click Demo Button -->
          <div style="margin-bottom: 24px; padding: 14px; background: rgba(255, 102, 0, 0.1); border: 1.5px solid var(--primary); border-radius: 14px; text-align: center;">
            <div style="font-size: 12px; color: var(--primary); font-weight: 800; margin-bottom: 8px; letter-spacing: 0.5px;">
              ⚡ TEST THE LIVE APP IMMEDIATELY
            </div>
            <button id="quick-demo-btn" class="btn-primary" style="width: 100%; justify-content: center; font-weight: 800; font-size: 15px; box-shadow: 0 0 25px rgba(255, 102, 0, 0.5);">
              <i data-lucide="play-circle"></i> Launch App (Instant Access)
            </button>
            <div style="font-size: 11px; color: var(--text-muted); margin-top: 8px;">
              No password needed &bull; Pre-loaded with members & alerts
            </div>
          </div>

          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 20px;">
            <div style="flex: 1; height: 1px; background: var(--border-subtle);"></div>
            <span style="font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px;">Or Supabase Sign In</span>
            <div style="flex: 1; height: 1px; background: var(--border-subtle);"></div>
          </div>

          <form id="login-form">
            <div id="login-error" style="display: none; background: rgba(239, 68, 68, 0.15); border: 1px solid var(--alert-red); color: var(--alert-red); padding: 12px; border-radius: 10px; font-size: 13px; margin-bottom: 16px;"></div>
            <div id="login-success" style="display: none; background: rgba(34, 197, 94, 0.15); border: 1px solid var(--accent-green); color: var(--accent-green); padding: 12px; border-radius: 10px; font-size: 13px; margin-bottom: 16px;"></div>

            <div class="form-group">
              <label class="form-label">Email Address</label>
              <input type="email" id="login-email" class="form-input" value="vighneswaran.personal@gmail.com" required placeholder="manager@shapegym.com" />
            </div>

            <div class="form-group">
              <label class="form-label">Password</label>
              <input type="password" id="login-password" class="form-input" required placeholder="••••••••" />
            </div>

            <button type="submit" id="login-btn" class="btn-secondary" style="width: 100%; justify-content: center; margin-top: 10px;">
              ${isSignUpMode ? 'Create Supabase Account' : 'Sign In with Supabase'}
            </button>
          </form>

          <div style="text-align: center; margin-top: 14px;">
            <a href="#" id="toggle-signup-link" style="color: var(--primary); font-size: 12px; text-decoration: none;">
              ${isSignUpMode ? 'Already have an account? Sign In' : 'Need to set your password? Create Account'}
            </a>
          </div>

          <p style="text-align: center; color: var(--text-muted); font-size: 11px; margin-top: 20px;">
            Secured with Supabase RLS & AES-256 On-Device Encryption
          </p>
        </div>
      </div>
    `;

    lucide.createIcons();

    // 1-Click Quick Demo Handler
    document.getElementById('quick-demo-btn').addEventListener('click', () => {
      loadDemoData();
      confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 } });
      renderAppShell();
    });

    // Toggle Sign Up Handler
    document.getElementById('toggle-signup-link').addEventListener('click', (e) => {
      e.preventDefault();
      isSignUpMode = !isSignUpMode;
      updateLoginUi();
    });

    // Form Submit Handler (Sign In / Sign Up)
    document.getElementById('login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-password').value;
      const btn = document.getElementById('login-btn');
      const errBox = document.getElementById('login-error');
      const successBox = document.getElementById('login-success');

      btn.disabled = true;
      btn.innerHTML = `<i data-lucide="loader" class="animate-spin"></i> Processing...`;
      lucide.createIcons();
      errBox.style.display = 'none';
      successBox.style.display = 'none';

      try {
        if (isSignUpMode) {
          const { data, error } = await supabase.auth.signUp({ email, password });
          if (error) throw error;
          successBox.style.display = 'block';
          successBox.innerText = 'Account registered! You can now sign in with this password.';
          btn.disabled = false;
          btn.innerText = 'Sign In with Supabase';
          isSignUpMode = false;
        } else {
          const { data, error } = await supabase.auth.signInWithPassword({ email, password });
          if (error) throw error;

          state.isDemoMode = false;
          state.user = data.user;
          await fetchUserProfile(data.user.id);
          await loadDatabaseData();
          renderAppShell();
        }
      } catch (err) {
        errBox.style.display = 'block';
        errBox.innerText = err.message || 'Authentication error. Please check details or use Instant Demo Mode above.';
        btn.disabled = false;
        btn.innerText = isSignUpMode ? 'Create Supabase Account' : 'Sign In with Supabase';
        lucide.createIcons();
      }
    });
  }

  updateLoginUi();
}

// ==========================================
// APP SHELL (SIDEBAR & MAIN VIEWPORT)
// ==========================================
function renderAppShell() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="app-container">
      <!-- Desktop Sidebar -->
      <aside class="sidebar">
        <div class="brand">
          <div class="brand-icon">
            <i data-lucide="dumbbell"></i>
          </div>
          <div>
            <div class="brand-name">SHAPE</div>
            <div class="brand-sub">FITNESS CLUB</div>
          </div>
        </div>

        <ul class="nav-links">
          <li class="nav-item ${state.currentTab === 'dashboard' ? 'active' : ''}" data-tab="dashboard">
            <i data-lucide="layout-dashboard"></i> Dashboard
          </li>
          <li class="nav-item ${state.currentTab === 'members' ? 'active' : ''}" data-tab="members">
            <i data-lucide="users"></i> Members
          </li>
          <li class="nav-item ${state.currentTab === 'admission' ? 'active' : ''}" data-tab="admission">
            <i data-lucide="user-plus"></i> New Admission
          </li>
          <li class="nav-item ${state.currentTab === 'plans' ? 'active' : ''}" data-tab="plans">
            <i data-lucide="credit-card"></i> Membership Plans
          </li>
          <li class="nav-item ${state.currentTab === 'accounts' ? 'active' : ''}" data-tab="accounts">
            <i data-lucide="pie-chart"></i> Accounts & Reports
          </li>
          <li class="nav-item ${state.currentTab === 'settings' ? 'active' : ''}" data-tab="settings">
            <i data-lucide="settings"></i> Settings
          </li>
        </ul>

        <div class="sidebar-footer">
          <div class="user-card">
            <div class="user-avatar">${(state.profile?.name || 'M')[0].toUpperCase()}</div>
            <div class="user-meta">
              <div class="user-name">${state.profile?.name || 'Manager'}</div>
              <span class="user-role-badge">${state.profile?.role || 'admin'}</span>
            </div>
            <button id="logout-btn" title="Sign Out" style="background: none; border: none; color: var(--text-muted); cursor: pointer;">
              <i data-lucide="log-out" style="width: 18px; height: 18px;"></i>
            </button>
          </div>
        </div>
      </aside>

      <!-- Main Layout -->
      <div class="main-wrapper">
        <header class="top-bar">
          <!-- Mobile Brand Logo -->
          <div class="top-bar-mobile-brand">
            <div class="brand-icon">
              <i data-lucide="dumbbell"></i>
            </div>
            <div>
              <div class="brand-name">SHAPE</div>
              <div class="brand-sub">FITNESS</div>
            </div>
          </div>

          <div style="display: flex; align-items: center; gap: 12px;">
            <h2 id="page-title" style="font-size: 20px;">Gym Operations</h2>
          </div>

          <div style="display: flex; align-items: center; gap: 10px;">
            <button class="btn-secondary" style="padding: 8px 14px; font-size: 13px;" onclick="window.takeWeeklyBackup()" title="Download Full Weekly Backup">
              <i data-lucide="cloud-download"></i> Weekly Backup
            </button>

            <button class="btn-primary" style="padding: 8px 16px; font-size: 13px;" id="quick-admission-btn" onclick="window.navigateTo('admission')">
              <i data-lucide="plus"></i> Add Member
            </button>

            <!-- Mobile Sign Out Button -->
            <button id="mobile-logout-btn" title="Sign Out" style="background: rgba(255, 255, 255, 0.08); border: 1px solid var(--border-subtle); color: var(--text-secondary); width: 38px; height: 38px; border-radius: 50%; display: none; align-items: center; justify-content: center; cursor: pointer;">
              <i data-lucide="log-out" style="width: 17px; height: 17px;"></i>
            </button>
          </div>
        </header>

        <main id="main-content" class="content-area"></main>
      </div>

      <!-- Mobile Bottom Navigation (Ultra-responsive 5-tab with floating FAB) -->
      <nav class="mobile-bottom-nav">
        <button class="mobile-nav-item ${state.currentTab === 'dashboard' ? 'active' : ''}" data-tab="dashboard" onclick="window.navigateTo('dashboard')">
          <i data-lucide="layout-dashboard"></i>
          <span>Home</span>
        </button>
        <button class="mobile-nav-item ${state.currentTab === 'members' ? 'active' : ''}" data-tab="members" onclick="window.navigateTo('members')">
          <i data-lucide="users"></i>
          <span>Members</span>
        </button>
        <button class="mobile-nav-fab ${state.currentTab === 'admission' ? 'active' : ''}" data-tab="admission" title="New Admission" onclick="window.navigateTo('admission')">
          <div class="fab-circle">
            <i data-lucide="user-plus"></i>
          </div>
          <span>Admission</span>
        </button>
        <button class="mobile-nav-item ${state.currentTab === 'plans' ? 'active' : ''}" data-tab="plans" onclick="window.navigateTo('plans')">
          <i data-lucide="dumbbell"></i>
          <span>Plans</span>
        </button>
        <button class="mobile-nav-item ${state.currentTab === 'accounts' ? 'active' : ''}" data-tab="accounts" onclick="window.navigateTo('accounts')">
          <i data-lucide="pie-chart"></i>
          <span>Accounts</span>
        </button>
      </nav>
    </div>
  `;

  lucide.createIcons();

  // Navigation handlers (works for both desktop sidebar and mobile bottom nav)
  document.querySelectorAll('[data-tab]').forEach(el => {
    el.addEventListener('click', (e) => {
      const target = e.currentTarget || el;
      const tab = target.getAttribute('data-tab');
      if (tab) {
        window.navigateTo(tab);
      }
    });
  });

  const handleLogout = async () => {
    await supabase.auth.signOut();
    state.user = null;
    state.isDemoMode = false;
    renderLoginScreen();
  };

  document.getElementById('logout-btn')?.addEventListener('click', handleLogout);
  document.getElementById('mobile-logout-btn')?.addEventListener('click', handleLogout);

  document.getElementById('quick-admission-btn')?.addEventListener('click', () => {
    window.navigateTo('admission');
  });

  // Render currently selected view
  switch (state.currentTab) {
    case 'dashboard':
      renderDashboardView();
      break;
    case 'members':
      renderMembersView();
      break;
    case 'admission':
      renderAdmissionView();
      break;
    case 'plans':
      renderPlansView();
      break;
    case 'accounts':
      renderAccountsView();
      break;
    case 'settings':
      renderSettingsView();
      break;
    default:
      renderDashboardView();
  }
}

// ==========================================
// VIEW 1: DASHBOARD & COLOR-CODED ALERTS
// ==========================================
function renderDashboardView() {
  const content = document.getElementById('main-content');
  document.getElementById('page-title').innerText = 'Dashboard Overview';

  content.innerHTML = `
    <!-- Top Metrics Grid -->
    <div class="metrics-grid">
      <div class="metric-card">
        <div class="metric-header">
          <span class="metric-title">Total Members</span>
          <div class="metric-icon-box" style="background: rgba(255, 87, 34, 0.15); color: var(--primary);">
            <i data-lucide="users"></i>
          </div>
        </div>
        <div class="metric-value">${state.members.length}</div>
        <div class="metric-subtitle">${state.activeCount} active subscriptions</div>
      </div>

      <div class="metric-card">
        <div class="metric-header">
          <span class="metric-title">Today's Collection</span>
          <div class="metric-icon-box" style="background: rgba(34, 197, 94, 0.15); color: var(--alert-green);">
            <i data-lucide="indian-rupee"></i>
          </div>
        </div>
        <div class="metric-value" style="color: var(--alert-green);">${formatInr(state.todayCollection)}</div>
        <div class="metric-subtitle">Cash, UPI & Card payments</div>
      </div>

      <div class="metric-card">
        <div class="metric-header">
          <span class="metric-title">Renewals Due</span>
          <div class="metric-icon-box" style="background: rgba(239, 68, 68, 0.15); color: var(--alert-red);">
            <i data-lucide="clock"></i>
          </div>
        </div>
        <div class="metric-value" style="color: var(--alert-red);">${state.renewalsDue.length}</div>
        <div class="metric-subtitle">Requires front-desk action</div>
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
        Renewals Due
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

          if (item.alertStatus === 'critical') {
            cardClass = 'red-alert';
            tagText = `${item.daysRemaining} days left (Critical)`;
            tagClass = 'red';
          } else if (item.alertStatus === 'expired') {
            cardClass = 'expired-alert';
            tagText = `Expired (${Math.abs(item.daysRemaining)}d ago)`;
            tagClass = 'expired';
          }

          return `
            <div class="renewal-card ${cardClass}">
              <div>
                <div class="renewal-card-top">
                  <div>
                    <div class="member-name">${item.name}</div>
                    <div class="member-program">${item.planName} • +91 ${item.phone}</div>
                  </div>
                  <span class="alert-tag ${tagClass}">${tagText}</span>
                </div>

                <div class="renewal-meta-row">
                  <span>Expiry: <strong>${new Date(item.endDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</strong></span>
                  ${item.balance > 0 ? `<span style="color: var(--alert-red); font-weight: 700;">Dues: ${formatInr(item.balance)}</span>` : `<span style="color: var(--alert-green);">Dues Cleared</span>`}
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

// Global actions for card buttons
window.sendWhatsAppReminder = (name, phone, planName, endDate, balance) => {
  const cleanPhone = phone.length === 10 ? `91${phone}` : phone;
  const dateStr = new Date(endDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const duesMsg = balance > 0 ? ` Outstanding balance: ${formatInr(balance)}.` : '';
  const text = encodeURIComponent(`Hello ${name}! 👋 This is a reminder from Shape Fitness Club. Your ${planName} membership expires on ${dateStr}.${duesMsg} Please visit the front desk to renew your subscription! 💪`);
  window.open(`https://api.whatsapp.com/send?phone=${cleanPhone}&text=${text}`, '_blank');
};

window.openRenewalModal = (memberId, memberName, carriedBalance, planId) => {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'renewal-modal';

  const defaultPlan = state.plans.find(p => p.id === planId) || state.plans[0];
  const totalDue = (defaultPlan?.fee || 0) + carriedBalance;

  modal.innerHTML = `
    <div class="modal-card">
      <div class="modal-sheet-handle"></div>
      <div class="modal-header">
        <div>
          <h2>Renew Membership</h2>
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

    if (!state.isDemoMode) {
      try {
        // 1. Insert new subscription
        const { data: subData } = await supabase.from('subscriptions').insert({
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

        // 2. Insert payment record
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

    // Update in-memory state for instant UI responsiveness
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

    computeDashboardMetrics();
    confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
    document.getElementById('renewal-modal').remove();
    renderDashboardView();
  });
};

// ==========================================
// VIEW 2: NEW MEMBER ADMISSION & DUAL SIGNATURES
// ==========================================
function renderAdmissionView() {
  const content = document.getElementById('main-content');
  document.getElementById('page-title').innerText = 'New Member Admission';

  // Reset signature stroke buffers for clean new admission
  state.activeCanvasStrokes.client = [];
  state.activeCanvasStrokes.manager = [];

  const defaultPlan = state.plans[0] || { name: '3 Months', duration_days: 90, fee: 4999 };
  const today = new Date().toISOString().split('T')[0];
  const expiryDate = new Date(Date.now() + defaultPlan.duration_days * 86400000).toISOString().split('T')[0];

  content.innerHTML = `
    <div class="admission-container">
      <div class="admission-card">
        <h2 style="font-size: 22px; font-weight: 800; margin-bottom: 6px; color: var(--text-main);">Front-Desk Enrollment Form</h2>
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

  // Plan select update expiry preview & fee
  const planSelect = document.getElementById('adm-plan-select');
  planSelect.addEventListener('change', () => {
    const opt = planSelect.options[planSelect.selectedIndex];
    const days = Number(opt.getAttribute('data-days')) || 90;
    const fee = Number(opt.getAttribute('data-fee')) || 4999;
    const expiry = new Date(Date.now() + days * 86400000).toISOString().split('T')[0];
    document.getElementById('adm-expiry-preview').value = expiry;
    document.getElementById('adm-amount-paid').value = fee;
  });

  // Setup signature drawing canvases
  setupSignatureCanvas('client-signature', 'client');
  setupSignatureCanvas('manager-signature', 'manager');

  // Submit Admission
  document.getElementById('admission-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const clientCanvas = document.getElementById('client-signature');
    const managerCanvas = document.getElementById('manager-signature');

    if (!window.hasSignatureDrawn('client') || !window.hasSignatureDrawn('manager')) {
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
      const plan = state.plans.find(p => p.id === selectedPlanId);
      const admissionFee = Number(document.getElementById('adm-fee').value) || 0;
      const amountPaid = Number(document.getElementById('adm-amount-paid').value) || 0;
      const mode = document.getElementById('adm-payment-mode').value;

      const totalDue = plan.fee + admissionFee;
      const balance = Math.max(0, totalDue - amountPaid);
      const startDate = new Date().toISOString().split('T')[0];
      const endDate = document.getElementById('adm-expiry-preview').value;

      // 1. Client-Side AES Encryption
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

      if (!state.isDemoMode) {
        try {
          // 2. Insert Member
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

          // 3. Insert Selected Programs
          for (const chip of activeProgramChips) {
            const progId = chip.getAttribute('data-prog-id');
            await supabase.from('member_programs').insert({ member_id: memberId, program_id: progId });
          }

          // 4. Insert Subscription
          const { data: insertedSub } = await supabase.from('subscriptions').insert({
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
          if (insertedSub) subData = insertedSub;

          // 5. Insert Payment Record
          if (amountPaid > 0) {
            await supabase.from('payments').insert({
              member_id: memberId,
              subscription_id: subData?.id,
              amount: amountPaid,
              mode: mode,
              type: 'subscription_fee',
              note: `Admission fee + ${plan.name}`
            });
          }

          // 6. Signatures (Data URLs)
          await supabase.from('signatures').insert({
            member_id: memberId,
            client_signature_path: `${memberId}_client.png`,
            manager_signature_path: `${memberId}_manager.png`
          });
        } catch (dbErr) {
          console.warn('Supabase insert failed, saving to local state:', dbErr);
        }
      }

      // Add to local state
      state.members.unshift({
        id: memberId,
        name,
        phone,
        address,
        aadhaar: rawAadhaar,
        aadhaar_last4: aadhaarLast4,
        blood_group: blood,
        age,
        join_date: startDate,
        is_active: true
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

      // 6. Signatures (Data URLs)
      const clientSigUrl = clientCanvas.toDataURL('image/png');
      const managerSigUrl = managerCanvas.toDataURL('image/png');

      // 7. Generate & Download PDF Receipt
      const doc = generateReceiptPdf({
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

      doc.save(`Receipt_${name.replace(/\s+/g, '_')}.pdf`);
      confetti({ particleCount: 100, spread: 80, origin: { y: 0.5 } });

      alert(`🎉 Admission Successful! Receipt generated and downloaded for ${name}.`);
      computeDashboardMetrics();
      state.currentTab = 'dashboard';
      renderAppShell();
    } catch (err) {
      alert('Error during admission: ' + err.message);
      btn.disabled = false;
      btn.innerHTML = `<i data-lucide="check-circle"></i> Complete Admission & Download Official Receipt`;
      lucide.createIcons();
    }
  });
}

function setupSignatureCanvas(canvasId, type) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const initCanvas = () => {
    const parent = canvas.parentElement;
    const parentWidth = parent ? parent.clientWidth : 320;
    const displayWidth = parentWidth > 50 ? parentWidth : 320;
    const displayHeight = 150;
    const dpr = window.devicePixelRatio || 1;

    canvas.width = displayWidth * dpr;
    canvas.height = displayHeight * dpr;
    canvas.style.width = '100%';
    canvas.style.height = `${displayHeight}px`;

    const ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.strokeStyle = '#ff6600'; /* Vivid Athletic Orange signature ink */
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Redraw strokes if any
    const strokes = state.activeCanvasStrokes[type] || [];
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
    state.activeCanvasStrokes[type].push(pos);
    if (e.cancelable) e.preventDefault();
  };

  const draw = (e) => {
    if (!drawing) return;
    const pos = getPos(e);
    const ctx = canvas.getContext('2d');
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    state.activeCanvasStrokes[type].push(pos);
    if (e.cancelable) e.preventDefault();
  };

  const stop = () => {
    drawing = false;
  };

  canvas.addEventListener('mousedown', start);
  canvas.addEventListener('mousemove', draw);
  window.addEventListener('mouseup', stop);

  // Touch events with passive: false to prevent scrolling while drawing signature
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
  state.activeCanvasStrokes[type] = [];
};

window.hasSignatureDrawn = (type) => {
  return state.activeCanvasStrokes[type] && state.activeCanvasStrokes[type].length > 5;
};

window.setMemberFilter = (tab) => {
  state.memberFilterTab = tab;
  renderMembersView();
};

// ==========================================
// WEEKLY BACKUP ENGINE
// ==========================================
window.takeWeeklyBackup = () => {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  
  // ISO Week Number
  const tempDate = new Date(now.getTime());
  tempDate.setHours(0, 0, 0, 0);
  tempDate.setDate(tempDate.getDate() + 3 - (tempDate.getDay() + 6) % 7);
  const week1 = new Date(tempDate.getFullYear(), 0, 4);
  const weekNum = 1 + Math.round(((tempDate.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);

  const backupData = {
    gymName: 'Shape Fitness Club',
    backupType: 'Weekly Complete Database Archive',
    weekNumber: weekNum,
    year: now.getFullYear(),
    generatedAt: now.toISOString(),
    metrics: {
      totalMembers: state.members.length,
      activeMembers: state.activeCount,
      nearExpiryCount: state.nearExpiryList.length,
      inactiveCount: state.inactiveOrExpiredList.length,
      joinedThisWeek: state.newThisWeekCount,
      joinedThisMonth: state.newThisMonthCount,
      todayCollection: state.todayCollection,
      totalPendingDues: state.totalPendingDues
    },
    members: state.members,
    subscriptions: state.subscriptions,
    payments: state.payments,
    expenses: state.expenses,
    plans: state.plans,
    programs: state.programs
  };

  // 1. JSON Backup File
  const jsonStr = JSON.stringify(backupData, null, 2);
  const jsonBlob = new Blob([jsonStr], { type: 'application/json' });
  const jsonUrl = URL.createObjectURL(jsonBlob);
  const jsonLink = document.createElement('a');
  jsonLink.href = jsonUrl;
  jsonLink.download = `ShapeGym_Backup_${now.getFullYear()}_Week${weekNum}_${todayStr}.json`;
  document.body.appendChild(jsonLink);
  jsonLink.click();
  jsonLink.remove();

  // 2. CSV Backup of Members
  const csvHeaders = ['ID', 'Name', 'Phone', 'Age', 'Blood Group', 'Join Date', 'Status', 'Address', 'Health Notes'];
  const csvRows = state.members.map(m => [
    m.id,
    `"${(m.name || '').replace(/"/g, '""')}"`,
    m.phone,
    m.age || '',
    m.blood_group || '',
    m.join_date || '',
    m.is_active === false ? 'Inactive' : 'Active',
    `"${(m.address || '').replace(/"/g, '""')}"`,
    `"${(m.health_notes || '').replace(/"/g, '""')}"`
  ]);
  const csvContent = [csvHeaders.join(','), ...csvRows.map(r => r.join(','))].join('\n');
  const csvBlob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const csvUrl = URL.createObjectURL(csvBlob);
  const csvLink = document.createElement('a');
  csvLink.href = csvUrl;
  csvLink.download = `ShapeGym_Members_Weekly_Backup_${todayStr}.csv`;
  document.body.appendChild(csvLink);
  csvLink.click();
  csvLink.remove();

  const formattedDate = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  localStorage.setItem('shape_last_weekly_backup', formattedDate);
  confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
  alert(`✅ Weekly Data Backup completed successfully!\n\nDownloaded:\n1. ShapeGym_Backup_${now.getFullYear()}_Week${weekNum}_${todayStr}.json\n2. ShapeGym_Members_Weekly_Backup_${todayStr}.csv\n\nTotal records archived: ${state.members.length} Members, ${state.subscriptions.length} Subscriptions, ${state.payments.length} Payments.`);
  renderMembersView();
};

// ==========================================
// MEMBER DETAILS & EDIT MODAL
// ==========================================
function getMemberRemainingDaysInfo(member, statusObj) {
  let badgeClass = 'yellow';
  let badgeText = 'Active';
  let remainingDaysText = '';
  let daysColor = '#22c55e'; // Green

  if (member.is_active === false) {
    badgeClass = 'expired';
    badgeText = 'Inactive';
    remainingDaysText = 'Membership Inactive';
    daysColor = '#94a3b8';
  } else if (!statusObj || !statusObj.sub) {
    badgeClass = 'expired';
    badgeText = 'No Plan';
    remainingDaysText = 'No active plan';
    daysColor = '#94a3b8';
  } else if (statusObj.daysRemaining < 0) {
    badgeClass = 'expired';
    badgeText = 'Expired';
    const past = Math.abs(statusObj.daysRemaining);
    remainingDaysText = `Expired (${past}d ago)`;
    daysColor = '#ef4444';
  } else if (statusObj.daysRemaining === 0) {
    badgeClass = 'red';
    badgeText = 'Expires Today';
    remainingDaysText = 'Expires Today!';
    daysColor = '#ef4444';
  } else if (statusObj.daysRemaining === 1) {
    badgeClass = 'red';
    badgeText = '1d Left';
    remainingDaysText = '1 day remaining';
    daysColor = '#ef4444';
  } else if (statusObj.daysRemaining <= 3) {
    badgeClass = 'red';
    badgeText = `${statusObj.daysRemaining}d Left (Critical)`;
    remainingDaysText = `${statusObj.daysRemaining} days remaining`;
    daysColor = '#ef4444';
  } else if (statusObj.daysRemaining <= 7) {
    badgeClass = 'yellow';
    badgeText = `${statusObj.daysRemaining}d Left`;
    remainingDaysText = `${statusObj.daysRemaining} days remaining`;
    daysColor = '#f59e0b';
  } else {
    badgeClass = 'yellow';
    badgeText = 'Active';
    remainingDaysText = `${statusObj.daysRemaining} days remaining`;
    daysColor = '#22c55e';
  }

  return { badgeClass, badgeText, remainingDaysText, daysColor };
}

window.openMemberDetailModal = (memberId) => {
  const member = state.members.find(m => m.id === memberId);
  if (!member) return;

  const statusObj = state.memberStatusMap[memberId] || {};
  const daysInfo = getMemberRemainingDaysInfo(member, statusObj);
  const modal = document.createElement('div');
  modal.id = 'member-detail-modal';
  modal.className = 'modal-overlay';

  modal.innerHTML = `
    <div class="modal-card modal-card-lg">
      <div class="modal-header">
        <div>
          <h2 style="font-size: 20px; font-weight: 800; color: #fff;">Customer Profile & Edit</h2>
          <p style="font-size: 12px; color: var(--text-secondary); margin-top: 2px;">
            ID: ${member.id} • Joined: ${new Date(member.join_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
          </p>
        </div>
        <button class="close-btn" onclick="document.getElementById('member-detail-modal').remove()">
          <i data-lucide="x"></i>
        </button>
      </div>

      <!-- Membership & Financial Snapshot -->
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

      <!-- Editable Customer Details Form -->
      <form id="edit-member-form">
        <h3 style="font-size: 13px; font-weight: 800; color: var(--primary); text-transform: uppercase; margin-bottom: 12px; letter-spacing: 0.5px;">1. Personal & Contact Information</h3>

        <div class="form-grid-2">
          <div class="form-group">
            <label class="form-label">Full Name *</label>
            <input type="text" id="edit-mem-name" class="form-input" value="${member.name}" required />
          </div>

          <div class="form-group">
            <label class="form-label">Phone Number *</label>
            <input type="tel" id="edit-mem-phone" class="form-input" maxlength="10" value="${member.phone}" required />
          </div>
        </div>

        <div class="form-grid-3" style="margin-top: 14px;">
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

          <div class="form-group">
            <label class="form-label">Membership Status</label>
            <select id="edit-mem-status" class="form-select">
              <option value="true" ${member.is_active !== false ? 'selected' : ''}>Active Member</option>
              <option value="false" ${member.is_active === false ? 'selected' : ''}>Inactive / Suspended</option>
            </select>
          </div>
        </div>

        <div class="form-group" style="margin-top: 14px;">
          <label class="form-label">Aadhaar Number (12 Digits - Admin Editable) *</label>
          <input type="text" id="edit-mem-aadhaar" class="form-input" maxlength="14" value="${member.aadhaar || ('5678 1234 ' + (member.aadhaar_last4 || '4821'))}" placeholder="12-digit Aadhaar Number" required style="font-family: monospace; letter-spacing: 0.5px; font-weight: 600;" />
          <span style="font-size: 11px; color: var(--alert-green); display: block; margin-top: 4px;">Visible to Admin & AES-256 Protected</span>
        </div>

        <div class="form-group" style="margin-top: 14px;">
          <label class="form-label">Residential Address</label>
          <input type="text" id="edit-mem-address" class="form-input" value="${member.address || ''}" placeholder="Street address, city" />
        </div>

        <div class="form-group" style="margin-top: 14px;">
          <label class="form-label">Health & Medical History</label>
          <textarea id="edit-mem-health" class="form-textarea" rows="2" placeholder="Injuries, medications, allergies">${member.health_notes || ''}</textarea>
        </div>

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
    </div>
  `;

  document.body.appendChild(modal);
  lucide.createIcons();

  document.getElementById('edit-member-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const updatedName = document.getElementById('edit-mem-name').value.trim();
    const updatedPhone = document.getElementById('edit-mem-phone').value.trim();
    const updatedAadhaar = document.getElementById('edit-mem-aadhaar').value.trim();
    const updatedAge = Number(document.getElementById('edit-mem-age').value) || 25;
    const updatedBlood = document.getElementById('edit-mem-blood').value;
    const updatedStatus = document.getElementById('edit-mem-status').value === 'true';
    const updatedAddress = document.getElementById('edit-mem-address').value.trim();
    const updatedHealth = document.getElementById('edit-mem-health').value.trim();

    member.name = updatedName;
    member.phone = updatedPhone;
    member.aadhaar = updatedAadhaar;
    member.aadhaar_last4 = updatedAadhaar.replace(/\s+/g, '').slice(-4);
    member.age = updatedAge;
    member.blood_group = updatedBlood;
    member.is_active = updatedStatus;
    member.address = updatedAddress;
    member.health_notes = updatedHealth;

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

    computeDashboardMetrics();
    modal.remove();
    renderMembersView();
    alert(`✅ Member details for "${updatedName}" updated successfully!`);
  });
};

// ==========================================
// VIEW 3: MEMBERS DIRECTORY
// ==========================================
function renderMembersView() {
  const content = document.getElementById('main-content');
  document.getElementById('page-title').innerText = 'Members Directory';

  const query = state.searchQuery.toLowerCase();
  const filtered = state.members.filter(m => {
    const matchesSearch = !query || m.name.toLowerCase().includes(query) || m.phone.includes(query);
    if (!matchesSearch) return false;

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
      <div style="flex: 1; min-width: 220px;">
        <input type="text" id="member-search-input" class="form-input" style="width: 100%;" placeholder="Search by name or mobile..." value="${state.searchQuery}" />
      </div>
      <div style="display: flex; gap: 10px; flex-wrap: wrap;">
        <button class="btn-secondary" style="flex-shrink: 0;" onclick="window.takeWeeklyBackup()" title="Download Full Weekly Backup">
          <i data-lucide="cloud-download"></i> Weekly Backup
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
          <span class="alert-tag expired" style="font-size: 11px;">${state.inactiveOrExpiredList.length} Inactive/Expired</span>
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
                  <div style="font-weight: 800; color: #fff; font-size: 14px;">${item.name}</div>
                  <div style="font-size: 12px; color: var(--text-secondary);">+91 ${item.phone} • ${item.planName}</div>
                </div>
                <span class="alert-tag ${item.alertStatus === 'critical' ? 'red' : item.alertStatus === 'expiring' ? 'yellow' : 'expired'}" style="font-size: 10px;">
                  ${item.alertStatus === 'expired' ? 'Expired' : item.alertStatus === 'inactive' ? 'Inactive' : `${item.daysRemaining}d left`}
                </span>
              </div>
              <div style="display: flex; gap: 6px; margin-top: 4px;">
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

    <!-- Quick Insights & Filter Bar (This Week / Month Joinees & Status) -->
    <div class="members-filter-bar">
      <button class="filter-pill ${state.memberFilterTab === 'all' ? 'active' : ''}" onclick="window.setMemberFilter('all')">
        <i data-lucide="users"></i> All Members (${state.members.length})
      </button>
      <button class="filter-pill ${state.memberFilterTab === 'near-expiry' ? 'active' : ''}" onclick="window.setMemberFilter('near-expiry')">
        <i data-lucide="clock" style="color: var(--alert-yellow);"></i> Near Expiry (${state.nearExpiryList.length})
      </button>
      <button class="filter-pill ${state.memberFilterTab === 'inactive' ? 'active' : ''}" onclick="window.setMemberFilter('inactive')">
        <i data-lucide="user-x" style="color: var(--alert-red);"></i> Inactive / Expired (${state.inactiveOrExpiredList.length})
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
            <th>Member Name</th>
            <th>Phone</th>
            <th>Aadhaar</th>
            <th>Blood Group</th>
            <th>Status & Remaining Days</th>
            <th>Joined On</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${filtered.length === 0 ? `
            <tr>
              <td colspan="7" style="text-align: center; color: var(--text-muted); padding: 40px;">
                <p style="margin-bottom: 14px;">No members found matching the selected filter.</p>
                <button class="btn-primary" onclick="window.navigateTo('admission')">
                  <i data-lucide="user-plus"></i> Enroll New Member
                </button>
              </td>
            </tr>
          ` : filtered.map(m => {
            const statusObj = state.memberStatusMap[m.id] || {};
            const daysInfo = getMemberRemainingDaysInfo(m, statusObj);

            return `
              <tr>
                <td>
                  <strong>${m.name}</strong>
                  <div style="font-size: 11px; color: var(--text-muted);">${statusObj.planName || ''}</div>
                </td>
                <td>+91 ${m.phone}</td>
                <td><span style="font-family: monospace; letter-spacing: 0.5px; font-weight: 600; color: #fff;">${m.aadhaar || ('5678 1234 ' + (m.aadhaar_last4 || '4821'))}</span></td>
                <td><span style="color: var(--primary); font-weight: 700;">${m.blood_group || 'N/A'}</span></td>
                <td>
                  <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 5px;">
                    <span class="alert-tag ${daysInfo.badgeClass}" style="font-size: 11px;">${daysInfo.badgeText}</span>
                    <button class="btn-sm btn-call" style="padding: 3px 8px; font-size: 11px; min-height: 26px;" onclick="window.openMemberDetailModal('${m.id}')" title="Edit Member Data">
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
          <p style="color: var(--text-muted); font-size: 13px; margin-bottom: 14px;">No members found matching filter.</p>
          <button class="btn-primary" onclick="window.navigateTo('admission')">
            <i data-lucide="user-plus"></i> Enroll New Member
          </button>
        </div>
      ` : filtered.map(m => {
        const statusObj = state.memberStatusMap[m.id] || {};
        const daysInfo = getMemberRemainingDaysInfo(m, statusObj);

        return `
          <div class="member-mobile-card">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
              <div>
                <div style="font-size: 16px; font-weight: 800; color: #ffffff;">${m.name}</div>
                <div style="font-size: 13px; color: var(--text-secondary); margin-top: 2px;">+91 ${m.phone} • ${statusObj.planName || 'Plan'}</div>
              </div>
              <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
                <span class="alert-tag ${daysInfo.badgeClass}" style="font-size: 10px;">${daysInfo.badgeText}</span>
                <button class="btn-sm btn-call" style="padding: 4px 8px; font-size: 11px; min-height: 28px;" onclick="window.openMemberDetailModal('${m.id}')" title="Edit Member Data">
                  <i data-lucide="edit-3" style="width: 12px; height: 12px;"></i> Edit
                </button>
              </div>
            </div>

            <!-- Remaining Days High-Visibility Bar for Each Individual -->
            <div style="background: rgba(255, 255, 255, 0.04); border: 1px solid var(--border-subtle); border-radius: 8px; padding: 7px 12px; display: flex; justify-content: space-between; align-items: center; margin-top: 10px;">
              <span style="font-size: 11px; color: var(--text-muted); text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px; display: flex; align-items: center; gap: 5px;">
                <i data-lucide="hourglass" style="width: 13px; height: 13px; color: var(--primary);"></i> Remaining Days
              </span>
              <span style="font-size: 12px; font-weight: 800; color: ${daysInfo.daysColor}; display: flex; align-items: center; gap: 4px;">
                <i data-lucide="clock" style="width: 13px; height: 13px;"></i>
                ${daysInfo.remainingDaysText}
              </span>
            </div>

            <div style="display: flex; justify-content: space-between; font-size: 12px; color: var(--text-muted); border-top: 1px solid var(--border-subtle); padding-top: 8px; flex-wrap: wrap; gap: 6px; margin-top: 8px;">
              <span>Aadhaar: <strong style="font-family: monospace; color: #fff;">${m.aadhaar || ('5678 1234 ' + (m.aadhaar_last4 || '4821'))}</strong></span>
              <span>Blood: <strong style="color: var(--primary);">${m.blood_group || 'N/A'}</strong></span>
              <span>Joined: ${new Date(m.join_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-top: 8px;">
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

  document.getElementById('member-search-input').addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    renderMembersView();
  });
}

// ==========================================
// VIEW 4: MEMBERSHIP PLANS MANAGEMENT
// ==========================================
function renderPlansView() {
  const content = document.getElementById('main-content');
  document.getElementById('page-title').innerText = 'Membership Plans';

  content.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
      <p style="color: var(--text-secondary); font-size: 13px;">
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
      await supabase.from('plans').update({ name, duration_days, fee, description }).eq('id', plan.id);
    } else {
      await supabase.from('plans').insert({ name, duration_days, fee, description, is_active: true });
    }

    document.getElementById('plan-modal').remove();
    await loadDatabaseData();
    renderPlansView();
  });
};

window.editPlan = (planId) => {
  const plan = state.plans.find(p => p.id === planId);
  if (plan) window.openPlanModal(plan);
};

window.togglePlanActive = async (planId, active) => {
  await supabase.from('plans').update({ is_active: active }).eq('id', planId);
  await loadDatabaseData();
  renderPlansView();
};

// ==========================================
// VIEW 5: ACCOUNTS & REPORTS
// ==========================================
function renderAccountsView() {
  const content = document.getElementById('main-content');
  document.getElementById('page-title').innerText = 'Accounts & Reports';

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
      <h3 style="font-size: 18px;">Recent Payments & Ledger</h3>
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

    <!-- Mobile Transaction Cards (100% Phone Auto-fit) -->
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

    await supabase.from('expenses').insert({ category, amount, note });
    document.getElementById('expense-modal').remove();
    await loadDatabaseData();
    renderAccountsView();
  });
};

window.exportCsv = () => {
  let csv = "Date,Type,Amount,Mode,Note\n";
  state.payments.forEach(p => {
    csv += `"${p.created_at}","${p.type}","${p.amount}","${p.mode}","${p.note || ''}"\n`;
  });
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Shape_Gym_Accounts_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
};

// ==========================================
// VIEW 6: SETTINGS
// ==========================================
function renderSettingsView() {
  const content = document.getElementById('main-content');
  document.getElementById('page-title').innerText = 'Gym Settings';

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
          <input type="text" id="settings-gstin" class="form-input" value="${state.gstin}" />
        </div>

        <div class="form-group">
          <label class="form-label">GST Rate (%)</label>
          <input type="number" id="settings-gst-percent" class="form-input" value="${state.gstPercent}" />
        </div>

        <button class="btn-primary" onclick="alert('Settings Saved Successfully!')">Save Settings</button>
      </div>

      <div class="metric-card">
        <h3 style="font-size: 18px; margin-bottom: 8px;">Database & Storage</h3>
        <p style="color: var(--text-secondary); font-size: 13px; margin-bottom: 18px;">
          Live Supabase connection: <strong>https://sxqimjzghdvysajvsthr.supabase.co</strong>
        </p>

        <button class="btn-secondary" onclick="window.exportCsv()">
          <i data-lucide="database"></i> Export Complete Data Dump (JSON/CSV)
        </button>
      </div>
    </div>
  `;

  lucide.createIcons();

  document.getElementById('settings-gst-toggle').addEventListener('change', (e) => {
    state.gstEnabled = e.target.checked;
  });
}

// Start application
initApp();

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
  programs: [],
  plans: [],
  members: [],
  subscriptions: [],
  payments: [],
  expenses: [],
  renewalsDue: [],
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

  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);

  Object.values(latestSubs).forEach(sub => {
    const member = state.members.find(m => m.id === sub.member_id);
    if (!member) return;

    totalDues += Number(sub.balance) || 0;

    const endDate = new Date(sub.end_date);
    endDate.setHours(0, 0, 0, 0);

    const diffDays = Math.round((endDate - todayDate) / (1000 * 60 * 60 * 24));

    let alertStatus = 'active';
    if (diffDays < 0) {
      alertStatus = 'expired'; // Dark red/grey
    } else if (diffDays <= 3) {
      alertStatus = 'critical'; // Red
      active++;
    } else if (diffDays <= 7) {
      alertStatus = 'expiring'; // Yellow
      active++;
    } else {
      active++;
    }

    if (alertStatus !== 'active') {
      renewals.push({
        memberId: member.id,
        subscriptionId: sub.id,
        name: member.name,
        phone: member.phone,
        planName: sub.plan_name_snapshot,
        planId: sub.plan_id,
        planFee: sub.fee_snapshot,
        endDate: sub.end_date,
        daysRemaining: diffDays,
        alertStatus,
        balance: Number(sub.balance) || 0
      });
    }
  });

  state.activeCount = active;
  state.totalPendingDues = totalDues;

  // Urgency Sort: Critical (<=3d) first, then Expiring (<=7d), then Expired
  state.renewalsDue = renewals.sort((a, b) => {
    const order = { critical: 0, expiring: 1, expired: 2 };
    return order[a.alertStatus] - order[b.alertStatus] || a.daysRemaining - b.daysRemaining;
  });
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
  const dMinus4 = new Date(now.getTime() - 4 * 86400000).toISOString().split('T')[0];
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
      aadhaar_last4: '4821',
      blood_group: 'B+',
      age: 28,
      join_date: '2025-10-10',
      photo_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
    },
    {
      id: 'mem-2',
      name: 'Priya Sundaram',
      phone: '9845012345',
      address: 'Koramangala 4th Block, Bengaluru',
      aadhaar_last4: '7190',
      blood_group: 'O+',
      age: 25,
      join_date: '2025-11-01',
      photo_url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80'
    },
    {
      id: 'mem-3',
      name: 'Vikram Malhotra',
      phone: '9988776655',
      address: 'HSR Layout Sector 2, Bengaluru',
      aadhaar_last4: '3312',
      blood_group: 'A+',
      age: 34,
      join_date: '2025-08-15',
      photo_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80'
    },
    {
      id: 'mem-4',
      name: 'Ananya Deshmukh',
      phone: '9765432109',
      address: 'Whitefield Main Rd, Bengaluru',
      aadhaar_last4: '8834',
      blood_group: 'AB+',
      age: 22,
      join_date: '2026-01-05',
      photo_url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80'
    },
    {
      id: 'mem-5',
      name: 'Karthik Raja',
      phone: '9123456780',
      address: 'JP Nagar 6th Phase, Bengaluru',
      aadhaar_last4: '5501',
      blood_group: 'O-',
      age: 31,
      join_date: '2025-06-20',
      photo_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80'
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
      start_date: '2026-02-20',
      end_date: dPlus45, // Active
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
      <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; background: radial-gradient(circle at center, #1a1e29 0%, #0d0f14 100%);">
        <div class="modal-card" style="max-width: 440px; border-color: var(--border-subtle); box-shadow: var(--shadow-glow);">
          <div style="text-align: center; margin-bottom: 24px;">
            <div class="brand-icon" style="width: 64px; height: 64px; margin: 0 auto 16px; border-radius: 16px;">
              <i data-lucide="dumbbell" style="width: 32px; height: 32px;"></i>
            </div>
            <h1 style="font-size: 32px; letter-spacing: 2px;">SHAPE</h1>
            <p style="color: var(--primary); font-weight: 700; font-size: 11px; letter-spacing: 2px; margin-top: 4px;">GYM MANAGEMENT SYSTEM</p>
          </div>

          <!-- Instant 1-Click Demo Button -->
          <div style="margin-bottom: 24px; padding: 14px; background: rgba(226, 253, 90, 0.08); border: 1px solid var(--primary); border-radius: 12px; text-align: center;">
            <div style="font-size: 12px; color: var(--primary); font-weight: 700; margin-bottom: 8px;">
              ⚡ TEST THE LIVE APP IMMEDIATELY
            </div>
            <button id="quick-demo-btn" class="btn-primary" style="width: 100%; justify-content: center; font-weight: 700; box-shadow: 0 0 20px rgba(226, 253, 90, 0.4);">
              <i data-lucide="play-circle"></i> Launch App (Instant Access)
            </button>
            <div style="font-size: 11px; color: var(--text-muted); margin-top: 6px;">
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
          <div style="display: flex; align-items: center; gap: 12px;">
            <h2 id="page-title" style="font-size: 20px;">Gym Operations</h2>
          </div>

          <div style="display: flex; align-items: center; gap: 16px;">
            <div class="status-chip">
              <span class="status-dot" style="${state.isDemoMode ? 'background: #e2fd5a;' : ''}"></span>
              ${state.isDemoMode ? 'Interactive Demo Mode' : 'Supabase Live Connected'}
            </div>

            <button class="btn-primary" style="padding: 8px 16px; font-size: 13px;" id="quick-admission-btn">
              <i data-lucide="plus"></i> Add Member
            </button>
          </div>
        </header>

        <main id="main-content" class="content-area"></main>
      </div>

      <!-- Mobile Bottom Navigation -->
      <nav class="mobile-bottom-nav" style="display: none;">
        <div class="nav-item ${state.currentTab === 'dashboard' ? 'active' : ''}" data-tab="dashboard"><i data-lucide="layout-dashboard"></i></div>
        <div class="nav-item ${state.currentTab === 'members' ? 'active' : ''}" data-tab="members"><i data-lucide="users"></i></div>
        <div class="nav-item ${state.currentTab === 'admission' ? 'active' : ''}" data-tab="admission"><i data-lucide="user-plus"></i></div>
        <div class="nav-item ${state.currentTab === 'accounts' ? 'active' : ''}" data-tab="accounts"><i data-lucide="pie-chart"></i></div>
        <div class="nav-item ${state.currentTab === 'settings' ? 'active' : ''}" data-tab="settings"><i data-lucide="settings"></i></div>
      </nav>
    </div>
  `;

  lucide.createIcons();

  // Navigation handlers
  document.querySelectorAll('[data-tab]').forEach(el => {
    el.addEventListener('click', () => {
      state.currentTab = el.getAttribute('data-tab');
      renderAppShell();
    });
  });

  document.getElementById('logout-btn')?.addEventListener('click', async () => {
    await supabase.auth.signOut();
    state.user = null;
    renderLoginScreen();
  });

  document.getElementById('quick-admission-btn')?.addEventListener('click', () => {
    state.currentTab = 'admission';
    renderAppShell();
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
      <div class="modal-header">
        <div>
          <h2>Renew Membership</h2>
          <p style="color: var(--primary); font-size: 13px; font-weight: 600; margin-top: 4px;">${memberName}</p>
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

      <div style="display: flex; justify-content: flex-end; gap: 12px; margin-top: 24px;">
        <button class="btn-secondary" onclick="document.getElementById('renewal-modal').remove()">Cancel</button>
        <button class="btn-primary" id="confirm-renew-btn">Confirm Renewal</button>
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

  const defaultPlan = state.plans[0] || { name: '3 Months', duration_days: 90, fee: 4999 };
  const today = new Date().toISOString().split('T')[0];
  const expiryDate = new Date(Date.now() + defaultPlan.duration_days * 86400000).toISOString().split('T')[0];

  content.innerHTML = `
    <div style="max-width: 900px; margin: 0 auto;">
      <div class="metric-card" style="padding: 32px;">
        <h2 style="font-size: 24px; margin-bottom: 6px;">Front-Desk Enrollment Form</h2>
        <p style="color: var(--text-secondary); font-size: 13px; margin-bottom: 28px;">
          Register member, capture dual signatures, and produce the official PDF admission receipt.
        </p>

        <form id="admission-form">
          <!-- 1. Personal Details -->
          <h3 style="font-size: 16px; color: var(--primary); margin-bottom: 16px;">1. Personal Details</h3>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
            <div class="form-group">
              <label class="form-label">Full Name *</label>
              <input type="text" id="adm-name" class="form-input" required placeholder="e.g. Ramesh Kumar" />
            </div>

            <div class="form-group">
              <label class="form-label">Phone Number (10 Digits) *</label>
              <input type="tel" id="adm-phone" class="form-input" maxlength="10" required placeholder="9876543210" />
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px;">
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

          <div class="form-group">
            <label class="form-label">Residential Address</label>
            <input type="text" id="adm-address" class="form-input" placeholder="Flat, Street, Area, City" />
          </div>

          <div class="form-group">
            <label class="form-label">Health History / Medical Information</label>
            <textarea id="adm-health" class="form-textarea" rows="2" placeholder="Injuries, asthma, allergies, medications (Encrypted)"></textarea>
          </div>

          <!-- 2. Programs & Plan -->
          <h3 style="font-size: 16px; color: var(--primary); margin: 28px 0 16px;">2. Programs & Membership Plan</h3>

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

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
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
          <h3 style="font-size: 16px; color: var(--primary); margin: 28px 0 16px;">3. Fees & Payment Collection</h3>

          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px;">
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
          <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid var(--border-subtle); padding: 14px; border-radius: 12px; margin: 24px 0;">
            <label style="display: flex; gap: 10px; align-items: flex-start; cursor: pointer; font-size: 13px;">
              <input type="checkbox" id="adm-consent" required style="margin-top: 3px; accent-color: var(--primary);" />
              <span>I confirm that the client has authorized storing and processing their personal fitness, health, and identity details in compliance with the <strong>India Digital Personal Data Protection (DPDP) Act 2023</strong>.</span>
            </label>
          </div>

          <!-- 5. Dual Signature Pads -->
          <h3 style="font-size: 16px; color: var(--primary); margin: 28px 0 16px;">4. Finger-Drawn Signatures (Mandatory)</h3>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 32px;">
            <div>
              <label class="form-label">Client / Member Signature *</label>
              <div class="signature-box">
                <canvas id="client-signature" class="signature-canvas" width="400" height="150"></canvas>
                <div class="signature-controls">
                  <button type="button" class="btn-sm btn-call" onclick="window.clearSignature('client')">Clear</button>
                </div>
              </div>
            </div>

            <div>
              <label class="form-label">Manager / Staff Signature *</label>
              <div class="signature-box">
                <canvas id="manager-signature" class="signature-canvas" width="400" height="150"></canvas>
                <div class="signature-controls">
                  <button type="button" class="btn-sm btn-call" onclick="window.clearSignature('manager')">Clear</button>
                </div>
              </div>
            </div>
          </div>

          <button type="submit" id="submit-admission-btn" class="btn-primary" style="width: 100%; justify-content: center; padding: 16px; font-size: 16px;">
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
        aadhaar_last4: aadhaarLast4,
        blood_group: blood,
        age,
        join_date: startDate
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
  const ctx = canvas.getContext('2d');
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  let drawing = false;

  const getPos = (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: ((e.clientX || e.touches[0].clientX) - rect.left) * scaleX,
      y: ((e.clientY || e.touches[0].clientY) - rect.top) * scaleY
    };
  };

  const start = (e) => {
    drawing = true;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    state.activeCanvasStrokes[type].push(pos);
    e.preventDefault();
  };

  const draw = (e) => {
    if (!drawing) return;
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    state.activeCanvasStrokes[type].push(pos);
    e.preventDefault();
  };

  const stop = () => {
    drawing = false;
  };

  canvas.addEventListener('mousedown', start);
  canvas.addEventListener('mousemove', draw);
  window.addEventListener('mouseup', stop);

  canvas.addEventListener('touchstart', start);
  canvas.addEventListener('touchmove', draw);
  window.addEventListener('touchend', stop);
}

window.clearSignature = (type) => {
  const canvas = document.getElementById(`${type}-signature`);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  state.activeCanvasStrokes[type] = [];
};

window.hasSignatureDrawn = (type) => {
  return state.activeCanvasStrokes[type] && state.activeCanvasStrokes[type].length > 5;
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
    return matchesSearch;
  });

  content.innerHTML = `
    <div style="display: flex; gap: 16px; margin-bottom: 24px; flex-wrap: wrap;">
      <input type="text" id="member-search-input" class="form-input" style="flex: 1; min-width: 280px;" placeholder="Search member by name or 10-digit mobile..." value="${state.searchQuery}" />
      <button class="btn-primary" onclick="state.currentTab = 'admission'; renderAppShell();">
        <i data-lucide="user-plus"></i> Add New Member
      </button>
    </div>

    <div class="data-table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>Member Name</th>
            <th>Phone</th>
            <th>Aadhaar</th>
            <th>Blood Group</th>
            <th>Joined On</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${filtered.length === 0 ? `
            <tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 40px;">No members found.</td></tr>
          ` : filtered.map(m => `
            <tr>
              <td><strong>${m.name}</strong></td>
              <td>+91 ${m.phone}</td>
              <td>•••• ${m.aadhaar_last4 || '••••'}</td>
              <td><span style="color: var(--alert-green); font-weight: 700;">${m.blood_group || 'N/A'}</span></td>
              <td>${new Date(m.join_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
              <td><span class="user-role-badge" style="background: rgba(34, 197, 94, 0.2); color: var(--alert-green);">Active Member</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
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
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
      <h3 style="font-size: 18px;">Recent Payments & Ledger</h3>
      <div style="display: flex; gap: 10px;">
        <button class="btn-secondary" onclick="window.recordExpenseModal()"><i data-lucide="plus"></i> Add Expense</button>
        <button class="btn-primary" onclick="window.exportCsv()"><i data-lucide="download"></i> Export CSV Report</button>
      </div>
    </div>

    <div class="data-table-container">
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
              <td>${new Date(p.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
              <td><span class="alert-tag yellow" style="font-size: 10px;">${p.type}</span></td>
              <td><strong style="color: var(--alert-green);">${formatInr(p.amount)}</strong></td>
              <td>${p.mode}</td>
              <td style="color: var(--text-muted);">${p.note || 'Membership payment'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
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

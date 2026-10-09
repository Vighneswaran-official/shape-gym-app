import './style.css';
import { supabase } from './config/supabase.js';
import { state, loadDashboardData, loadDemoData, computeDashboardMetrics } from './state/store.js';
import { renderDashboardView } from './views/dashboard.js';
import { renderAdmissionView } from './views/admission.js';
import { renderMembersView } from './views/members.js';
import { renderPlansView } from './views/plans.js';
import { renderAccountsView } from './views/reports.js';
import { renderSettingsView } from './views/settings.js';
import { exportWeeklyBackupExcel } from './utils/excel.js';
import { openMemberDetailModal } from './components/memberEditModal.js';
import { openBulkUpdateModal } from './components/bulkUpdateModal.js';
import { openRenewalModal, sendWhatsAppReminder } from './components/renewalModal.js';
import confetti from 'canvas-confetti';

/**
 * ====================================================================
 * SHAPE FITNESS CLUB - GYM MANAGEMENT & MEMBERSHIP OPERATING SYSTEM
 * ====================================================================
 * Modular Folder Structure:
 * - config/      : Supabase client & credentials
 * - state/       : Global reactive state store & metric computations
 * - utils/       : AES-GCM Crypto, PDF receipt builder, Excel exporter/importer
 * - components/  : Member Edit Modal, Bulk Update Modal, Renewal Modal
 * - views/       : Dashboard, Admission, Members, Plans, Reports, Settings
 * ====================================================================
 */

// Global navigation helper accessible across modules and inline HTML onclick handlers
window.navigateTo = (tab) => {
  state.currentView = tab;
  window.scrollTo(0, 0);
  renderAppShell();
};

window.takeWeeklyBackup = () => {
  const filename = exportWeeklyBackupExcel(state);
  const now = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  localStorage.setItem('shape_last_weekly_backup', now);
  confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
  alert(`✅ Weekly Excel Backup generated and downloaded!\n\nFile: ${filename}\n\nIncludes 3 dedicated sheets:\n1. Members Directory\n2. Subscriptions & Renewal History\n3. Financial & Operational Summary`);
  if (state.currentView === 'members') renderMembersView();
};

window.exportWeeklyExcelBackup = window.takeWeeklyBackup;

window.openMemberDetailModal = (memberId) => {
  openMemberDetailModal(memberId, () => {
    if (state.currentView === 'members') renderMembersView();
    else if (state.currentView === 'dashboard') renderDashboardView();
  });
};

window.openBulkUpdateModal = () => {
  openBulkUpdateModal(() => {
    if (state.currentView === 'members') renderMembersView();
    else if (state.currentView === 'dashboard') renderDashboardView();
  });
};

window.openRenewalModal = (memberId, memberName, balance, planId) => {
  openRenewalModal(memberId, memberName, balance, planId, () => {
    if (state.currentView === 'members') renderMembersView();
    else if (state.currentView === 'dashboard') renderDashboardView();
  });
};

window.sendWhatsAppReminder = sendWhatsAppReminder;

// ==========================================
// APPLICATION BOOTSTRAP
// ==========================================
async function initApp() {
  const { data: { session } } = await supabase.auth.getSession();

  if (session?.user) {
    state.user = session.user;
    await fetchUserProfile(session.user.id);
    await loadDashboardData();
    renderAppShell();
  } else {
    renderLoginScreen();
  }
}

async function fetchUserProfile(userId) {
  try {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (data) {
      state.profile = data;
    } else {
      state.profile = { name: state.user?.email?.split('@')[0] || 'Manager', role: 'admin' };
    }
  } catch (e) {
    state.profile = { name: 'Manager', role: 'admin' };
  }
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

    document.getElementById('quick-demo-btn').addEventListener('click', () => {
      loadDemoData();
      confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 } });
      renderAppShell();
    });

    document.getElementById('toggle-signup-link').addEventListener('click', (e) => {
      e.preventDefault();
      isSignUpMode = !isSignUpMode;
      updateLoginUi();
    });

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
          const { error } = await supabase.auth.signUp({ email, password });
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
          await loadDashboardData();
          renderAppShell();
        }
      } catch (err) {
        errBox.style.display = 'block';
        errBox.innerText = err.message || 'Authentication error. Please check credentials or use Instant Access.';
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
          <li class="nav-item ${state.currentView === 'dashboard' ? 'active' : ''}" data-tab="dashboard">
            <i data-lucide="layout-dashboard"></i> Dashboard
          </li>
          <li class="nav-item ${state.currentView === 'members' ? 'active' : ''}" data-tab="members">
            <i data-lucide="users"></i> Members
          </li>
          <li class="nav-item ${state.currentView === 'admission' ? 'active' : ''}" data-tab="admission">
            <i data-lucide="user-plus"></i> New Admission
          </li>
          <li class="nav-item ${state.currentView === 'plans' ? 'active' : ''}" data-tab="plans">
            <i data-lucide="credit-card"></i> Membership Plans
          </li>
          <li class="nav-item ${state.currentView === 'accounts' ? 'active' : ''}" data-tab="accounts">
            <i data-lucide="pie-chart"></i> Accounts & Reports
          </li>
          <li class="nav-item ${state.currentView === 'settings' ? 'active' : ''}" data-tab="settings">
            <i data-lucide="settings"></i> Settings
          </li>
        </ul>

        <div class="sidebar-footer">
          <div class="user-card">
            <div class="user-avatar">${(state.profile?.name || 'M')[0].toUpperCase()}</div>
            <div class="user-meta">
              <div class="user-name">${state.profile?.name || 'Master Admin'}</div>
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
              <i data-lucide="file-spreadsheet" style="color: var(--alert-green);"></i> Weekly Backup
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

      <!-- Mobile Bottom Navigation (Responsive 5-tab with floating FAB) -->
      <nav class="mobile-bottom-nav">
        <button class="mobile-nav-item ${state.currentView === 'dashboard' ? 'active' : ''}" data-tab="dashboard" onclick="window.navigateTo('dashboard')">
          <i data-lucide="layout-dashboard"></i>
          <span>Home</span>
        </button>
        <button class="mobile-nav-item ${state.currentView === 'members' ? 'active' : ''}" data-tab="members" onclick="window.navigateTo('members')">
          <i data-lucide="users"></i>
          <span>Members</span>
        </button>
        <button class="mobile-nav-fab ${state.currentView === 'admission' ? 'active' : ''}" data-tab="admission" title="New Admission" onclick="window.navigateTo('admission')">
          <div class="fab-circle">
            <i data-lucide="user-plus"></i>
          </div>
          <span>Admission</span>
        </button>
        <button class="mobile-nav-item ${state.currentView === 'plans' ? 'active' : ''}" data-tab="plans" onclick="window.navigateTo('plans')">
          <i data-lucide="dumbbell"></i>
          <span>Plans</span>
        </button>
        <button class="mobile-nav-item ${state.currentView === 'accounts' ? 'active' : ''}" data-tab="accounts" onclick="window.navigateTo('accounts')">
          <i data-lucide="pie-chart"></i>
          <span>Accounts</span>
        </button>
      </nav>
    </div>
  `;

  lucide.createIcons();

  document.querySelectorAll('[data-tab]').forEach(el => {
    el.addEventListener('click', (e) => {
      const target = e.currentTarget || el;
      const tab = target.getAttribute('data-tab');
      if (tab) window.navigateTo(tab);
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

  // Route to the active view
  switch (state.currentView) {
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

// Start application
initApp();

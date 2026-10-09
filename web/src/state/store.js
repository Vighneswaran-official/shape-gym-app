import { supabase } from '../config/supabase.js';

export const state = {
  user: null,
  profile: null,
  currentView: 'dashboard',
  members: [],
  subscriptions: [],
  plans: [],
  programs: [],
  payments: [],
  expenses: [],
  attendanceLogs: [],
  // Derived state & maps
  memberStatusMap: {},
  nearExpiryList: [],
  inactiveOrExpiredList: [],
  renewalsDue: [],
  activeCount: 0,
  totalPendingDues: 0,
  newThisWeekMembers: [],
  newThisWeekCount: 0,
  newThisMonthMembers: [],
  newThisMonthCount: 0,
  // Directory Filters & Search
  memberFilterTab: 'all',
  searchQuery: '',
  isDemoMode: false,
};

/**
 * Computes all business logic metrics:
 * - Sequential Member Codes (1, 2, 3...)
 * - Remaining subscription days
 * - Near expiry & inactive lists
 * - Pending dues & new joinees
 */
export function computeDashboardMetrics() {
  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);

  let active = 0;
  let totalDues = 0;
  const nearExpiryList = [];
  const inactiveOrExpiredList = [];
  const renewals = [];

  // Ensure every member has a sequential code based on index/order
  state.members.forEach((m, idx) => {
    if (!m.member_code) {
      m.member_code = idx + 1;
    }
  });

  state.members.forEach(member => {
    // Latest active subscription for this member
    const memberSubs = state.subscriptions.filter(s => s.member_id === member.id);
    const sub = memberSubs.length > 0 ? memberSubs[memberSubs.length - 1] : null;

    let alertStatus = 'active';
    let daysRemaining = 0;
    let balance = 0;
    let endDate = null;
    let planName = 'No Plan';
    let planId = null;
    let planFee = 0;

    if (member.is_active === false) {
      alertStatus = 'inactive';
      if (sub) {
        endDate = sub.end_date;
        planName = sub.plan_name_snapshot || 'Plan';
        planFee = sub.fee_snapshot || 0;
        balance = Number(sub.balance) || 0;
      }
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

  // Joinees in this week & month
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

/**
 * Calculates remaining days badge and color for any member
 */
export function getMemberRemainingDaysInfo(member, statusObj) {
  let badgeClass = 'yellow';
  let badgeText = 'Active';
  let remainingDaysText = '';
  let daysColor = '#22c55e'; // Green

  if (member.is_active === false) {
    badgeClass = 'expired';
    badgeText = 'Inactive';
    remainingDaysText = 'Membership Inactive (Left Gym)';
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

/**
 * Loads rich demo data with sequential codes and continuous renewal histories
 */
export function loadDemoData() {
  state.isDemoMode = true;
  state.user = { id: 'demo-manager-001', email: 'vighneswaran.personal@gmail.com' };
  state.profile = { id: 'demo-manager-001', name: 'Vighneswaran (Master Admin)', role: 'admin' };

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
      member_code: 1, // Member #1
      name: 'Rahul Sharma',
      phone: '9876543210',
      address: 'Indiranagar 100ft Rd, Bengaluru',
      aadhaar: '5678 1234 4821',
      aadhaar_last4: '4821',
      blood_group: 'B+',
      age: 28,
      join_date: '2025-07-10',
      is_active: true,
      health_notes: 'None / Fit',
      photo_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      renewal_history: [
        { cycle: 1, plan_name: '1 Month Kickstart', start_date: '2025-07-10', end_date: '2025-08-10', renewed_on: '2025-07-10', fee: 1999, paid: 1999 },
        { cycle: 2, plan_name: '3 Months Pro Fitness', start_date: '2025-08-10', end_date: '2025-11-10', renewed_on: '2025-08-10', fee: 4999, paid: 4999 },
        { cycle: 3, plan_name: '3 Months Pro Fitness', start_date: '2025-11-10', end_date: '2026-02-10', renewed_on: '2025-11-10', fee: 4999, paid: 4999 },
        { cycle: 4, plan_name: '3 Months Pro Fitness', start_date: '2026-02-10', end_date: dPlus2, renewed_on: '2026-02-10', fee: 4999, paid: 4999 }
      ]
    },
    {
      id: 'mem-2',
      member_code: 2, // Member #2
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
      photo_url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
      renewal_history: [
        { cycle: 1, plan_name: '1 Month Kickstart', start_date: '2026-03-04', end_date: dPlus5, renewed_on: '2026-03-04', fee: 1999, paid: 1500 }
      ]
    },
    {
      id: 'mem-3',
      member_code: 3, // Member #3
      name: 'Vikram Malhotra',
      phone: '9988776655',
      address: 'HSR Layout Sector 2, Bengaluru',
      aadhaar: '7890 3456 3312',
      aadhaar_last4: '3312',
      blood_group: 'A+',
      age: 34,
      join_date: '2025-08-15',
      is_active: false, // Inactive (Left Gym)
      health_notes: 'Lower back stiffness',
      photo_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      renewal_history: [
        { cycle: 1, plan_name: '6 Months Muscle Transformation', start_date: '2025-08-15', end_date: dMinus4, renewed_on: '2025-08-15', fee: 8999, paid: 8999 }
      ]
    },
    {
      id: 'mem-4',
      member_code: 4, // Member #4
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
      photo_url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
      renewal_history: [
        { cycle: 1, plan_name: '1 Year Elite Annual', start_date: '2026-01-05', end_date: dPlus120, renewed_on: '2026-01-05', fee: 14999, paid: 14999 }
      ]
    },
    {
      id: 'mem-5',
      member_code: 5, // Member #5
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
      photo_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
      renewal_history: [
        { cycle: 1, plan_name: '3 Months Pro Fitness', start_date: '2025-06-20', end_date: '2025-09-20', renewed_on: '2025-06-20', fee: 4999, paid: 4999 },
        { cycle: 2, plan_name: '3 Months Pro Fitness', start_date: '2025-10-01', end_date: '2026-01-01', renewed_on: '2025-10-01', fee: 4999, paid: 4999 },
        { cycle: 3, plan_name: '3 Months Pro Fitness', start_date: '2026-02-15', end_date: dPlus45, renewed_on: '2026-02-15', fee: 4999, paid: 4000 }
      ]
    },
    {
      id: 'mem-6',
      member_code: 6, // Member #6
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
      photo_url: 'https://images.unsplash.com/photo-1548142813-c348350df52b?w=150&auto=format&fit=crop&q=80',
      renewal_history: [
        { cycle: 1, plan_name: '3 Months Pro Fitness', start_date: dMinus2, end_date: dPlus45, renewed_on: dMinus2, fee: 4999, paid: 4999 }
      ]
    }
  ];

  state.subscriptions = [
    {
      id: 'sub-1',
      member_id: 'mem-1',
      plan_id: 'plan-2',
      plan_name_snapshot: '3 Months Pro Fitness',
      fee_snapshot: 4999,
      start_date: '2026-02-10',
      end_date: dPlus2, // Critical (<= 3 days)
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
      end_date: dPlus5, // Expiring (<= 7 days)
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
      start_date: '2025-08-15',
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

/**
 * Loads dashboard data from Supabase or initializes demo data
 */
export async function loadDashboardData() {
  if (state.isDemoMode || !state.user) {
    loadDemoData();
    return;
  }

  try {
    const [pRes, plRes, mRes, sRes, payRes, expRes] = await Promise.all([
      supabase.from('programs').select('*').order('name'),
      supabase.from('membership_plans').select('*').order('duration_days'),
      supabase.from('members').select('*').order('created_at', { ascending: false }),
      supabase.from('member_subscriptions').select('*').order('created_at', { ascending: false }),
      supabase.from('payments').select('*').order('created_at', { ascending: false }).limit(20),
      supabase.from('expenses').select('*').order('created_at', { ascending: false }).limit(20)
    ]);

    state.programs = pRes.data || [];
    state.plans = plRes.data || [];
    state.members = mRes.data || [];
    state.subscriptions = sRes.data || [];
    state.payments = payRes.data || [];
    state.expenses = expRes.data || [];

    // Fallback to demo data if brand new clean database
    if (state.members.length === 0 && state.plans.length === 0) {
      loadDemoData();
      return;
    }

    computeDashboardMetrics();
  } catch (err) {
    console.warn('Supabase fetch failed, switching to demo store:', err);
    loadDemoData();
  }
}

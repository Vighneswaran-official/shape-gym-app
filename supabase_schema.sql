-- ==============================================================================
-- SHAPE GYM MANAGEMENT APP - SUPABASE DATABASE MIGRATION SCRIPT
-- PostgreSQL Schema, Indexes, RLS Policies, Storage Buckets, and Seed Data
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 2. TABLE DEFINITIONS
-- ==============================================================================

-- 2.1 PROFILES TABLE (Linked directly to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'staff')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2.2 PROGRAMS TABLE (Admin editable gym programs)
CREATE TABLE IF NOT EXISTS public.programs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2.3 MEMBERSHIP PLANS TABLE (Admin editable, duration in days, fee in INR)
CREATE TABLE IF NOT EXISTS public.plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    duration_days INTEGER NOT NULL CHECK (duration_days > 0),
    fee NUMERIC(10, 2) NOT NULL CHECK (fee >= 0),
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2.4 MEMBERS TABLE
-- Note: Aadhaar & Health History are encrypted client-side using AES-256-GCM.
CREATE TABLE IF NOT EXISTS public.members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    address TEXT,
    aadhaar_last4 VARCHAR(4),
    aadhaar_encrypted TEXT,
    blood_group VARCHAR(5) CHECK (blood_group IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-') OR blood_group IS NULL),
    health_history_encrypted TEXT,
    age INTEGER CHECK (age >= 10 AND age <= 120),
    phone VARCHAR(15) NOT NULL,
    photo_path TEXT,
    join_date DATE NOT NULL DEFAULT CURRENT_DATE,
    consent_given BOOLEAN NOT NULL DEFAULT false,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    deleted_at TIMESTAMPTZ DEFAULT NULL
);

-- 2.5 MEMBER PROGRAMS (Many-to-Many join table)
CREATE TABLE IF NOT EXISTS public.member_programs (
    member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    PRIMARY KEY (member_id, program_id)
);

-- 2.6 SUBSCRIPTIONS TABLE
-- Stores immutable snapshot of plan name & fee so editing plan definitions does not affect history.
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    plan_id UUID REFERENCES public.plans(id) ON DELETE SET NULL,
    plan_name_snapshot TEXT NOT NULL,
    fee_snapshot NUMERIC(10, 2) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    amount_due NUMERIC(10, 2) NOT NULL DEFAULT 0,
    amount_paid NUMERIC(10, 2) NOT NULL DEFAULT 0,
    balance NUMERIC(10, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2.7 PAYMENTS TABLE (Audit log of all financial transactions)
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
    amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
    mode TEXT NOT NULL CHECK (mode IN ('Cash', 'UPI', 'Card')),
    paid_on TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    type TEXT NOT NULL CHECK (type IN ('admission_fee', 'subscription_fee', 'pending_dues', 'other')),
    note TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2.8 EXPENSES TABLE
CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category TEXT NOT NULL CHECK (category IN ('rent', 'electricity', 'salary', 'equipment', 'maintenance', 'other')),
    amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
    spent_on DATE NOT NULL DEFAULT CURRENT_DATE,
    note TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2.9 SIGNATURES TABLE (Dual signature pad storage paths)
CREATE TABLE IF NOT EXISTS public.signatures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL UNIQUE REFERENCES public.members(id) ON DELETE CASCADE,
    client_signature_path TEXT NOT NULL,
    manager_signature_path TEXT NOT NULL,
    signed_on TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2.10 APP SETTINGS TABLE (Singleton configuration row)
CREATE TABLE IF NOT EXISTS public.app_settings (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    gym_name TEXT NOT NULL DEFAULT 'Shape Fitness Club',
    logo_path TEXT,
    gst_enabled BOOLEAN NOT NULL DEFAULT false,
    gst_percent NUMERIC(5, 2) NOT NULL DEFAULT 18.00,
    gstin TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ==============================================================================
-- 3. PERFORMANCE INDEXES
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_members_phone ON public.members(phone);
CREATE INDEX IF NOT EXISTS idx_members_deleted_at ON public.members(deleted_at);
CREATE INDEX IF NOT EXISTS idx_subscriptions_member_id ON public.subscriptions(member_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_end_date ON public.subscriptions(end_date);
CREATE INDEX IF NOT EXISTS idx_payments_member_id ON public.payments(member_id);
CREATE INDEX IF NOT EXISTS idx_payments_paid_on ON public.payments(paid_on);
CREATE INDEX IF NOT EXISTS idx_expenses_spent_on ON public.expenses(spent_on);

-- ==============================================================================
-- 4. RLS HELPER FUNCTIONS
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT (public.get_user_role() = 'admin');
$$;

CREATE OR REPLACE FUNCTION public.is_active_staff_or_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT (public.get_user_role() IN ('admin', 'staff'));
$$;

-- ==============================================================================
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- Enable RLS on custom tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- 5.1 PROFILES POLICIES
DROP POLICY IF EXISTS "Profiles viewable by authenticated users" ON public.profiles;
CREATE POLICY "Profiles viewable by authenticated users"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Admin can insert profiles" ON public.profiles;
CREATE POLICY "Admin can insert profiles"
    ON public.profiles FOR INSERT
    TO authenticated
    WITH CHECK (public.is_admin() OR auth.uid() = id);

DROP POLICY IF EXISTS "Admin can update profiles or users can update own name" ON public.profiles;
CREATE POLICY "Admin can update profiles or users can update own name"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (public.is_admin() OR auth.uid() = id)
    WITH CHECK (public.is_admin() OR auth.uid() = id);

DROP POLICY IF EXISTS "Admin can delete profiles" ON public.profiles;
CREATE POLICY "Admin can delete profiles"
    ON public.profiles FOR DELETE
    TO authenticated
    USING (public.is_admin());

-- 5.2 PROGRAMS POLICIES
DROP POLICY IF EXISTS "Programs viewable by authenticated users" ON public.programs;
CREATE POLICY "Programs viewable by authenticated users"
    ON public.programs FOR SELECT
    TO authenticated
    USING (public.is_active_staff_or_admin());

DROP POLICY IF EXISTS "Admin can insert programs" ON public.programs;
CREATE POLICY "Admin can insert programs"
    ON public.programs FOR INSERT
    TO authenticated
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admin can update programs" ON public.programs;
CREATE POLICY "Admin can update programs"
    ON public.programs FOR UPDATE
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admin can delete programs" ON public.programs;
CREATE POLICY "Admin can delete programs"
    ON public.programs FOR DELETE
    TO authenticated
    USING (public.is_admin());

-- 5.3 PLANS POLICIES
DROP POLICY IF EXISTS "Plans viewable by authenticated users" ON public.plans;
CREATE POLICY "Plans viewable by authenticated users"
    ON public.plans FOR SELECT
    TO authenticated
    USING (public.is_active_staff_or_admin());

DROP POLICY IF EXISTS "Admin can insert plans" ON public.plans;
CREATE POLICY "Admin can insert plans"
    ON public.plans FOR INSERT
    TO authenticated
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admin can update plans" ON public.plans;
CREATE POLICY "Admin can update plans"
    ON public.plans FOR UPDATE
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admin can delete plans" ON public.plans;
CREATE POLICY "Admin can delete plans"
    ON public.plans FOR DELETE
    TO authenticated
    USING (public.is_admin());

-- 5.4 MEMBERS POLICIES (Soft-deleted hidden from regular reads)
DROP POLICY IF EXISTS "Members viewable by staff and admin" ON public.members;
CREATE POLICY "Members viewable by staff and admin"
    ON public.members FOR SELECT
    TO authenticated
    USING (public.is_active_staff_or_admin() AND deleted_at IS NULL);

DROP POLICY IF EXISTS "Staff and Admin can insert members" ON public.members;
CREATE POLICY "Staff and Admin can insert members"
    ON public.members FOR INSERT
    TO authenticated
    WITH CHECK (public.is_active_staff_or_admin());

DROP POLICY IF EXISTS "Staff and Admin can update members" ON public.members;
CREATE POLICY "Staff and Admin can update members"
    ON public.members FOR UPDATE
    TO authenticated
    USING (public.is_active_staff_or_admin())
    WITH CHECK (public.is_active_staff_or_admin());

DROP POLICY IF EXISTS "Only Admin can delete members" ON public.members;
CREATE POLICY "Only Admin can delete members"
    ON public.members FOR DELETE
    TO authenticated
    USING (public.is_admin());

-- 5.5 MEMBER_PROGRAMS POLICIES
DROP POLICY IF EXISTS "Member programs viewable by staff and admin" ON public.member_programs;
CREATE POLICY "Member programs viewable by staff and admin"
    ON public.member_programs FOR SELECT
    TO authenticated
    USING (public.is_active_staff_or_admin());

DROP POLICY IF EXISTS "Staff and Admin can insert member programs" ON public.member_programs;
CREATE POLICY "Staff and Admin can insert member programs"
    ON public.member_programs FOR INSERT
    TO authenticated
    WITH CHECK (public.is_active_staff_or_admin());

DROP POLICY IF EXISTS "Staff and Admin can update member programs" ON public.member_programs;
CREATE POLICY "Staff and Admin can update member programs"
    ON public.member_programs FOR UPDATE
    TO authenticated
    USING (public.is_active_staff_or_admin());

DROP POLICY IF EXISTS "Only Admin can delete member programs" ON public.member_programs;
CREATE POLICY "Only Admin can delete member programs"
    ON public.member_programs FOR DELETE
    TO authenticated
    USING (public.is_admin());

-- 5.6 SUBSCRIPTIONS POLICIES
DROP POLICY IF EXISTS "Subscriptions viewable by staff and admin" ON public.subscriptions;
CREATE POLICY "Subscriptions viewable by staff and admin"
    ON public.subscriptions FOR SELECT
    TO authenticated
    USING (public.is_active_staff_or_admin());

DROP POLICY IF EXISTS "Staff and Admin can insert subscriptions" ON public.subscriptions;
CREATE POLICY "Staff and Admin can insert subscriptions"
    ON public.subscriptions FOR INSERT
    TO authenticated
    WITH CHECK (public.is_active_staff_or_admin());

DROP POLICY IF EXISTS "Staff and Admin can update subscriptions" ON public.subscriptions;
CREATE POLICY "Staff and Admin can update subscriptions"
    ON public.subscriptions FOR UPDATE
    TO authenticated
    USING (public.is_active_staff_or_admin());

DROP POLICY IF EXISTS "Only Admin can delete subscriptions" ON public.subscriptions;
CREATE POLICY "Only Admin can delete subscriptions"
    ON public.subscriptions FOR DELETE
    TO authenticated
    USING (public.is_admin());

-- 5.7 PAYMENTS POLICIES (Audit protected: no silent edits or deletes by staff)
DROP POLICY IF EXISTS "Payments viewable by staff and admin" ON public.payments;
CREATE POLICY "Payments viewable by staff and admin"
    ON public.payments FOR SELECT
    TO authenticated
    USING (public.is_active_staff_or_admin());

DROP POLICY IF EXISTS "Staff and Admin can record payments" ON public.payments;
CREATE POLICY "Staff and Admin can record payments"
    ON public.payments FOR INSERT
    TO authenticated
    WITH CHECK (public.is_active_staff_or_admin());

DROP POLICY IF EXISTS "Only Admin can update payments" ON public.payments;
CREATE POLICY "Only Admin can update payments"
    ON public.payments FOR UPDATE
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Only Admin can delete payments" ON public.payments;
CREATE POLICY "Only Admin can delete payments"
    ON public.payments FOR DELETE
    TO authenticated
    USING (public.is_admin());

-- 5.8 EXPENSES POLICIES (Staff cannot delete expenses)
DROP POLICY IF EXISTS "Expenses viewable by staff and admin" ON public.expenses;
CREATE POLICY "Expenses viewable by staff and admin"
    ON public.expenses FOR SELECT
    TO authenticated
    USING (public.is_active_staff_or_admin());

DROP POLICY IF EXISTS "Staff and Admin can insert expenses" ON public.expenses;
CREATE POLICY "Staff and Admin can insert expenses"
    ON public.expenses FOR INSERT
    TO authenticated
    WITH CHECK (public.is_active_staff_or_admin());

DROP POLICY IF EXISTS "Staff and Admin can update expenses" ON public.expenses;
CREATE POLICY "Staff and Admin can update expenses"
    ON public.expenses FOR UPDATE
    TO authenticated
    USING (public.is_active_staff_or_admin());

DROP POLICY IF EXISTS "Only Admin can delete expenses" ON public.expenses;
CREATE POLICY "Only Admin can delete expenses"
    ON public.expenses FOR DELETE
    TO authenticated
    USING (public.is_admin());

-- 5.9 SIGNATURES POLICIES
DROP POLICY IF EXISTS "Signatures viewable by staff and admin" ON public.signatures;
CREATE POLICY "Signatures viewable by staff and admin"
    ON public.signatures FOR SELECT
    TO authenticated
    USING (public.is_active_staff_or_admin());

DROP POLICY IF EXISTS "Staff and Admin can insert signatures" ON public.signatures;
CREATE POLICY "Staff and Admin can insert signatures"
    ON public.signatures FOR INSERT
    TO authenticated
    WITH CHECK (public.is_active_staff_or_admin());

DROP POLICY IF EXISTS "Staff and Admin can update signatures" ON public.signatures;
CREATE POLICY "Staff and Admin can update signatures"
    ON public.signatures FOR UPDATE
    TO authenticated
    USING (public.is_active_staff_or_admin());

DROP POLICY IF EXISTS "Only Admin can delete signatures" ON public.signatures;
CREATE POLICY "Only Admin can delete signatures"
    ON public.signatures FOR DELETE
    TO authenticated
    USING (public.is_admin());

-- 5.10 APP_SETTINGS POLICIES
DROP POLICY IF EXISTS "App settings viewable by staff and admin" ON public.app_settings;
CREATE POLICY "App settings viewable by staff and admin"
    ON public.app_settings FOR SELECT
    TO authenticated
    USING (public.is_active_staff_or_admin());

DROP POLICY IF EXISTS "Only Admin can update app settings" ON public.app_settings;
CREATE POLICY "Only Admin can update app settings"
    ON public.app_settings FOR UPDATE
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ==============================================================================
-- 6. AUTOMATED TRIGGER FOR USER CREATION
-- Automatically creates a profile record when a user signs up.
-- If it is the first user ever, assign role 'admin', else 'staff'.
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_count INTEGER;
    initial_role TEXT;
    raw_name TEXT;
BEGIN
    SELECT COUNT(*) INTO user_count FROM public.profiles;
    IF user_count = 0 THEN
        initial_role := 'admin';
    ELSE
        initial_role := COALESCE(new.raw_user_meta_data->>'role', 'staff');
    END IF;

    raw_name := COALESCE(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1));

    INSERT INTO public.profiles (id, name, role)
    VALUES (new.id, raw_name, initial_role)
    ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        role = EXCLUDED.role;

    RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- ==============================================================================
-- 7. STORAGE BUCKETS SETUP (Private Buckets)
-- ==============================================================================

-- Create buckets if not present
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
    ('member-photos', 'member-photos', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp']),
    ('signatures', 'signatures', false, 5242880, ARRAY['image/png']),
    ('receipts', 'receipts', false, 10485760, ARRAY['application/pdf', 'image/png', 'image/jpeg']),
    ('backups', 'backups', false, 104857600, ARRAY['application/json', 'application/zip', 'application/octet-stream'])
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

-- Storage RLS Policies (Note: RLS is already enabled on storage.objects by Supabase)
DROP POLICY IF EXISTS "Authenticated users can read non-backup storage" ON storage.objects;
CREATE POLICY "Authenticated users can read non-backup storage"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (bucket_id IN ('member-photos', 'signatures', 'receipts') AND public.is_active_staff_or_admin());

DROP POLICY IF EXISTS "Staff and Admin can upload to non-backup storage" ON storage.objects;
CREATE POLICY "Staff and Admin can upload to non-backup storage"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id IN ('member-photos', 'signatures', 'receipts') AND public.is_active_staff_or_admin());

DROP POLICY IF EXISTS "Only admin can view backups" ON storage.objects;
CREATE POLICY "Only admin can view backups"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (bucket_id = 'backups' AND public.is_admin());

DROP POLICY IF EXISTS "Only admin can upload backups" ON storage.objects;
CREATE POLICY "Only admin can upload backups"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'backups' AND public.is_admin());

-- ==============================================================================
-- 8. SEED DATA
-- ==============================================================================

-- 8.1 Default Gym Programs
INSERT INTO public.programs (name) VALUES
    ('CrossFit'),
    ('Strength Training'),
    ('Boxing'),
    ('HIIT Training'),
    ('Functional Training')
ON CONFLICT (name) DO NOTHING;

-- 8.2 Default Membership Plans
INSERT INTO public.plans (name, duration_days, fee, description, is_active) VALUES
    ('3 Months', 90, 4999.00, 'Standard 3 months quarterly access to gym and all programs', true),
    ('6 Months', 180, 5999.00, 'Semi-annual package with bonus fitness evaluation', true),
    ('1 Year', 365, 8999.00, 'Best value annual membership covering all programs', true)
ON CONFLICT (name) DO NOTHING;

-- 8.3 Default App Settings
INSERT INTO public.app_settings (id, gym_name, logo_path, gst_enabled, gst_percent, gstin)
VALUES (1, 'Shape Fitness Club', NULL, false, 18.00, NULL)
ON CONFLICT (id) DO UPDATE SET gym_name = EXCLUDED.gym_name;

-- 8.4 Sample Members and Subscriptions for Testing Expiry Alert Bands:
-- Member 1: Critical (expires in 2 days - RED CARD)
-- Member 2: Expiring Soon (expires in 6 days - YELLOW CARD)
-- Member 3: Already Expired (expired 10 days ago - DARK RED/GREY CARD)
-- Member 4: Active Normal (expires in 75 days)
-- Member 5: Active Normal with balance pending
DO $$
DECLARE
    plan_3m_id UUID;
    plan_6m_id UUID;
    plan_1y_id UUID;
    prog_crossfit_id UUID;
    prog_strength_id UUID;
    prog_boxing_id UUID;
    m1_id UUID := '11111111-1111-1111-1111-111111111111'::UUID;
    m2_id UUID := '22222222-2222-2222-2222-222222222222'::UUID;
    m3_id UUID := '33333333-3333-3333-3333-333333333333'::UUID;
    m4_id UUID := '44444444-4444-4444-4444-444444444444'::UUID;
    m5_id UUID := '55555555-5555-5555-5555-555555555555'::UUID;
    s1_id UUID := 'aaaaaaaa-1111-1111-1111-111111111111'::UUID;
    s2_id UUID := 'bbbbbbbb-2222-2222-2222-222222222222'::UUID;
    s3_id UUID := 'cccccccc-3333-3333-3333-333333333333'::UUID;
    s4_id UUID := 'dddddddd-4444-4444-4444-444444444444'::UUID;
    s5_id UUID := 'eeeeeeee-5555-5555-5555-555555555555'::UUID;
BEGIN
    SELECT id INTO plan_3m_id FROM public.plans WHERE name = '3 Months' LIMIT 1;
    SELECT id INTO plan_6m_id FROM public.plans WHERE name = '6 Months' LIMIT 1;
    SELECT id INTO plan_1y_id FROM public.plans WHERE name = '1 Year' LIMIT 1;

    SELECT id INTO prog_crossfit_id FROM public.programs WHERE name = 'CrossFit' LIMIT 1;
    SELECT id INTO prog_strength_id FROM public.programs WHERE name = 'Strength Training' LIMIT 1;
    SELECT id INTO prog_boxing_id FROM public.programs WHERE name = 'Boxing' LIMIT 1;

    -- Member 1: Rahul Sharma (Expires in 2 days -> RED ALERT)
    INSERT INTO public.members (id, name, address, aadhaar_last4, blood_group, age, phone, join_date, consent_given)
    VALUES (m1_id, 'Rahul Sharma', '42 Indiranagar, Bengaluru', '8812', 'B+', 28, '9876543210', CURRENT_DATE - INTERVAL '88 days', true)
    ON CONFLICT (id) DO NOTHING;
    INSERT INTO public.member_programs (member_id, program_id) VALUES (m1_id, prog_crossfit_id) ON CONFLICT (member_id, program_id) DO NOTHING;
    INSERT INTO public.subscriptions (id, member_id, plan_id, plan_name_snapshot, fee_snapshot, start_date, end_date, amount_due, amount_paid, balance)
    VALUES (s1_id, m1_id, plan_3m_id, '3 Months', 4999.00, CURRENT_DATE - INTERVAL '88 days', CURRENT_DATE + INTERVAL '2 days', 4999.00, 4999.00, 0.00)
    ON CONFLICT (id) DO NOTHING;
    INSERT INTO public.payments (member_id, subscription_id, amount, mode, type, note)
    VALUES (m1_id, s1_id, 4999.00, 'UPI', 'subscription_fee', 'Full payment done via GPay')
    ON CONFLICT (id) DO NOTHING;

    -- Member 2: Priya Patel (Expires in 6 days -> YELLOW ALERT, ₹1000 balance pending)
    INSERT INTO public.members (id, name, address, aadhaar_last4, blood_group, age, phone, join_date, consent_given)
    VALUES (m2_id, 'Priya Patel', '108 Koramangala, Bengaluru', '4590', 'O+', 25, '9811223344', CURRENT_DATE - INTERVAL '84 days', true)
    ON CONFLICT (id) DO NOTHING;
    INSERT INTO public.member_programs (member_id, program_id) VALUES (m2_id, prog_strength_id) ON CONFLICT (member_id, program_id) DO NOTHING;
    INSERT INTO public.subscriptions (id, member_id, plan_id, plan_name_snapshot, fee_snapshot, start_date, end_date, amount_due, amount_paid, balance)
    VALUES (s2_id, m2_id, plan_3m_id, '3 Months', 4999.00, CURRENT_DATE - INTERVAL '84 days', CURRENT_DATE + INTERVAL '6 days', 4999.00, 3999.00, 1000.00)
    ON CONFLICT (id) DO NOTHING;
    INSERT INTO public.payments (member_id, subscription_id, amount, mode, type, note)
    VALUES (m2_id, s2_id, 3999.00, 'Card', 'subscription_fee', 'Partial card swipe, 1000 balance pending')
    ON CONFLICT (id) DO NOTHING;

    -- Member 3: Amit Verma (Expired 12 days ago -> EXPIRED DARK RED/GREY CARD)
    INSERT INTO public.members (id, name, address, aadhaar_last4, blood_group, age, phone, join_date, consent_given)
    VALUES (m3_id, 'Amit Verma', '12 HSR Layout, Bengaluru', '3145', 'A+', 34, '9733445566', CURRENT_DATE - INTERVAL '192 days', true)
    ON CONFLICT (id) DO NOTHING;
    INSERT INTO public.member_programs (member_id, program_id) VALUES (m3_id, prog_boxing_id) ON CONFLICT (member_id, program_id) DO NOTHING;
    INSERT INTO public.subscriptions (id, member_id, plan_id, plan_name_snapshot, fee_snapshot, start_date, end_date, amount_due, amount_paid, balance)
    VALUES (s3_id, m3_id, plan_6m_id, '6 Months', 5999.00, CURRENT_DATE - INTERVAL '192 days', CURRENT_DATE - INTERVAL '12 days', 5999.00, 5999.00, 0.00)
    ON CONFLICT (id) DO NOTHING;
    INSERT INTO public.payments (member_id, subscription_id, amount, mode, type, note)
    VALUES (m3_id, s3_id, 5999.00, 'Cash', 'subscription_fee', 'Cash paid on joining')
    ON CONFLICT (id) DO NOTHING;

    -- Member 4: Sneha Kulkarni (Active Normal: 1 Year plan, expires in 280 days)
    INSERT INTO public.members (id, name, address, aadhaar_last4, blood_group, age, phone, join_date, consent_given)
    VALUES (m4_id, 'Sneha Kulkarni', '75 Whitefield, Bengaluru', '9021', 'AB+', 29, '9944556677', CURRENT_DATE - INTERVAL '85 days', true)
    ON CONFLICT (id) DO NOTHING;
    INSERT INTO public.member_programs (member_id, program_id) VALUES (m4_id, prog_crossfit_id) ON CONFLICT (member_id, program_id) DO NOTHING;
    INSERT INTO public.subscriptions (id, member_id, plan_id, plan_name_snapshot, fee_snapshot, start_date, end_date, amount_due, amount_paid, balance)
    VALUES (s4_id, m4_id, plan_1y_id, '1 Year', 8999.00, CURRENT_DATE - INTERVAL '85 days', CURRENT_DATE + INTERVAL '280 days', 8999.00, 8999.00, 0.00)
    ON CONFLICT (id) DO NOTHING;
    INSERT INTO public.payments (member_id, subscription_id, amount, mode, type, note)
    VALUES (m4_id, s4_id, 8999.00, 'UPI', 'subscription_fee', 'Paid via PhonePe')
    ON CONFLICT (id) DO NOTHING;

    -- Member 5: Vikram Singh (Active Normal: 6 Months plan, expires in 120 days, balance ₹1500)
    INSERT INTO public.members (id, name, address, aadhaar_last4, blood_group, age, phone, join_date, consent_given)
    VALUES (m5_id, 'Vikram Singh', '302 JP Nagar, Bengaluru', '1288', 'O-', 31, '9822334455', CURRENT_DATE - INTERVAL '60 days', true)
    ON CONFLICT (id) DO NOTHING;
    INSERT INTO public.member_programs (member_id, program_id) VALUES (m5_id, prog_strength_id) ON CONFLICT (member_id, program_id) DO NOTHING;
    INSERT INTO public.subscriptions (id, member_id, plan_id, plan_name_snapshot, fee_snapshot, start_date, end_date, amount_due, amount_paid, balance)
    VALUES (s5_id, m5_id, plan_6m_id, '6 Months', 5999.00, CURRENT_DATE - INTERVAL '60 days', CURRENT_DATE + INTERVAL '120 days', 5999.00, 4499.00, 1500.00)
    ON CONFLICT (id) DO NOTHING;
    INSERT INTO public.payments (member_id, subscription_id, amount, mode, type, note)
    VALUES (m5_id, s5_id, 4499.00, 'UPI', 'subscription_fee', 'Partial payment on admission')
    ON CONFLICT (id) DO NOTHING;
END $$;

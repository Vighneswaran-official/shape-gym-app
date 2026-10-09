# Shape - Gym Management Android App 🏋️‍♂️

A modern gym management system built for gym owners and managers to maintain members, memberships, renewals, front-desk admissions, and accounts.

---

## 🛠️ Phase 1 Architecture & Tech Stack
- **Language**: Kotlin (100%)
- **UI**: Jetpack Compose + Material 3 (Bold Dark Fitness Theme)
- **Architecture**: MVVM + Repository Pattern + Clean Architecture
- **Dependency Injection**: Dagger Hilt
- **Backend**: Supabase
  - PostgreSQL Database with Row Level Security (RLS) on **every** table
  - Supabase Auth (Email + Password)
  - Supabase Storage (Private buckets for photos, signatures, receipts, backups)
  - Official Supabase Kotlin SDK (`supabase-kt` 2.4.0) with OkHttp engine
- **Offline Cache**: Room Database (`ShapeDatabase`)
- **Device Security**:
  - Android Keystore AES-256-GCM Hardware Encryption
  - Encrypted Front-Desk 4-Digit PIN Lock & Biometric prompt
  - Client-side encryption for sensitive data (Aadhaar & health history)

---

## 🚀 Step-by-Step Supabase Setup Guide

### 1. Create Supabase Project
1. Go to [https://supabase.com](https://supabase.com) and log in.
2. Click **"New Project"**.
3. Choose your organization, set the project name: `Shape Gym`.
4. Choose a strong database password (keep this safe!).
5. **Region**: Select **Asia (Mumbai) `ap-south-1`** for the lowest latency in India.
6. Click **"Create new project"**.

### 2. Run the SQL Migration Script
1. In the Supabase Dashboard, open the **SQL Editor** from the left navigation.
2. Click **"+ New query"**.
3. Copy the entire contents of [`supabase_schema.sql`](./supabase_schema.sql) and paste it into the editor.
4. Click **"Run"** (or press Ctrl+Enter).
5. The script automatically creates:
   - All 10 tables: `profiles`, `members`, `programs`, `plans`, `member_programs`, `subscriptions`, `payments`, `expenses`, `signatures`, `app_settings`
   - Performance indexes on `phone`, `deleted_at`, `end_date`, `paid_on`, etc.
   - Comprehensive **Row Level Security (RLS)** policies for Admin & Staff roles
   - Automatic user profile provisioning trigger (`handle_new_auth_user`)
   - 4 Private Storage buckets: `member-photos`, `signatures`, `receipts`, `backups`
   - Default seed data: 5 gym programs, 3 membership plans (3M: ₹4,999, 6M: ₹5,999, 1Y: ₹8,999), and 5 test members demonstrating alert colors!

### 3. Create First Admin User
1. Go to **Authentication > Users** in the Supabase Dashboard.
2. Click **"Add user" > "Create user"**.
3. Enter your manager email (e.g. `owner@shapegym.com`) and a password.
4. Turn **"Auto Confirm User"** ON so you can log in immediately.
5. Click **"Create user"**.
6. Because of the `handle_new_auth_user` trigger, the first user created is automatically assigned the `admin` role in `public.profiles`!
   *(You can verify this by checking Table Editor > `profiles`).*

### 4. Retrieve Supabase Project URL & Anon Key
1. Go to **Project Settings > API**.
2. Copy the **Project URL** (e.g. `https://xyzcompany.supabase.co`).
3. Copy the `anon` / `public` Project API key.
   *(⚠️ NEVER use the `service_role` secret key in the mobile app!).*

---

## 📱 Running the Android App in Android Studio

1. Open Android Studio (Hedgehog 2023.1.1 or Ladybug / Koala recommended).
2. Choose **"Open"** and select the folder `C:\Users\knitk\.gemini\antigravity-ide\scratch\shape-gym-app`.
3. In the root directory of the project, create or edit `local.properties`:
   ```properties
   sdk.dir=C:\\Users\\YOUR_USERNAME\\AppData\\Local\\Android\\Sdk
   SUPABASE_URL=https://your-project-id.supabase.co
   SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```
4. Click **"Sync Project with Gradle Files"**.
5. Select an Android emulator (API 26+) or a physical device.
6. Click **Run ('app')**.

---

## 🔒 Security & Privacy Implementation Details
- **Aadhaar Masking**: Aadhaar is validated for 12 digits, displayed masked as `XXXX-XXXX-1234`.
- **Client-Side AES-256-GCM**: Encrypted before hitting network/Supabase, preventing plaintext leaks.
- **Auditable Payments**: Payments cannot be deleted or secretly edited by staff. Corrections are logged as new entries with notes.
- **Front-Desk App Lock**: 4-digit PIN stored as a salted SHA-256 hash in `EncryptedSharedPreferences`, with quick keypad access.

---

## 📦 Deliverables in Phase 1
- `supabase_schema.sql`: Complete PostgreSQL migration file with RLS, Storage Buckets, and Seed Data.
- Project structure, Gradle configuration, AndroidManifest, Proguard rules.
- MVVM Architecture with Hilt, Room Database, and Supabase Kotlin SDK.
- Auth Flow: Splash Screen, Login Screen, Front-Desk PIN Setup & Lock Screen, Main Hub Screen.

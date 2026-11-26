# Timmy Life Journal

A life journal combining Timmy'sShadow, the Timmy OS daily workflow, and a PARA Second Brain. It can run locally or sync through a private Supabase account.

## Run locally

```bash
npm install
npm run dev
npm test
npm run build
```

## Configure cloud sync

1. In Supabase, create a project and enable the Google provider under Authentication. In Google Cloud, create an OAuth web client and add `https://YOUR_PROJECT.supabase.co/auth/v1/callback` as an authorized redirect URI. Enter the client ID and secret in Supabase, not in this app.
2. Set the Supabase Auth site URL to your Vercel URL, and allow that URL and your local development URL in Auth's redirect URL settings. Enable Google sign-up for the initial sign-in.
3. Run `supabase/migrations/20261125000000_cloud_sync.sql` in the Supabase SQL editor. It creates account-owned data, conflict backups, row-level policies, and an atomic revision-checked save function. It uses the existing complete app data model rather than the four simplified tables.
4. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Vercel, or copy `.env.example` to `.env.local` for local development. Use the project's public publishable/anon key, **never** the service-role or secret key. Rebuild and deploy after changing environment variables.
5. Sign in once with Google. The app will initially say the account is not permitted. In Supabase Authentication → Users, copy your user's UUID, then run `insert into public.shadow_allowed_users (user_id) values ('YOUR_USER_UUID');` in the SQL editor. Sign out and back in. Only UUIDs added to this allowlist can read or write cloud journal data; other users who sign up cannot access it. Restrict sign-ups in Supabase as appropriate once your account exists.
6. On each device choose **PC** or **phone/tablet**. Use **Change device label** if you chose incorrectly.

The app stores planner, journal, health, habit and Second Brain data in a single versioned account document, with separately protected conflict backups. Google Calendar and Tasks integrations remain separate and their access tokens and external data are not synced. The browser keeps an account-scoped offline copy, including unsynced changes. Sync runs on changes, reconnect, focus, periodically, and on supported Supabase Realtime notifications. An authenticated session is needed to send changes; if it expires offline, **Open last offline cloud copy** lets you continue editing and sign in later. Offline copies remain on the device after sign-out and are accessible to anyone with access to that browser. Use a current browser with Web Locks; only one tab per account can edit on a device.

Concurrent unrelated changes are merged. When the same field changes on PC and phone/tablet, PC wins and both versions are saved in **Conflict backups**; download either version there as a restorable journal backup. Conflicts between devices with the same label prefer the cloud version. Unsupported concurrent changes to arrays without stable IDs pause sync instead of discarding data. In that case download both the current backup and **Download cloud copy**, restore the cloud copy, wait for sync, then manually reconcile your changes. Conflict backups stay in Supabase until deleted by a project administrator.

## Using the journal

- **Planner** follows the Jibun Techo LIFE / DIARY / IDEA flow. LIFE holds values, vision, dreams, milestones, and connections. DIARY opens on the daily view with events, tasks, habits, and the shared journal; its year, month, and week tabs help turn the big picture into plans. IDEA retains the planner's free notes and links to the searchable Second Brain.
- **Growth** (from Daybook 2027's growth page) sits beside LIFE in the planner with four sections: **Vision** (eleven questions about who you want to become), **Skills** (current vs. target level, practice log, days since practice), **Old habits** (log slips with triggers and a next-time plan, days since last slip, best run), and **Progress** (journal streak from your shared journal, skill and habit summary, weekly five-pillar self-check-in trend). Growth data lives inside the planner data, so it is included in backups and cloud sync.
- **Daily focus**: choose up to five personal and five work priorities for each date from local tasks, or create tasks directly in those lists. The order you select them is their priority order; removing a priority does not delete the task. Record your current focus and running action log for each date. View all goals, including saved year and month goals, in the day view. Add goals there, select a focus goal for each date, and link habits to goals. Habits linked to that day's focus are highlighted. Set a time for each habit on the selected day to show it in the local schedule; this does not create a Google Calendar event. Silent Strength and Daily Stoic reflection fields, daily notes, and the shared journal are saved per date. Manage habits in Daily & health.
- **Daily & health** uses the same selected date, journal, and habits, and retains recovery, workouts, meals, nutrition, and weight tracking.
- **Second Brain** captures searchable notes in an Inbox or PARA category: Projects, Areas, Resources, and Archive. Existing notes without a category appear in Inbox. Optional Google actions create separate tasks or calendar events; they do not sync changes.

## Google in the day planner

The day planner reads events from Google calendars selected in Google Calendar in **Review your schedule**. The **Daily & health** page also shows the Google schedule for its selected date. Each page has its own Google session; connect on that page to load events. Use **Refresh Google** to load external changes. Google events are read-only in the planner; Google Tasks are no longer displayed in the day planner. Existing local and Google tasks are not deleted. Google data is not available offline and is not included in backups. Goal links are included in planner backups and cloud sync.

The Day schedule has a Google OAuth web client ID prefilled. The **Daily & health** page uses `VITE_GOOGLE_CLIENT_ID` if set at build time, or you can enter a client ID there. In Google Cloud, enable the Google Calendar API, configure the OAuth consent screen and test users if the app is in testing, and add the app's origin (such as `https://timmy-shadow.vercel.app` or `http://localhost:3000`) to the client's authorized JavaScript origins. The planner and Daily & health request `calendar.readonly`; you may be prompted to grant access again. Access tokens stay in memory and expire; reconnect as needed. The separate Second Brain integration requires the Google Tasks API and still requests permission to create calendar events and tasks. A client's origin and OAuth consent must be configured for each deployment; a client secret is not needed in this browser app.

Previous planner diaries remain available under **Earlier planner diary** on their respective dates. They are kept separate to avoid overwriting a Shadow journal entry; copy any text you want into the shared journal.

## Moving data and backups

Without cloud configuration, data remains in this browser on this device. To move existing data, open the local journal on the original device and use **Backup & import → Download backup**. Sign in to the cloud account and restore that file only when you intend to replace its current data; signing in never automatically uploads or overwrites local or cloud data. A restore replaces the selected cloud or local data, so download a fresh backup first. Older Shadow-only backups can still be restored without replacing planner data or notes. Keep backups private: they contain personal information. OneDrive is manual storage, not automatic sync.

To bring data from Timmy OS, export its JSON backup and choose **Backup & import → Import Timmy OS** here. Journal entries, dated tasks, events, habits, and check-ins are merged. Conflicting journal text is appended with an import label; existing planner and health records are not replaced. Re-importing the same backup does not duplicate records, and existing imported tasks and habit check-ins are not overwritten. Make a backup before importing.

To bring over the Daybook 2027 growth page, use its **Export ↗** (`growth-2027.json`) and choose **Backup & import → Import Daybook growth**. Skills, old habits, and check-ins are added with stable IDs (re-importing does not duplicate them), and vision answers are appended only when they differ from yours. Daybook journal entries use **Import Daybook 2027**.

Timmy OS and Daybook 2027 are now fully consolidated here: their planner views, tasks, events, habit tracking and streaks, journal, calendar export, and backups already existed in this app, so only the Growth features were added. The Timmy OS bootable image (`os/`) is not part of this web app.

The app is installable on a phone via the browser's Add to Home Screen option and can work offline after loading; cloud sync and Google actions require a connection.

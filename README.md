# Timmy Life Journal

A local-first life journal combining Timmy'sShadow, the Timmy OS daily workflow, and a PARA Second Brain.

## Run locally

```bash
npm install
npm run dev
npm test
npm run build
```

## Using the journal

- **Planner** follows the Jibun Techo LIFE / DIARY / IDEA flow. LIFE holds values, vision, dreams, milestones, and connections. DIARY opens on the daily view with events, tasks, habits, and the shared journal; its year, month, and week tabs help turn the big picture into plans. IDEA retains the planner's free notes and links to the searchable Second Brain.
- **Daily focus**: add goals in the day view, select a focus goal for each date, and link local tasks, Google tasks, and habits to goals. Items linked to that day's focus are highlighted. Open tasks due before the selected date and undated tasks remain visible; completed tasks appear on their due date. Silent Strength and Daily Stoic reflection fields, daily notes, and the shared journal are saved per date. Manage habits in Daily & health.
- **Daily & health** uses the same selected date, journal, and habits, and retains recovery, workouts, meals, nutrition, and weight tracking.
- **Second Brain** captures searchable notes in an Inbox or PARA category: Projects, Areas, Resources, and Archive. Existing notes without a category appear in Inbox. Optional Google actions create separate tasks or calendar events; they do not sync changes.

## Google in the day planner

The day planner reads events from Google calendars selected in Google Calendar in **Review your schedule** and shows Google Tasks from all task lists in **Plan your tasks**. It can add a task to a chosen list, due on the selected day, and mark tasks complete or incomplete. Use **Refresh Google** to load external changes. Google events are read-only in the planner; local events and tasks remain separate. Google data is not available offline and is not included in backups. Goal links are stored locally and included in planner backups.

Set `VITE_GOOGLE_CLIENT_ID` at build time or enter a Google OAuth web client ID in the day view. In Google Cloud, enable the Google Calendar API and Google Tasks API, configure the OAuth consent screen and test users if the app is in testing, and add the app's origin (such as `https://timmy-shadow.vercel.app` or `http://localhost:3000`) to the client's authorized JavaScript origins. The planner requests `calendar.readonly` and `tasks`; you may be prompted to grant access again. Access tokens stay in memory and expire; reconnect as needed. The separate Second Brain integration still requests permission to create calendar events and tasks. A client's origin and OAuth consent must be configured for each deployment; a client secret is not needed in this browser app.

Previous planner diaries remain available under **Earlier planner diary** on their respective dates. They are kept separate to avoid overwriting a Shadow journal entry; copy any text you want into the shared journal.

## Moving data and backups

Data remains in this browser on this device. Clearing site data removes it; there is no account or automatic sync. Use **Backup & import → Download backup** to save the planner, journal, health data, and Second Brain notes together. Keep the file private: it contains personal information. Restore replaces these data sets on the target device. Older Shadow-only backups can still be restored without replacing planner data or notes. OneDrive is manual storage, not automatic sync.

To bring data from Timmy OS, export its JSON backup and choose **Backup & import → Import Timmy OS** here. Journal entries, dated tasks, events, habits, and check-ins are merged. Conflicting journal text is appended with an import label; existing planner and health records are not replaced. Re-importing the same backup does not duplicate records, and existing imported tasks and habit check-ins are not overwritten. Make a backup before importing.

The app is installable on a phone via the browser's Add to Home Screen option and can work offline after loading; Google actions require a connection.

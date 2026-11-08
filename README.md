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
- **Daily & health** uses the same selected date, journal, and habits, and retains recovery, workouts, meals, nutrition, and weight tracking.
- **Second Brain** captures searchable notes in an Inbox or PARA category: Projects, Areas, Resources, and Archive. Existing notes without a category appear in Inbox. Optional Google actions create separate tasks or calendar events; they do not sync changes.

Previous planner diaries remain available under **Earlier planner diary** on their respective dates. They are kept separate to avoid overwriting a Shadow journal entry; copy any text you want into the shared journal.

## Moving data and backups

Data remains in this browser on this device. Clearing site data removes it; there is no account or automatic sync. Use **Backup & import → Download backup** to save the planner, journal, health data, and Second Brain notes together. Keep the file private: it contains personal information. Restore replaces these data sets on the target device. Older Shadow-only backups can still be restored without replacing planner data or notes. OneDrive is manual storage, not automatic sync.

To bring data from Timmy OS, export its JSON backup and choose **Backup & import → Import Timmy OS** here. Journal entries, dated tasks, events, habits, and check-ins are merged. Conflicting journal text is appended with an import label; existing planner and health records are not replaced. Re-importing the same backup does not duplicate records, and existing imported tasks and habit check-ins are not overwritten. Make a backup before importing.

The app is installable on a phone via the browser's Add to Home Screen option and can work offline after loading; Google actions require a connection.

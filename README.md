# Rio Training

Shared training log for two people. Static site on GitHub Pages, data in Supabase.
Both devices read and write the same record, so Rio and the trainer see each other's
entries.

## Setup, once

### 1. Database (about 5 minutes)

1. Sign up at [supabase.com](https://supabase.com) and create a new project.
   Any region near you; the free tier is plenty.
2. When it finishes provisioning, open **SQL Editor → New query**, paste the whole
   contents of [`schema.sql`](schema.sql), and press **Run**.
3. Go to **Project Settings → API** and copy two values:
   - **Project URL** — looks like `https://abcdefgh.supabase.co`
   - **anon** / **publishable** key — the long one.
     Do **not** copy `service_role`; that key is full-access and must never go in a web page.

### 2. Config

Open `config.js` and paste those two values in place of the `PASTE_...` placeholders.
Save the file.

The anon key is meant to live in client-side code, so it's fine in a public repo.
The app's URL is the real secret: anyone with the link can read and write the log,
exactly as the old shared artifact worked.

### 3. Publish

Create a new repository on github.com, upload these files (drag and drop works),
then **Settings → Pages → Source: Deploy from a branch → main / root**. Wait a minute
and your app is at `https://<your-username>.github.io/<repo-name>/`.

Send that link to the trainer. Same link, same data.

## Day to day

- **Log** — tap a date to open or start a session, add exercises, record sets, reps
  or seconds, and weight.
- **Exercises** — the exercise database, grouped into categories, with optional
  target and video link. YouTube links play inline.
- **Export** — CSV for spreadsheets, or a full JSON backup. The backup is the only
  file `Restore` accepts.

## How saving works

- Edits save automatically about a second after you stop typing, not on every keystroke.
- A failed save retries on its own; your work stays on screen and in a local cache
  meanwhile, so a dropped connection costs nothing.
- Before each write the app re-reads the shared record and merges: days you changed
  win, days the other person changed are kept. Two people logging different sessions
  never overwrite each other.
- Every 15 seconds an idle device picks up the other person's changes.

## Separate logs

Add `#room=someone-else` to the URL for an independent log sharing the same database.
Everyone using the same room sees the same data.

## Backups

`Export → Download full backup` writes a JSON file that restores everything exactly.
Take one before any big change.

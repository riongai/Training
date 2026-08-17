// ---------------------------------------------------------------------------
// Fill in these two values from your Supabase project, then save this file.
//
// In Supabase: Project Settings -> API
//   SUPABASE_URL  is "Project URL",  e.g. https://abcdefgh.supabase.co
//   SUPABASE_ANON is the "anon" / "publishable" key (the long one, NOT
//   "service_role" — never put service_role in here, it is a full-access key).
//
// The anon key is designed to sit in client-side code, so it is safe in a public
// repo. Treat the app's URL as the secret: anyone with the link can read and
// write the training log, exactly as the old shared artifact worked.
// ---------------------------------------------------------------------------

window.CONFIG = {
  SUPABASE_URL: "https://gpunvhlceoahvwxqfxnh.supabase.co",
  SUPABASE_ANON: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdwdW52aGxjZW9haHZ3eHFmeG5oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY5NDg5MDIsImV4cCI6MjEwMjUyNDkwMn0.-dGi2ojkthSL6BTIbXbP18TwJZOvtvFb-Lpxfqt_5f0",

  // The shared record both of you read and write. Anyone using the same room
  // sees the same log. Change it only if you want a second, separate log.
  ROOM: "rio-2026",

  TABLE: "training",
};

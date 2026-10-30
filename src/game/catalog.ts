export type QuestDefinition = { id: string; title: string; xp: number; description?: string };

// Exact IDs, titles, descriptions, and rewards from reference/pilot.html.
export const QUESTS: readonly QuestDefinition[] = [
  {
    id: "start-record",
    title: "Start your record",
    xp: 0,
    description: "Log work or import a PayPal activity CSV. This first-run quest completes automatically."
  },
  {
    "id": "paypal",
    "title": "Quest 1: Set up your PayPal payout account",
    "xp": 30,
    "description": "One PayPal account and one personal email on every site, so every payout lands in one place."
  },
  {
    "id": "pro-sign",
    "title": "Prolific: account approved",
    "xp": 30,
    "description": "Sign up or join the waitlist, verify your ID, link PayPal."
  },
  {
    "id": "pro-about",
    "title": "Prolific: finish every About You screener",
    "xp": 40,
    "description": "More screeners answered means more studies you qualify for."
  },
  {
    "id": "pro-alert",
    "title": "Prolific: alerts on",
    "xp": 20,
    "description": "Phone notifications plus a browser alert, so you only show up when a study is live."
  },
  {
    "id": "pro-first",
    "title": "Prolific: first study approved",
    "xp": 50,
    "description": "Read every instruction and pass every attention check."
  },
  {
    "id": "rev-apply",
    "title": "Rev: apply (join the waitlist)",
    "xp": 30,
    "description": "Read the style guide before starting the sample test."
  },
  {
    "id": "tm-apply",
    "title": "TranscribeMe: pass the transcription test",
    "xp": 30,
    "description": "Same approach: style guide first, headphones on."
  },
  {
    "id": "expand",
    "title": "Set up text expansion",
    "xp": 40,
    "description": "Short codes for [inaudible], [crosstalk] and speaker labels."
  },
  {
    "id": "hotkeys",
    "title": "Learn the transcription editor hotkeys",
    "xp": 30,
    "description": "Play, pause and rewind without touching the mouse."
  },
  {
    "id": "wpm",
    "title": "Record your baseline typing speed",
    "xp": 30,
    "description": "Retest weekly. Note it in a session log entry."
  },
  {
    "id": "pick",
    "title": "Skip a bad audio file",
    "xp": 20,
    "description": "Preview 30 seconds and pass on noisy, crosstalk-heavy files."
  },
  {
    "id": "ss-profile",
    "title": "SideShift: profile and 2 sample videos",
    "xp": 40,
    "description": "Brands pick creators who already show their style."
  },
  {
    "id": "ss-setup",
    "title": "SideShift: fixed filming setup",
    "xp": 30,
    "description": "One spot, one light, one script skeleton."
  },
  {
    "id": "ss-first",
    "title": "SideShift: land your first gig",
    "xp": 60,
    "description": "Reuse a pitch message you can tweak per brand."
  },
  {
    "id": "mw-sign",
    "title": "Microworkers: sign up",
    "xp": 15,
    "description": "Filler only. Cap it at 20 minutes."
  },
  {
    "id": "lb-join",
    "title": "Join the leaderboard",
    "xp": 20,
    "description": "Then race for the bonus quests: first to each rung gets +100 XP."
  },
  {
    "id": "tax",
    "title": "Start a tax set-aside",
    "xp": 20,
    "description": "Move part of each payout aside the day it arrives."
  },
  {
    "id": "week",
    "title": "First Sunday review",
    "xp": 40,
    "description": "Check the per-hour table and drop the bottom site's time."
  },
  {
    "id": "pedal",
    "title": "Buy a foot pedal with earnings",
    "xp": 50,
    "description": "Only once transcription earnings cover it."
  }
];
export const PILOT_AVAILABLE = true;
export const PLATFORMS = ["Prolific", "Rev", "TranscribeMe", "SideShift", "Microworkers", "Other"] as const;
export const TITLES = ["Rookie", "Clocked In", "Grinder", "Hustler", "Pro", "Machine", "Legend"] as const;

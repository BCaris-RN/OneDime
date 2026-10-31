TASK HANDOFF: The Vault (teaser of the Mint)
Operator: Brandon. Lead/design: Claude. Spec: the Vault tab in reference/pilot.html.
Start AFTER the personal-ladder PR merges (both touch XP). Branch vault-teaser from main. One PR.

BUILD (match the pilot exactly):
- A seventh top-level tab "Vault" after Stats; phone grid 3+3+1 or 4+3, no overflow at 320px.
- XP chip in the header on every page ("XP 658 >") that opens the Vault.
- 10x10 tile grid over Penny (16x16 pixel robot, original art in the pilot). Tiles break in a fixed
  seeded order (never random per visit). New tiles crumble in stepped animation the first time
  they're seen; reduced motion = no animation. Store "tiles seen" per player server-side.
- Tiles broken = min(100, 2 per MATCHED dollar across all apps + 1 per distinct work day + 3 per
  completed quest). Server computes it; the browser only draws it. Never purchasable, never random.
- At 100: "PENNY IS AWAKE", stats Grit (streak), Shine (matched share), Range (income apps),
  Craft (best hourly), "THE MINT DOOR - Your Lot opens soon" (no link yet).
- Roster: Penny, Lumen (Spotlight), Quill (Freelance), Axle (Delivery), Barter (Selling) as
  silhouettes with "Wakes with ..." (only Penny wakes in this phase).
- Copy rules: no income promises, no "get rich", no celebrity names. "Nothing here can be bought."
- No "prototype" demo buttons in the app; a seeded demo account shows a partial reveal for the video.
TESTS: tile math (matched only, caps at 100, quests and days), deterministic order, seen-state per
player, no tiles from unmatched pay, keyboard/screen-reader labels, no overflow, contrast in every skin.
Open a PR, green CI, clean bot review, 5-line summary for Claude. Don't merge or deploy.

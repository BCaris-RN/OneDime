# OneDime walkthrough video script

Target runtime: 2:30, hard limit 2:50. The recorder stops the run at 2:40, so the footage always leaves room
for an end card. Capture only fictional demo data.

Record with `npm run record:demo`. It starts the isolated demo with DEMO_VIDEO enabled, so every platform label
is fictional, and writes one video at 1280x720 and one at 390x844 to `video/`. The sign-in shot is the local
fake demo login. It is not PayPal authentication. The recorder does not capture the hosted beta; the two
required inserts below are separate clips.

The times below follow the recorder's own pauses. Read the voice-over slowly; each line fits its window.

| Time | Picture | Voice-over |
| --- | --- | --- |
| 0:00-0:18 | The demo opens on First Dime with the "Local demo, fictional data, no PayPal connection" banner and the welcome card. | Independent work can mean income scattered across apps. OneDime gives workers one private place to keep a record. This is a fictional local demo with fake sign-in, and it never contacts PayPal. |
| 0:18-0:42 | A fictional entry is typed in and saved: 42 minutes, $3.25. It lands in the ledger. | A worker logs an amount and time by hand. Money is stored as whole cents, so the record never depends on decimal rounding. |
| 0:42-0:56 | Spotlight: one creator income row is added. Then the Freelance and Market tabs, each with a fictional record. | The same private ledger covers creator income, freelance gigs, deliveries and sales. Each app keeps its own records. |
| 0:56-1:04 | PayPal tab: a fictional activity CSV is imported. | A worker can import their own PayPal activity file. It is their supplied file, not an independent payment lookup. |
| 1:04-1:22 | First Dime after the five payments are linked: the entry shows as matched, and the ladder and profession rank badge update. | Linking one payment to one record keeps an earning from counting twice. A matched record is matched to your PayPal activity; PayPal does not confirm it. Matches move your ladder and field-app ranks. Ranks grant XP, never money. |
| 1:22-1:46 | Stats: the charts draw, then "Show as a table" opens the numbers behind a chart. | Stats shows monthly income, matched share, work rates and a streak across every app. Each chart has a table view, and the motion respects reduced-motion settings. |
| 1:46-2:04 | PayPal tab: the monthly summary of imported activity. | The PayPal tab keeps a monthly summary of the imported activity, so a worker can see what came in. |
| 2:04-2:20 | Back to First Dime, then the Help tab. | Help explains the rules in plain words, including what matched means and what it does not. |
| 2:20-2:30 | Stats once more, then an end card with the project name and repo link. | OneDime: keep your record, see your progress, choose your next step. |

## Required inserts

Cut these two into the 2:30 timeline. Together they add 15 seconds, so the video runs 2:45 and stays under
the 2:50 limit.

| Length | Picture | Voice-over |
| --- | --- | --- |
| 10 s, after the 1:04 import beat | PayPal tab with Smart suggestions on. A payment from a payer OneDime does not know shows "Suggested: <workspace> / Other. Confirm or change it." The cursor confirms it. | A small model on this device suggests which workspace an imported payment belongs to. Nothing leaves the device. I confirm it, and the server decides. |
| 5 s, at the end before the end card | Clip of the real sandbox Log in with PayPal on the hosted beta (https://onedime-web.onrender.com): press the button, show PayPal's sandbox page, land back on First Dime. Blur or cut before the email and password are typed. | The hosted beta signs in through PayPal's sandbox. No real money moves. |

Capture the suggestion from a local demo with a payment from an unknown payer. The sample CSV
(`tests/fixtures/paypal-activity.csv`) has only a known payer, so it shows no suggestion. If the demo data does
not include an unknown payer, add one fictional payer to a throwaway CSV for the recording.

## Optional inserts

The recorder does not open the landing console, the Vault or Appearance. If you want them, capture each as a
separate clip from the local demo and cut it in. With the required inserts the cut is 2:45, so all the optional
ones together get 5 seconds at most. Anything longer needs matching cuts from the main timeline. None is
needed to match the footage above.

- Landing console: press START and show the short boot overlay. "OneDime starts on a handheld console."
- Vault: open it right after routing so the new tiles are unseen and crumble. "Matched pay, work days and
  quests break tiles. Nothing can be bought. Penny wakes at a hundred."
- Appearance: switch Glass, Current, Paper and Slate. "Glass is the default. Three more looks are one tap
  away."

## Recording notes

- Run the recorder once. It records both sizes in one run, so check both files before editing. The 390x844
  clip is the phone shot.
- Use the isolated local demo and fictional records. Do not use personal account, payer, transaction or real
  financial information.
- Say "matched to your PayPal activity", not "verified by PayPal". Do not imply that imported CSV files are
  authenticated evidence.
- Never show real gig-platform names. DEMO_VIDEO mode supplies fictional labels, and the recorder fails if a
  real one appears on screen. PayPal stays named because the app matches entries to an uploaded PayPal
  activity file.
- Nothing in the script implies a deployment or live PayPal action.

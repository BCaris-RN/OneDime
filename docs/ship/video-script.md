# OneDime walkthrough video script

Target runtime: 2:35, with a hard limit of 2:50. Capture only fictional demo data.
The login shot uses the local fake demo login; it is not PayPal authentication.
Phase 5 shots depend on open PR #9 and must be recorded only after that branch is
merged and the demo runs against the merged code.

| Time | Picture | Voice-over |
| --- | --- | --- |
| 0:00–0:14 | Show an unorganized set of fictional platform payouts, then open OneDime. | Independent work can mean income scattered across apps. OneDime gives workers one private place to keep a record and see what their time is earning. |
| 0:14–0:30 | Local demo login; land on First Dime. Label the login as a fake, local demo. | This is a fictional local demo. The beta uses PayPal sandbox sign-in; this screen uses fake demo sign-in and never contacts PayPal. |
| 0:30–0:52 | Add a fictional First Dime entry, save it, and show the entry in the ledger. | A worker can log an amount and time by hand. Money is stored as whole cents, so the record does not depend on decimal rounding. |
| 0:52–1:12 | Open PayPal, import a fictional activity CSV, inspect the review queue, route one payment to the matching record. | A worker may import their own PayPal activity CSV and review a suggested match. The import is their supplied file, not an independent payment lookup. Linking one payment to one record prevents counting the same earning twice. |
| 1:12–1:29 | Show the record's matched status and the ranks panel. | An eligible record can be matched to your PayPal activity file; PayPal does not independently confirm it. Matched earnings advance profession ranks. The ranks grant progression XP; they do not create money or change the First Dime game rules. **This rank shot depends on open PR #9.** |
| 1:29–1:53 | Open Stats. Let the screen wipe, KPI count-up, bars, meter and finite coin animation play. Show a table toggle. | Stats brings together monthly income, matched share, timed work rates, recent activity and a streak across apps. The charts also have table views, and the motion respects reduced-motion settings. **The Stats shot depends on open PR #9.** |
| 1:53–2:11 | Show the field apps and PayPal monthly overview. | Each workspace records its own work. PayPal's overview brings monthly totals together, while the original record remains the source for an earning. |
| 2:11–2:27 | Briefly show a local settings or privacy screen, then return to the app. | OneDime keeps personal ledger data scoped to its account. It does not scrape or sign in to gig platforms. Suggestions run on the device and remain optional. |
| 2:27–2:35 | End card with project name and repo link. | OneDime: keep your record, see your progress, choose your next step. |

## Recording notes

- Record at 1280×720 and 390×844. The walkthrough should remain under 2:40 so there
  is room for a clean opening and end card while staying below 2:50.
- Use the isolated local demo and fictional records. Do not use personal account,
  payer, transaction or real financial information.
- The video must show the finite Stats animations from a fresh tab open and must not
  imply that imported CSV files are authenticated evidence.
- Never show real gig-platform names in the video; demo mode uses fictional labels.
  PayPal remains named because the app uses sandbox sign-in and matches entries to an uploaded PayPal activity file.
- The ranks and Stats shots remain blocked until PR #9 is merged. No deployment or
  live PayPal action is implied by the script.

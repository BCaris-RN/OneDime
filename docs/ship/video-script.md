# OneDime walkthrough video script

Target runtime: 2:35, with a hard limit of 2:50. Capture only fictional demo data.
Everything shown is on main. Record with `npm run record:demo`, which runs the isolated demo with
DEMO_VIDEO enabled so every platform label is fictional. The login shot uses the local fake demo login; it is
not PayPal authentication. The hosted beta uses PayPal sandbox sign-in and is not recorded.

| Time | Picture | Voice-over |
| --- | --- | --- |
| 0:00-0:14 | Show an unorganized set of fictional platform payouts, then cut to the OneDime console booting. | Independent work can mean income scattered across apps. OneDime gives workers one private place to keep a record, and turns the first dime into a game you can win. |
| 0:14-0:30 | The console home screen: D-pad down to the info screen, back up, press START. Land on First Dime after the short boot overlay. Label the login as a fake, local demo. | This is a fictional local demo. The beta uses PayPal sandbox sign-in, and PayPal checks the password, not OneDime. This screen uses fake demo sign-in and never contacts PayPal. |
| 0:30-0:50 | Add a fictional First Dime entry, save it, then show the ledger and your ladder with its next rung. | A worker logs an amount and time by hand. Money is stored as whole cents, so the record does not depend on decimal rounding. Your ladder shows the next rung and what is still pending. |
| 0:50-1:12 | Open PayPal, import a fictional activity CSV, review the suggested workspace, route one payment to the matching record. | A worker can import their own PayPal activity CSV and review a suggested match. The import is their supplied file, not an independent payment lookup. Linking one payment to one record keeps an earning from counting twice. |
| 1:12-1:30 | Back on First Dime: the record now shows matched, two rungs land with their XP, then the profession rank badge. | An eligible record can be matched to your PayPal activity file; PayPal does not independently confirm it. A match earns permanent ladder rungs and, in the field apps, a profession rank. Ranks grant XP; they never create money. |
| 1:30-1:50 | Open Stats. Let the charts draw, show a table toggle. | Stats brings together monthly income, matched share, timed work rates and a streak across apps. Every chart has a table view, and the motion respects reduced-motion settings. |
| 1:50-2:10 | Open the Vault: tiles crumble as the new match counts, Penny shows through, then the four sleeping robots. | Matched pay, work days and quests break tiles in the Vault. Nothing can be bought. Penny wakes at a hundred tiles, and four more robots wait for their own kind of work. |
| 2:10-2:25 | Open Appearance and switch Glass, Current, Paper and Slate; show one tab on a phone-width screen. | The look is Glass by default, with the handheld Current skin, Paper and Slate one tap away. It works on a phone and respects reduced motion and reduced transparency. |
| 2:25-2:35 | End card with project name and repo link. | OneDime: keep your record, see your progress, choose your next step. |

## Recording notes

- Record at 1280x720 and 390x844. The walkthrough should stay under 2:40 so there is room for a clean
  opening and end card while staying below 2:50.
- Use the isolated local demo and fictional records. Do not use personal account, payer, transaction or real
  financial information.
- Show the Stats animations from a fresh tab open, and do not imply that imported CSV files are authenticated
  evidence. Say "matched to your PayPal activity", not "verified by PayPal".
- Never show real gig-platform names. DEMO_VIDEO mode supplies fictional labels. PayPal stays named because the
  app uses sandbox sign-in and matches entries to an uploaded PayPal activity file.
- Make sure the Vault shot shows tiles crumbling: open the Vault right after routing the payment so the new
  tiles are unseen.
- Nothing in the script implies a deployment or live PayPal action.

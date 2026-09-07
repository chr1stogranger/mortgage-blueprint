# LLM Council transcript — Mobile bottom tab bar vs hamburger drawer

Date: 2026-09-06

## Original question

I want to update the mobile app so it doesn't use the hamburger, but has 3-5 buttons at the bottom like the X (formerly Twitter) app. But also keeping in mind that there are 3 apps built into it (Blueprint, PricePoint, Markets). 1) Should we switch and condense the tabs to buttons at the bottom of the screen? 2) If yes, what do you recommend and how can/should we address the other tabs and loan scenarios?

## Framed question

## The decision
Christo (a mortgage loan officer who builds and ships his own product suite, RealStack) wants to change MOBILE navigation in the Mortgage Blueprint app. Today mobile uses a hamburger (top-left) that opens a full-height left drawer. He is asking:
1) Should we drop the hamburger drawer and move to a 3–5 button bottom tab bar (like the X/Twitter app)?
2) If yes, what should the buttons be, and how should everything that doesn't fit (the other tabs, the "Jump to" section anchors, the loan-scenario switcher, the product switcher) be handled?

## What the current mobile drawer contains (top to bottom, from a real screenshot)
- Theme toggle + close X
- RealStack logo/wordmark (umbrella brand)
- PRODUCT SWITCHER: Blueprint / PricePoint / Markets (three products living in ONE React shell, one root, one background canvas). Switching product changes `appMode`; URL path becomes `/`, `/pricepoint`, `/markets`.
- SCENARIOS list (e.g. "Loan - $1.500m - buy now", "Scenario 1", "Refi - CMG - 6.49%"), each with a ⋮ menu. Users typically have 1–5 saved loan scenarios; switching scenario swaps the whole calculator state.
- BLUEPRINT PAGE TABS: Overview, Compare, Learn, Team, Share, Settings are always visible. Conditional extra tabs appear based on flags: Refi Summary + 3-Point Test (refi loans), REO (owns properties), Seller Net, Investor, Rent vs Buy, Prop 19, Pipeline (loan-officer-only, never borrowers). Workspace is desktop-only. So the visible tab count ranges ~6 to ~12.
- "Overview: Jump to" section index: Quick Start, Monthly Payment, Costs, Assets, Debts, Income, Qualify, Tax, Amortization... (~8–12 scroll anchors inside the long single-scroll Overview page; kept in sync by hand with OverviewTab.jsx).
- (LO view only) a SidebarSwitcher for finding/pinning other clients' blueprints.

## Relevant facts from the codebase
- PricePoint (the home-price guessing game product inside the same shell) ALREADY has its own fixed bottom tab bar on mobile: Daily / Sold / For Sale / Stats / Board, glass-styled, honoring safe-area-inset-bottom. So there is a precedent and a style to match — and a conflict risk if Blueprint adds a second bottom bar in the same shell.
- Markets is a lighter product (stock-line style "Live Markets" tab, positions), no bottom bar today.
- Blueprint mobile content already reserves `paddingBottom: calc(90px + safe-area-inset-bottom)` — historically for a sticky payment summary / CTA that sits at the bottom on mobile.
- A previous horizontal-scroll tab strip under the header was REMOVED on 2026-05-03 ("saved ~50px of sticky fold, removed nav redundancy with the drawer"). Fold height on mobile has been fought over before.
- Two audiences share the same UI by explicit decision ("I want them all to have the same view"): loan officers (power users, many clients, many scenarios) and borrowers (a single client, often first-time, opened from a share link; may be in a Guided flow that unlocks tabs progressively).
- The app is a PWA + Capacitor iOS/Android app (App Store), desktop breakpoint is 900px; desktop keeps a persistent left sidebar and is NOT in scope.
- Brand rules: Grange liquid-glass chrome (`T.glass`), pill buttons, shared Icon set, no emojis, Inter font, MONO only for uppercase microlabels. Bottom chrome would sit over an animated wireframe-house background canvas.
- Main file is a 9,800-line MortgageBlueprint.jsx; the drawer is rendered inline there. The header (UnifiedHeader.jsx) currently holds the hamburger, the wordmark, and on LO view the client BorrowerPicker.

## What's at stake
Mobile is where borrowers open shared blueprints, so this touches first impressions and conversion for Christo's mortgage business, plus App Store screenshots and the native releases. A bad nav change buries scenarios/products behind more taps or leaves two competing bottom bars. A good one makes the app feel native and gets people to Compare/Share faster.

## Advisor responses

Anonymization mapping used in peer review: A = Outsider, B = Executor, C = Contrarian, D = Expansionist, E = First Principles.

### The Outsider (Response A)
I tapped a link my loan officer texted me. Here is what I see and think.

The drawer today shows me, in order: a theme toggle, a logo for a company I've never heard of ("RealStack"), three product names ("Blueprint / PricePoint / Markets" — a guessing game? stocks? I came here for my house), a list of "scenarios" with names like "Loan - $1.500m - buy now" that I didn't write, then Overview / Compare / Learn / Team / Share / Settings, then a "Jump to" list of nine more things. That's forty-plus tappable words before I find "Monthly Payment," which is the only number I care about.

So yes, drop the drawer. But the real problem isn't hamburger-vs-tabs. It's that the nav is built for the person who built it. A bottom bar helps only if the buttons are words I already know.

Bottom bar, four buttons, in my language:
- **My Loan** (the Overview page)
- **Compare** (I understand comparing two loans)
- **Learn**
- **Share** (I want to send this to my partner)

Not "Scenarios." Not "Team." Not "Settings." Not "Blueprint."

Everything else:
- **Scenarios**: don't call them that. Show it as a title at the top of My Loan: "$1.5M purchase ▾" and let me tap it to see the other one or two. If I only have one, show nothing.
- **Product switcher**: hide it from me completely. I never asked for a game or stock charts. If the loan officer wants those, put them under his own avatar.
- **Jump to**: this is scrolling. A sticky section label as I scroll is fine; a menu of nine anchors is not.
- **Refi / REO / Investor / Prop 19**: only show them if they apply to me, and put them inside My Loan, not in the bar.

One test: if I'd need a loan officer to explain a button, it shouldn't be in the bar.

### The Executor (Response B)
Yes, do it — but the fastest path is not "design a nav system," it's copy-paste PricePoint's bar. `src/PricePoint.jsx` ~line 5300 already has the exact thing: `position: fixed; bottom: 0; zIndex: 100; T.card + blur(20px); paddingBottom: env(safe-area-inset-bottom)`, five `{id,label,icon}` entries, `maxWidth: 480`. Lift that block into `src/components/MobileTabBar.jsx`, have PricePoint import it, and render it in `MortgageBlueprint.jsx` when `!isDesktop && appMode === "blueprint"`. One component, one shell, so the two-bars conflict is settled by construction: each `appMode` mounts its own entry list, never both.

Monday morning, in order:

1. Extract the bar (1 hour). Blueprint entries: **Overview, Compare, Share, Learn, More**. `tab` state and `setTab` already exist; the first four buttons are `setTab("overview")` etc. — nothing new to wire.
2. **More** opens the existing drawer. Don't rewrite 350 lines at 7290–7640; just move its trigger from the hamburger to the fifth button and delete the hamburger from `UnifiedHeader`. Scenarios, product switcher, conditional tabs (Refi, REO, Investor…), the LO client picker — all still live there, one tap away, zero regressions.
3. Padding is already paid for: `paddingBottom: calc(90px + safe-area-inset-bottom)` at line 7675 exists. Check whether the old sticky payment summary still renders; if it does, that's the real collision, not PricePoint.
4. Jump-to anchors: leave them in the drawer for v1. Second-tap problem later, after telemetry says anyone uses them.

Ship that, verify on blueprint.realstack.app with the cache-buster reload, done in a day. The "what should the five buttons be" debate can run for a week; the only decision that costs anything to reverse is whether the bar exists, and reusing PricePoint's makes it near-free.

### The Contrarian (Response C)
The fatal flaw is hiding in item 2 of the drawer, not item 1. The hamburger isn't the problem; the drawer is doing four jobs (product, scenario, page, section) and a tab bar can do exactly one. So "drop the drawer" is really "keep the drawer, plus add a bar," and now mobile has two nav systems, two mental models, and the fold shrinks again on the exact screen he already fought to reclaim in May.

Things being avoided:

**The tab count is not 3–5. It's 6–12, and it's data-dependent.** A refi LO with REO and Prop 19 sees a different app than a first-time borrower on a guided share link that unlocks tabs progressively. A fixed bar either lies (shows tabs that are locked/hidden) or reflows per user, which kills the one thing tab bars are for: muscle memory. "More" as the 5th button is just the hamburger with a worse name.

**PricePoint already owns the bottom edge.** Same shell, same root. Blueprint adding its own bar means the product switch animates one bar out and another in, or both render for a frame. Nobody has specified that transition and it's where the bug will live.

**That 90px paddingBottom is reserved for the sticky payment/CTA.** The thing borrowers actually convert on. Stacking a tab bar under it means ~140px of fixed chrome on a 667px iPhone SE, over an animated canvas. That's a screenshot he'll hate in the App Store listing.

**Scenarios have a ⋮ menu each.** Where does that go? A bar can't host contextual menus. If the answer is "it stays in the drawer," you've proven the drawer can't be dropped.

Question to answer before touching code: what's the borrower's *second* tap on a shared link? If it's Compare or Share, put those two in the existing sticky bottom row and leave nav alone. If nobody knows, you have no data, and a rewrite of a 9,800-line file's nav is the wrong first move.

### The Expansionist (Response D)
Yes, go bottom bar — and the upside everyone's about to undercount is that this isn't a Blueprint nav decision, it's the moment RealStack becomes one app instead of three products sharing a shell.

PricePoint already has a glass bottom bar. That's not a conflict, it's a template. Build ONE shared `BottomBar` component driven by `appMode`, and suddenly every product gets native-feeling nav for free, Markets included. The App Store screenshots stop looking like a calculator and start looking like a platform. That's the bigger prize.

The tab set that unlocks the most: **Overview · Compare · Share · Scenarios · More**. Scenarios as a first-class tab is the sleeper. Today scenarios are buried in a drawer; as a bottom tab they become the thing borrowers *play with* — "what if I put 20% down" is one tap, and every scenario a borrower creates is engagement data for Christo and a reason to reopen the app. Share as a permanent tab turns every mobile session into a referral surface. That's conversion, not chrome.

"More" is the overflow — a half-height bottom sheet (not a drawer) holding the conditional tabs, the product switcher, and the LO client picker. Bottom sheets feel native; drawers feel like 2015.

The "Jump to" anchors shouldn't be nav at all. Make them a tap-to-expand pill on the bottom bar's Overview tab (tap again while active → section index pops up). That's a pattern X and Instagram use — re-tap the active tab for a secondary action.

And the 90px reserved padding that "historically" held a sticky payment summary? Put the live monthly payment *inside* the bottom bar — a number that updates as they scroll. The bar becomes the product's heartbeat, not just navigation. Do that and the mobile app is the demo, not the desktop.

### The First Principles Thinker (Response E)
The question "hamburger vs. bottom tabs" is a container question. Strip it back: what is a person on a phone actually trying to do in Blueprint, and how many *kinds* of navigation does the app force on them?

Count them. The drawer holds four orthogonal switchers stacked in one list: **product** (Blueprint/PricePoint/Markets), **scenario** (which loan), **page** (Overview/Compare/Share…), and **section** (Jump-to anchors). Those are different axes with different frequencies, and jamming them into one scrolling menu is the real problem. A bottom bar doesn't fix a four-axis nav; it just relocates one axis and leaves the other three homeless. That's how you end up with a tab bar *plus* a hamburger *plus* a scenario picker — worse than today.

So the first-principles move is to assign each axis its own home based on frequency:

- **Section (Jump-to)** — most frequent, but it's not navigation at all. It's a symptom of an Overview page too long to scroll. Fix the page (collapsible sections, a sticky mini-index) and the axis disappears.
- **Page** — moderate frequency, bounded set. This is the only thing that belongs in a bottom bar, and only for 4–5 pages a borrower actually uses: Overview, Compare, Share, and a "More" that absorbs the conditional tabs.
- **Scenario** — infrequent but high-stakes. It's context, not navigation. It belongs in the header as a title-dropdown ("Loan – $1.5m ▾"), the way Mail shows the mailbox name.
- **Product** — rarest. A borrower on a share link never switches products. Bury it: wordmark tap, or the RealStack drawer only.

Note PricePoint already answered this correctly for itself: bottom bar = pages. Match it; don't invent a second grammar in the same shell.

The wrong question is "which chrome." The right one is "why does one screen need four switchers?"

## Peer reviews

(Anonymization mapping: A=Outsider, B=Executor, C=Contrarian, D=Expansionist, E=First Principles)

**Review 1 (general):**
1. Strongest: E. It names the actual problem (four orthogonal nav axes stacked in one list), assigns each a home by frequency, and lands on a concrete answer that matches PricePoint's existing grammar (bottom bar = pages only; scenario = header title-dropdown; product = wordmark; Jump-to = fix the page). A gets the borrower-language insight right but is a subset of E's structure.
2. Biggest blind spot: D. Putting the live monthly payment inside the tab bar and making Scenarios a first-class tab ignores that borrowers rarely switch scenarios, that a re-tap-active-tab gesture is undiscoverable, and that a "shared BottomBar for every product" is a platform rewrite dressed as a nav tweak. It also never addresses the 90px sticky-CTA collision C flags. B is close behind: "More opens the existing drawer" ships the hamburger under a new label, which C correctly calls out.
3. All five missed: Guided flow (borrowers on share links may have tabs locked progressively; nobody said what a bottom bar shows for a locked tab). LO client switching (BorrowerPicker/SidebarSwitcher) hand-waved into "More" by everyone; for the power user it's the most frequent action. Sticky CTA vs. tab bar is a binary conflict; only C raised it and no one resolved it.

**Review 2 (skeptic):**
1. Strongest: E. Only response that names the actual problem — four orthogonal switchers in one list — and assigns each a home by frequency while matching PricePoint's "bar = pages" grammar. B is the best execution plan, but B's "More" just relocates the hamburger; it works only as step one of E's design.
2. Biggest blind spot: D. Five tabs plus a live payment number in a 375px bar, a re-tap gesture nobody discovers, and "Scenarios" as a first-class tab when most borrowers have one scenario. A is a close second: it designs for borrowers only and hides the product switcher, breaking the explicit "everyone gets the same view" decision and stranding LOs.
3. All five missed: Keyboard occlusion (Blueprint is input-heavy, unlike PricePoint; a fixed bar rides up over the keyboard on Android and jitters on iOS). Header contention (E's scenario dropdown and the LO BorrowerPicker both want the header title slot). Android hardware back + Capacitor (drawer-close vs tab history is native-release behavior).

**Review 3 (achievable/reversible):**
1. Strongest: B. Only response with a reversible path: lift PricePoint's bar into a shared MobileTabBar, mount per appMode (settles the two-bar conflict structurally), point "More" at the existing drawer, delete the hamburger. Zero new state, one-day ship, and B correctly flags the real collision risk: the sticky payment CTA, not PricePoint. E supplies the better mental model and B's plan is compatible with it; do B first, then migrate scenarios to the header title-dropdown per E.
2. Biggest blind spot: D. Everything in it is a new build, none reversible, none reuses code, and "Scenarios as a tab" contradicts the fact that borrowers typically have 1 scenario. A adds a rename campaign that breaks LO muscle memory; C argues for paralysis.
3. All five missed: the tab bar's active state must survive the Guided flow (locked tabs dimmed, hidden, or trigger unlock?). Capacitor keyboard behavior with a form-heavy Overview. App Store screenshot regeneration, which Christo must do by hand in Xcode.

**Review 4 (end users: borrower + LO):**
1. Strongest: E. Only response that gives both audiences a coherent home for every nav axis — pages in the bar, scenario as header title-dropdown (LOs still switch fast, borrowers with one scenario see nothing), product buried, Jump-to solved by fixing the page. A converges on the same answer from the borrower's seat and is the best gut-check; B is the pragmatic ship path and should be the implementation of E, not a competitor.
2. Biggest blind spot: D. Live payment inside the bar and "re-tap Overview for the section index" are invisible affordances for a first-time borrower and collide with the fold C warns about. Elevates Scenarios to a tab for borrowers who have one — a button that does nothing.
3. All five missed: the Guided flow (locked tabs in a fixed bar either show dead buttons or reflow). The LO client switcher — the busiest LO action on mobile — waved into "More" by everyone; the header BorrowerPicker already exists and nobody said so. Desktop-to-mobile URL parity: deep links from shares must land on the right tab regardless of chrome.

**Review 5 (senior mobile designer / HIG):**
1. Strongest: E. Gets the taxonomy right in HIG terms: a tab bar is for peer top-level pages; product/scenario/section are different axes. Its assignments are the canonical patterns (scenario as header title-dropdown like Mail's mailbox; product under the wordmark; Jump-to solved by fixing the page) and align with PricePoint's "bar = pages" grammar. B is a close second for execution realism, but its "More opens the old drawer" is the anti-pattern C names.
2. Biggest blind spot: D. Scenarios in the bar violates tab-bar semantics (a context switch, not a destination); "re-tap active tab" is a discoverability trap Apple reserves for scroll-to-top; a live payment number inside the bar collides with 44pt touch targets and the 90px CTA.
3. All five missed: (a) Guided-flow gating: tab bars must not have disabled/appearing items, so borrowers in progressive unlock need a defined bar state. (b) Per-tab state retention: does switching tabs preserve scroll/section? (c) iOS 18+ adaptive tab bar guidance, and the sticky CTA's z-order/keyboard-avoidance with a fixed bar. (d) LO client picker relocation.

## Chairman's verdict

### Where the Council Agrees

- **Drop the hamburger drawer; add a bottom tab bar.** Four of five advisors (Outsider, Executor, Expansionist, First Principles) said yes outright. The Contrarian said "not yet," not "no."
- **The bar is for pages only.** First Principles named the real defect: the drawer stacks four orthogonal switchers (product, scenario, page, section) in one list. Every reviewer ranked this the strongest response. PricePoint already uses "bar = pages"; Blueprint should match that grammar, not invent a second one in the same shell.
- **Overview, Compare, Share are in the bar** in every proposal that named buttons. Nobody put Team, Settings, or a conditional tab in it.
- **Jump-to anchors are not navigation.** Outsider, First Principles, and Expansionist all said this is a symptom of an over-long Overview page.
- **Build one shared `MobileTabBar` mounted per `appMode`.** Executor and Expansionist converged on lifting PricePoint's existing bar; this settles the two-bar conflict structurally.
- **The sticky payment CTA, not PricePoint, is the real collision.** Executor and Contrarian both flagged the reserved 90px padding.

### Where the Council Clashes

**Ship via the old drawer vs. redesign first.** Executor wants "More" to open the existing drawer and delete the hamburger — a one-day, reversible ship. Contrarian and the HIG reviewer call that the hamburger under a new name. Both are right: it is the anti-pattern *and* the correct first commit, because the only expensive decision is whether the bar exists. Resolution: do Executor's step one, then migrate axes out of the drawer per First Principles.

**Scenarios as a bar tab.** Expansionist wants Scenarios first-class ("what borrowers play with"). Outsider, First Principles, and all five reviewers reject it: most borrowers have one scenario, so it's a dead button; a scenario is context, not a destination. Reasonable people disagree because LOs really do switch scenarios constantly — but the header title-dropdown serves them just as fast without taxing borrowers.

**Rename for borrowers.** Outsider wants "My Loan" instead of "Overview." The reversibility reviewer warns this breaks LO muscle memory. Minor; defer.

### Blind Spots the Council Caught

- **Guided flow.** No advisor said what a fixed bar shows for a locked tab. HIG rule: tab bars must not have items that appear/disable. This needs a defined state before shipping.
- **LO client switcher.** Every advisor waved it into "More." Reviewers noted it's the LO's most frequent mobile action, and that `BorrowerPicker` already lives in the header — nobody mentioned that.
- **Header contention.** First Principles' scenario dropdown and the LO BorrowerPicker both want the header title slot.
- **Keyboard occlusion.** Blueprint is input-heavy (unlike PricePoint); a fixed bar rides the keyboard on Android and jitters on iOS.
- **Android hardware back** under Capacitor: tab history vs. drawer close.
- **App Store screenshots** must be regenerated by hand in Xcode.
- **Deep-link parity**: share URLs must land on the right tab regardless of chrome.

### The Recommendation

**(1) Yes — switch to a bottom tab bar.** Lift PricePoint's bar into a shared `src/components/MobileTabBar.jsx`, mount it in the shell keyed on `appMode`, and delete the hamburger from `UnifiedHeader`.

**(2) Button set, four buttons plus More:**

**Overview · Compare · Share · Learn · More**

Homes for everything else:

- **Conditional Blueprint tabs** (Refi Summary, 3-Point Test, REO, Seller Net, Investor, Rent vs Buy, Prop 19, Pipeline, Team, Settings): inside **More**, which is a half-height bottom sheet listing only the tabs that apply to this loan and this role. Conditional items never enter the bar itself, so the bar is identical for every user.
- **Jump-to anchors**: removed from nav. Replace with a sticky section label at the top of Overview that opens a small section index on tap. Longer term, collapsible Overview sections make the index unnecessary.
- **Loan-scenario switcher**: header title-dropdown, Mail-mailbox style ("$1.5M purchase ▾"). Renders as plain text with no chevron when the user has exactly one scenario. The per-scenario ⋮ actions live inside that dropdown.
- **Product switcher** (Blueprint/PricePoint/Markets): tap the wordmark to open the existing RealStack umbrella drawer, which keeps the logo, product list, and theme toggle. That drawer stays; it just stops being page nav.
- **LO client picker**: stays in the header as `BorrowerPicker` — it already exists there. Resolve header contention by ordering the title as *client → scenario* for LOs (client name is the title, scenario the subtitle-dropdown) and scenario-only for borrowers.
- **Guided-flow locked tabs**: the bar always shows all five buttons. Tapping a locked one routes to the same gate the drawer uses today (unlock explainer), never a dead tap. No dimming, no reflow.
- **Sticky payment CTA**: it sits *above* the tab bar as a single 44pt row, and it collapses on scroll-down / reappears on scroll-up. Total fixed chrome stays under ~100px when scrolling. Do not put the live payment number inside the tab bar.

Also: hide the bar while any input has focus (fixes keyboard occlusion), map Android back to close sheets before navigating tabs, and plan to regenerate App Store screenshots in the same release.

### The One Thing to Do First

Extract PricePoint's bar into `MobileTabBar.jsx` with entries driven by `appMode`, mount it for Blueprint with Overview/Compare/Share/Learn/More where More opens the existing drawer, and delete the hamburger. Ship that, confirm on a real iPhone SE that the sticky CTA and bar don't stack over 100px, then start moving scenarios to the header.

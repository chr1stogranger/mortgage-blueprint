# Mortgage Blueprint — App Store Screenshot Spec v1

Deliverable: 5 screenshots for the US App Store listing, plus revised subtitle and What's New copy.
Goal: a stranger scrolling search results understands the app from image 1 alone, and each subsequent image sells one outcome.

---

## 1. Global Design System

Apply to all 5 screenshots so the set reads as one branded strip.

### Canvas
- Size: 1290 x 2796 px (iPhone 6.9"/6.7" display set; App Store Connect scales down for smaller devices)
- Format: PNG, sRGB, no transparency
- Safe margins: keep captions at least 90 px from top edge, device frame at least 60 px from side edges

### Background
- Base: brand indigo gradient. Top #4F5BF0, bottom #3A44C4 (sampled from your app icon family; adjust to exact brand hex)
- Alternate for screenshots 3 and 5: very light neutral #F4F5FB with indigo accents, so the strip alternates dark-light-dark and reads as designed, not repeated
- Subtle texture optional: 4% noise or a faint blueprint grid line pattern at 6% opacity. On-brand for the name. Do not exceed 6% or it fights the text.

### Caption typography
- Font: SF Pro Display Bold (or Inter Bold if building outside Apple tooling)
- Headline size: 96 to 110 px, 2 lines max, left-aligned or centered consistently across all 5 (pick one, recommend centered)
- Headline color: white on indigo backgrounds, #1A1D3D on light backgrounds
- Optional subline: SF Pro Regular, 44 px, 70% opacity, 1 line max. Use sparingly; screenshots 1 and 2 only.
- Numbers inside captions get accent color: #7EF0B2 (the green already used for cash-to-close in your UI) on dark, #16A34A on light

### Device treatment
- Use a minimal dark device frame (iPhone 16 Pro style, thin bezel) or frameless with a 40 px rounded-corner mask and soft shadow (0 40 px 80 px rgba(0,0,0,0.35))
- Device occupies roughly 70 to 78% of canvas width
- KEY RULE: the device is cropped, not shrunk. Bottom of the device runs off the bottom edge of the canvas in every shot. This creates the "pop" effect and lets the UI render large enough to read at thumbnail size.
- One element per screenshot floats OUTSIDE the device frame as a pulled-out chip (drop shadow, slight scale-up 1.15x). This is the guide's 3D effect. Specified per screenshot below.

### What to strip from every raw screenshot before compositing
- iOS status bar (time, signal, battery): remove or replace with clean mock status bar (9:41, full bars)
- Hamburger menu and header nav: crop out where possible
- The Pre-Qualified pill: keep it. It is quiet social proof.
- The stat strip (PRICE / PAYMENT / CASH CLOSE / DOWN / DTI): keep in screenshots 1 and 2 only, crop from the rest. It repeats and eats vertical space.

---

## 2. The Five Screenshots

Order matters. Apple shows roughly 2.5 screenshots in search results on iPhone. Screenshots 1 and 2 do 80% of the work.

---

### Screenshot 1 — The Payment Donut
**Caption:** Know the real payment. Not just the P&I.
**Subline:** Principal, interest, tax, insurance, HOA. All of it.
**Background:** indigo gradient (dark)

Composition:
- Source: donut chart screen (your current screenshot 1)
- Crop the device view to start just above the donut. Kill the nav bar and page dots.
- The donut with MONTHLY $4,793 must be the largest element on the canvas. Target: donut diameter roughly 55% of canvas width.
- Pull-out element: the Cash to Close chip ($173,149) floats outside the right edge of the device frame at 1.15x scale with shadow.
- Below donut, keep the 4-item legend (Principal / Interest / Tax / Insurance) but bump legend text so it is legible at thumbnail: minimum 34 px rendered.
- Payment breakdown table below may run off the bottom crop. Fine. It signals depth without needing to be read.

Thumbnail test: at 300 px wide, a viewer sees a big colorful ring, "$4,793," and the phrase "real payment." Pass.

---

### Screenshot 2 — Cash to Close
**Caption:** See every dollar to close. Before you offer.
**Subline:** Down payment, closing costs, prepaids. No surprises.
**Background:** indigo gradient (dark)

Composition:
- Source: Cash to Close Summary screen (your current screenshot 2/7)
- Crop device view to start at the green qualification checkmarks row (FICO / Down / DTI / Cash / Reserves). Those five green checks are doing quiet "you can do this" work. Keep all five.
- The CASH TO CLOSE SUMMARY card is the hero. The ESTIMATED CASH TO CLOSE $173,149 row must render at minimum 40 px.
- Pull-out element: the ESTIMATED CASH TO CLOSE total row, duplicated as a floating chip outside the left edge of the device, green number, 1.15x.
- This is your most differentiated feature versus every generic mortgage calculator. No competitor shows cash to close. Give it the number 2 slot.

---

### Screenshot 3 — Tax Savings
**Caption:** Owning could save you $11,521 a year.
**Subline:** none
**Background:** light neutral #F4F5FB

Composition:
- Source: Tax Savings screen (current screenshots 3 and 6)
- DELETE the federal bracket table entirely from this composition. It is illegible at thumbnail and reads as homework. It can live in the app; it dies on the store page.
- Crop the device view to show: the Before vs After cards (Year 1 orange card next to Year 2 green card) and the Total Annual Savings $11,521 / $960 per mo footer.
- Pull-out element: the Total Annual Savings footer card, floated below-right of the device frame, scaled 1.2x. The $960/mo figure is the emotional hook: it reads as "the government pays part of my mortgage."
- Caption number set in green accent #16A34A.
- Note: the $11,521 figure ties to a $300K income scenario visible on screen. That is fine for a Bay Area audience. Do not caption it as a promise; "could save" keeps it compliant with the educational-tool disclaimer.

---

### Screenshot 4 — Payoff Acceleration
**Caption:** Pay $300 extra. Finish 67 months early.
**Subline:** none
**Background:** indigo gradient (dark)

Composition:
- Source: Equity / extra payment screen (current screenshots 5 and 6, right panel)
- Crop device view to show: Monthly Extra Payment input ($300), the Interest Saved / Time Saved card, and the payoff chart.
- Pull-out elements (two, small): "Save $167,837" chip and "67 months saved" chip, floating stacked outside the right edge, green text.
- This is the single most emotionally resonant screen in the app. Every homeowner fantasizes about this. The caption is the entire pitch; the screen just proves it.

---

### Screenshot 5 — Learn + PricePoint
**Caption:** Learn the loan game. Then play it.
**Subline:** Guides from a working loan officer. Plus a daily price challenge.
**Background:** light neutral #F4F5FB

Composition:
- Source: Learn tab (current screenshot 5, right panel) and, if you can capture it, one PricePoint gameplay frame
- Layout: two device frames side by side, each at 48% width, both cropped at bottom. Left: Learn tab showing "VA Loans: The Best Loan in America" and "How Mortgage Rates Work" rows. Right: PricePoint daily challenge screen.
- If PricePoint cannot produce a clean capture, run Learn solo and change caption to: Learn what lenders really look at.
- PricePoint earns its slot because it is the retention feature. A daily challenge is the reason the app stays on the home screen for the 6 months between "just looking" and "writing offers." Screenshot 5 is where returning browsers land, so retention features belong here.

---

## 3. Production Workflow

Option A (fast, recommended): Figma
1. Create 1290 x 2796 frames, 5 of them, using the system above.
2. Drop in raw screenshots, mask to rounded rect, apply shadow.
3. Duplicate pull-out elements as cropped layers, scale 1.15x, add shadow.
4. Export PNG 1x.
Free community templates: search Figma Community for "App Store screenshots 6.9" and use any recent template as scaffolding.

Option B (no design tool): AppScreens, Screenshots.pro, or AppMockUp
Upload raws, pick a caption template, set brand colors. Faster, less control over pull-out elements.

Option C: give this spec plus the raw PNGs to an AI image tool or a Fiverr designer. The spec is written to be executable by someone who has never seen the app.

Upload: App Store Connect > your app > version > App Previews and Screenshots > 6.9" display. One size set is sufficient; Apple downscales.

---

## 4. Companion Copy Changes (ship in the same update)

### Subtitle (30 char limit)
Current: Smarter mortgage scenarios
Replace with: Payment Calculator & Rates
(26 chars. Adds the two highest-volume keywords you do not own: calculator, rates. No word repeats from the title per ASO best practice.)

### What's New (next release)
Current copy leads with a bug fix. Replace pattern:

> NEW: PricePoint. Guess the sold price of real homes in a daily challenge. Live sold-price scoring, free play mode, and streaks.
> Plus: faster load times and polish throughout.

Lead with the feature, demote the fix to one line.

### Description, add one block after FULL AMORTIZATION SCHEDULE:

> PRICEPOINT DAILY CHALLENGE
> Think you know the market? Guess the sold price of real homes and get scored against actual closing data. A new challenge every day.

---

## 5. Review Sprint (do before the screenshot update ships)

Screenshots convert browsers; ratings get browsers to look. Current count: 2.
- Text 10 past clients and 5 realtor partners personally. One line: "I built a free mortgage app, would mean a lot if you left it a quick rating: [App Store link]"
- Target: 15+ ratings before the new screenshots go live, so the improved page converts against a 5.0 with real volume.
- In-app: trigger SKStoreReviewController after a user views an amortization schedule or completes a PricePoint round (peak-value moments). Apple caps prompts at 3 per year per user; these two triggers are enough.

---

## 6. Definition of Done
- [ ] 5 composited PNGs at 1290 x 2796 uploaded to App Store Connect
- [ ] Every caption legible at 300 px thumbnail width
- [ ] Screenshot 1 passes the stranger test: ring, $4,793, "real payment" readable in search results
- [ ] Subtitle swapped
- [ ] What's New rewritten for next release
- [ ] 15+ ratings live

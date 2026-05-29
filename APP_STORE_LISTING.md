# Mortgage Blueprint — App Store Listing Copy

Paste each field below into App Store Connect → your app → the **iOS App** version page and **App Information**. Character limits are noted; everything here is within Apple's limits. Audience: homebuyers **and** real estate agents.

---

## App Information (set once, applies to all versions)

**Name** (30 char max)
```
Mortgage Blueprint
```
> If "Mortgage Blueprint" is rejected as already taken, use: `Mortgage Blueprint by Xpert`

**Subtitle** (30 char max — 26 used)
```
Smarter mortgage scenarios
```

**Category**
- Primary: **Finance**
- Secondary (optional): **Business**

**Age Rating:** run the questionnaire, answer "None" to everything → results in **4+**.

---

## Version Information (the 1.0 page)

**Promotional Text** (170 char max — editable anytime without a new review)
```
See the full cost of any home purchase in seconds: payment breakdowns, side-by-side loan comparisons, tax-savings estimates, and a complete amortization schedule.
```

**Description** (4000 char max)
```
Mortgage Blueprint turns a home price into a complete financial picture in seconds. Whether you're a homebuyer trying to understand what you can truly afford or a real estate agent running numbers for a client on the spot, Blueprint gives you the full breakdown — not just a single payment figure.

Enter a purchase price, down payment, and interest rate, and instantly see where every dollar goes.

MONTHLY PAYMENT BREAKDOWN
See your full PITI payment broken into principal and interest, property taxes, homeowner's insurance, mortgage insurance, and HOA dues — so there are no surprises at closing.

COMPARE LOANS SIDE BY SIDE
Put two or more scenarios next to each other and see exactly how a different rate, term, or down payment changes the monthly payment and long-term cost.

TAX SAVINGS ESTIMATE
Get a quick estimate of the potential tax benefit from mortgage interest and property taxes, so you can weigh the real, after-tax cost of owning.

FULL AMORTIZATION SCHEDULE
Watch how your balance is paid down over the life of the loan, month by month and year by year, and see how much interest you'll pay over time.

PURCHASE AND REFINANCE
Model a new purchase or a refinance and understand the trade-offs of each.

BUILT FOR THE FIELD
Fast, clean, and optimized for your phone — designed for agents who need answers in front of clients and buyers who want to explore options anywhere.

Every calculation runs right on your device. No account, no sign-up, no waiting — open the app and start running numbers.

Mortgage Blueprint is an educational planning tool. Estimates are for illustration only and are not a loan offer, commitment to lend, or financial advice. Actual rates, payments, and costs depend on your lender, credit, and final loan terms.
```

**Keywords** (100 char max, comma-separated, no spaces — 95 used)
```
mortgage,calculator,loan,refinance,payment,home,amortization,FHA,rate,escrow,PITI,realtor,buyer
```

**Support URL** (required)
```
https://realstack.app
```

**Marketing URL** (optional)
```
https://blueprint.realstack.app
```

---

## App Privacy (App Privacy section — required before submitting)

**Privacy Policy URL** (required)
```
https://blueprint.realstack.app/privacy.html
```

**Data collection — confirmed app behavior:** The native build runs calculator + live FRED rates + PricePoint (RapidAPI listings). It has **no account, no login, and no analytics/tracking SDK.** The only data that leaves the device are anonymous API requests: a rate lookup to FRED and a zip-code lookup to RapidAPI for PricePoint. No name, email, account, or device identifier is sent, and you (the developer) don't retain anything.

**Recommended answer: "Data Not Collected."** Rationale: Apple's "collect" means transmitting data off-device that you or a partner *retain/use*. Your app sends no user identifiers — just an anonymous rate request and a zip code — and stores nothing on your servers. An IP address incidental to an HTTPS request is connection metadata, not "collected." This is the standard, defensible choice for a no-account calculator that uses a weather/rate-style API.
> Note: I'm not a lawyer. If you'd rather be maximally conservative, you can instead declare **"Usage Data → Product Interaction,"** marked **not linked to the user** and **not used for tracking** — over-declaring is never penalized by Apple, only under-declaring is. Either answer is acceptable; "Data Not Collected" is cleaner and accurate for this build.

---

## App Review Information (bottom of the version page)

**Sign-in required?** → **No**  ← the single most important answer; it removes the demo-account blocker.

**Contact Information**
- First name: Christopher
- Last name: Granger
- Email: chr1stogranger@gmail.com
- Phone: (add your phone number directly in the form)

**Notes for Reviewer** (paste verbatim)
```
Mortgage Blueprint is a standalone mortgage calculator for homebuyers and real estate agents. No login or account is required — the app opens directly into the calculator. To test: enter a purchase price (e.g. $750,000), a down payment (e.g. 20%), and an interest rate (e.g. 6.5%) to see a full monthly payment breakdown (principal, interest, taxes, insurance, MI, HOA), side-by-side loan comparisons, a tax-savings estimate, and a complete amortization schedule. The app also displays current mortgage rate data and includes PricePoint, an optional real-estate price-guessing feature for fun (no prizes, no wagering). The "Markets" tab is a preview of an upcoming feature and is non-functional in this version: it offers no real-money trading, wagering, payouts, or in-app purchases. All calculations run on-device. This is an educational planning tool and does not collect user data or make loan offers.
```

---

## Pre-fill numbers for screenshots
Use a realistic scenario so screenshots show real figures, not zeros:
- Purchase price: $750,000
- Down payment: 20% ($150,000)
- Rate: 6.5%
- Term: 30-year fixed

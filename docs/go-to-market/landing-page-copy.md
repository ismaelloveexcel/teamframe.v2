# Landing Page Copy (draft)

Copy-ready content for the public landing page. **Not yet built** — TeamFrame
ships as an authenticated app with no public marketing route. This is structured
so it can be dropped into a real marketing site later (see "Future public site"
at the end). Tone: premium, simple, founder-friendly. No legal-advice claims.
Avoid: "calm directory", "HRIS", "automated HR", "self-serve", "AI", "payroll".

---

## 1. Hero

**Headline:** Know what's about to break in your team — before it does.

**Subheadline:** TeamFrame watches contracts, documents, onboarding and
offboarding, flags every people-ops risk, and gives founders a clear action
list. Set up and run for you in 72 hours.

- **Primary CTA:** Book a setup call
- **Secondary CTA:** View the managed service

---

## 2. Problem

You're running a team of 6–25 with no HR person. People-ops lives in your head,
a few spreadsheets, and a shared drive. Contracts lapse. Documents go missing.
Onboarding is improvised. Someone leaves and access lingers for weeks. Nothing is
on fire — until it is, usually at the worst possible moment (a raise, due
diligence, a dispute).

The problem isn't that you're careless. It's that no one is watching the dials.

---

## 3. What TeamFrame watches

- **Contracts & documents** — what exists, what's missing, what's out of date.
- **Onboarding** — every new hire set up properly *before* day one.
- **Offboarding** — clean exits: assignments ended, positions vacated, nothing
  left dangling.
- **Org structure** — who reports to whom, which roles have no owner.
- **People-ops risk signals** — surfaced as a clear, ranked list.

It's the check-engine light for your people operations: always on, watching the
things you don't have time to.

---

## 4. Risk → fix → proof

1. **Risk** — TeamFrame surfaces what's wrong or about to be: expiring documents,
   undocumented roles, incomplete onboarding, lingering access after exits.
2. **Fix** — each signal comes with a clear action. We run the fixes with you in
   the weekly review, not just a dashboard that nags you.
3. **Proof** — resolved items move to done, and you get exports for due diligence
   and finance handoff. You can show, on paper, that it's handled.

---

## 5. The managed service

TeamFrame is set up and run **for** you — it is not software you have to learn.

- **72-hour done-for-you setup**: we provision your workspace and load your team
  and documents. You configure nothing.
- **Weekly risk review** by a named operator.
- **Weekly risk summary** of what's open, by email.
- **Monthly review call** and light people-ops advisory within agreed limits.
- **One offer:** USD 2,500 setup + USD 2,000/month, 3-month minimum.
  (Founding pilot for the first 3 clients: USD 1,000 setup + USD 1,500/month.)

→ Full details: [`pricing-and-packages.md`](./pricing-and-packages.md)

---

## 6. Who it's for

Founder-led teams of **6–25** with no dedicated HR person — typically actively
hiring, post-seed/Series A, or structurally informal (roles and ownership live in
the founder's head). You want the risks visible and handled without hiring a
full-time HR lead.

---

## 7. What it is not

- Not payroll.
- Not a recruiting/ATS tool.
- Not performance reviews or comp benchmarking.
- Not a full HRIS with dozens of modules.
- Not legal advice — TeamFrame flags risk; it does not advise on law.
- Not self-serve software — it's set up and run for you.

---

## 8. Closing CTA

**Headline:** See what's about to break — before your next hire.

- **Primary CTA:** Book a setup call
- **Secondary CTA:** View the managed service

---

## CTA copy reference

| Use | Label |
|---|---|
| Primary | Book a setup call |
| Secondary | View the managed service |

Both CTAs are **operator-led**: "Book a setup call" routes to a scheduling link /
contact, **not** a signup form. There is no self-serve purchase or checkout.

---

## Future public site (flagged, not built now)

When a public marketing surface is built, it should:

- Live **outside** the authenticated SPA (separate static site or a public route
  that does not touch the app's auth/routing) — do not add a public marketing
  page inside the product app.
- Implement sections 1–8 above as static pages/components.
- Wire both CTAs to a scheduling link (e.g. Cal.com/Calendly) — never a signup
  form; provisioning stays operator-led.
- Reuse the app's Tailwind tokens for visual consistency, but stay deliberately
  simple (premium, founder-friendly, not over-designed).
- Carry a footer line: "TeamFrame is not legal advice."
- **Not** add: self-serve signup, Stripe checkout, pricing calculators, an AI
  chatbot, or any automated tenant provisioning.

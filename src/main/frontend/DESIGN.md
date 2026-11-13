# JobPortal design direction

The product makes three promises: **every listing is real, shows its pay, and answers you.**
The interface exists to make those three things visible. Anything that does not serve one of
them, or a task the user came to do, is decoration and should go.

## Why the previous design read as static

Observed in the "before" screenshots (`design-audit/before/`):

- Half of most pages was empty ground: a text-only hero, three boxed numbers, then nothing.
- Every surface was the same white box with the same hairline; nothing was more important than anything else.
- Tracked-out uppercase monospace labels and "A · B · C" strings carried all the metadata.
- The product's own idea (the employer must answer within 14 days) appeared only as a sentence of grey text.
- No company identity on a job, no progress on an application, no motion in response to anything.
- On phones, navigation hid behind a menu button and job rows were very tall.

## The one memorable thing: the response clock

`<ResponseClock>` draws one tick per day of the employer's 14-day window. It is the wordmark's
mark, the home hero's demonstration, the seeker's application row and the employer's queue.
Marigold (`--jp-signal`) means **time** and is used for nothing else. Spend boldness here; keep
everything around it quiet.

## Tokens (all in `src/styles/tokens.css`; never hard-code a colour, size, radius or duration)

| Role | Token | Value |
|---|---|---|
| Page ground | `--jp-ground` | warm paper `#faf9f7` |
| Surface | `--jp-surface` | `#ffffff` |
| Ink | `--jp-ink` | `#1a1815` |
| Action / active | `--jp-accent` | deep teal `#0f6e68` |
| Time / deadline | `--jp-signal` | marigold `#e9a820` |
| Dark band | `--jp-band` | green-black `#12211f` (hero, sign-in panel, footer only) |

Type: **Archivo** set wide and heavy for `.jp-display` / `.jp-h1` and KPI numbers
(`font-stretch: var(--jp-display-stretch)`); **IBM Plex Sans** for everything else;
**IBM Plex Mono** (`.jp-data`) only for money and counts in columns.

## Rules

1. No gradients, no emoji, no card shadows (the only shadow belongs to the modal), no uniform rounding.
2. No uppercase tracked labels. `.jp-label` is a small sentence-case heading; use it only where a group of facts needs a name.
3. No "A · B · C" strings. Use `<Facts>` / `<Fact icon>`; each fact is its own element.
4. Do not box every block. Prefer ruled strips, whitespace and type weight; a bordered surface means "this is one object" (a list, a table, a form).
5. No arrows appended to link or button text. Buttons say what happens: "Apply", "Save changes", "Reject".
6. Motion answers an action (press, open, confirm, status change). The only unprompted motion is the clock filling once. Honour `prefers-reduced-motion` (the duration tokens already collapse to 0).
7. Left-aligned content. Line length under 75 characters for prose.
8. Fill the viewport with useful content, not padding: if a page is half empty at 1440px, it is missing information the user needs.
9. Phones: the bottom tab bar is the navigation; content must not sit under it (the shell already pads for it). Touch targets at least 40px.
10. Accessibility floor: visible focus (already global), labels on every control, colour never the only cue, `aria-live` for async results, headings in order.
11. Copy is plain and specific. Empty states say what to do next. Errors say what happened.

## Shared primitives (do not re-implement; import them)

From `src/components/ui` (index.jsx): `Button` (variants `primary | secondary | ghost | danger`, sizes `sm | lg`, `block`),
`IconButton`, `Field`, `Input`, `Textarea`, `Select`, `Badge` (tones `neutral | accent | success | warning | danger`),
`Card`, `CardHead`, `CardBody`, `Skeleton`, `EmptyState`, `Modal`, toast via `useToast()`.

From `src/components/ui/kit` (kit.jsx):

- `ResponseClock({ appliedAt, respondBy, respondedAt, status, size })` — sizes `sm | lg`.
- `StageTrack({ status, reached })` — Applied → Reviewed → Interview → Offer → Hired, with endings.
- `Monogram({ name, src, size })` — company mark; sizes `sm | lg`.
- `Facts` / `Fact({ icon, strong })` — metadata rows.
- `Proofs({ verified, salaryShown, responsiveness })` — the three promises as facts.
- `StatGroup` / `Stat({ label, value, hint, tone })` — a ruled KPI strip.
- `SegmentBar({ segments, label })` — share bar with legend.
- `PageHead({ title, sub, children })`.
- `.jp-on-band` — class for a dark full-width surface; clock and proofs adapt inside it.

Other existing pieces: `JobRow`, `SalaryPanel`, `ApplicationTimeline`, helpers in `src/lib/format.js`
(`salaryRange`, `lakhs`, `relativeDate`, `fullDate`, `daysUntil`, `statusTone`, `titleCase`, `jobTypeLabel`).

## Verifying

`npm run shots -- --base http://localhost:<port> --out design-audit/after [--only <name>]` captures every
page at desktop, tablet and phone with a mocked API (`e2e/shots.mjs`, `e2e/fixtures.mjs`). Look at the
PNGs. `npx eslint src` must report 0 errors and `npx vite build` must pass.

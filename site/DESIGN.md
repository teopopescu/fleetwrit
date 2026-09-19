---
name: Fleetwrit
description: The office of record for machine actions — a signed, tamper-evident register of who authorised what.
colors:
  ultramarine-ink: "#2b27a6"
  deep-ultramarine: "#201d84"
  ultramarine-wash: "#eceaf6"
  record-red: "#b3261e"
  verify-green: "#1c6b49"
  held-amber: "#93611a"
  bond-paper: "#f7f8f5"
  register-band: "#eceeea"
  raised-slip: "#fdfdfb"
  ink-black: "#15171c"
  secondary-ink: "#474b53"
  caption-grey: "#61656d"
  hairline: "#dcded5"
  hairline-strong: "#c8cabf"
typography:
  display:
    fontFamily: "'Instrument Serif', Georgia, 'Times New Roman', serif"
    fontSize: "clamp(2.7rem, 6.2vw, 4.5rem)"
    fontWeight: 400
    lineHeight: 1.02
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "'Instrument Serif', Georgia, 'Times New Roman', serif"
    fontSize: "clamp(2rem, 4.4vw, 2.9rem)"
    fontWeight: 400
    lineHeight: 1.05
    letterSpacing: "-0.01em"
  title:
    fontFamily: "'Instrument Serif', Georgia, 'Times New Roman', serif"
    fontSize: "1.25rem"
    fontWeight: 400
    lineHeight: 1.05
    letterSpacing: "-0.01em"
  body:
    fontFamily: "'Public Sans', system-ui, -apple-system, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  label:
    fontFamily: "'Spline Sans Mono Variable', ui-monospace, 'SF Mono', Menlo, monospace"
    fontSize: "0.68rem"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "0.08em"
    fontFeature: "'tnum'"
rounded:
  record: "4px"
  slip: "6px"
spacing:
  gutter: "clamp(1.15rem, 4vw, 3rem)"
  section: "clamp(3.5rem, 8vw, 6rem)"
  card: "1.6rem"
components:
  button-primary:
    backgroundColor: "{colors.ultramarine-ink}"
    textColor: "#ffffff"
    typography: "{typography.body}"
    rounded: "{rounded.record}"
    padding: "0.85rem 1.45rem"
  button-primary-hover:
    backgroundColor: "{colors.deep-ultramarine}"
    textColor: "#ffffff"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-black}"
    rounded: "{rounded.record}"
    padding: "0.85rem 1.45rem"
  button-light:
    backgroundColor: "#ffffff"
    textColor: "{colors.ink-black}"
    rounded: "{rounded.record}"
    padding: "0.85rem 1.45rem"
  stamp-chip:
    backgroundColor: "transparent"
    textColor: "{colors.verify-green}"
    typography: "{typography.label}"
    rounded: "{rounded.record}"
    padding: "0.2rem 0.5rem"
  card:
    backgroundColor: "{colors.raised-slip}"
    rounded: "{rounded.slip}"
    padding: "{spacing.card}"
  input:
    backgroundColor: "{colors.bond-paper}"
    textColor: "{colors.ink-black}"
    typography: "{typography.body}"
    rounded: "{rounded.record}"
    padding: "0.62rem 0.72rem"
---

# Design System: Fleetwrit

## Overview

**Creative North Star: "The Office of Record"**

Fleetwrit looks like a document register, not a dev-tool SaaS page. The surface is cool bond paper ruled by hairlines; content is set as records — numbered, dated, referenced — in a single serif display face over a plain UI sans, with every figure struck in tabular monospace. State is never a coloured pill; it is a struck mark. One ultramarine ink carries every action, link and the engraved seal. Depth is almost entirely refused: surfaces sit flat on the paper, separated by 1px rules, and exactly one instrument on the page is lifted.

The world deliberately rejects two category defaults: the bright dev-tool page (sky gradients, pastel card kits, eyebrows over headings, pill-everything) and its neon-terminal opposite. Restraint is the mechanism of credibility — colour is spent on one element, the type system is one display face plus one UI face plus one data face, and the page reads like something an auditor would accept.

The signature is the playable certificate: the hero instrument opens as a pending approval request and, on a press, is struck with an ultramarine seal into a certificate of authorisation carrying a signed-receipt fingerprint and a Verify control. Fingerprints, sequence numbers and timestamps are first-class typographic material, never decoration.

**Key Characteristics:**
- Bond-paper ground, ink text, one ultramarine accent, three stamp inks used only on struck marks.
- Hairline rules instead of shadows; a single lifted instrument.
- Near-square 4px corners; records are squared, never pill-shaped.
- One serif display face, one UI sans, one tabular mono for all data.
- State shown as a struck stamp-chip, not a coloured fill.

## Colors

A cool paper-and-ink palette: near-neutral grounds, ink-black text, one saturated ultramarine, and three desaturated stamp inks held in reserve.

### Primary
- **Ultramarine Ink** (#2b27a6): The only accent. Carries buttons, links, the seal, the brand mark, section index numbers, and code highlights. Used sparingly — actions and marks, not fields of colour.
- **Deep Ultramarine** (#201d84): Hover/pressed state for ultramarine actions and links on paper.
- **Ultramarine Wash** (#eceaf6): A faint accent tint, used rarely for tinted fills.

### Secondary
Stamp inks. These appear only on struck marks — stamp-chips, seal ticks, roadmap dots, flags — never as surface fills or body text.
- **Record Red** (#b3261e): Record / critical / rejected.
- **Verify Green** (#1c6b49): Verified / approved / open.
- **Held Amber** (#93611a): Held / pending / flagged.

### Neutral
- **Bond Paper** (#f7f8f5): The page ground.
- **Register Band** (#eceeea): Alternating section band (`.section--soft`) and slip headers.
- **Raised Slip** (#fdfdfb): Card, panel, form and listing surfaces sitting on the paper.
- **Ink Black** (#15171c): Headings, key data, the dark footer CTA block.
- **Secondary Ink** (#474b53): Body copy and decks.
- **Caption Grey** (#61656d): Captions, labels, notes; holds ≥4.5:1 on paper.
- **Hairline** (#dcded5): The default 1px rule between records and sections.
- **Stronger Hairline** (#c8cabf): Heavier 1px rule for card borders and register heads.

### Named Rules
**The One Ink Rule.** Exactly one accent exists — ultramarine. If a surface needs a second "colour," it is wrong; reach for a rule, a weight, or a stamp mark instead.

**The Struck-Mark Rule.** Record-red, verify-green and held-amber never fill a shape or set body text. They colour only a struck mark: a stamp-chip, a tick, a seal, a status dot.

## Typography

**Display Font:** Instrument Serif (with Georgia, Times New Roman fallback)
**Body/UI Font:** Public Sans (with system-ui fallback)
**Data/Mono Font:** Spline Sans Mono (with ui-monospace fallback)

**Character:** A single-weight serif at architectural scale gives headings a printed, institutional authority; Public Sans keeps UI plain and legible; Spline Sans Mono sets every registered figure in tabular columns. The pairing reads like an official document, not an app.

### Hierarchy
- **Display** (400, clamp(2.7rem, 6.2vw, 4.5rem), line-height 1.02, tracking -0.01em): Hero headline only. Text-wrap balanced.
- **Headline** (400, clamp(2rem, 4.4vw, 2.9rem), line-height 1.05): Section titles. Max ~20ch.
- **Title** (400, 1.25rem–1.6rem, line-height 1.05): Step verbs, plan names, panel/doc entry titles, the certificate action line.
- **Body** (400, 1.0625rem, line-height 1.6): Decks and copy in Public Sans; secondary copy drops to 0.9375rem. Decks capped near 42–46ch.
- **Label** (500, 0.68rem, tracking 0.08em, uppercase, tabular): Spline Sans Mono for stamps, register heads, kickers, receipt labels, table headers.

### Named Rules
**The Tabular Figures Rule.** Every number that is a record — sequence numbers, timestamps, ids, fingerprints, prices, counts — is set in Spline Sans Mono with `font-feature-settings: 'tnum'` / tabular-nums so columns align.

**The Single-Weight Display Rule.** Instrument Serif ships one weight (400) with `font-synthesis: none`; never faux-bold it. Emphasis at display scale comes from size and tracking, not weight.

## Layout

Content lives in a centred column, `max-width: 1160px` (narrow variant 880px), with a fluid `gutter` (clamp(1.15rem, 4vw, 3rem)). Sections carry vertical rhythm of `clamp(3.5rem, 8vw, 6rem)`; alternating sections use the Register Band ground bordered top and bottom by a hairline. Section heads cap at 52rem and pair a serif title with a caption-grey mono register line where used.

The grid model is the register: rows and columns are separated by 1px hairlines rather than gaps or cards — the problem ledger, how-it-works steps, dashboard panels, the boundary table, trust columns and docs grid are all ruled tables. The hero is a two-column grid (~1.06fr / 0.94fr) with a hairline drawn down the gutter. Grids collapse to one column at 900px (620–820px for the denser tables/plans). Sticky masthead (66px) and a sticky code listing (top: 88px) on wide viewports.

## Elevation & Depth

Nearly flat by construction. Depth is carried by hairline rules and the Register Band, not by shadows. `--shadow-sm` is literally `none`; panels and cards sit flat on the paper with a 1px border.

### Shadow Vocabulary
- **The lifted instrument** (`box-shadow: 0 22px 55px -26px rgba(21, 23, 40, 0.42)`): One crisp, deep, tight shadow reserved for the single hero certificate (`.crt`). It is the only lifted object on the page.
- **Hairline shadow** (`box-shadow: 0 1px 2px rgba(21, 23, 28, 0.06)`, token `--shadow`): Defined but effectively unused; if ever applied it is a whisper, not a pillow.

### Named Rules
**The One Lifted Object Rule.** At most one element on any screen carries a shadow — the hero instrument. Everything else is flat on paper, separated by 1px rules. No pillow shadows anywhere.

## Shapes

Records are squared, not rounded. Corners are near-square: 4px (`--r`, the default for buttons, chips, inputs, tags) and 6px (`--r-lg`, for larger slips — cards, panels, listings, the form, the footer CTA block). The pill radius is deliberately aliased to 4px (`--r-pill: 4px`) so nothing reads as a pill. Borders are 1px hairlines (`--line` / `--line-2`); dotted and dashed rules appear as record devices (the certificate's dotted leaders, the partner CTA's dashed perforation frame). Solid buttons carry an inset struck double-frame (`inset: 3px` translucent white border); the seal is a concentric engraved ring with a 60-tick rosette.

## Components

### Buttons
- **Shape:** Squared, 4px corners (`--r`). Solid buttons carry an inset 3px struck double-frame in translucent white.
- **Primary:** Ultramarine fill (#2b27a6), white text, 1px ultramarine border, `padding: 0.85rem 1.45rem`, weight 600, tracking 0.01em. Hover → Deep Ultramarine (#201d84).
- **Ghost:** Transparent, ink text, `--line-2` border; hover fills to Raised Slip and darkens border to ink, revealing an inset hairline frame.
- **Light:** White fill / ink text, for the dark footer CTA block; hover to #eceee9.
- **Quiet:** Borderless underlined text link (secondary-ink), 3px underline offset in `--line-2`; hover to ultramarine.
- **Partner CTA:** A sealed, perforated pass — a 15px concentric-seal glyph before the label (`::before` masked SVG) and a dashed perforation frame (`::after`, `inset: 4px`, dashed, 0.4 opacity). Used only for the design-partner action.

### Chips (Stamp chips)
- **Style:** Struck mark, not a fill. Transparent background, 1px border in `currentColor`, uppercase Spline Sans Mono (0.68rem, tracking 0.08em), 4px corners, a 5px square swatch before the label.
- **State:** Colour set by `currentColor` — Verify Green (available/open), Ultramarine (next/accent), Caption Grey (planned/muted), Record Red (risk/rejected), Held Amber (held). The dashboard `.chip--ok` variant is the one filled exception (mint tint, green text).

### Cards / Containers
- **Corner Style:** 6px (`--r-lg`).
- **Background:** Raised Slip (#fdfdfb) on the paper ground.
- **Shadow Strategy:** Flat — no shadow (see Elevation). Depth is the 1px border only.
- **Border:** 1px `--line-2` (or `--line` for interior rules).
- **Internal Padding:** ~1.6rem–1.7rem. The feature plan inverts to an ultramarine fill with light text.

### Inputs / Fields
- **Style:** Bond-paper fill, 1px `--line-2` border, 4px corners, Public Sans; labels are 0.8125rem weight-600 secondary-ink.
- **Focus:** Border shifts to ultramarine (`outline: none` on the field; global `:focus-visible` draws a 2px ultramarine outline offset 2px).

### Navigation
- **Style:** Sticky 66px masthead, translucent bond-paper background (`color-mix`) with `saturate(130%) blur(10px)` backdrop, 1px bottom hairline. Links in secondary-ink Public Sans weight-500 (0.9375rem), hover to ink. Plain nav links hide below 900px; the partner CTA persists. Brand mark is an ultramarine ticked-box glyph beside the serif wordmark.

### Signature — The Playable Certificate (`.crt`)
The hero instrument and the one lifted object. Opens `is-pending` as an "Approval request" (amber state), showing a ruled action, dotted-leader rows (change / reason / approvers), and reviewer avatars. Approve → `is-approved`: an ultramarine engraved seal is struck in (`thwack`/`bloom` keyframes), the header flips to "Certificate of authorisation" (green), and a signed-receipt footer prints up (`printup`) carrying a real fingerprint hash and a Verify control that resolves to "Chain intact" in verify-green. Reject → `is-rejected`: red header wash, held note. All animation is gated behind `prefers-reduced-motion`.

## Do's and Don'ts

### Do:
- **Do** spend colour on one element — the One Ink Rule. Ultramarine for actions, links, marks; everything else is ink on paper.
- **Do** set every record figure (ids, sequence numbers, timestamps, fingerprints, prices) in Spline Sans Mono with tabular figures.
- **Do** separate content with 1px hairlines and the Register Band; build tables and lists as ruled registers.
- **Do** show state as a struck stamp-chip (bordered, mono, uppercase, currentColor), not a coloured fill.
- **Do** keep corners squared (4px records, 6px slips).

### Don't:
- **Don't** add shadows to more than the one hero instrument; no pillow shadows, no card lift.
- **Don't** faux-bold Instrument Serif or request weights it doesn't ship — it is single-weight 400 with `font-synthesis: none`.
- **Don't** use pill radii or round chips; records are squared.
- **Don't** fill shapes or set text in record-red, verify-green or held-amber — those inks belong to struck marks only.
- **Don't** introduce a second accent hue, a gradient, or a pastel card kit.

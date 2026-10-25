---
name: Planejador WiFi
description: The floor plan is the protagonist; the Wi-Fi heat map lives on it, and the interface stays quiet around it.
colors:
  drafting-blue: "#2F43C4"
  drafting-blue-soft: "rgba(47, 67, 196, .12)"
  on-drafting-blue: "#FFFFFF"
  desk-gray: "#E7EAEE"
  plan-paper: "#FBFCFD"
  panel-mist: "#F3F5F8"
  graphite-ink: "#1B222C"
  pencil-gray: "#5A6473"
  hairline: "#C8CFD8"
  grid-faint: "#E1E6EC"
  grid-major: "#C9D1DA"
  alert-red: "#B42335"
  signal-excellent: "#1A9850"
  signal-good: "#86C65A"
  signal-fair: "#EFC23F"
  signal-weak: "#EE8547"
  signal-none: "#D33343"
  wall-brick: "#9C4A2C"
  wall-concrete: "#555D69"
  wall-drywall: "#97A0AC"
  wall-wood: "#A26B22"
  wall-glass: "#2A8FBA"
  wall-metal: "#1F242B"
  drafting-blue-dark: "#8D9BFF"
  on-drafting-blue-dark: "#10131A"
  desk-gray-dark: "#101419"
  plan-paper-dark: "#171C23"
  panel-mist-dark: "#141920"
  graphite-ink-dark: "#E5E9EF"
  pencil-gray-dark: "#98A2B1"
  hairline-dark: "#2C3440"
  alert-red-dark: "#FF7A88"
typography:
  display:
    fontFamily: "Barlow Semi Condensed, Arial Narrow, Arial, sans-serif"
    fontSize: "clamp(24px, 3vw, 32px)"
    fontWeight: 700
    lineHeight: 1.15
  headline:
    fontFamily: "Barlow Semi Condensed, Arial Narrow, Arial, sans-serif"
    fontSize: "26px"
    fontWeight: 700
    lineHeight: 1.15
  title:
    fontFamily: "Barlow Semi Condensed, Arial Narrow, Arial, sans-serif"
    fontSize: "17px"
    fontWeight: 700
    lineHeight: 1.15
  metric:
    fontFamily: "Barlow Semi Condensed, Arial Narrow, Arial, sans-serif"
    fontSize: "40px"
    fontWeight: 700
    lineHeight: 1
    fontFeature: "\"tnum\" 1"
  body:
    fontFamily: "Barlow, Helvetica Neue, Arial, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
  reading:
    fontFamily: "Barlow, Helvetica Neue, Arial, sans-serif"
    fontSize: "16.5px"
    fontWeight: 400
    lineHeight: 1.65
  label:
    fontFamily: "Barlow Semi Condensed, Arial Narrow, Arial, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    letterSpacing: "0.09em"
  data:
    fontFamily: "IBM Plex Mono, ui-monospace, Menlo, Consolas, monospace"
    fontSize: "12.5px"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "\"tnum\" 1"
rounded:
  swatch: "3px"
  sheet: "4px"
  control: "6px"
  card: "8px"
  overlay: "10px"
  pill: "999px"
spacing:
  hair: "4px"
  tight: "6px"
  snug: "10px"
  base: "14px"
  roomy: "16px"
  section: "20px"
components:
  button:
    backgroundColor: "{colors.plan-paper}"
    textColor: "{colors.graphite-ink}"
    rounded: "{rounded.control}"
    padding: "7px 11px"
  button-primary:
    backgroundColor: "{colors.drafting-blue}"
    textColor: "{colors.on-drafting-blue}"
    rounded: "{rounded.control}"
    padding: "7px 11px"
  button-danger:
    backgroundColor: "{colors.alert-red}"
    textColor: "{colors.plan-paper}"
    rounded: "{rounded.control}"
    padding: "7px 11px"
  input:
    backgroundColor: "{colors.plan-paper}"
    textColor: "{colors.graphite-ink}"
    rounded: "{rounded.control}"
    padding: "6px 8px"
  tool:
    textColor: "{colors.graphite-ink}"
    rounded: "{rounded.control}"
    padding: "7px 11px"
    width: "128px"
  tool-active:
    backgroundColor: "{colors.plan-paper}"
    textColor: "{colors.graphite-ink}"
    rounded: "{rounded.control}"
  band-segment:
    textColor: "{colors.graphite-ink}"
    typography: "{typography.data}"
    padding: "6px 14px"
  band-segment-active:
    backgroundColor: "{colors.graphite-ink}"
    textColor: "{colors.plan-paper}"
    typography: "{typography.data}"
    padding: "6px 14px"
  card:
    backgroundColor: "{colors.panel-mist}"
    textColor: "{colors.graphite-ink}"
    rounded: "{rounded.card}"
    padding: "14px"
  plan-sheet:
    backgroundColor: "{colors.plan-paper}"
    rounded: "{rounded.sheet}"
  pill:
    textColor: "#111111"
    typography: "{typography.data}"
    rounded: "{rounded.pill}"
    padding: "1px 8px"
  note-bar:
    backgroundColor: "{colors.drafting-blue-soft}"
    textColor: "{colors.graphite-ink}"
    rounded: "{rounded.card}"
    padding: "9px 12px"
  toast:
    backgroundColor: "{colors.graphite-ink}"
    textColor: "{colors.plan-paper}"
    rounded: "{rounded.card}"
    padding: "10px 14px"
---

# Design System: Planejador WiFi

## Overview

**Creative North Star: "The Living Floor Plan"**

The floor plan is the protagonist. Everything a visitor needs to decide where the router goes happens on one sheet of plan paper: walls drawn in the colors of their materials, nodes as solid ink dots, and the Wi-Fi heat map laid over the drawing like a living layer that changes as soon as a wall or a node moves. The interface around the sheet stays neutral, cool and quiet, so the plan is always the most colorful and most important thing on screen.

The system is technical and precise, but never intimidating. Measurements are exact and set in a monospaced face, categories carry plain-language names next to every dBm value, and the controls look like ordinary, familiar buttons and fields with thin hairline borders. A layperson finishes the job without feeling they opened engineering software; an expert finds every number where they expect it.

Density is moderate: a tool on one side, readings on the other, the plan in the middle and a long reading guide below. Both light and dark themes are first-class and share the same structure.

**Key Characteristics:**

- The plan sheet holds the only saturated color on screen: signal colors and wall materials.
- Cool, slightly blue neutrals; one ink accent, Drafting Blue.
- Condensed display type for headings and numbers, humanist sans for reading, monospace for measurements.
- Thin 1px hairlines and gently rounded corners; flat surfaces, shadows only on floating layers.
- Every color that carries meaning is repeated in text.

## Colors

A cool drafting-room palette of paper, graphite and one blue ink, with all saturated color reserved for what lives on the plan.

### Primary

- **Drafting Blue** (`drafting-blue`): the single interface accent. The main node on the plan, primary buttons, links, keyboard focus rings, the active state of range and checkbox controls, and the "main" swatch in the legend. Its soft tint (`drafting-blue-soft`) backs the example-house note bar and menu hover rows. In dark mode it lightens to a periwinkle (`drafting-blue-dark`) with near-black text on it.

### Neutral

- **Desk Gray** (`desk-gray`): the page background, the "desk" the plan sheet rests on.
- **Plan Paper** (`plan-paper`): the drawing sheet, buttons, inputs, dialogs and the tour card. The brightest surface in light mode.
- **Panel Mist** (`panel-mist`): result cards in the side column, one step darker than paper so cards read as grouped without shadows.
- **Graphite Ink** (`graphite-ink`): primary text, ordinary nodes on the plan, the active floor tab and the active band segment (inverted).
- **Pencil Gray** (`pencil-gray`): secondary text, hints, labels, table headers, axis labels on the plan.
- **Hairline** (`hairline`): every 1px border and divider; walls of other floors drawn as dashed ghosts.
- **Grid Faint / Grid Major** (`grid-faint`, `grid-major`): the 1 m drawing grid and its every-5-meter emphasis.
- **Alert Red** (`alert-red`): destructive actions and form errors only.

### Signal scale (the heat map)

Five fixed colors from a diverging green-to-red scale, identical in light and dark themes, drawn semi-transparent over the plan:

- **Signal Excellent** (`signal-excellent`): ≥ −60 dBm.
- **Signal Good** (`signal-good`): −60 to −67 dBm.
- **Signal Fair** (`signal-fair`): −67 to −72 dBm.
- **Signal Weak** (`signal-weak`): −72 to −80 dBm.
- **Signal None** (`signal-none`): below −80 dBm.

### Wall materials

Earthy, material-like colors used only for walls on the plan: **Brick Terracotta** (`wall-brick`), **Concrete Slate** (`wall-concrete`), **Drywall Ash** (`wall-drywall`), **Door Oak** (`wall-wood`), **Glass Teal** (`wall-glass`, always dashed) and **Metal Black** (`wall-metal`). In dark mode each one is lightened so it stays visible on the dark sheet (brick `#D27C59`, concrete `#A7AEB9`, drywall `#717A87`, wood `#D4A35A`, glass `#6BC6EA`, metal `#E3E7ED`).

### Named Rules

**The Plan Leads Rule.** Saturated color lives on the plan sheet. Interface chrome stays in neutrals plus Drafting Blue; if a control is more colorful than the heat map, it is wrong.

**The Signal Is Sacred Rule.** The five signal colors mean signal quality and nothing else. Never use them for buttons, badges or decoration, and never show one without its category name or dBm value next to it.

**The One Ink Rule.** Drafting Blue marks the main node, the primary action, links and focus. Nothing decorative is blue.

## Typography

**Display Font:** Barlow Semi Condensed (with Arial Narrow, Arial)
**Body Font:** Barlow (with Helvetica Neue, Arial)
**Data Font:** IBM Plex Mono (with ui-monospace, Menlo, Consolas)

**Character:** A condensed, slightly technical display face for headings, labels and big numbers, paired with the same family's friendly humanist cut for reading, and a monospace for anything measured. All three are self-hosted.

### Hierarchy

- **Display** (700, `clamp(24px, 3vw, 32px)`, 1.15): the page title above the planner.
- **Headline** (700, 26px, 1.15): section headings in the reading guide.
- **Title** (700, 17px; 20px in dialogs and the tour card): card and dialog headings.
- **Metric** (700, 40px, 1, tabular figures): the coverage percentage in the results card.
- **Body** (400, 15px, 1.5): interface text, buttons, menus.
- **Reading** (400, 16.5px, 1.65; 16px on phones): the guide below the planner, in a column of at most 760px.
- **Label** (600, 12px, 0.09em, uppercase): eyebrow labels; table headers use 13px and 0.05em.
- **Data** (400, 12.5–13px, tabular figures): the signal readout, band segments, dBm pills, table numbers, keyboard hints and canvas annotations.

### Named Rules

**The Numbers In Mono Rule.** Every measured value (dBm, meters, coordinates, percentages in tables) is set in IBM Plex Mono with tabular figures, so numbers line up and read as measurements.

**The Condensed Is For Headings Rule.** Barlow Semi Condensed is for headings, labels and big numbers. Paragraphs are always Barlow.

## Layout

- **Page:** maximum width 1440px, centered, with a 16px side gutter that respects device safe areas.
- **Planner (wider than 1100px):** a two-column grid, the stage (`minmax(0, 1fr)`) and a 320px results column, 20px apart. Inside the stage, a 128px vertical toolbar sits glued to the left of the plan. The stage is sticky 12px from the top, so the plan and its tools stay in view while the results column scrolls. The plan canvas is scaled to fit the viewport height (viewport minus 230px for the option bar, readout, legend and note).
- **Tablet (721–1100px):** one column; the results cards flow into an auto-fit grid of columns at least 260px wide, below the plan.
- **Phone (up to 720px):** the toolbar becomes a wrapping row of buttons above the plan, keyboard hints hide, the site menu takes its own scrollable row, and the plan uses the full width.
- **Reading guide:** a single 760px column below the planner, 48px from it.
- **Spacing rhythm:** small steps of 4, 6 and 10px inside controls and rows; 14–16px between cards and blocks; 20px between the stage and the panel.

## Elevation & Depth

The system is flat. Surfaces are separated by tone (desk, paper, panel) and 1px hairlines, never by shadows at rest. A single soft shadow appears only on layers that float above the page: the File menu, dialogs, the toast and the tour card. The guided tour dims everything except its target with a dark overlay.

### Shadow Vocabulary

- **Floating layer** (`box-shadow: 0 10px 30px rgba(20, 28, 40, .16)`; `rgba(0, 0, 0, .5)` in dark mode): menus, dialogs, toast, tour card.
- **Tour spotlight** (`box-shadow: 0 0 0 9999px rgba(8, 12, 18, .62)`): the cut-out around the element a tour step points to.
- **Dialog backdrop** (`rgba(10, 14, 20, .45)`).

### Named Rules

**The Flat Sheet Rule.** Nothing that sits in the page flow casts a shadow. If an element needs to stand out, change its tone or border, not its elevation.

## Shapes

Gently rounded and thin-lined. Controls use 6px corners, cards, menus, tables and note bars 8px, and floating overlays 10px. The plan sheet has an almost square 4px corner so it reads as a sheet of paper. Pills and tags are fully rounded. Borders are always 1px Hairline; the active tool and active floor tab switch to a Graphite Ink border or fill instead of getting thicker.

## Components

### Buttons

Precise and restrained: thin hairline borders, paper background, medium weight.

- **Shape:** gently rounded (6px), padding 7px 11px, weight 500.
- **Default:** Plan Paper background, Graphite Ink text, Hairline border; on hover the border darkens to Pencil Gray.
- **Primary:** Drafting Blue background and border, white text (near-black on the dark-mode blue).
- **Ghost:** transparent background, same border.
- **Danger:** Alert Red text; the confirming button in a destructive dialog fills with Alert Red.
- **Focus:** 2px Drafting Blue outline, 2px offset, on every interactive element.
- **Disabled / busy:** 60% opacity with a progress cursor.

### Toolbar (signature)

The vertical tool column glued to the plan: Select, Wall, Mesh node, Room, Measure, Erase, then Undo.

- Tools are borderless text buttons with a keyboard-shortcut hint in monospace at the right.
- The active tool gets a Plan Paper fill and a Graphite Ink border and turns semibold.
- On phones the tools become a wrapping row of bordered buttons and the shortcut hints hide.

### Band selector and floor tabs

- **Band selector:** a segmented control with monospace labels (2.4 / 5 / 6 GHz) inside one hairline-bordered capsule (7px); the selected band inverts to Graphite Ink with Plan Paper text.
- **Floor tabs:** small buttons; the active floor inverts the same way.

### Cards

- **Corner Style:** 8px.
- **Background:** Panel Mist, with Plan Paper inner tiles (the per-band coverage tiles).
- **Shadow Strategy:** none (see The Flat Sheet Rule).
- **Border:** 1px Hairline.
- **Internal Padding:** 14px, with 10px between items.

### Inputs / Fields

- **Style:** Plan Paper background, 1px Hairline border, 6px corners, padding 6px 8px.
- **Focus:** the shared 2px Drafting Blue outline.
- **Error:** Alert Red message text below the field.
- **Checkboxes and ranges:** native controls tinted with Drafting Blue.

### Navigation

- **Site menu:** text links in Graphite Ink, weight 500, with a soft Drafting Blue tint on hover; scrolls horizontally on its own row on phones.
- **Language switcher:** a plain select at the right of the header.

### Pills and legend

- **dBm pills:** fully rounded, monospace 12px, filled with the signal color of the link quality and dark text; the "cable" pill uses Grid Faint.
- **Legend swatches:** 12px squares with 3px corners, always followed by the category name and range.

### Plan sheet (signature)

The canvas: Plan Paper with a 1 m grid (every fifth line stronger), axis labels in monospace Pencil Gray every 2 m, walls at their material color and real thickness (glass dashed), the heat map at the opacity the visitor chooses, nodes as filled circles (Drafting Blue for the main node, Graphite Ink for the others, numbered), labels with a paper-colored halo so they stay legible over any heat color, and dashed backhaul lines colored by link quality.

## Do's and Don'ts

### Do:

- **Do** keep all saturated color on the plan sheet; the chrome stays neutral plus Drafting Blue.
- **Do** pair every signal color with its category name or dBm value.
- **Do** set every measurement in IBM Plex Mono with tabular figures.
- **Do** use 1px Hairline borders and tonal steps (desk, paper, panel) to separate areas.
- **Do** keep the shadow for floating layers only: menus, dialogs, toast and the tour card.
- **Do** give every interactive element the 2px Drafting Blue focus outline.
- **Do** keep the plan and its toolbar visible together while the results scroll on wide screens.

### Don't:

- **Don't** use the signal colors (green, yellow, orange, red) for buttons, badges or decoration.
- **Don't** add shadows to cards or anything in the page flow.
- **Don't** set paragraphs in Barlow Semi Condensed.
- **Don't** introduce a second accent color.
- **Don't** load fonts or any other resource from a third-party host; fonts are self-hosted.

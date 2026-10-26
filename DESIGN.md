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
  signal-excellent-dark: "#23B26D"
  signal-good-dark: "#C8E66B"
  wall-brick-dark: "#CF9A86"
typography:
  display:
    fontFamily: "Barlow Semi Condensed, Arial Narrow, Arial, sans-serif"
    fontSize: "21px"
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
    fontSize: "13px"
    fontWeight: 600
    letterSpacing: "0.05em"
  data:
    fontFamily: "IBM Plex Mono, ui-monospace, Menlo, Consolas, monospace"
    fontSize: "12.5px"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "\"tnum\" 1"
rounded:
  swatch: "3px"
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
  tool-rail:
    backgroundColor: "{colors.plan-paper}"
    rounded: "{rounded.overlay}"
    padding: "4px"
    width: "84px"
  tool:
    textColor: "{colors.graphite-ink}"
    rounded: "{rounded.control}"
    padding: "7px 2px 6px"
  tool-active:
    backgroundColor: "{colors.graphite-ink}"
    textColor: "{colors.plan-paper}"
    rounded: "{rounded.control}"
  floor-tab-active:
    backgroundColor: "{colors.graphite-ink}"
    textColor: "{colors.plan-paper}"
    rounded: "{rounded.control}"
    padding: "4px 10px"
  band-segment:
    backgroundColor: "{colors.plan-paper}"
    textColor: "{colors.graphite-ink}"
    typography: "{typography.data}"
    rounded: "{rounded.control}"
    padding: "7px 13px"
  band-segment-active:
    backgroundColor: "{colors.graphite-ink}"
    textColor: "{colors.plan-paper}"
    typography: "{typography.data}"
    padding: "7px 13px"
  floating-instrument:
    backgroundColor: "{colors.plan-paper}"
    textColor: "{colors.graphite-ink}"
    rounded: "{rounded.card}"
    padding: "6px 10px"
  popover:
    backgroundColor: "{colors.plan-paper}"
    textColor: "{colors.graphite-ink}"
    rounded: "{rounded.overlay}"
    padding: "10px 12px 12px"
    width: "270px"
  drawer:
    backgroundColor: "{colors.panel-mist}"
    textColor: "{colors.graphite-ink}"
    rounded: "{rounded.card}"
    width: "340px"
  summary-chip:
    backgroundColor: "{colors.plan-paper}"
    textColor: "{colors.graphite-ink}"
    rounded: "{rounded.pill}"
    padding: "6px 8px 6px 12px"
  card:
    backgroundColor: "{colors.panel-mist}"
    textColor: "{colors.graphite-ink}"
    rounded: "{rounded.card}"
    padding: "14px"
  verdict-card:
    backgroundColor: "{colors.panel-mist}"
    textColor: "{colors.graphite-ink}"
    rounded: "{rounded.card}"
    padding: "14px"
  band-tile:
    backgroundColor: "{colors.plan-paper}"
    textColor: "{colors.graphite-ink}"
    rounded: "{rounded.control}"
    padding: "6px 4px"
  plan-map:
    backgroundColor: "{colors.desk-gray}"
    rounded: "{rounded.card}"
  plan-sheet:
    backgroundColor: "{colors.plan-paper}"
  pill:
    backgroundColor: "{colors.plan-paper}"
    textColor: "{colors.graphite-ink}"
    typography: "{typography.data}"
    rounded: "{rounded.pill}"
    padding: "1px 8px"
  example-chip:
    backgroundColor: "{colors.drafting-blue-soft}"
    textColor: "{colors.graphite-ink}"
    rounded: "{rounded.pill}"
    padding: "3px 4px 3px 12px"
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

The planner is a one-screen workspace: a short title and the project bar on top, then the plan map filling the rest of the viewport, with its instruments floating on it (floors and bands, the tool rail, the readout, history and zoom) and the results in a drawer at its side. The reading guide follows below the workspace. Both light and dark themes are first-class and share the same structure.

**Key Characteristics:**

- The plan sheet holds the only saturated color on screen: signal colors and wall materials.
- Cool, slightly blue neutrals; one ink accent, Drafting Blue.
- Condensed display type for headings and numbers, humanist sans for reading, monospace for measurements.
- Thin 1px hairlines and gently rounded corners; flat surfaces, a faint shadow on the instruments floating on the plan and a deeper one on overlays.
- Every color that carries meaning is repeated in text.

## Colors

A cool drafting-room palette of paper, graphite and one blue ink, with all saturated color reserved for what lives on the plan.

### Primary

- **Drafting Blue** (`drafting-blue`): the single interface accent. The main node on the plan, primary buttons, links, keyboard focus rings, the active state of range and checkbox controls, and the "main" swatch in the legend. Its soft tint (`drafting-blue-soft`) backs the example-house chip and the hover state of menu rows, tool buttons and view buttons. In dark mode it lightens to a periwinkle (`drafting-blue-dark`) with near-black text on it.

### Neutral

- **Desk Gray** (`desk-gray`): the page background and the map area around the plan sheet, the "desk" the sheet rests on.
- **Plan Paper** (`plan-paper`): the drawing sheet, every floating instrument on the plan, the popover, buttons, inputs, dialogs and the tour card. The brightest surface in light mode.
- **Panel Mist** (`panel-mist`): the results drawer and its cards, one step darker than paper so they read as grouped without shadows.
- **Graphite Ink** (`graphite-ink`): primary text, ordinary nodes on the plan, and the fill of every pressed floor, band and tool (with Plan Paper text).
- **Pencil Gray** (`pencil-gray`): secondary text, hints, labels, table headers, axis labels on the plan.
- **Hairline** (`hairline`): every 1px border and divider; walls of other floors drawn as dashed ghosts.
- **Grid Faint / Grid Major** (`grid-faint`, `grid-major`): the 1 m drawing grid and its every-5-meter emphasis.
- **Alert Red** (`alert-red`): destructive actions and form errors only.

### Signal scale (the heat map)

Five colors from a diverging green-to-red scale, drawn semi-transparent over the plan. Fair, Weak and None are identical in both themes; over the dark sheet the two greens blend darker, so dark mode spreads them apart in lightness (Excellent `#23B26D`, Good `#C8E66B`):

- **Signal Excellent** (`signal-excellent`): ≥ −60 dBm.
- **Signal Good** (`signal-good`): −60 to −67 dBm.
- **Signal Fair** (`signal-fair`): −67 to −72 dBm.
- **Signal Weak** (`signal-weak`): −72 to −80 dBm.
- **Signal None** (`signal-none`): below −80 dBm.

### Wall materials

Earthy, material-like colors used only for walls on the plan: **Brick Terracotta** (`wall-brick`), **Concrete Slate** (`wall-concrete`), **Drywall Ash** (`wall-drywall`), **Door Oak** (`wall-wood`), **Glass Teal** (`wall-glass`, always dashed) and **Metal Black** (`wall-metal`). In dark mode each one is lightened so it stays visible on the dark sheet (brick `#CF9A86`, kept less saturated so it never reads as the weak-signal orange, concrete `#A7AEB9`, drywall `#717A87`, wood `#D4A35A`, glass `#6BC6EA`, metal `#E3E7ED`).

### Named Rules

**The Plan Leads Rule.** The plan map takes the workspace and holds the saturated color; the instruments float on it in paper and ink, and the results sit beside it. Interface chrome stays in neutrals plus Drafting Blue; if a control is more colorful than the heat map, it is wrong.

**The Signal Is Sacred Rule.** The five signal colors mean signal quality and nothing else. Never use them for buttons, badges or decoration, and never show one without its category name or dBm value next to it.

**The One Ink Rule.** Drafting Blue marks the main node, the primary action, links and focus. Nothing decorative is blue.

## Typography

**Display Font:** Barlow Semi Condensed (with Arial Narrow, Arial)
**Body Font:** Barlow (with Helvetica Neue, Arial)
**Data Font:** IBM Plex Mono (with ui-monospace, Menlo, Consolas)

**Character:** A condensed, slightly technical display face for headings, labels and big numbers, paired with the same family's friendly humanist cut for reading, and a monospace for anything measured. All three are self-hosted.

### Hierarchy

- **Display** (700, 21px, 1.15; 17px on phones): the short page title above the workspace. Document pages (privacy) set their title at 32px.
- **Headline** (700, 26px, 1.15): section headings in the reading guide.
- **Title** (700, 17px; 16px in the popover, 20px in dialogs and the tour card): card, drawer, popover and dialog headings. The verdict status line uses the display face at 22px.
- **Metric** (700, 40px, 1, tabular figures): the coverage percentage in the results card.
- **Body** (400, 15px, 1.5): interface text, buttons, menus. Tool rail labels are 12px (11px on phones); the readout's prose is Body at 13px.
- **Reading** (400, 16.5px, 1.65; 16px on phones): the guide below the workspace, in a column of at most 720px; its opening lead paragraph is 18px in Pencil Gray.
- **Label** (600, 13px, 0.05em, uppercase, display face): table headers in the guide.
- **Data** (400–500, 10–13px, tabular figures): coordinates and dBm in the readout, band segments, dBm pills and link tags, the summary percentage, table numbers, shortcut letters and canvas annotations.

### Named Rules

**The Numbers In Mono Rule.** Every measured value (dBm, meters, coordinates, percentages in tables) is set in IBM Plex Mono with tabular figures, so numbers line up and read as measurements. Only the values go mono: the sentences around them stay in Barlow.

**The Condensed Is For Headings Rule.** Barlow Semi Condensed is for headings, labels and big numbers. Paragraphs are always Barlow.

## Layout

- **Page:** maximum width 1440px, centered, with a 16px side gutter that respects device safe areas.
- **Workspace:** one screen tall (viewport height minus the header, at least 520px). A short title row (H1, example-house chip, project bar) sits on top, 8px above the body. The body is a grid of the plan map (`minmax(0, 1fr)`) and a 340px results drawer, 12px apart. Collapsing the drawer gives the map the full width and leaves a summary chip in the map's top-right corner.
- **Plan map:** a hairline-bordered 8px frame on Desk Gray; the plan sheet is drawn inside it and pans and zooms. Instruments float 10px from its edges: the top strip (floors, band segment, heat-map toggle) along the top, the tool rail on the left below it, the active tool's options to the right of the top strip, the readout at the bottom left beside the rail, and the history and view clusters at the bottom right.
- **Sheet mode (up to 1099px):** the drawer becomes a bottom sheet over the plan (up to 72% of its height) whose head stays visible when collapsed, showing the status icon, the coverage percentage and the band. The readout and view clusters sit above that head.
- **Phone (up to 719px):** the workspace runs edge to edge with no frame corners; the title takes its own line at 17px and the example chip hides. The tool rail becomes a full-width bar on the bottom edge (shortcut letters hidden), the sheet sits on top of it, the readout moves under the top strip and clamps to one line, and the tool options and the popover dock above the rail. The site menu takes its own scrollable row.
- **Reading guide:** a single 720px column, 40px below the workspace; it opens with the lead paragraph that introduces the planner.
- **Spacing rhythm:** small steps of 2, 4 and 6px inside instruments and button groups; 8–10px between floating instruments and the map edge; 12px between drawer cards and between the map and the drawer; 14px card padding.

## Elevation & Depth

The system is flat in the page flow: the map frame, the drawer beside it and its cards are separated by tone (desk, paper, panel) and 1px hairlines, never by shadows. Depth appears only on layers above the plan, in two steps. Instruments floating on the plan (top strip, tool rail, tool options, readout, history and view clusters, summary chip) carry a faint lift so they read as resting on the sheet. Overlays that open over content (the properties popover, the bottom sheet, the File menu, dialogs, the toast and the tour card) carry the deeper floating-layer shadow. The guided tour dims everything except its target with a dark overlay.

### Shadow Vocabulary

- **Floating instrument** (`box-shadow: 0 2px 10px rgba(20, 28, 40, .12)`; `0 2px 12px rgba(0, 0, 0, .45)` in dark mode): the instruments that float on the plan. The phone's bottom tool bar sits flush and drops it.
- **Floating layer** (`box-shadow: 0 10px 30px rgba(20, 28, 40, .16)`; `rgba(0, 0, 0, .5)` in dark mode): popover, bottom sheet, menus, dialogs, toast, tour card.
- **Tour spotlight** (`box-shadow: 0 0 0 9999px rgba(8, 12, 18, .62)`): the cut-out around the element a tour step points to.
- **Dialog backdrop** (`rgba(10, 14, 20, .45)`).

### Named Rules

**The Flat Sheet Rule.** Nothing that sits in the page flow casts a shadow. If an element needs to stand out, change its tone or border, not its elevation. Only what floats over the plan is lifted: instruments with the faint shadow, overlays with the deep one.

## Shapes

Gently rounded and thin-lined. Controls, the band segment, the heat-map chip and tool buttons use 6px corners; cards, the map frame, the drawer, menus, tables and the floating instruments 8px; the tool rail, the popover, dialogs, the tour card and the top corners of the bottom sheet 10px. Pills, tags, the summary chip and the example chip are fully rounded. The plan sheet itself is a square-cornered rectangle of paper drawn on the desk. Borders are always 1px Hairline; pressed controls switch to a Graphite Ink fill instead of getting a thicker border.

### Icons

One authored set of line icons, drawn on a 24px grid with a 1.75 stroke, round caps and joins, no fill and the current text color, shown at 20px (14–18px in the File menu, popover close and summary chip). The set covers the tools (select, wall, node, label, measure, erase), history (undo, redo), view (plus, minus, fit) and two utilities (chevron, close). Icons are inline symbols in the page; no glyph characters stand in for icons.

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

### Floating instruments (signature)

Small paper panels resting on the plan: Plan Paper background, 1px Hairline border, 8px corners (6px for the band segment and heat-map chip, 10px for the tool rail) and the faint floating-instrument shadow. They hold the controls the visitor needs while drawing, so the map never has to scroll away from them.

- **Top strip:** floor tabs in one paper group, the band segment, and the heat-map toggle as a bordered chip, wrapping along the top edge of the map.
- **Tool options:** the settings of the active tool (wall material and straight-lines check, or node model and the "other model" link) in one row beside the top strip; docked above the rail on phones.
- **Readout:** the reading under the pointer and the tool hint, at the bottom left. Prose in Barlow 13px Pencil Gray with key words in Graphite Ink; only coordinates and dBm values switch to monospace.
- **History and view clusters:** two button groups at the bottom right (undo/redo; zoom out, fit, zoom in). Icon-only buttons divided by hairlines inside one 8px capsule, Drafting Blue tint on hover; disabled history buttons drop to 35% opacity.
- **Summary chip:** when the drawer is collapsed on wide screens, a fully rounded chip in the map's top-right corner shows the status icon, the coverage percentage in monospace, the band and the number of weak links, and reopens the drawer.

### Tool rail (signature)

The vertical rail floating at the left of the map: Select, Wall, Mesh node, Room, Measure, Erase.

- One 84px paper panel with 10px corners, 4px padding and the floating-instrument shadow.
- Each tool is a stacked button: a 20px line icon above a 12px label, with its shortcut letter in 10px monospace Pencil Gray in the top-right corner.
- Tools are borderless; hover tints with Drafting Blue soft. The pressed tool fills with Graphite Ink, Plan Paper text and icon, semibold.
- On phones the rail becomes a full-width bar flush with the bottom edge (no shadow, no corners), the tools share the width equally, labels drop to 11px and the shortcut letters hide.
- On touch screens the floor tabs, band segments, view and history buttons and the heat-map chip are at least 40px tall.
- **Empty plan invitation:** a floor with nothing on it shows a centered card on the sheet (floating-layer shadow, 10px corners) with "Draw walls" and "Load floor plan photo"; an image can also be dropped on the map, which shows a dashed Drafting Blue outline while dragging. The card goes away on the first touch of the plan.

### Pressed state

Floors, bands and tools all show their pressed state the same way: a Graphite Ink fill with Plan Paper text, announced with `aria-pressed`. The per-band tiles in the verdict card are the exception: they stay paper and switch to a 2px Graphite Ink outline drawn inside the tile.

### Band selector and floor tabs

- **Band selector:** a segmented control with monospace labels (2.4 / 5 / 6 GHz) inside one hairline-bordered capsule (6px) on the top strip; the pressed band inverts to Graphite Ink with Plan Paper text. A band no placed device supports is struck through in Pencil Gray (it stays selectable).
- **Floor tabs:** small borderless buttons inside one paper group (8px corners, 3px padding); the active floor inverts the same way.

### Properties popover

The settings of the selected wall, node, room label, link or measurement, opened next to the object itself.

- A 270px Plan Paper panel with 10px corners, a Hairline border and the floating-layer shadow; 10px 12px 12px padding, 8px between rows.
- Head: a 16px display-face title (the object name, with its length for walls) and an icon-only close button.
- Placement: beside points (nodes, labels), above or below the midpoint of lines (walls, links, measurements) so the object stays visible; kept 10px inside the map. It hides while the object is dragged. On phones it docks full width above the tool bar and the plan scrolls so the object stays in view.
- **Several items:** Shift/Ctrl-click, Shift-drag (a dashed Drafting Blue box over a faint tint) or the "Select several" option of the Select tool gather walls, nodes and names. Each selected item keeps its own highlight; one popover covers the group ("3 items selected", counts per kind, one material for all walls, one model for all nodes, delete) and is placed off the rectangle around all of them. A change made with several items selected never applies on its own: the popover shows what will change on a Drafting Blue tint ("Walls: 2 → Glass") with "Apply to all selected" and Cancel, and deleting several items asks in a dialog first. Dragging any selected item moves the group on the grid; while picking several on a phone the plan does not scroll between taps.

### Results drawer and bottom sheet

- **Drawer (wide screens):** a 340px Panel Mist column beside the map, 8px corners and a Hairline border, no shadow. A full-width head button (17px display-face title, summary at the right, chevron icon) collapses it into the summary chip. The body scrolls on its own with 12px padding and 12px between cards.
- **Bottom sheet (up to 1099px):** the same drawer laid over the bottom of the map with 10px top corners and the floating-layer shadow. Collapsed, only the head shows: the status icon, the coverage percentage and the band.
- **Contents, in order:** the verdict card, coverage on the selected band (big metric, signal bar and category rows), links between nodes and the suggested next node. Below them a quieter footer, separated by a Hairline instead of a card: the "Copy summary" button with its one-line explanation, and a collapsed "About the estimate" disclosure holding the signal legend and the model note. Setup does not live in the results: plan size, the floor-plan photo, opacities and floor removal sit in a "Plan and scale…" dialog opened from the File menu.
- **Summary head:** names what it reports ("Main band 5 GHz · 97%") so it never reads as the band on screen.

### Verdict card (signature)

The first card in the drawer, answering "is this enough, and what do I buy".

- Status line in the display face (700, 22px) led by a 22px status icon from the icon set: a check in Drafting Blue when the plan covers the house, an alert in Graphite Ink when a node needs a cable, an alert in Alert Red when signal is missing. Signal colors are not used for the verdict; the line always names the status in words.
- A definition list of the devices to buy (Pencil Gray 13px term, semibold value), a coverage line, and, when a link is weak, a cable sentence with a primary button to wire that node.
- A 6 GHz note in small Pencil Gray text.
- Whole-house tiles, one per band, as three equal buttons: Plan Paper, 6px corners, the percentage in 15px monospace over an 11.5px Pencil Gray band label. Pressing one switches the plan to that band.
- Closes with the ±8 dB estimate note as a hint.

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
- **File picker:** the native file input is visually hidden and a label styled as a default button carries the translated action ("Choose image…"); the input keeps keyboard focus and draws the focus ring on that button. The native control would speak the browser's language.

### Navigation

- **Site menu:** text links in Graphite Ink, weight 500, with a soft Drafting Blue tint on hover; scrolls horizontally on its own row on phones.
- **Language switcher:** a plain select at the right of the header.

### Pills and legend

- **dBm pills:** fully rounded, monospace 12px, a neutral Plan Paper pill with a Hairline border and Graphite Ink text, led by an 8px dot for the link quality (great: Signal Excellent, ok: Signal Good, weak: Signal None; the Fair yellow is not used for links); the "cable" pill fills with Grid Faint and has no dot. Signal color never sits behind text.
- **Example chip:** a fully rounded Drafting Blue soft chip in the title row that says the example house is loaded, with rounded buttons to start a project; hidden on phones.
- **Legend swatches:** 12px squares with 3px corners, always followed by the category name and range.

### Plan sheet (signature)

The canvas: Plan Paper with a 1 m grid (every fifth line stronger), axis labels in monospace Pencil Gray every 2 m, walls at their material color and real thickness (glass dashed), the heat map at the opacity the visitor chooses, nodes as filled circles (Drafting Blue for the main router, marked "R", Graphite Ink for the other nodes, numbered), room names that step above a node sitting on them, labels with a paper-colored halo so they stay legible over any heat color, and dashed backhaul lines colored by link quality (wired links dotted in Graphite Ink). Each link carries a small fully rounded tag at its midpoint: Plan Paper fill, a border in the link's signal color (Hairline for cable), and the dBm value in 11px monospace Graphite Ink; the tag is a click target that opens the link's popover, and the selected link and tag switch to Drafting Blue. The sheet is a square-cornered rectangle on the Desk Gray map area, which pans and zooms.

## Do's and Don'ts

### Do:

- **Do** keep all saturated color on the plan sheet; the chrome stays neutral plus Drafting Blue.
- **Do** pair every signal color with its category name or dBm value.
- **Do** set every measurement in IBM Plex Mono with tabular figures.
- **Do** use 1px Hairline borders and tonal steps (desk, paper, panel) to separate areas.
- **Do** keep shadows for what floats over the plan: the faint instrument shadow for the floating instruments, the floating-layer shadow for the popover, bottom sheet, menus, dialogs, toast and tour card.
- **Do** give every interactive element the 2px Drafting Blue focus outline.
- **Do** keep the plan filling the workspace with its tools floating on it; results scroll inside the drawer, never the plan off screen.
- **Do** show pressed floors, bands and tools as a Graphite Ink fill with Plan Paper text.
- **Do** draw new icons in the authored set's grammar: 24px grid, 1.75 stroke, round caps and joins, current color.

### Don't:

- **Don't** use the signal colors (green, yellow, orange, red) for buttons, badges or decoration.
- **Don't** add shadows to cards, the drawer beside the map or anything else in the page flow.
- **Don't** put text on a signal-color fill; use a neutral pill or tag with a signal-color dot or border.
- **Don't** use typographic glyphs (such as ▾) in place of icons.
- **Don't** set paragraphs in Barlow Semi Condensed.
- **Don't** introduce a second accent color.
- **Don't** load fonts or any other resource from a third-party host; fonts are self-hosted.

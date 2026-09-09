# Design spec

Values read off the reference mockup of the Overview screen (1536 × 961). Every
number here is what the interface is checked against; if the built page and this
file disagree, one of them is wrong and the mismatch gets resolved before the
work is called done.

## Ground and surfaces

| Token | Value | Used for |
| --- | --- | --- |
| `--bg` | `#f4f7f5` | page ground |
| `--card` | `#ffffff` | every card |
| `--border` | `#e8eeeb` | 1px card border; there is no drop shadow anywhere |
| `--line` | `#eef3f0` | chart gridlines, table row rules |
| `--text` | `#0f2f24` | primary ink |
| `--muted` | `#6b7d75` | labels, captions, table headers |
| `--radius` | `14px` | cards |
| `--radius-sm` | `10px` | buttons, inputs, pills, icon tiles |

## Green scale

| Token | Value | Used for |
| --- | --- | --- |
| `--accent` | `#15734f` | primary button, dark chart bars, progress fill |
| `--accent-strong` | `#0f5c3e` | hover, active ink |
| `--accent-soft` | `#e6f2ec` | icon tile tint, category pills, mint buttons |
| `--bar-light` | `#93c9ab` | the light bar in a paired chart, lighter donut slices |
| `--sidebar` | `#0d3b2a` | sidebar top of gradient |
| `--sidebar-deep` | `#072a1e` | sidebar bottom of gradient |
| `--sidebar-active` | `#17553d` | active nav row, avatar chip |
| `--sidebar-ink` | `#a9c7b8` | inactive nav label |
| `--sidebar-dim` | `#6f9c88` | motto, sub-labels on dark |
| `--kpi-dark` | `#0f4a33` | the Income tile |

Amber is a second accent, not a third green: `--warning` `#dfa63f`,
`--warning-soft` `#fdf3e1`, `--warning-border` `#f3e3c0`, `--warning-text`
`#8a6410`. It marks the folded "other" donut slice, the Budget-remaining tile
and the budget warning strip — nothing else. Expense amounts are
`--critical` `#d64545`; income amounts are `--accent`.

## Type

Plus Jakarta Sans throughout, one family.

| Role | Size / weight |
| --- | --- |
| Page title | 34px / 800, tracking −0.03em |
| Page date | 14px / 500, muted |
| Card title | 17px / 700 |
| KPI label | 14px / 600 |
| KPI value | 30px / 800, tracking −0.03em, tabular |
| KPI sub-label | 12.5px / 500, muted |
| Table header | 13px / 500, muted, sentence case (**not** all caps) |
| Table cell | 14px / 500; amounts 14px / 700 tabular |
| Chart value label | 12.5px / 600, muted |
| Chart week label | 13px / 700; date range 11.5px muted |
| Pill / chip | 12.5px / 600 |
| Nav item | 15px / 500; active 15px / 600 |
| Motto | 12px / 400, `--sidebar-dim`, line-height 1.45 |

## Sidebar — 250px

Vertical gradient `--sidebar` → `--sidebar-deep`. Brand: 34px white rounded
square (radius 9) holding a green wallet glyph, then "Expense Tracker" 17/700
white. Nav rows: 44px tall, radius 10, 12px side inset, 20px icon, 12px gap;
inactive `--sidebar-ink`; active `--sidebar-active` fill with white ink.

Order: Overview, Transactions, Accounts, Budgets, Savings goals, Reports.

Below the nav, in order: flexible gap, the motto (small — see the type table —
with a 28 × 2px `--sidebar-dim` rule under it), a pine-forest silhouette that
bleeds to both side edges and the bottom, then Settings as a nav row and the
user chip: 32px avatar circle (`--sidebar-active`, white initial), name 14/600
white, chevron right. The chip opens Settings; signing out lives there.

## Header

Two rows.

1. Left: title, then the long-form date under it. Right: search pill (360 × 40,
   radius 10, white, `--border`, 16px search glyph, placeholder "Search
   transactions, categories…"), 40 × 40 bell button with a 7px dot in the
   top-right corner when something is due, 40px avatar circle (`--kpi-dark`,
   white initial).
2. Right-aligned only: month select (white pill, calendar glyph, chevron),
   Export (white, upload glyph), Add transaction (`--accent`, white, plus glyph,
   44px tall).

## KPI row — four tiles, full width, 18px gap

Each tile is 20px padding, radius 14, and three rows:

1. icon (34px rounded-8 tile, tinted) **beside** the label, on one line;
2. the value, with a five-bar sparkline (44 × 36, 6px bars, 4px gaps, radius 2)
   pushed to the right edge;
3. the sub-label.

Tile 1 Income is `--kpi-dark` with white ink, a white-tinted icon tile and
white-tinted bars. Tile 2 Expenses: soft-red icon tint, green bars. Tile 3 Net
savings: mint tint. Tile 4 Budget remaining: amber tint and amber bars.

## Body grid

`minmax(0, 2fr) minmax(0, 1fr)`, 18px gap.

Left column: Cash flow, then Recent transactions.
Right column: Spending breakdown, then Savings goal, then Upcoming bills.

### Cash flow

Header: 20px glyph + title on the left; on the right the legend (two 9px dots
with 13px labels) and a period select styled like the month pill. Plot ~300px
tall: 5 horizontal gridlines, y labels 12px muted, four groups of two bars —
`--accent` and `--bar-light`, 52px wide, 6px apart, radius 4 on the top corners
only — each with its value printed above, and W1…W4 plus the date range under
the axis. No summary line under the chart.

### Spending breakdown

Header glyph + title + period select. Donut 200px, ring 34px thick, greens
stepped dark → light with amber for the folded remainder; centre holds the total
(22/800) over "Total spent" (11.5 muted). Legend rows: 9px dot, name, amount
right-aligned, percentage right-aligned and muted.

Under it the warning strip: `--warning-soft` on `--warning-border`, radius 12,
triangle glyph, a bold headline ("Food budget is at 91%") over a second line
("₹750 remaining this month"), chevron on the right; the whole strip links to
Budgets.

### Recent transactions

Header: glyph + title on the left; a 36px search input and a Filter control on
the right. Columns Name, Category, Date, Account, Amount. Rows 50px: a plain
20px category glyph before the name (no tinted circle), the category as a mint
pill that contains its own small glyph, dates as `09 Sep 2026`, account as the
payment-method label, amount right-aligned and signed.

### Savings goal

Header glyph + title + "View all ›". Row: 68px rounded-12 mint tile with the
goal glyph, name 15/700, `₹45,000 of ₹75,000` 13 muted, a 6px progress track
with a green fill, the percentage 15/700 at the right, and an "Add money" button
(mint fill, green ink, radius 8).

### Upcoming bills

Header glyph + title + "View all ›". Rows: 20px glyph, name, then
`₹999 · 12 Sep 2026` muted and a chevron.

## Phone (≤768px)

Sidebar off, bottom tab bar with a centre FAB, the KPI row folds into the hero
card, every grid to one column, charts scroll sideways at a 520px minimum rather
than shrinking, and nothing overflows 390px.

// Single inline-SVG icon set — avoids an icon dependency and keeps the bundle small.
// All paths are drawn on a 24x24 grid with a 1.8 stroke so they sit together evenly.
const PATHS = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  list: 'M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  pie: 'M12 3a9 9 0 1 0 9 9h-9z',
  settings:
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 7.9 19l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 4 13.6H4a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 5.1 7L5 6.9a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H10a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z',
  wallet: 'M3 7a2 2 0 0 1 2-2h13a1 1 0 0 1 1 1v2M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3M3 7h16a2 2 0 0 1 2 2v2h-5a2 2 0 0 0 0 4h5',
  trendUp: 'M3 17l6-6 4 4 7-7M15 8h6v6',
  trendDown: 'M12 5v14M12 19l-5-5M12 19l5-5',
  food: 'M6 3v8a2 2 0 0 0 4 0V3M8 11v10M18 3c-1.5 1.5-2 3.5-2 6s.5 3 2 3v9',
  transport:
    'M5 17h14M6 17v2H4v-2M20 19h-2v-2M4 12l1.5-5A2 2 0 0 1 7.4 5.5h9.2A2 2 0 0 1 18.5 7L20 12M4 12h16v4a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zM7.5 14.5h.01M16.5 14.5h.01',
  shopping: 'M6 8h12l-1 12H7zM9 8V6a3 3 0 0 1 6 0v2',
  housing: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z',
  utilities: 'M13 2 4 14h7l-1 8 9-12h-7z',
  bills: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9.5 8h5M9.5 12h5',
  health: 'M12 6.5c2-3 7-2.5 7 1.5 0 4-4.5 7-7 9-2.5-2-7-5-7-9 0-4 5-4.5 7-1.5z',
  entertainment: 'M4 5h16v14H4zM4 9h16M8 5v4M16 5v4M10 13l4 2-4 2z',
  education: 'M12 4 2 9l10 5 10-5zM6 11.5V16c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5v-4.5',
  cart: 'M3 4h2l2.2 10.5A2 2 0 0 0 9.2 16h7.8a2 2 0 0 0 2-1.6L20.5 7H6M9.5 20h.01M17.5 20h.01',
  wifi: 'M2.5 9a15 15 0 0 1 19 0M5.5 12.5a10 10 0 0 1 13 0M8.5 16a5.5 5.5 0 0 1 7 0M12 19.5h.01',
  income: 'M17 7 7 17M17 7h-6M17 7v6',
  other: 'M6 12h.01M12 12h.01M18 12h.01',
  plus: 'M12 5v14M5 12h14',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3',
  filter: 'M3 5h18l-7 8v6l-4 2v-8z',
  calendar: 'M7 3v4M17 3v4M3.5 9h17M4 5h16a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z',
  chevronRight: 'M9 5l7 7-7 7',
  chevronDown: 'M5 9l7 7 7-7',
  back: 'M19 12H5M11 18l-6-6 6-6',
  camera: 'M4 7h3l1.5-2h7L17 7h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1zM12 16a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z',
  alert: 'M12 4 2.5 20h19zM12 10v4M12 17h.01',
  logout: 'M9 21H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h4M16 17l5-5-5-5M21 12H9',
  swap: 'M4 8h13l-3-3M20 16H7l3 3',
  accounts: 'M3 6h18v13H3zM3 10h18M7 15h4',
  budget: 'M4 5h16v14H4zM9 5v14M4 12h5',
  bell: 'M18 9a6 6 0 1 0-12 0c0 5-2 6-2 6h16s-2-1-2-6M10.5 20a2 2 0 0 0 3 0',
  export: 'M12 16V4M8 8l4-4 4 4M4 20h16',
  laptop: 'M4 5h16v11H4zM2 19h20',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zM12 13h.01',
  savings: 'M4 13a7 7 0 0 1 7-7h3a6 6 0 0 1 6 6v3a4 4 0 0 1-4 4h-8a4 4 0 0 1-4-4zM7 18v2M17 18v2M20 11h1.5M15 9h.01',
  fuel: 'M5 17h11v2H5zM5 12l1.2-4A2 2 0 0 1 8.1 6.5h5.8A2 2 0 0 1 15.8 8L17 12M5 12h12v5H5zM19 9h2v6h-2',
  briefcase: 'M4 7h16v13H4zM9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M4 12h16',
  arrowUpRight: 'M4 17l6-6 4 4 6-7M15 8h6v6',
  arrowDownRight: 'M20 7l-6 6-4-4-6 7M9 16H3v-6'
};

// Which glyph represents each spending category.
export const CATEGORY_ICON = {
  food: 'food',
  transport: 'transport',
  housing: 'housing',
  utilities: 'utilities',
  health: 'health',
  entertainment: 'entertainment',
  education: 'education',
  shopping: 'shopping',
  other: 'other',
  salary: 'income',
  freelance: 'income',
  interest: 'income',
  refund: 'income',
  'other income': 'income',
  'other categories': 'other'
};

export default function Icon({ name, size = 20, className, strokeWidth = 1.8 }) {
  const path = PATHS[name] || PATHS.other;
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={path} />
    </svg>
  );
}

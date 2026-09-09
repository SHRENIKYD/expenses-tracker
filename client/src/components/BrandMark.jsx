// A stand-in for the Tessera mark: three tiles, offset, reading as a T.
//
// Filled rather than stroked, so it does not sit with the line icons in
// Icon.jsx. Replace the paths with the real artwork when it is to hand — the
// component is the only place that needs to change.
export default function BrandMark({ size = 30 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="currentColor"
      role="img"
      aria-label="Tessera"
    >
      <path d="M2 4h28l-4 7H6z" />
      <path d="M13.5 13h8l-1.2 8h-8z" />
      <path d="M12.3 23h8l-1.2 7h-8z" />
    </svg>
  );
}

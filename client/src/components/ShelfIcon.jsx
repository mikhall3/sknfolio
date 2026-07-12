// A simple bottles-on-a-shelf glyph, drawn to match lucide-react's icon
// conventions (24x24 viewBox, currentColor stroke, round caps/joins) so it
// drops into the nav bar alongside the rest of the icon set.
export default function ShelfIcon({ size = 24, strokeWidth = 2, className, ...rest }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...rest}
    >
      <path d="M3 20h18" />
      <rect x="5" y="13" width="3" height="7" rx="1" />
      <path d="M6 13v-2" />
      <rect x="10" y="9" width="4" height="11" rx="1" />
      <path d="M12 9V6.5" />
      <rect x="16" y="12" width="3" height="8" rx="1" />
      <path d="M17.5 12v-2" />
    </svg>
  )
}

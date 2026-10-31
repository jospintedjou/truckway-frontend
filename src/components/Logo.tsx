export function Logo({ size = 28, animated = false }: { size?: number; animated?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className={animated ? "logo-anim" : undefined}>
      <rect width="64" height="64" rx="16" fill="#11243B" />
      <path
        className="logo-path"
        d="M14 46 C24 44 30 38 34 30 S44 18 50 16"
        fill="none"
        stroke="#2DD4BF"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <circle cx="14" cy="46" r="5" fill="#E6F0F5" />
      <circle cx="50" cy="16" r="5" fill="#FF4D6A" />
    </svg>
  );
}

export function Brand() {
  return (
    <span className="brand">
      <Logo size={26} />
      <span>Truckway</span>
    </span>
  );
}

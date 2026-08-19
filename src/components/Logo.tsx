export default function Logo({ size = 26 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className="shrink-0 rounded-[28%] bg-primary text-primary-foreground"
      aria-hidden="true"
    >
      <circle cx="13" cy="13" r="6.2" stroke="currentColor" strokeWidth="2.3" />
      <path d="M17.6 17.6 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path
        d="M10.2 13.3 12.4 15.6 16.2 10.6"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

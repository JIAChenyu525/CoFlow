type P = { size?: number; className?: string };

const base = (size = 16) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
});

export const IconBoard = ({ size, className }: P) => (
  <svg {...base(size)} className={className} aria-hidden>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M3 9h18M8 9v11" />
  </svg>
);

export const IconTask = ({ size, className }: P) => (
  <svg {...base(size)} className={className} aria-hidden>
    <path d="M9 6h11M9 12h11M9 18h11" />
    <path d="m3.5 6 1.2 1.2L6.5 5M3.5 12l1.2 1.2L6.5 11M3.5 18l1.2 1.2L6.5 17" />
  </svg>
);

export const IconArtifact = ({ size, className }: P) => (
  <svg {...base(size)} className={className} aria-hidden>
    <path d="M21 8.5 12 3.5 3 8.5v7L12 20.5l9-5v-7Z" />
    <path d="m3 8.5 9 5 9-5M12 13.5v7" />
  </svg>
);

export const IconTimeline = ({ size, className }: P) => (
  <svg {...base(size)} className={className} aria-hidden>
    <path d="M12 3v18" />
    <circle cx="12" cy="7" r="2.2" fill="var(--surface)" />
    <circle cx="12" cy="16" r="2.2" fill="var(--surface)" />
  </svg>
);

export const IconSettings = ({ size, className }: P) => (
  <svg {...base(size)} className={className} aria-hidden>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
  </svg>
);

export const IconAgent = ({ size, className }: P) => (
  <svg {...base(size)} className={className} aria-hidden>
    <rect x="4" y="6" width="16" height="12" rx="3" />
    <circle cx="9" cy="12" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="15" cy="12" r="1.2" fill="currentColor" stroke="none" />
    <path d="M12 6V3M8 18v2M16 18v2" />
  </svg>
);

export const IconLock = ({ size, className }: P) => (
  <svg {...base(size)} className={className} aria-hidden>
    <rect x="4.5" y="10" width="15" height="10" rx="2" />
    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
  </svg>
);

export const IconArrow = ({ size, className }: P) => (
  <svg {...base(size)} className={className} aria-hidden>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

export const IconPlus = ({ size, className }: P) => (
  <svg {...base(size)} className={className} aria-hidden>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

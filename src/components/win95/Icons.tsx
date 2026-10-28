/** Small pixel-style icons drawn as SVG (crisp at 16/32px). */
type IconProps = { size?: number; className?: string };

const base = (size: number, className?: string) => ({
  width: size,
  height: size,
  className,
  shapeRendering: "crispEdges" as const,
  "aria-hidden": true,
});

export function LogoIcon({ size = 16, className }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" {...base(size, className)}>
      <rect x="0" y="1" width="16" height="14" fill="#000" />
      <rect x="1" y="2" width="14" height="12" fill="#c0c0c0" />
      <rect x="1" y="2" width="14" height="3" fill="#000080" />
      <rect x="12" y="3" width="2" height="1" fill="#fff" />
      <circle cx="8" cy="9.5" r="3.5" fill="#ffd23f" stroke="#000" strokeWidth="1" shapeRendering="auto" />
      <rect x="6" y="8" width="1" height="1" fill="#000" />
      <rect x="9" y="8" width="1" height="1" fill="#000" />
      <rect x="6" y="11" width="4" height="1" fill="#000" />
    </svg>
  );
}

export function FolderIcon({ size = 16, className, open }: IconProps & { open?: boolean }) {
  return (
    <svg viewBox="0 0 16 16" {...base(size, className)}>
      <path d="M1 3h5l1 1h7v10H1z" fill="#000" />
      <path d="M2 4h4l1 1h6v8H2z" fill={open ? "#fff8b0" : "#ffe680"} />
      <path d="M2 6h11v1H2z" fill="#c8a000" />
      {open && <path d="M3 8h12l-2 6H1z" fill="#ffd23f" stroke="#000" strokeWidth="1" />}
    </svg>
  );
}

export function SearchIcon({ size = 16, className }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" {...base(size, className)}>
      <circle cx="6.5" cy="6.5" r="4.5" fill="#bfe4ff" stroke="#000" strokeWidth="1.5" shapeRendering="auto" />
      <path d="M10 10l4.5 4.5" stroke="#000" strokeWidth="2.5" shapeRendering="auto" />
      <rect x="4" y="4" width="2" height="1" fill="#fff" />
    </svg>
  );
}

export function ImageIcon({ size = 16, className }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" {...base(size, className)}>
      <rect x="1" y="2" width="14" height="12" fill="#000" />
      <rect x="2" y="3" width="12" height="10" fill="#8fd3ff" />
      <path d="M2 13l4-5 3 3 2-2 3 4z" fill="#2a9d3f" />
      <rect x="10" y="4" width="2" height="2" fill="#ffd23f" />
    </svg>
  );
}

export function DownloadIcon({ size = 16, className }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" {...base(size, className)}>
      <path d="M6 1h4v6h3l-5 5-5-5h3z" fill="#008000" stroke="#000" strokeWidth="1" />
      <rect x="1" y="13" width="14" height="2" fill="#000" />
    </svg>
  );
}

export function ShareIcon({ size = 16, className }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" {...base(size, className)}>
      <path d="M2 9h3v5H2z M5 9l4-6h2l-1 4h4v3l-2 4H5z" fill="#ffd23f" stroke="#000" strokeWidth="1" />
    </svg>
  );
}

export function LinkIcon({ size = 16, className }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" {...base(size, className)}>
      <rect x="1" y="5" width="8" height="6" fill="none" stroke="#000080" strokeWidth="2" />
      <rect x="7" y="5" width="8" height="6" fill="none" stroke="#000" strokeWidth="2" />
    </svg>
  );
}

export function WarningIcon({ size = 32, className }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" {...base(size, className)}>
      <path d="M16 2l14 27H2z" fill="#ffff00" stroke="#000" strokeWidth="2" shapeRendering="auto" />
      <rect x="14" y="10" width="4" height="11" fill="#000" />
      <rect x="14" y="23" width="4" height="3" fill="#000" />
    </svg>
  );
}

export function InfoIcon({ size = 32, className }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" {...base(size, className)}>
      <circle cx="16" cy="16" r="14" fill="#0000ff" stroke="#000" strokeWidth="1.5" shapeRendering="auto" />
      <rect x="14" y="7" width="4" height="4" fill="#fff" />
      <rect x="14" y="13" width="4" height="12" fill="#fff" />
    </svg>
  );
}

export function ErrorIcon({ size = 32, className }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" {...base(size, className)}>
      <circle cx="16" cy="16" r="14" fill="#ff0000" stroke="#000" strokeWidth="1.5" shapeRendering="auto" />
      <path d="M10 10l12 12M22 10L10 22" stroke="#fff" strokeWidth="3.5" shapeRendering="auto" />
    </svg>
  );
}

export function ComputerIcon({ size = 32, className }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" {...base(size, className)}>
      <rect x="4" y="3" width="24" height="18" fill="#c0c0c0" stroke="#000" />
      <rect x="7" y="6" width="18" height="12" fill="#008080" />
      <rect x="12" y="21" width="8" height="3" fill="#808080" />
      <rect x="3" y="24" width="26" height="5" fill="#c0c0c0" stroke="#000" />
      <rect x="20" y="26" width="6" height="1" fill="#008000" />
    </svg>
  );
}

export function TrashIcon({ size = 16, className }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" {...base(size, className)}>
      <rect x="3" y="4" width="10" height="11" fill="#dfdfdf" stroke="#000" />
      <rect x="2" y="2" width="12" height="2" fill="#808080" stroke="#000" />
      <path d="M6 6v7M8 6v7M10 6v7" stroke="#808080" />
    </svg>
  );
}

export function UploadIcon({ size = 16, className }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" {...base(size, className)}>
      <path d="M6 12h4V6h3L8 1 3 6h3z" fill="#000080" stroke="#000" strokeWidth="1" />
      <rect x="1" y="13" width="14" height="2" fill="#000" />
    </svg>
  );
}

export function HelpIcon({ size = 16, className }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" {...base(size, className)}>
      <rect x="2" y="1" width="12" height="14" fill="#fff" stroke="#000" />
      <rect x="2" y="1" width="3" height="14" fill="#000080" />
      <path d="M7 5h4v3H9v2" stroke="#000" strokeWidth="1.5" fill="none" />
      <rect x="8" y="11" width="2" height="2" fill="#000" />
    </svg>
  );
}

export function DiceIcon({ size = 16, className }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" {...base(size, className)}>
      <rect x="1" y="1" width="14" height="14" fill="#fff" stroke="#000" />
      <rect x="3" y="3" width="2" height="2" fill="#c00000" />
      <rect x="7" y="7" width="2" height="2" fill="#c00000" />
      <rect x="11" y="11" width="2" height="2" fill="#c00000" />
    </svg>
  );
}

export function FlagIcon({ size = 16, className }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" {...base(size, className)}>
      <rect x="2" y="1" width="1" height="14" fill="#000" />
      <path d="M3 2h10l-2 3 2 3H3z" fill="#ff0000" stroke="#000" strokeWidth="1" />
    </svg>
  );
}

export function GearIcon({ size = 16, className }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" {...base(size, className)}>
      <path d="M7 1h2v2l2 1 1-1 1 1-1 2 1 1h2v2h-2l-1 2 1 1-1 1-2-1-1 1v2H7v-2l-2-1-1 1-1-1 1-2-1-1H1V7h2l1-2-1-1 1-1 2 1 1-1z" fill="#808080" stroke="#000" strokeWidth="1" />
      <circle cx="8" cy="8" r="2" fill="#c0c0c0" stroke="#000" strokeWidth="1" />
    </svg>
  );
}

export function CloseGlyph() {
  return (
    <svg viewBox="0 0 8 7" width="8" height="7" shapeRendering="crispEdges" aria-hidden>
      <path d="M0 0h2v1h1v1h2V1h1V0h2v1H7v1H6v1H5v1h1v1h1v1h1v1H6V6H5V5H3v1H2v1H0V6h1V5h1V4h1V3H2V2H1V1H0z" />
    </svg>
  );
}

export function MinimizeGlyph() {
  return (
    <svg viewBox="0 0 6 2" width="6" height="2" shapeRendering="crispEdges" aria-hidden className="mt-1.5">
      <rect width="6" height="2" />
    </svg>
  );
}

export function MaximizeGlyph() {
  return (
    <svg viewBox="0 0 9 9" width="9" height="9" shapeRendering="crispEdges" aria-hidden>
      <path d="M0 0h9v9H0zM1 2v6h7V2z" />
    </svg>
  );
}

export const EMOTION_GLYPHS: Record<string, string> = {
  happy: "☺",
  sad: "☹",
  angry: "!",
  sarcastic: "¬",
  tired: "z",
  "burnt-out": "♨",
  awkward: "~",
  shocked: "O",
  "passive-aggressive": "✉",
  "fake-enthusiasm": "★",
  relatable: "✓",
  chaos: "※",
  confused: "?",
  excited: "‼",
  "dead-inside": "✝",
  overwhelmed: "≋",
  unbothered: "☼",
  celebrating: "♪",
};

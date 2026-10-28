import type { ReactNode } from "react";
import { CloseGlyph, LogoIcon, MaximizeGlyph, MinimizeGlyph } from "./Icons";

type WindowProps = {
  title: ReactNode;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  /** Rendered as the title-bar close button; omit for decorative-only controls. */
  onClose?: () => void;
  closeHref?: string;
  controls?: "all" | "close" | "none";
  inactive?: boolean;
  titleId?: string;
};

export function Window({
  title,
  icon,
  children,
  className = "",
  bodyClassName = "",
  onClose,
  closeHref,
  controls = "all",
  inactive,
  titleId,
}: WindowProps) {
  const close = onClose ? (
    <button type="button" className="win-title-btn ml-0.5" onClick={onClose} aria-label="Cerrar">
      <CloseGlyph />
    </button>
  ) : closeHref ? (
    <a href={closeHref} className="win-title-btn ml-0.5" aria-label="Cerrar">
      <CloseGlyph />
    </a>
  ) : (
    <span className="win-title-btn ml-0.5" aria-hidden>
      <CloseGlyph />
    </span>
  );

  return (
    <section className={`win-window flex flex-col ${className}`} aria-labelledby={titleId}>
      <header className={`win-titlebar ${inactive ? "inactive" : ""}`}>
        {icon ?? <LogoIcon />}
        <h2 id={titleId} className="win-titlebar-title text-[inherit]">
          {title}
        </h2>
        {controls === "all" && (
          <>
            <span className="win-title-btn" aria-hidden>
              <MinimizeGlyph />
            </span>
            <span className="win-title-btn" aria-hidden>
              <MaximizeGlyph />
            </span>
          </>
        )}
        {controls !== "none" && close}
      </header>
      <div className={`flex min-h-0 flex-1 flex-col ${bodyClassName}`}>{children}</div>
    </section>
  );
}

"use client";

import { useEffect, useId, useRef, useState } from "react";

interface InlineInfoPopoverProps {
  label: string;
  content: string;
}

export function InlineInfoPopover({
  label,
  content
}: InlineInfoPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement | null>(null);
  const tooltipId = useId();

  useEffect(() => {
    function handlePointerDown(event: MouseEvent | TouchEvent) {
      if (!rootRef.current) {
        return;
      }

      const target = event.target;

      if (target instanceof Node && !rootRef.current.contains(target)) {
        setIsOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown, {
      passive: true
    });
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  return (
    <span
      ref={rootRef}
      className={`inline-info-popover${isOpen ? " is-open" : ""}`}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <button
        type="button"
        className="inline-info-popover-trigger"
        aria-label={label}
        aria-expanded={isOpen}
        aria-describedby={isOpen ? tooltipId : undefined}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setIsOpen((currentValue) => !currentValue);
        }}
      >
        <span aria-hidden="true">i</span>
      </button>
      <span
        id={tooltipId}
        role="tooltip"
        className="inline-info-popover-content"
      >
        {content}
      </span>
    </span>
  );
}

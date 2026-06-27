"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState
} from "react";
import { createPortal } from "react-dom";

interface InlineInfoPopoverProps {
  label: string;
  content: string;
}

type PopoverPlacement = "top" | "bottom";

interface PopoverCoordinates {
  top: number;
  left: number;
  maxWidth: number;
}

const VIEWPORT_PADDING_PX = 16;
const POPOVER_GAP_PX = 10;
const DEFAULT_POPOVER_WIDTH_PX = 304;
const HOVER_CLOSE_DELAY_MS = 90;

export function InlineInfoPopover({
  label,
  content
}: InlineInfoPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [placement, setPlacement] = useState<PopoverPlacement>("top");
  const [coordinates, setCoordinates] = useState<PopoverCoordinates | null>(null);
  const rootRef = useRef<HTMLSpanElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLSpanElement | null>(null);
  const closeTimeoutRef = useRef<number | null>(null);
  const tooltipId = useId();

  const clearCloseTimeout = useCallback(() => {
    if (closeTimeoutRef.current !== null) {
      window.clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  }, []);

  const scheduleClose = useCallback(() => {
    clearCloseTimeout();
    closeTimeoutRef.current = window.setTimeout(() => {
      setIsOpen(false);
    }, HOVER_CLOSE_DELAY_MS);
  }, [clearCloseTimeout]);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    const popover = popoverRef.current;

    if (!trigger || !popover || typeof window === "undefined") {
      return;
    }

    const triggerRect = trigger.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const availableWidth = Math.max(
      220,
      viewportWidth - VIEWPORT_PADDING_PX * 2
    );
    const maxWidth = Math.min(DEFAULT_POPOVER_WIDTH_PX, availableWidth);

    popover.style.maxWidth = `${maxWidth}px`;

    const popoverWidth = Math.min(popover.offsetWidth || maxWidth, maxWidth);
    const popoverHeight = popover.offsetHeight || 0;

    let nextLeft = triggerRect.right - popoverWidth + 8;
    nextLeft = Math.max(
      VIEWPORT_PADDING_PX,
      Math.min(nextLeft, viewportWidth - popoverWidth - VIEWPORT_PADDING_PX)
    );

    const preferredTop = triggerRect.top - popoverHeight - POPOVER_GAP_PX;
    const fallbackTop = triggerRect.bottom + POPOVER_GAP_PX;
    const hasTopSpace = preferredTop >= VIEWPORT_PADDING_PX;
    const hasBottomSpace =
      fallbackTop + popoverHeight <= viewportHeight - VIEWPORT_PADDING_PX;

    let nextPlacement: PopoverPlacement = "top";
    let nextTop = preferredTop;

    if (!hasTopSpace && hasBottomSpace) {
      nextPlacement = "bottom";
      nextTop = fallbackTop;
    } else if (!hasTopSpace && !hasBottomSpace) {
      const topOverflow = Math.abs(preferredTop - VIEWPORT_PADDING_PX);
      const bottomOverflow = Math.abs(
        fallbackTop + popoverHeight - (viewportHeight - VIEWPORT_PADDING_PX)
      );

      if (bottomOverflow < topOverflow) {
        nextPlacement = "bottom";
        nextTop = Math.max(
          VIEWPORT_PADDING_PX,
          viewportHeight - popoverHeight - VIEWPORT_PADDING_PX
        );
      } else {
        nextPlacement = "top";
        nextTop = VIEWPORT_PADDING_PX;
      }
    }

    setPlacement(nextPlacement);
    setCoordinates({
      top: nextTop,
      left: nextLeft,
      maxWidth
    });
  }, []);

  useEffect(() => {
    setIsMounted(true);

    return () => {
      clearCloseTimeout();
    };
  }, [clearCloseTimeout]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent | TouchEvent) {
      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      const clickedInsideRoot = rootRef.current?.contains(target);
      const clickedInsidePopover = popoverRef.current?.contains(target);

      if (!clickedInsideRoot && !clickedInsidePopover) {
        setIsOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    function handleViewportChange() {
      updatePosition();
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown, {
      passive: true
    });
    document.addEventListener("keydown", handleEscape);
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [isOpen, updatePosition]);

  useLayoutEffect(() => {
    if (!isOpen) {
      setCoordinates(null);
      return;
    }

    updatePosition();
  }, [isOpen, updatePosition]);

  return (
    <>
      <span
        ref={rootRef}
        className={`inline-info-popover${isOpen ? " is-open" : ""}`}
        onMouseEnter={() => {
          clearCloseTimeout();
          setIsOpen(true);
        }}
        onMouseLeave={scheduleClose}
      >
        <button
          ref={triggerRef}
          type="button"
          className="inline-info-popover-trigger"
          aria-label={label}
          aria-expanded={isOpen}
          aria-describedby={isOpen ? tooltipId : undefined}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            clearCloseTimeout();
            setIsOpen((currentValue) => !currentValue);
          }}
        >
          <span aria-hidden="true">i</span>
        </button>
      </span>

      {isMounted && isOpen
        ? createPortal(
            <span
              ref={popoverRef}
              id={tooltipId}
              role="tooltip"
              className={`inline-info-popover-content inline-info-popover-content-${placement}`}
              style={{
                top: coordinates?.top ?? VIEWPORT_PADDING_PX,
                left: coordinates?.left ?? VIEWPORT_PADDING_PX,
                maxWidth: coordinates?.maxWidth ?? DEFAULT_POPOVER_WIDTH_PX
              }}
              onMouseEnter={clearCloseTimeout}
              onMouseLeave={scheduleClose}
            >
              {content}
            </span>,
            document.body
          )
        : null}
    </>
  );
}

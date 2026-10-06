"use client";
import { useEffect, useId, useRef, useState } from "react";
import type { InfoNote } from "@/lib/diagnostic/questions";

/**
 * The (?) next to a question. Opens on hover or click on desktop and on tap on
 * phones; closes on Escape, outside click or a second tap.
 */
export function InfoTip({ note, label }: { note: InfoNote; label: string }) {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const root = useRef<HTMLSpanElement>(null);
  const panelId = useId();
  const hoverTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) {
        setOpen(false);
        setPinned(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setPinned(false);
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const hoverable = () => typeof window !== "undefined" && window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  return (
    <span
      ref={root}
      className="relative inline-block align-middle"
      onPointerEnter={() => {
        if (!hoverable()) return;
        clearTimeout(hoverTimer.current);
        setOpen(true);
      }}
      onPointerLeave={() => {
        if (!hoverable() || pinned) return;
        hoverTimer.current = setTimeout(() => setOpen(false), 150);
      }}
    >
      <button
        type="button"
        aria-label={`About: ${label}`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          const next = !(open && pinned);
          setPinned(next);
          setOpen(next);
        }}
        className={`ml-2 inline-flex h-6 w-6 items-center justify-center rounded-full border text-xs font-semibold transition-colors ${
          open ? "border-ink bg-ink text-paper" : "border-line-strong text-ink-2 hover:border-ink hover:text-ink"
        }`}
      >
        ?
      </button>
      {open && (
        <span
          id={panelId}
          role="note"
          className="fixed inset-x-0 bottom-0 z-50 block max-h-[70vh] overflow-y-auto border-t border-ink bg-card p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-left text-sm font-normal leading-relaxed text-ink shadow-2xl sm:absolute sm:inset-x-auto sm:bottom-auto sm:left-0 sm:top-full sm:mt-2 sm:w-[22rem] sm:border sm:p-4 sm:shadow-lg"
        >
          <Row title="What is it?" text={note.what} />
          <Row title="Why we need it" text={note.why} />
          {note.where && <Row title="Where can I find it?" text={note.where} />}
          {note.example && <Row title="Example" text={note.example} />}
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setPinned(false);
            }}
            className="mt-4 min-h-11 w-full border border-ink font-medium sm:hidden"
          >
            Got it
          </button>
        </span>
      )}
    </span>
  );
}

function Row({ title, text }: { title: string; text: string }) {
  return (
    <span className="block [&+&]:mt-3">
      <span className="block text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-ink-3">{title}</span>
      <span className="mt-0.5 block">{text}</span>
    </span>
  );
}

"use client";
import { useEffect, useId, useMemo, useRef, useState } from "react";

export interface ComboOption {
  value: string;
  label: string;
  hint?: string;
}

/** Search is offered once a list is long enough to need it. */
const SEARCH_FROM = 7;

const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "");

/**
 * A select with search, keyboard support and a clear selected state.
 * On phones the list opens as a sheet from the bottom, with large tap targets.
 */
export function Combobox({
  id,
  value,
  options,
  onChange,
  placeholder = "Select…",
  disabled,
  invalid,
  describedBy,
  labelledBy,
}: {
  id: string;
  value: string | undefined;
  options: ComboOption[];
  onChange: (v: string | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
  labelledBy?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const listId = useId();
  const selected = options.find((o) => o.value === value);
  const searchable = options.length >= SEARCH_FROM;

  const filtered = useMemo(() => {
    const q = fold(query.trim());
    if (!q) return options;
    return options.filter((o) => fold(`${o.label} ${o.hint ?? ""}`).includes(q));
  }, [options, query]);

  function openList() {
    if (disabled) return;
    setQuery("");
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
  }

  function close(focusButton = true) {
    setOpen(false);
    if (focusButton) button.current?.focus();
  }

  function choose(o: ComboOption) {
    onChange(o.value);
    close();
  }

  useEffect(() => {
    if (!open) return;
    if (searchable) search.current?.focus();
    else list.current?.focus();
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open, searchable]);

  useEffect(() => {
    if (!open) return;
    list.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(filtered.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Home") {
      e.preventDefault();
      setActive(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActive(filtered.length - 1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[active]) choose(filtered[active]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  }

  return (
    <div ref={root} className="relative">
      <button
        ref={button}
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        aria-invalid={invalid}
        disabled={disabled}
        onClick={() => (open ? close(false) : openList())}
        onKeyDown={(e) => {
          if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            openList();
          }
        }}
        className={`flex min-h-14 w-full items-center justify-between gap-3 border px-4 text-left text-base transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
          invalid ? "border-alert" : selected ? "border-ink bg-card" : "border-line-strong bg-card hover:border-ink"
        }`}
      >
        <span className={`min-w-0 truncate ${selected ? "font-medium" : "text-ink-3"}`}>
          {selected ? (
            <>
              <span aria-hidden className="mr-2 text-accent">
                ✓
              </span>
              {selected.label}
            </>
          ) : (
            placeholder
          )}
        </span>
        <svg aria-hidden viewBox="0 0 12 8" className={`h-2 w-3 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}>
          <path d="M1 1l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </button>

      {open && (
        <>
          {/* Phone backdrop for the bottom sheet. */}
          <div aria-hidden className="fixed inset-0 z-40 bg-ink/30 sm:hidden" onClick={() => close(false)} />
          <div
            className="fixed inset-x-0 bottom-0 z-50 flex max-h-[75vh] flex-col border-t border-ink bg-card pb-[env(safe-area-inset-bottom)] shadow-2xl sm:absolute sm:inset-x-0 sm:bottom-auto sm:top-full sm:mt-1 sm:max-h-80 sm:border sm:shadow-lg"
            onKeyDown={onKey}
          >
            <div className="flex items-center justify-between border-b border-line px-4 py-3 sm:hidden">
              <span className="font-medium">{placeholder.replace(/…$/, "")}</span>
              <button type="button" onClick={() => close()} className="min-h-10 px-2 text-sm text-ink-2">
                Close
              </button>
            </div>
            {searchable && (
              <div className="border-b border-line p-2">
                <input
                  ref={search}
                  type="search"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setActive(0);
                  }}
                  placeholder="Type to search"
                  aria-label="Search options"
                  aria-controls={listId}
                  aria-activedescendant={filtered[active] ? `${listId}-${active}` : undefined}
                  autoComplete="off"
                  className="block min-h-11 w-full border border-line-strong bg-paper px-3 text-base outline-none focus:border-ink"
                />
              </div>
            )}
            <ul
              ref={list}
              id={listId}
              role="listbox"
              tabIndex={-1}
              aria-labelledby={labelledBy}
              aria-activedescendant={!searchable && filtered[active] ? `${listId}-${active}` : undefined}
              className="flex-1 overflow-y-auto overscroll-contain py-1 outline-none"
            >
              {filtered.map((o, i) => {
                const isSelected = o.value === value;
                return (
                  <li
                    key={o.value}
                    id={`${listId}-${i}`}
                    data-index={i}
                    role="option"
                    aria-selected={isSelected}
                    onPointerEnter={() => setActive(i)}
                    onClick={() => choose(o)}
                    className={`flex min-h-12 cursor-pointer items-center gap-3 px-4 py-2 ${i === active ? "bg-paper-2" : ""} ${
                      isSelected ? "font-medium" : ""
                    }`}
                  >
                    <span aria-hidden className={`w-4 shrink-0 text-accent ${isSelected ? "" : "invisible"}`}>
                      ✓
                    </span>
                    <span className="min-w-0">
                      <span className="block">{o.label}</span>
                      {o.hint && <span className="block text-sm text-ink-3">{o.hint}</span>}
                    </span>
                  </li>
                );
              })}
              {filtered.length === 0 && <li className="px-4 py-3 text-sm text-ink-3">No match. Try another word, or pick “Other”.</li>}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

import { useEffect, useRef, useState } from "react";

export type Option = { id: number; label: string; sublabel?: string };

type Props = {
  placeholder: string;
  /** Called as the user types; returns matching options. */
  search: (q: string) => Promise<Option[]>;
  /** Called when the user chooses "Add …"; returns the created option. */
  create: (name: string) => Promise<Option>;
  onSelect: (option: Option) => void;
  /** Clear the input after a selection (used for multi-add artist lineups). */
  clearOnSelect?: boolean;
  inputId?: string;
};

export function Combobox({ placeholder, search, create, onSelect, clearOnSelect, inputId }: Props) {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<Option[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [busy, setBusy] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const debounce = useRef<number>();

  useEffect(() => {
    window.clearTimeout(debounce.current);
    debounce.current = window.setTimeout(async () => {
      try {
        const results = await search(query.trim());
        setOptions(results);
        setActive(0);
      } catch {
        setOptions([]);
      }
    }, 150);
    return () => window.clearTimeout(debounce.current);
  }, [query, search]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const trimmed = query.trim();
  const exactMatch = options.some((o) => o.label.toLowerCase() === trimmed.toLowerCase());
  const showCreate = trimmed.length > 0 && !exactMatch;
  const rowCount = options.length + (showCreate ? 1 : 0);

  const choose = async (index: number) => {
    if (index < options.length) {
      onSelect(options[index]);
      finish(options[index].label);
    } else if (showCreate) {
      setBusy(true);
      try {
        const created = await create(trimmed);
        onSelect(created);
        finish(created.label);
      } finally {
        setBusy(false);
      }
    }
  };

  const finish = (label: string) => {
    setQuery(clearOnSelect ? "" : label);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter")) setOpen(true);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, rowCount - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (rowCount > 0) void choose(active);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className="combobox" ref={rootRef}>
      <input
        id={inputId}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        autoComplete="off"
        placeholder={placeholder}
        value={query}
        disabled={busy}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />
      {open && rowCount > 0 && (
        <ul className="combobox-list" role="listbox">
          {options.map((o, i) => (
            <li
              key={o.id}
              role="option"
              aria-selected={i === active}
              className={i === active ? "active" : ""}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                void choose(i);
              }}
            >
              <span>{o.label}</span>
              {o.sublabel && <span className="sublabel">{o.sublabel}</span>}
            </li>
          ))}
          {showCreate && (
            <li
              role="option"
              aria-selected={active === options.length}
              className={`create-row ${active === options.length ? "active" : ""}`}
              onMouseEnter={() => setActive(options.length)}
              onMouseDown={(e) => {
                e.preventDefault();
                void choose(options.length);
              }}
            >
              Add “{trimmed}”
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { foldPlayerName, searchPlayers } from "../game/playerSearch.js";

const MENU_MARGIN = 8;

function menuBox(input, contentHeight) {
  const rect = input.getBoundingClientRect();
  const viewport = window.visualViewport;
  const viewTop = viewport?.offsetTop || 0;
  const viewLeft = viewport?.offsetLeft || 0;
  const viewWidth = viewport?.width || window.innerWidth;
  const viewHeight = viewport?.height || window.innerHeight;
  const viewBottom = viewTop + viewHeight;
  const anchorTop = rect.top + viewTop;
  const anchorBottom = rect.bottom + viewTop;
  const spaceBelow = Math.max(0, viewBottom - anchorBottom - MENU_MARGIN);
  const spaceAbove = Math.max(0, anchorTop - viewTop - MENU_MARGIN);
  const openBelow = spaceBelow >= contentHeight || spaceBelow >= spaceAbove;
  const maxHeight = Math.min(280, Math.max(48, Math.floor(openBelow ? spaceBelow : spaceAbove)));
  const height = Math.min(contentHeight, maxHeight);
  const width = Math.min(Math.max(rect.width, 220), viewWidth - MENU_MARGIN * 2);
  let left = rect.left + viewLeft;
  const maxLeft = viewLeft + viewWidth - MENU_MARGIN - width;
  if (left > maxLeft) left = maxLeft;
  if (left < viewLeft + MENU_MARGIN) left = viewLeft + MENU_MARGIN;
  const top = openBelow
    ? anchorBottom + 4
    : Math.max(viewTop + MENU_MARGIN, anchorTop - 4 - height);
  return {
    top: Math.round(top),
    left: Math.round(left),
    width: Math.round(width),
    maxHeight: Math.round(maxHeight),
  };
}

export default function PlayerSearch({ resetKey, disabled, onSubmit }) {
  const listId = useId();
  const emptyId = useId();
  const inputRef = useRef(null);
  const menuRef = useRef(null);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const [box, setBox] = useState(null);
  const suggestions = searchPlayers(query);
  const searching = !disabled && foldPlayerName(query).length > 0;
  const open = searching && suggestions.length > 0;
  const showEmpty = searching && suggestions.length === 0;
  const active = open ? Math.min(highlight, suggestions.length - 1) : 0;

  useEffect(() => {
    setQuery("");
    setHighlight(0);
    if (!disabled) inputRef.current?.focus();
  }, [resetKey, disabled]);

  useEffect(() => {
    setHighlight(0);
  }, [query]);

  useLayoutEffect(() => {
    if (!searching) return undefined;
    const place = () => {
      const input = inputRef.current;
      if (!input) return;
      const estimated = suggestions.length ? Math.min(280, suggestions.length * 48 + 16) : 52;
      const contentHeight = Math.min(280, Math.max(48, menuRef.current?.scrollHeight || estimated));
      const next = menuBox(input, contentHeight);
      setBox((current) => (
        current
        && current.top === next.top
        && current.left === next.left
        && current.width === next.width
        && current.maxHeight === next.maxHeight
          ? current
          : next
      ));
    };
    place();
    const viewport = window.visualViewport;
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    viewport?.addEventListener("resize", place);
    viewport?.addEventListener("scroll", place);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      viewport?.removeEventListener("resize", place);
      viewport?.removeEventListener("scroll", place);
    };
  }, [searching, query, suggestions.length, box]);

  useEffect(() => {
    if (!open) return undefined;
    menuRef.current?.querySelector("[data-active='true']")?.scrollIntoView({ block: "nearest" });
    return undefined;
  }, [open, active, box]);

  function commit(player) {
    if (!player?.name || disabled) return;
    onSubmit(player.name);
  }

  function onFormSubmit(event) {
    event.preventDefault();
    if (!open) return;
    commit(suggestions[active]);
  }

  function onKeyDown(event) {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "ArrowDown" && open) {
      event.preventDefault();
      setHighlight((current) => (Math.min(current, suggestions.length - 1) + 1) % suggestions.length);
    } else if (event.key === "ArrowUp" && open) {
      event.preventDefault();
      setHighlight((current) => {
        const index = Math.min(current, suggestions.length - 1);
        return (index - 1 + suggestions.length) % suggestions.length;
      });
    } else if (event.key === "Home" && open) {
      event.preventDefault();
      setHighlight(0);
    } else if (event.key === "End" && open) {
      event.preventDefault();
      setHighlight(suggestions.length - 1);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setQuery("");
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (open) commit(suggestions[active]);
    }
  }

  const menu = searching && box ? (
    open ? (
      <ul
        id={listId}
        ref={menuRef}
        role="listbox"
        className="player-search-menu"
        style={{ top: box.top, left: box.left, width: box.width, maxHeight: box.maxHeight }}
      >
        {suggestions.map((player, index) => (
          <li key={player.id ?? player.name} role="presentation">
            <button
              type="button"
              role="option"
              id={`${listId}-${index}`}
              aria-selected={index === active}
              data-active={index === active ? "true" : "false"}
              className={`player-search-option ${index === active ? "is-active" : ""}`}
              tabIndex={-1}
              onMouseEnter={() => setHighlight(index)}
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => commit(player)}
            >
              <span className="player-search-copy">
                <strong>{player.name}</strong>
              </span>
              <span className="player-search-select">Select</span>
            </button>
          </li>
        ))}
      </ul>
    ) : (
      <div
        id={emptyId}
        ref={menuRef}
        role="status"
        className="player-search-menu player-search-empty"
        style={{ top: box.top, left: box.left, width: box.width, maxHeight: box.maxHeight }}
      >
        No players found
      </div>
    )
  ) : null;

  return (
    <form className="player-search" onSubmit={onFormSubmit}>
      <label className="player-search-field">
        <svg className="player-search-icon" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="11" cy="11" r="6.5" />
          <path d="M16 16.5 20 20.5" />
        </svg>
        <input
          ref={inputRef}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={open ? listId : showEmpty ? emptyId : undefined}
          aria-activedescendant={open ? `${listId}-${active}` : undefined}
          aria-label="Search for a player"
          placeholder="Search for a player"
          value={query}
          disabled={disabled}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck="false"
          enterKeyHint="go"
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onKeyDown}
        />
        {query && !disabled ? (
          <button
            type="button"
            className="player-search-clear"
            aria-label="Clear search"
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
          >
            ×
          </button>
        ) : null}
      </label>
      {menu ? createPortal(menu, document.body) : null}
    </form>
  );
}

function Icon({ children }) {
  return (
    <svg className="stat-icon" viewBox="0 0 24 24" aria-hidden="true">
      {children}
    </svg>
  );
}

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

export default function StatIcon({ id }) {
  if (id === "ppg") {
    return (
      <Icon>
        <circle cx="12" cy="12" r="8" {...stroke} />
        <path d="M4.2 12h15.6M12 4.2v15.6M7 7.2c1.8 1.6 1.8 8 0 9.6M17 7.2c-1.8 1.6-1.8 8 0 9.6" {...stroke} />
      </Icon>
    );
  }
  if (id === "rpg") {
    return (
      <Icon>
        <path d="M5 16h14M12 16V7" {...stroke} />
        <path d="M8.5 10.5 12 7l3.5 3.5" {...stroke} />
      </Icon>
    );
  }
  if (id === "apg") {
    return (
      <Icon>
        <circle cx="6" cy="12" r="2.2" {...stroke} />
        <path d="M8.2 12h7.2" {...stroke} />
        <path d="M12.8 8.6 16.4 12l-3.6 3.4" {...stroke} />
      </Icon>
    );
  }
  if (id === "spg") {
    return (
      <Icon>
        <path d="M8 14.5c0-3 1.2-6.5 4-8.5 2.2 2.4 2.6 5.2 2.2 7.2" {...stroke} />
        <path d="M7 16.5h10" {...stroke} />
      </Icon>
    );
  }
  if (id === "bpg") {
    return (
      <Icon>
        <path d="M6 5.5h12v8.2c0 3.2-2.4 5.3-6 6.3-3.6-1-6-3.1-6-6.3V5.5Z" {...stroke} />
        <path d="M9 12.2 11.2 14l3.8-4.2" {...stroke} />
      </Icon>
    );
  }
  if (id === "fgPct") {
    return (
      <Icon>
        <circle cx="12" cy="12" r="7.5" {...stroke} />
        <circle cx="12" cy="12" r="3.2" {...stroke} />
        <circle cx="12" cy="12" r="0.8" fill="currentColor" />
      </Icon>
    );
  }
  if (id === "tpPct") {
    return (
      <Icon>
        <path d="M5 16.5c2.2-6 11.8-6 14 0" {...stroke} />
        <circle cx="7" cy="16.2" r="1.1" fill="currentColor" />
        <circle cx="12" cy="9.2" r="1.1" fill="currentColor" />
        <circle cx="17" cy="16.2" r="1.1" fill="currentColor" />
      </Icon>
    );
  }
  if (id === "ftPct") {
    return (
      <Icon>
        <path d="M12 4.5v15" {...stroke} />
        <circle cx="12" cy="8" r="2.3" {...stroke} />
        <path d="M7 19.5h10" {...stroke} />
      </Icon>
    );
  }
  if (id === "salary") {
    return (
      <Icon>
        <path d="M12 5v14M15.2 8.2c-.6-1-1.7-1.6-3.2-1.6-2 0-3.3 1.1-3.3 2.6 0 3.6 6.6 1.6 6.6 5 0 1.6-1.5 2.8-3.5 2.8-1.6 0-2.8-.7-3.4-1.8" {...stroke} />
      </Icon>
    );
  }
  if (id === "heightIn") {
    return (
      <Icon>
        <path d="M12 4.5v15M8.5 7.5 12 4.5 15.5 7.5M8.5 16.5 12 19.5l3.5-3" {...stroke} />
      </Icon>
    );
  }
  if (id === "threes") {
    return (
      <Icon>
        <circle cx="8" cy="14" r="2" {...stroke} />
        <circle cx="12" cy="8" r="2" {...stroke} />
        <circle cx="16" cy="14" r="2" {...stroke} />
      </Icon>
    );
  }
  return (
    <Icon>
      <path d="M12 4.8 14.1 9l4.6.5-3.4 3.1.9 4.5L12 15.1 7.8 17.1l.9-4.5L5.3 9.5 9.9 9 12 4.8Z" {...stroke} />
    </Icon>
  );
}

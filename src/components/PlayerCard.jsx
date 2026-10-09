import { useState } from "react";
import { teamLogoUrl } from "../game/teams.js";

function initials(name) {
  return name
    .split(" ")
    .filter((part) => part[0] && /[A-Za-z]/.test(part[0]))
    .slice(0, 2)
    .map((part) => part[0])
    .join("");
}

export default function PlayerCard({
  player,
  category,
  revealed,
  picked,
  higher,
  disabled,
  onSelect,
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);
  const stat = revealed ? category.format(player[category.id]) : null;
  const tone = revealed ? (higher ? "higher" : "lower") : "";
  const logo = teamLogoUrl(player.team);

  return (
    <button
      type="button"
      className={`player-card ${tone}`}
      onClick={() => onSelect(player.id)}
      disabled={disabled}
      aria-pressed={picked}
    >
      <span className="photo-frame">
        {imageFailed ? (
          <span className="initials" aria-hidden="true">
            {initials(player.name)}
          </span>
        ) : (
          <img
            src={`https://cdn.nba.com/headshots/nba/latest/1040x760/${player.id}.png`}
            alt=""
            onError={() => setImageFailed(true)}
          />
        )}
      </span>
      <span className="player-copy">
        <span className="player-name">{player.name}</span>
        <span className="player-team">
          {logo && !logoFailed ? (
            <img
              className="team-logo"
              src={logo}
              alt=""
              onError={() => setLogoFailed(true)}
            />
          ) : null}
          {player.team}
        </span>
        {revealed ? <span className="player-stat">{stat}</span> : null}
      </span>
      <span className="higher-label">{revealed ? (higher ? "Higher" : "Lower") : "Higher"}</span>
    </button>
  );
}

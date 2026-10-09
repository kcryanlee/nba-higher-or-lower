import { useState } from "react";
import { approvedPlayerImage, playerImageUrl } from "../data/playerMedia.js";
import { teamColors, teamLogoUrl } from "../game/teams.js";

function PlayerSilhouette() {
  return (
    <svg className="player-silhouette" viewBox="0 0 1040 760" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <path d="M520 128c-66 0-118 52-118 118 0 48 28 88 70 106-22 14-42 36-54 62-86 40-178 122-208 268-8 38 18 78 58 78h504c40 0 66-40 58-78-30-146-122-228-208-268-12-26-32-48-54-62 42-18 70-58 70-106 0-66-52-118-118-118z" />
    </svg>
  );
}

export default function PlayerCard({
  player,
  category,
  revealed,
  picked,
  higher,
  tied = false,
  disabled,
  onSelect,
}) {
  const [failedSrc, setFailedSrc] = useState("");
  const [failedLogo, setFailedLogo] = useState("");
  const statValue = player[category.id];
  const stat = revealed && Number.isFinite(statValue) ? category.format(statValue) : null;
  const tone = revealed ? (tied ? "equal" : higher ? "higher" : "lower") : "";
  const verdict = revealed ? (tied ? "Equal" : higher ? "Higher" : "Lower") : "";
  const photo = approvedPlayerImage(player.image) || playerImageUrl(player.id);
  const showPhoto = Boolean(photo) && failedSrc !== photo;
  const logo = player.teamLogo || teamLogoUrl(player.team);
  const colors = player.teamColors || teamColors(player.team);

  return (
    <button
      type="button"
      className={`player-card ${tone}`}
      onClick={() => onSelect(player.id)}
      disabled={disabled}
      aria-pressed={picked}
    >
      <span
        className={`photo-frame ${showPhoto ? "" : "is-fallback"}`}
        style={showPhoto ? undefined : {
          "--team-primary": colors.primary,
          "--team-secondary": colors.secondary,
          "--team-ink": colors.ink,
        }}
      >
        {showPhoto ? (
          <img
            src={photo}
            alt=""
            onError={() => setFailedSrc(photo)}
          />
        ) : (
          <PlayerSilhouette />
        )}
      </span>
      <span className="player-copy">
        <span className="player-name">{player.name}</span>
        <span className="player-team">
          {logo && failedLogo !== logo ? (
            <img
              className="team-logo"
              src={logo}
              alt=""
              onError={() => setFailedLogo(logo)}
            />
          ) : null}
          {player.team || ""}
        </span>
        {revealed ? <span className="player-stat">{stat}</span> : null}
      </span>
      <span className="higher-label">{verdict}</span>
    </button>
  );
}

import { useEffect, useState } from "react";
import { approvedPlayerImage, playerImageUrl } from "../data/playerMedia.js";
import { draftModeLabel, draftPrompt, formatDraftChoice, formatDraftFact, formatDraftReveal } from "../game/draft.js";
import { teamColors, teamLogoUrl } from "../game/teams.js";

function PlayerSilhouette() {
  return (
    <svg className="player-silhouette" viewBox="0 0 1040 760" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <path d="M520 128c-66 0-118 52-118 118 0 48 28 88 70 106-22 14-42 36-54 62-86 40-178 122-208 268-8 38 18 78 58 78h504c40 0 66-40 58-78-30-146-122-228-208-268-12-26-32-48-54-62 42-18 70-58 70-106 0-66-52-118-118-118z" />
    </svg>
  );
}

function DraftPlayer({ question }) {
  const [failedSrc, setFailedSrc] = useState("");
  const [failedLogo, setFailedLogo] = useState("");
  const photo = approvedPlayerImage(question.image) || playerImageUrl(question.id);
  const showPhoto = Boolean(photo) && failedSrc !== photo;
  const logo = question.teamLogo || teamLogoUrl(question.team);
  const colors = question.teamColors || teamColors(question.team);

  return (
    <div className="draft-player">
      <span
        className={`photo-frame ${showPhoto ? "" : "is-fallback"}`}
        style={showPhoto ? undefined : {
          "--team-primary": colors.primary,
          "--team-secondary": colors.secondary,
          "--team-ink": colors.ink,
        }}
      >
        {showPhoto ? (
          <img src={photo} alt="" onError={() => setFailedSrc(photo)} />
        ) : (
          <PlayerSilhouette />
        )}
      </span>
      <span className="player-copy">
        <span className="player-name">{question.name}</span>
        <span className="player-team">
          {logo && failedLogo !== logo ? (
            <img className="team-logo" src={logo} alt="" onError={() => setFailedLogo(logo)} />
          ) : null}
          {question.team}
        </span>
      </span>
    </div>
  );
}

export default function DraftGame({
  phase,
  mode,
  streak,
  best,
  question,
  result,
  guess,
  unlockedBadges = [],
  onSubmit,
  onAdvance,
  onAgain,
  onAwards,
  onMenu,
}) {
  const revealing = phase === "revealing";
  const label = draftModeLabel(mode);

  useEffect(() => {
    if (!revealing) return undefined;
    function onKey(event) {
      if (event.key !== "Enter") return;
      if (event.target instanceof Element && event.target.closest("button")) return;
      event.preventDefault();
      onAdvance();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [revealing, onAdvance]);

  if ((phase === "gameover" || phase === "cleared") && question) {
    const cleared = phase === "cleared";
    return (
      <section className="panel draft-over">
        <p className="eyebrow">{cleared ? "Round complete" : label}</p>
        <h1 className="section-title">{streak}</h1>
        <p className="streak-label">Win streak</p>
        <p className="badge">Best {best}</p>
        <p className="lede">
          {cleared
            ? `That's every player available for ${label}.`
            : formatDraftFact(question.name, mode, question.answer)}
        </p>
        <div className="actions">
          <button type="button" className="action" onClick={onAgain}>
            Play again
          </button>
          <button type="button" className="action secondary" onClick={onAwards}>
            Achievements
          </button>
          <button type="button" className="action secondary" onClick={onMenu}>
            All Games
          </button>
        </div>
      </section>
    );
  }

  if (!question?.choices || (phase !== "playing" && phase !== "revealing")) return null;

  return (
    <section className="panel draft-board">
      <p className="band">
        Draft Pick
        <span className="score-dot" aria-hidden="true">
          {" "}
          •{" "}
        </span>
        {label}
      </p>
      <h1 id="draft-prompt" className="section-title">{draftPrompt(mode)}</h1>
      <DraftPlayer question={question} />
      <div className="career-choices" role="group" aria-labelledby="draft-prompt">
        {question.choices.map((choice) => {
          const chosen = guess === choice;
          const correct = revealing && choice === question.answer;
          const missed = revealing && chosen && result === "wrong";
          return (
            <button
              key={choice}
              type="button"
              className={`action secondary career-choice ${correct ? "is-correct" : ""} ${missed ? "is-wrong" : ""}`}
              onClick={() => onSubmit(choice)}
              disabled={revealing}
            >
              {formatDraftChoice(mode, choice)}
            </button>
          );
        })}
      </div>
      {revealing ? (
        <div className={`reveal ${result === "correct" ? "is-correct" : "is-wrong"}`} role="status">
          <p className={`reveal-title ${result === "correct" ? "is-right" : "is-miss"}`}>
            {result === "correct" ? "Correct" : "Wrong"}
          </p>
          <p className="reveal-value">{formatDraftReveal(mode, question.answer)}</p>
          <button type="button" className="action" onClick={onAdvance}>
            {result === "correct" ? "Next" : "Continue"}
          </button>
        </div>
      ) : null}
      {revealing
        ? unlockedBadges.map((badge) => (
            <p key={badge.id} className="unlock">
              Badge unlocked · {badge.name}
            </p>
          ))
        : null}
      <div className="career-links">
        <button type="button" className="lobby-link" onClick={onAwards}>
          Achievements
        </button>
        <button type="button" className="lobby-link" onClick={onMenu}>
          All Games
        </button>
      </div>
    </section>
  );
}

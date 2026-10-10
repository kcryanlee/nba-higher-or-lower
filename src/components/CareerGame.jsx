import { useEffect, useRef, useState } from "react";
import { formatYears } from "../game/careerPath.js";
import { BADGE_REVEAL_MS, REVEAL_MS } from "../game/feedback.js";
import { teamLogoUrl } from "../game/teams.js";
import EndActions from "./EndActions.jsx";
import ScoreCard from "./ScoreCard.jsx";

function CareerStop({ stop, bandId }) {
  const [failed, setFailed] = useState(false);
  const logo = teamLogoUrl(stop.team);
  const showYears = bandId !== "hard";

  return (
    <span className="career-stop">
      {logo && !failed ? (
        <img src={logo} alt={stop.team} onError={() => setFailed(true)} />
      ) : null}
      <span className="career-team">{stop.team}</span>
      {showYears ? <span className="career-years">{formatYears(stop)}</span> : null}
    </span>
  );
}

export default function CareerGame({
  phase,
  streak,
  best,
  question,
  picked,
  result,
  onPick,
  onAdvance,
  onAgain,
  onMenu,
  onAwards,
  onDaily,
  kicker,
  menuLabel = "All Games",
  unlockedBadges = [],
}) {
  const onAdvanceRef = useRef(onAdvance);

  useEffect(() => {
    onAdvanceRef.current = onAdvance;
  });

  useEffect(() => {
    if (phase !== "revealing") return undefined;
    const hold = unlockedBadges.length ? BADGE_REVEAL_MS : REVEAL_MS;
    const timer = window.setTimeout(() => onAdvanceRef.current(), hold);
    return () => window.clearTimeout(timer);
  }, [phase, question, unlockedBadges.length]);

  if (phase === "gameover") {
    return (
      <section className="panel game-over">
        <ScoreCard
          title="Career Path"
          streak={streak}
          best={best}
          detail={`The player was ${question.answer}.`}
        />
        <EndActions
          title="Career Path"
          streak={streak}
          best={best}
          fileName="nba-career-path.png"
          onAgain={onAgain}
          onAwards={onAwards}
          onMenu={onMenu}
        />
      </section>
    );
  }

  const revealing = phase === "revealing";

  return (
    <section className="panel career-board">
      <p className="band">
        {kicker || "Career Path"}
        <span className="score-dot" aria-hidden="true">
          {" "}
          •{" "}
        </span>
        {question.band.label}
      </p>
      <h1 className="section-title">Who does this career belong to?</h1>
      {question.band.id === "easy" ? <p className="career-position">Position · {question.position}</p> : null}
      <div className="career-path">
        {question.stops.map((stop, index) => (
          <span key={`${stop.team}-${stop.start}`} className="career-piece">
            {index > 0 ? (
              <span className="career-arrow" aria-hidden="true">
                →
              </span>
            ) : null}
            <CareerStop stop={stop} bandId={question.band.id} />
          </span>
        ))}
      </div>
      <div className="career-choices">
        {question.choices.map((name) => {
          const chosen = picked === name;
          const correct = revealing && name === question.answer;
          const missed = revealing && chosen && result === "wrong";
          return (
            <button
              key={name}
              type="button"
              className={`action secondary career-choice ${correct ? "is-correct" : ""} ${missed ? "is-wrong" : ""}`}
              onClick={() => onPick(name)}
              disabled={revealing}
            >
              {name}
            </button>
          );
        })}
      </div>
      {revealing ? (
        <p className={`reveal-title ${result === "correct" ? "is-right" : "is-miss"}`}>
          {result === "correct" ? "Correct" : `Wrong · ${question.answer}`}
        </p>
      ) : null}
      {revealing
        ? unlockedBadges.map((badge) => (
            <p key={badge.id} className="unlock">
              Badge unlocked · {badge.name}
            </p>
          ))
        : null}
      <div className="career-links">
        {onDaily ? (
          <button type="button" className="lobby-link" onClick={onDaily}>
            Today&apos;s Challenge
          </button>
        ) : null}
        <button type="button" className="lobby-link" onClick={onAwards}>
          Achievements
        </button>
        <button type="button" className="lobby-link" onClick={onMenu}>
          {menuLabel}
        </button>
      </div>
    </section>
  );
}

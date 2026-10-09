import { useEffect, useRef, useState } from "react";
import { formatYears } from "../game/careerPath.js";
import { REVEAL_MS } from "../game/feedback.js";
import { teamLogoUrl } from "../game/teams.js";

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
  unlockedBadges = [],
}) {
  const onAdvanceRef = useRef(onAdvance);

  useEffect(() => {
    onAdvanceRef.current = onAdvance;
  });

  useEffect(() => {
    if (phase !== "revealing") return undefined;
    const timer = window.setTimeout(() => onAdvanceRef.current(), REVEAL_MS);
    return () => window.clearTimeout(timer);
  }, [phase, question]);

  if (phase === "gameover") {
    return (
      <section className="panel career-over">
        <p className="eyebrow">Career Path</p>
        <h1 className="section-title">{streak}</h1>
        <p className="streak-label">Win streak</p>
        <p className="badge">Best {best}</p>
        <p className="lede">The player was {question.answer}.</p>
        <div className="actions">
          <button type="button" className="action" onClick={onAgain}>
            Play again
          </button>
          <button type="button" className="action secondary" onClick={onAwards}>
            Achievements
          </button>
          <button type="button" className="action secondary" onClick={onMenu}>
            All games
          </button>
        </div>
      </section>
    );
  }

  const revealing = phase === "revealing";

  return (
    <section className="panel career-board">
      <p className="band">
        Career Path
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
      <button type="button" className="lobby-link" onClick={onAwards}>
        Achievements
      </button>
      <button type="button" className="lobby-link" onClick={onMenu}>
        All games
      </button>
    </section>
  );
}

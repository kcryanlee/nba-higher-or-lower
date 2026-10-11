import { useState } from "react";
import { playerImageUrl } from "../data/playerMedia.js";
import { choiceName, gradeChainChoice } from "../game/chain.js";
import { teamLogoUrl } from "../game/teams.js";
import EndActions from "./EndActions.jsx";
import ScoreCard from "./ScoreCard.jsx";

function ChainPhoto({ id, name }) {
  const [failed, setFailed] = useState(false);
  const src = playerImageUrl(id);
  if (!src || failed) {
    return <span className="chain-fallback" aria-hidden="true">{name.slice(0, 1)}</span>;
  }
  return <img src={src} alt="" onError={() => setFailed(true)} />;
}

function TeamMark({ team }) {
  const [failed, setFailed] = useState(false);
  const logo = teamLogoUrl(team);
  if (!logo || failed) return null;
  return <img src={logo} alt="" onError={() => setFailed(true)} />;
}

function ConnectionList({ connections }) {
  return (
    <ul className="chain-connections">
      {connections.map((row) => (
        <li key={row.targetId}>
          <strong>{row.targetName}</strong>
          {row.groups.length ? row.groups.map((group) => (
            <span key={group.slug} className="chain-stint">
              <TeamMark team={group.team} />
              <span>{group.team}</span>
              <span className="chain-seasons">{group.seasons.join(", ")}</span>
            </span>
          )) : <span className="chain-stint">No shared team</span>}
        </li>
      ))}
    </ul>
  );
}

export default function ChainGame({
  phase,
  streak,
  best,
  question,
  picked,
  result,
  ended = null,
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
  if (phase === "gameover") {
    const missed = ended !== "cleared";
    const detail = missed
      ? "That player did not play with both."
      : "No questions left.";
    return (
      <section className="panel game-over">
        <ScoreCard
          title="Teammate Chain"
          streak={streak}
          best={best}
          detail={detail}
        />
        <EndActions
          title="Teammate Chain"
          streak={streak}
          best={best}
          detail={detail}
          fileName="nba-teammate-chain.png"
          onAgain={onAgain}
          onAwards={onAwards}
          onMenu={onMenu}
        />
      </section>
    );
  }

  const revealing = phase === "revealing";
  const grade = revealing ? gradeChainChoice(question, picked) : null;
  const validIds = new Set(grade?.validIds || []);

  return (
    <section className="panel chain-board">
      <p className="band">{kicker || "Teammate Chain"}</p>
      <h1 className="section-title">Find the player who links these two careers.</h1>
      <p className="chain-hint">A link played with each of them, even on different teams or in different seasons.</p>
      <div className="chain-targets">
        {question.targets.map((target) => (
          <article key={target.id} className="chain-target">
            <ChainPhoto id={target.id} name={target.name} />
            <h2>{target.name}</h2>
          </article>
        ))}
      </div>
      <div className="career-choices">
        {question.choices.map((id) => {
          const chosen = picked === id;
          const correct = revealing && validIds.has(id);
          const missed = revealing && chosen && !validIds.has(id);
          return (
            <button
              key={id}
              type="button"
              className={`action secondary career-choice ${correct ? "is-correct" : ""} ${missed ? "is-wrong" : ""}`}
              onClick={() => onPick(id)}
              disabled={revealing}
            >
              {choiceName(question, id)}
            </button>
          );
        })}
      </div>
      {grade ? (
        <div className="chain-reveal">
          <p className={`reveal-title ${grade.correct ? "is-right" : "is-miss"}`}>
            {grade.correct ? "Correct" : "Wrong"}
          </p>
          <p className="chain-subject">
            {grade.subjectName} links both careers.
          </p>
          <ConnectionList connections={grade.connections} />
          {grade.guess ? (
            <>
              <p className="chain-subject">{grade.guess.name} did not play with both.</p>
              <ConnectionList connections={grade.guess.connections} />
            </>
          ) : null}
          {grade.validIds.length > 1 ? (
            <p className="chain-also">Every highlighted player shared a team and season with both.</p>
          ) : null}
        </div>
      ) : null}
      {revealing
        ? unlockedBadges.map((badge) => (
            <p key={badge.id} className="unlock">
              Badge unlocked · {badge.name}
            </p>
          ))
        : null}
      {revealing ? (
        <button type="button" className="action" onClick={onAdvance}>
          {result === "correct" ? "Next" : "Continue"}
        </button>
      ) : null}
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

import PlayerCard from "./PlayerCard.jsx";
import RevealBar from "./RevealBar.jsx";
import StatIcon from "./StatIcon.jsx";

function higherId(matchup) {
  const { category, left, right } = matchup;
  if (left[category.id] === right[category.id]) return null;
  return left[category.id] > right[category.id] ? left.id : right.id;
}

function verdictLabel(result) {
  if (result === "wrong") return "Wrong";
  if (result === "push") return "Tie";
  return "Correct";
}

function verdictTone(result) {
  if (result === "wrong") return "is-miss";
  if (result === "push") return "is-tie";
  return "is-right";
}

export default function Board({
  matchup,
  phase,
  pickedId,
  result,
  unlockedBadges,
  callout,
  onPick,
  onAdvance,
  onMenu,
  onAwards,
  onDailyAwards,
  onDaily,
  menuLabel = "All Games",
}) {
  const leaderId = higherId(matchup);
  const tied = matchup.left[matchup.category.id] === matchup.right[matchup.category.id];
  const wrong = phase === "revealing" && result === "wrong";

  return (
    <section className={`board ${wrong ? "is-wrong" : ""}`}>
      <div className="prompt">
        <p className="band category-chip">
          <StatIcon id={matchup.category.id} />
          <span>{matchup.category.label}</span>
          <span className="score-dot" aria-hidden="true">
            •
          </span>
          <span>{matchup.band.label}</span>
        </p>
        <h1>{matchup.category.question}</h1>
      </div>
      <div className="cards">
        <PlayerCard
          player={matchup.left}
          category={matchup.category}
          revealed={phase === "revealing"}
          picked={pickedId === matchup.left.id}
          higher={leaderId === matchup.left.id}
          tied={phase === "revealing" && tied}
          disabled={phase !== "playing"}
          onSelect={onPick}
        />
        <p className="versus" aria-hidden="true">
          VS
        </p>
        <PlayerCard
          player={matchup.right}
          category={matchup.category}
          revealed={phase === "revealing"}
          picked={pickedId === matchup.right.id}
          higher={leaderId === matchup.right.id}
          tied={phase === "revealing" && tied}
          disabled={phase !== "playing"}
          onSelect={onPick}
        />
      </div>
      {phase === "revealing" ? (
        <div className="result-step" role="status">
          <p className={`reveal-title ${verdictTone(result)}`}>{verdictLabel(result)}</p>
          <RevealBar
            unlockedBadges={unlockedBadges}
            callout={callout}
            autoAdvance={false}
          />
          <button type="button" className="action rank-lock" onClick={onAdvance}>
            Continue
          </button>
        </div>
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
        {onDailyAwards ? (
          <button type="button" className="lobby-link" onClick={onDailyAwards}>
            Daily achievements
          </button>
        ) : null}
        <button type="button" className="lobby-link" onClick={onMenu}>
          {menuLabel}
        </button>
      </div>
    </section>
  );
}

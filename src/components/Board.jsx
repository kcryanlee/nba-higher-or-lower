import PlayerCard from "./PlayerCard.jsx";
import RevealBar from "./RevealBar.jsx";
import StatIcon from "./StatIcon.jsx";

function higherId(matchup) {
  const { category, left, right } = matchup;
  if (left[category.id] === right[category.id]) return null;
  return left[category.id] > right[category.id] ? left.id : right.id;
}

export default function Board({
  matchup,
  phase,
  pickedId,
  result,
  unlockedBadges,
  callout,
  holdMs,
  onPick,
  onAdvance,
}) {
  const leaderId = higherId(matchup);
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
          disabled={phase !== "playing"}
          onSelect={onPick}
        />
      </div>
      {phase === "revealing" ? (
        <RevealBar
          matchup={matchup}
          result={result}
          unlockedBadges={unlockedBadges}
          callout={callout}
          holdMs={holdMs}
          onAdvance={onAdvance}
        />
      ) : null}
    </section>
  );
}

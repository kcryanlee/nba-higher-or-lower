import { BADGE_REVEAL_MS, REVEAL_MS } from "../game/feedback.js";
import EndActions from "./EndActions.jsx";
import PlayerCard from "./PlayerCard.jsx";
import RevealBar from "./RevealBar.jsx";
import ScoreCard from "./ScoreCard.jsx";

const POINTS = {
  id: "pts",
  label: "Points",
  format(value) {
    return `${value} PTS`;
  },
};

const RANK_LABELS = ["1st", "2nd", "3rd"];

function rankHelp(revealing, picks, credit) {
  if (revealing) {
    return Number.isInteger(credit) ? `${credit} of 3 in the right place` : "";
  }
  if (picks.length === 0) return "Tap the most points, then the next, then the fewest.";
  if (picks.length === 1) return "Now the next highest.";
  if (picks.length === 2) return "Now the fewest points.";
  return "Lock in this order, or tap a card to change it.";
}

export default function ScoredGame({
  phase,
  streak,
  best,
  question,
  picks = [],
  credit = null,
  result,
  onPick,
  onLock,
  onAdvance,
  onAgain,
  onMenu,
  onAwards,
  onDaily,
  kicker,
  menuLabel = "All Games",
  unlockedBadges = [],
  callout = "",
  holdMs,
}) {
  const wait = holdMs ?? (unlockedBadges.length ? BADGE_REVEAL_MS : REVEAL_MS);
  if (!question) return null;

  if (phase === "gameover") {
    return (
      <section className="panel game-over">
        <ScoreCard
          title="Who Scored More?"
          streak={streak}
          best={best}
        />
        <EndActions
          title="Who Scored More?"
          streak={streak}
          best={best}
          detail={`${question.dateLabel} · ${question.away} at ${question.home}`}
          fileName="nba-who-scored-more.png"
          onAgain={onAgain}
          onAwards={onAwards}
          onMenu={onMenu}
        />
      </section>
    );
  }

  const revealing = phase === "revealing";
  const wrong = revealing && result === "miss";
  const ranked = new Map(picks.map((id, index) => [id, index]));
  const ordered = revealing
    ? picks.map((id) => question.players.find((player) => player.id === id)).filter(Boolean)
    : question.players;
  const shown = ordered.length === question.players.length ? ordered : question.players;

  return (
    <section className={`board ${wrong ? "is-wrong" : ""}`}>
      <div className="prompt">
        <p className="band category-chip">
          <span>{kicker || question.dateLabel}</span>
          <span className="score-dot" aria-hidden="true">
            •
          </span>
          <span>{question.band.label}</span>
        </p>
        <h1>Rank the scoring</h1>
        <p className="game-slate">
          {kicker ? <span>{question.dateLabel}</span> : null}
          {kicker ? (
            <span className="score-dot" aria-hidden="true">
              {" "}
              •{" "}
            </span>
          ) : null}
          <span>
            {question.away}
            {" at "}
            {question.home}
          </span>
        </p>
        <p className="rank-help">{rankHelp(revealing, picks, credit)}</p>
      </div>
      <div className="cards is-rank" role="group" aria-label="Rank from most points to fewest">
        {shown.map((player, index) => {
          const place = revealing ? index : ranked.get(player.id);
          const slotCorrect = revealing && question.ranking[index] === player.id;
          return (
            <PlayerCard
              key={player.id}
              player={player}
              category={POINTS}
              revealed={revealing}
              picked={ranked.has(player.id)}
              higher={slotCorrect}
              rankLabel={Number.isInteger(place) ? RANK_LABELS[place] : ""}
              verdictLabel={revealing ? (slotCorrect ? "Right" : "Wrong") : undefined}
              disabled={revealing}
              onSelect={onPick}
            />
          );
        })}
      </div>
      {!revealing && picks.length === 3 ? (
        <button type="button" className="action rank-lock" onClick={onLock}>
          Lock in
        </button>
      ) : null}
      {revealing ? (
        <RevealBar
          unlockedBadges={unlockedBadges}
          callout={callout}
          holdMs={wait}
          onAdvance={onAdvance}
        />
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

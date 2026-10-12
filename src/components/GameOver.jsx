import EndActions from "./EndActions.jsx";
import ScoreCard from "./ScoreCard.jsx";

export default function GameOver({
  streak,
  best,
  onAgain,
  onAwards,
  onMenu,
}) {
  return (
    <section className="panel game-over">
      <ScoreCard
        title="NBA Higher or Lower"
        streak={streak}
        best={best}
      />
      <EndActions
        title="NBA Higher or Lower"
        streak={streak}
        best={best}
        onAgain={onAgain}
        onAwards={onAwards}
        onMenu={onMenu}
      />
    </section>
  );
}

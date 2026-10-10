import EndActions from "./EndActions.jsx";
import ScoreCard from "./ScoreCard.jsx";

export default function GameOver({
  streak,
  best,
  difficulty,
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
        detail={`Difficulty: ${difficulty}`}
      />
      <EndActions
        title="NBA Higher or Lower"
        streak={streak}
        best={best}
        detail={`Difficulty: ${difficulty}`}
        onAgain={onAgain}
        onAwards={onAwards}
        onMenu={onMenu}
      />
    </section>
  );
}

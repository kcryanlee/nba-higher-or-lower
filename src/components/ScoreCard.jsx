export default function ScoreCard({ streak, best, difficulty }) {
  return (
    <article className="score-card" aria-label="Score card">
      <h2>NBA Higher or Lower</h2>
      <p className="streak-flame">
        <span className="streak-fire" aria-hidden="true">
          🔥
        </span>
        <span className="streak-count">{streak}</span>
      </p>
      <p className="streak-label">Win streak</p>
      <p className="badge">🏆 Best {best}</p>
      <p className="reached">Difficulty: {difficulty}</p>
      <p className="challenge">Can you beat my streak?</p>
      <p className="play-now">Play now →</p>
    </article>
  );
}

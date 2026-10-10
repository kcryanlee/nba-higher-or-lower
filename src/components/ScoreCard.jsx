export default function ScoreCard({ title, streak, best, detail }) {
  return (
    <article className="score-card" aria-label="Score card">
      <h2>{title}</h2>
      <p className="streak-flame">
        <span className="streak-fire" aria-hidden="true">
          🔥
        </span>
        <span className="streak-count">{streak}</span>
      </p>
      <p className="streak-label">Win streak</p>
      <p className="badge">🏆 Best {best}</p>
      {detail ? <p className="reached">{detail}</p> : null}
      <p className="challenge">Can you beat my streak?</p>
      <p className="play-now">Play now →</p>
    </article>
  );
}

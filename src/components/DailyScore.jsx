export default function DailyScore({
  attempt,
  unlockedBadges = [],
  onPractice,
  onAwards,
  onMenu,
}) {
  return (
    <section className="panel daily-score">
      <p className="eyebrow">Daily challenge</p>
      <h1 className="section-title">{attempt.dateLabel}</h1>
      {unlockedBadges.map((badge) => (
        <p key={badge.id} className="unlock">
          Badge unlocked · {badge.name}
        </p>
      ))}
      {attempt.practice ? (
        <p className="score-note">
          Practice. Today&apos;s official score stays {attempt.officialCorrect} / {attempt.officialTotal}.
        </p>
      ) : null}
      <dl className="score-list">
        <div>
          <dt>Score</dt>
          <dd>
            {attempt.correct} / {attempt.total}
          </dd>
        </div>
        <div>
          <dt>Accuracy</dt>
          <dd>{attempt.accuracy}%</dd>
        </div>
        <div>
          <dt>Final score</dt>
          <dd>{attempt.score}</dd>
        </div>
        <div>
          <dt>Highest difficulty reached</dt>
          <dd>{attempt.difficulty}</dd>
        </div>
        <div>
          <dt>Daily ranking</dt>
          <dd>{attempt.ranking}</dd>
        </div>
        <div>
          <dt>Daily streak</dt>
          <dd>
            {attempt.dailyStreak} {attempt.dailyStreak === 1 ? "day" : "days"}
          </dd>
        </div>
        <div>
          <dt>Best daily score</dt>
          <dd>
            {attempt.bestCorrect} / {attempt.bestTotal}
          </dd>
        </div>
      </dl>
      <p className="score-note">
        Each correct answer scores 1 to 4, matching its difficulty. The official score locks after one play.
      </p>
      <div className="actions">
        <button type="button" className="action" onClick={onPractice}>
          Practice
        </button>
        <button type="button" className="action secondary" onClick={onAwards}>
          Achievements
        </button>
        <button type="button" className="action secondary" onClick={onMenu}>
          All Games
        </button>
      </div>
    </section>
  );
}

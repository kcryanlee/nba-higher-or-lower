export default function QuizDailyScore({
  eyebrow,
  attempt,
  unlockedBadges = [],
  onAwards,
  onBack,
  backLabel,
  onMenu,
}) {
  return (
    <section className="panel daily-score quiz-daily-score">
      <p className="eyebrow">{eyebrow}</p>
      <h1 className="section-title">
        {attempt.correct}
        {" / "}
        {attempt.total}
      </h1>
      <p className="streak-label">{attempt.dateLabel}</p>
      {unlockedBadges.map((badge) => (
        <p key={badge.id} className="unlock">
          Badge unlocked · {badge.name}
        </p>
      ))}
      <p className="badge">
        Daily streak {attempt.streak} {attempt.streak === 1 ? "day" : "days"}
      </p>
      <p className="score-note">
        One completed attempt per day. Everyone gets the same five questions, and this score stays on this device.
      </p>
      <div className="actions">
        <button type="button" className="action secondary" onClick={onAwards}>
          Achievements
        </button>
        <button type="button" className="action secondary" onClick={onBack}>
          {backLabel}
        </button>
        <button type="button" className="action secondary" onClick={onMenu}>
          All Games
        </button>
      </div>
    </section>
  );
}

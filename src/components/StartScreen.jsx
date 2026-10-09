import { DAILY_LENGTH } from "../game/daily.js";

export default function StartScreen({
  best,
  dailyStreak,
  dailyStatus,
  todayCorrect,
  resumeQuestion,
  onPlay,
  onDaily,
  onAwards,
  onHub,
}) {
  const dailyLine = dailyStatus === "complete"
    ? `Today's challenge • ${todayCorrect}/${DAILY_LENGTH} completed`
    : dailyStatus === "progress"
      ? `Today's challenge • question ${resumeQuestion} of ${DAILY_LENGTH}`
      : dailyStatus === "unavailable"
        ? "Today's challenge"
        : "Today's challenge • not started";

  return (
    <section className="panel start-screen lobby">
      <p className="eyebrow">Basketball stats, one guess at a time</p>
      <h1>NBA Higher or Lower</h1>
      <p className="lede">
        Two players. One stat. Pick who’s higher. Build your streak.
      </p>
      <p className="best-line">
        Best streak <strong>{best}</strong>
      </p>
      <button type="button" className="action play-main" onClick={onPlay}>
        Play
      </button>
      {dailyStatus === "unavailable" ? (
        <div className="lobby-card is-unavailable" role="status">
          <span>{dailyLine}</span>
          <strong>Unavailable today</strong>
        </div>
      ) : (
        <button type="button" className="lobby-card" onClick={onDaily}>
          <span>{dailyLine}</span>
          {dailyStreak > 0 ? (
            <strong>
              🔥 {dailyStreak}-day daily streak
            </strong>
          ) : (
            <strong>Same questions for everyone today</strong>
          )}
        </button>
      )}
      <button type="button" className="lobby-link" onClick={onAwards}>
        Achievements
      </button>
      <button type="button" className="lobby-link" onClick={onHub}>
        All Games
      </button>
    </section>
  );
}

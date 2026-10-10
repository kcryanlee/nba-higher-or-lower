import { QUIZ_DAILY_LENGTH } from "../game/quizDaily.js";

export default function GameLobby({
  eyebrow,
  title,
  lede,
  best,
  dailyStatus,
  dailyStreak,
  todayCorrect,
  resumeQuestion,
  onPlay,
  onDaily,
  onAwards,
  onDailyAwards,
  onHub,
}) {
  const dailyLine = dailyStatus === "complete"
    ? `Today's challenge • ${todayCorrect}/${QUIZ_DAILY_LENGTH} completed`
    : dailyStatus === "progress"
      ? `Today's challenge • question ${resumeQuestion} of ${QUIZ_DAILY_LENGTH}`
      : dailyStatus === "unavailable"
        ? "Today's challenge"
        : "Today's challenge • not started";

  return (
    <section className="panel start-screen lobby">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p className="lede">{lede}</p>
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
          <span>Uses your local date</span>
        </div>
      ) : (
        <button type="button" className="lobby-card" onClick={onDaily}>
          <span>{dailyLine}</span>
          {dailyStreak > 0 ? (
            <strong>
              🔥 {dailyStreak}-day daily streak
            </strong>
          ) : (
            <strong>Same five questions for everyone today</strong>
          )}
          <span>One attempt · uses your local date</span>
        </button>
      )}
      <button type="button" className="lobby-link" onClick={onAwards}>
        Achievements
      </button>
      <button type="button" className="lobby-link" onClick={onDailyAwards}>
        Daily achievements
      </button>
      <button type="button" className="lobby-link" onClick={onHub}>
        All Games
      </button>
    </section>
  );
}

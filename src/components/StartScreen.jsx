import { DAILY_LENGTH } from "../game/daily.js";

export default function StartScreen({
  best,
  dailyStreak,
  playedToday,
  todayCorrect,
  onPlay,
  onDaily,
  onAwards,
  onHub,
}) {
  const progress = playedToday ? `${todayCorrect}/${DAILY_LENGTH}` : `0/${DAILY_LENGTH}`;

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
      <button type="button" className="lobby-card" onClick={onDaily}>
        <span>Today&apos;s challenge • {progress} completed</span>
        {dailyStreak > 0 ? (
          <strong>
            🔥 {dailyStreak}-day daily streak
          </strong>
        ) : (
          <strong>Same questions for everyone today</strong>
        )}
      </button>
      <button type="button" className="lobby-link" onClick={onAwards}>
        Achievements
      </button>
      <button type="button" className="lobby-link" onClick={onHub}>
        All games
      </button>
    </section>
  );
}

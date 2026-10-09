import { BADGES, badgeProgress } from "../game/badges.js";

export default function Achievements({
  badges,
  best,
  dailyStreak,
  monthCount,
  celebrate = [],
  onBack,
  catalog = BADGES,
  progressFor,
  eyebrow = "Milestones",
}) {
  return (
    <section className="panel awards">
      <p className="eyebrow">{eyebrow}</p>
      <h1 className="section-title">Achievements</h1>
      <p className="lede">
        Badges stay on this device and show up the moment you earn them.
      </p>
      <div className="award-grid">
        {catalog.map((badge) => {
          const progress = progressFor
            ? progressFor(badge)
            : badgeProgress(badge, badges, { best, dailyStreak, monthCount });
          const isOwned = progress === "Unlocked";

          return (
            <article
              key={badge.id}
              className={`award ${isOwned ? "is-owned" : "is-locked"} ${celebrate.includes(badge.id) ? "just-unlocked" : ""}`}
            >
              <p className="award-mark">{badge.mark}</p>
              <h2>{badge.name}</h2>
              <p>{badge.detail}</p>
              <p className="award-state">{progress}</p>
            </article>
          );
        })}
      </div>
      <button type="button" className="action secondary" onClick={onBack}>
        Back
      </button>
    </section>
  );
}

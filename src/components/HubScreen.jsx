const GAMES = [
  {
    id: "higher",
    name: "Higher or Lower",
    detail: "Two players. One stat. Pick who’s higher.",
    ready: true,
  },
  {
    id: "career",
    name: "Career Path",
    detail: "See the teams a player joined. Name who it is.",
    ready: true,
  },
  {
    id: "draft",
    name: "Draft Pick",
    detail: "Guess where a player was selected.",
    ready: false,
  },
  {
    id: "scored",
    name: "Who Scored More?",
    detail: "Two players from the same game. Who scored more?",
    ready: false,
  },
  {
    id: "chain",
    name: "Teammate Chain",
    detail: "Find the player who links two careers.",
    ready: false,
  },
];

export default function HubScreen({ onHigher, onCareer }) {
  const actions = { higher: onHigher, career: onCareer };

  return (
    <section className="panel hub">
      <p className="eyebrow">NBA Mini Games</p>
      <h1 className="section-title">NBA Mini Games</h1>
      <p className="lede">Test how well you really know basketball.</p>
      <div className="hub-grid">
        {GAMES.map((game) => (
          <article key={game.id} className={`hub-card ${game.ready ? "" : "is-soon"}`}>
            <h2>{game.name}</h2>
            <p>{game.detail}</p>
            {game.ready ? (
              <button type="button" className="action" onClick={actions[game.id]}>
                Play
              </button>
            ) : (
              <p className="hub-soon">Coming soon</p>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

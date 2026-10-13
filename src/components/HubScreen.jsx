import { players } from "../data/players.js";
import { draftPool } from "../game/draft.js";

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
    detail: "See the career. Name the player.",
    ready: true,
  },
  {
    id: "draft",
    name: "Draft Pick",
    detail: "Guess the draft year or the overall pick.",
    ready: true,
  },
  {
    id: "scored",
    name: "Who Scored More?",
    detail: "Three players from one game. Rank their points.",
    ready: true,
  },
  {
    id: "chain",
    name: "Teammate Chain",
    detail: "Find the player who links two careers.",
    ready: true,
  },
];

function listedReady(game, modes) {
  if (game.id === "draft") return game.ready && (modes.year || modes.pick);
  return game.ready;
}

export default function HubScreen({ onHigher, onCareer, onDraftYear, onDraftPick, onScored, onChain, onPk }) {
  const actions = { higher: onHigher, career: onCareer, scored: onScored, chain: onChain };
  const draftModes = {
    year: draftPool(players, "year").length > 0,
    pick: draftPool(players, "pick").length > 0,
  };

  return (
    <section className="panel hub">
      <p className="eyebrow">NBA Mini Games</p>
      <h1 className="section-title">NBA Mini Games</h1>
      <p className="lede">Test how well you really know basketball.</p>
      <button type="button" className="pk-entry" onClick={onPk}>
        <span>
          <strong>Live 1 vs 1</strong>
          <em>First correct answer scores.</em>
        </span>
        <span className="pk-entry-play">Play</span>
      </button>
      <div className="hub-grid">
        {GAMES.map((game) => (
          <article key={game.id} className={`hub-card ${listedReady(game, draftModes) ? "" : "is-soon"}`}>
            <h2>{game.name}</h2>
            <p>{game.detail}</p>
            {game.id === "draft" && listedReady(game, draftModes) ? (
              <div className="hub-modes">
                {draftModes.year ? (
                  <button type="button" className="action" onClick={onDraftYear}>
                    Draft Year
                  </button>
                ) : null}
                {draftModes.pick ? (
                  <button type="button" className="action" onClick={onDraftPick}>
                    Draft Pick
                  </button>
                ) : null}
              </div>
            ) : listedReady(game, draftModes) ? (
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

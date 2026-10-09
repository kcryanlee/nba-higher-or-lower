import { useState } from "react";
import { gameLink, renderShareCard, shareMessage } from "../game/shareCard.js";
import ScoreCard from "./ScoreCard.jsx";

export default function GameOver({
  streak,
  best,
  difficulty,
  onAgain,
  onAwards,
  onMenu,
}) {
  const [copied, setCopied] = useState(false);
  const [shareFallback, setShareFallback] = useState("");

  function message() {
    return shareMessage({
      streak,
      difficulty,
      best,
      link: gameLink(),
    });
  }

  async function copyResult() {
    const text = message();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setShareFallback("");
    } catch {
      setCopied(false);
      setShareFallback(text);
    }
  }

  async function shareScore() {
    const text = message();
    try {
      const file = await renderShareCard({ streak, difficulty, best });
      const payload = { text, files: [file] };
      if (navigator.canShare?.(payload)) {
        await navigator.share(payload);
        setShareFallback("");
        return;
      }
    } catch (error) {
      if (error?.name === "AbortError") return;
    }

    if (navigator.share) {
      try {
        await navigator.share({ text });
        setShareFallback("");
        return;
      } catch (error) {
        if (error?.name === "AbortError") return;
      }
    }

    await copyResult();
  }

  return (
    <section className="panel game-over">
      <ScoreCard
        streak={streak}
        best={best}
        difficulty={difficulty}
      />
      <div className="actions">
        <button type="button" className="action" onClick={shareScore}>
          Share
        </button>
        <button type="button" className="action secondary" onClick={copyResult}>
          Copy result
        </button>
        <button type="button" className="action secondary" onClick={onAgain}>
          Play again
        </button>
        <button type="button" className="action secondary" onClick={onAwards}>
          Achievements
        </button>
        <button type="button" className="action secondary" onClick={onMenu}>
          All Games
        </button>
      </div>
      {copied ? <p className="copied">Copied</p> : null}
      {shareFallback ? <pre className="share-fallback">{shareFallback}</pre> : null}
    </section>
  );
}

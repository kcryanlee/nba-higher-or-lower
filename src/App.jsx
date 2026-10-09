import { useState } from "react";
import { Analytics } from "@vercel/analytics/react";
import Achievements from "./components/Achievements.jsx";
import Board from "./components/Board.jsx";
import CareerGame from "./components/CareerGame.jsx";
import DailyScore from "./components/DailyScore.jsx";
import GameOver from "./components/GameOver.jsx";
import HubScreen from "./components/HubScreen.jsx";
import StartScreen from "./components/StartScreen.jsx";
import roster from "./data/players.json";
import { CAREER_BADGES, careerBadgeProgress } from "./game/careerBadges.js";
import { MILESTONE_MS, REVEAL_MS, milestoneBanner, streakCallout } from "./game/feedback.js";
import { useBadges } from "./hooks/useBadges.js";
import { useCareer } from "./hooks/useCareer.js";
import { useCareerBadges } from "./hooks/useCareerBadges.js";
import { useDaily } from "./hooks/useDaily.js";
import { useGame } from "./hooks/useGame.js";

export default function App() {
  const [screen, setScreen] = useState("hub");
  const [awardsReturn, setAwardsReturn] = useState("menu");
  const badges = useBadges();
  const game = useGame(roster.players, { onAnswer: badges.recordAnswer });
  const daily = useDaily(roster.players, {
    onAnswer: badges.recordAnswer,
    onOfficial: badges.recordDaily,
  });
  const careerBadges = useCareerBadges();
  const career = useCareer({ onCorrect: careerBadges.recordStreak });

  function openAwards(from) {
    setAwardsReturn(from);
    setScreen("awards");
  }

  function playCareer() {
    careerBadges.dismiss();
    career.start();
    setScreen("career");
  }

  function advanceCareer() {
    careerBadges.dismiss();
    career.advance();
  }

  function playClassic() {
    badges.dismiss();
    game.start();
    setScreen("classic");
  }

  function openDaily() {
    badges.dismiss();
    if (daily.official) {
      daily.showOfficial();
    } else {
      daily.start(false);
    }
    setScreen("daily");
  }

  function practiceDaily() {
    badges.dismiss();
    daily.start(true);
    setScreen("daily");
  }

  function advanceClassic() {
    badges.dismiss();
    game.advance();
  }

  function advanceDaily() {
    badges.dismiss();
    daily.advance();
  }

  const classicLive = screen === "classic" && (game.phase === "playing" || game.phase === "revealing");
  const dailyLive = screen === "daily" && (daily.phase === "playing" || daily.phase === "revealing");
  const wrongFlash = (classicLive && game.result === "wrong") || (dailyLive && daily.result === "wrong");
  const milestone =
    classicLive && game.result === "correct" ? milestoneBanner(game.streak) : "";

  return (
    <div className="court">
      <Analytics />
      {wrongFlash ? <div className="wrong-flash" aria-hidden="true" /> : null}
      {milestone ? (
        <div className="milestone" role="status">
          <p>{milestone}</p>
        </div>
      ) : null}
      <header className="topbar">
        <p className="brand">NBA Mini Games</p>
        {dailyLive ? (
          <p className="scoreboard">
            {daily.practice ? <span>Practice</span> : null}
            {daily.practice ? (
              <span className="score-dot" aria-hidden="true">
                •
              </span>
            ) : null}
            <span>
              Question <strong>{Math.min(daily.index + 1, daily.total)}</strong>
              {" / "}
              {daily.total}
            </span>
            <span className="score-dot" aria-hidden="true">
              •
            </span>
            <span>
              Correct <strong>{daily.correctCount}</strong>
            </span>
          </p>
        ) : screen === "daily" ? (
          <p className="scoreboard">
            <span>Daily challenge</span>
          </p>
        ) : screen === "career" || screen === "career-awards" ? (
          <p className="scoreboard">
            <span>
              Streak <strong>{career.streak}</strong>
            </span>
            <span className="score-dot" aria-hidden="true">
              •
            </span>
            <span>
              Best <strong>{career.best}</strong>
            </span>
          </p>
        ) : screen === "hub" ? (
          <p className="scoreboard">
            <span>Pick a game</span>
          </p>
        ) : (
          <p className="scoreboard">
            <span>
              Streak <strong>{game.streak}</strong>
            </span>
            <span className="score-dot" aria-hidden="true">
              •
            </span>
            <span>
              Best <strong>{game.best}</strong>
            </span>
          </p>
        )}
      </header>

      <main className="frame">
        {screen === "hub" ? <HubScreen onHigher={() => setScreen("menu")} onCareer={playCareer} /> : null}

        {screen === "menu" ? (
          <StartScreen
            best={game.best}
            dailyStreak={daily.dailyStreak}
            playedToday={Boolean(daily.official)}
            todayCorrect={daily.official?.correct ?? 0}
            onPlay={playClassic}
            onDaily={openDaily}
            onAwards={() => openAwards("menu")}
            onHub={() => setScreen("hub")}
          />
        ) : null}

        {screen === "career" ? (
          <CareerGame
            phase={career.phase}
            streak={career.streak}
            best={career.best}
            question={career.question}
            picked={career.picked}
            result={career.result}
            onPick={career.pick}
            onAdvance={advanceCareer}
            onAgain={playCareer}
            onMenu={() => setScreen("hub")}
            onAwards={() => setScreen("career-awards")}
            unlockedBadges={careerBadges.fresh}
          />
        ) : null}

        {screen === "career-awards" ? (
          <Achievements
            badges={careerBadges.snapshot}
            best={career.best}
            celebrate={careerBadges.celebrate}
            catalog={CAREER_BADGES}
            progressFor={(badge) => careerBadgeProgress(badge, careerBadges.snapshot, career.best)}
            eyebrow="Career Path"
            onBack={() => {
              careerBadges.acknowledge();
              setScreen("career");
            }}
          />
        ) : null}

        {screen === "awards" ? (
          <Achievements
            badges={badges.snapshot}
            best={game.best}
            dailyStreak={daily.dailyStreak}
            monthCount={daily.monthCount}
            celebrate={badges.celebrate}
            onBack={() => {
              badges.acknowledge();
              setScreen(awardsReturn);
            }}
          />
        ) : null}

        {screen === "classic" && game.phase === "gameover" ? (
          <GameOver
            streak={game.streak}
            best={game.best}
            difficulty={game.difficulty}
            onAgain={playClassic}
            onAwards={() => openAwards("classic")}
            onMenu={() => setScreen("hub")}
          />
        ) : null}

        {screen === "daily" && daily.phase === "results" && daily.attempt ? (
          <DailyScore
            attempt={daily.attempt}
            unlockedBadges={badges.fresh}
            onPractice={practiceDaily}
            onAwards={() => openAwards("daily")}
            onMenu={() => setScreen("hub")}
          />
        ) : null}

        {classicLive && game.matchup ? (
          <Board
            matchup={game.matchup}
            phase={game.phase}
            pickedId={game.pickedId}
            result={game.result}
            unlockedBadges={badges.fresh}
            callout={game.result === "correct" ? streakCallout(game.streak) : ""}
            holdMs={milestone ? MILESTONE_MS : REVEAL_MS}
            onPick={game.pick}
            onAdvance={advanceClassic}
          />
        ) : null}

        {dailyLive && daily.matchup ? (
          <Board
            matchup={daily.matchup}
            phase={daily.phase}
            pickedId={daily.pickedId}
            result={daily.result}
            unlockedBadges={badges.fresh}
            onPick={daily.pick}
            onAdvance={advanceDaily}
          />
        ) : null}

        <p className="snapshot">{roster.snapshot}</p>
      </main>
    </div>
  );
}

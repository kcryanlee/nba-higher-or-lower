import { useCallback, useState } from "react";
import { Analytics } from "@vercel/analytics/react";
import Achievements from "./components/Achievements.jsx";
import Board from "./components/Board.jsx";
import CareerGame from "./components/CareerGame.jsx";
import DailyScore from "./components/DailyScore.jsx";
import DraftGame from "./components/DraftGame.jsx";
import GameLobby from "./components/GameLobby.jsx";
import GameOver from "./components/GameOver.jsx";
import HubScreen from "./components/HubScreen.jsx";
import QuizDailyScore from "./components/QuizDailyScore.jsx";
import StartScreen from "./components/StartScreen.jsx";
import { dataDisclaimer, dataSeasonLine } from "./data/dataConfig.js";
import { players } from "./data/players.js";
import { openingScreen } from "./game/activeRun.js";
import { CAREER_BADGES, careerBadgeProgress } from "./game/careerBadges.js";
import { CAREER_DAILY_KEY, buildCareerDaily } from "./game/careerDaily.js";
import { DRAFT_BADGES, draftBadgeProgress } from "./game/draftBadges.js";
import { DRAFT_DAILY_KEYS, buildDraftDaily, draftDailyTitle } from "./game/draftDaily.js";
import { DRAFT_BEST_KEYS, draftModeLabel } from "./game/draft.js";
import { BADGE_REVEAL_MS, MILESTONE_MS, REVEAL_MS, milestoneBanner, streakCallout } from "./game/feedback.js";
import {
  CAREER_DAILY_BADGE_KEY,
  DRAFT_DAILY_BADGE_KEY,
  HIGHER_DAILY_BADGE_KEY,
  MODE_DAILY_BADGES,
  mergeModeDailyRecords,
  modeDailyBadgeProgress,
  modeDailyStats,
} from "./game/modeDailyBadges.js";
import { DAILY_KEY, DAILY_LENGTH, readDailyRecord } from "./game/daily.js";
import { QUIZ_DAILY_LENGTH, readQuizDailyRecord } from "./game/quizDaily.js";
import { readStoredNumber } from "./game/storage.js";
import { useBadges } from "./hooks/useBadges.js";
import { useCareer } from "./hooks/useCareer.js";
import { useCareerBadges } from "./hooks/useCareerBadges.js";
import { useDaily } from "./hooks/useDaily.js";
import { useDraft } from "./hooks/useDraft.js";
import { useDraftBadges } from "./hooks/useDraftBadges.js";
import { useGame } from "./hooks/useGame.js";
import { useModeDailyBadges } from "./hooks/useModeDailyBadges.js";
import { useQuizDaily } from "./hooks/useQuizDaily.js";

const HIGHER_DAILY_BADGES = MODE_DAILY_BADGES.map((badge) => (
  badge.id === "perfect-day"
    ? {
        ...badge,
        detail: `Get ${DAILY_LENGTH}/${DAILY_LENGTH} in a daily challenge`,
        mark: `${DAILY_LENGTH}/${DAILY_LENGTH}`,
      }
    : badge
));

function readDraftSharedDailyRecord() {
  return mergeModeDailyRecords([
    readQuizDailyRecord(DRAFT_DAILY_KEYS.year),
    readQuizDailyRecord(DRAFT_DAILY_KEYS.pick),
  ]);
}

export default function App() {
  const [screen, setScreen] = useState(() => openingScreen(players));
  const [awardsReturn, setAwardsReturn] = useState("menu");
  const [draftLobbyMode, setDraftLobbyMode] = useState("year");
  const [draftAwardsMode, setDraftAwardsMode] = useState(null);
  const badges = useBadges();
  const higherDailyBadges = useModeDailyBadges(HIGHER_DAILY_BADGE_KEY, DAILY_KEY, readDailyRecord);
  const game = useGame(players, { onAnswer: badges.recordAnswer });
  const daily = useDaily(players, {
    onAnswer: badges.recordAnswer,
    onOfficial: higherDailyBadges.record,
  });
  const careerBadges = useCareerBadges();
  const career = useCareer({ onCorrect: careerBadges.recordStreak });
  const careerDailyBadges = useModeDailyBadges(CAREER_DAILY_BADGE_KEY, CAREER_DAILY_KEY);
  const careerDaily = useQuizDaily({
    storageKey: CAREER_DAILY_KEY,
    questionsFor: buildCareerDaily,
    onComplete: careerDailyBadges.record,
  });
  const draftBadges = useDraftBadges();
  const draft = useDraft(players, { onCorrect: draftBadges.recordStreak });
  const draftYearQuestions = useCallback((date) => buildDraftDaily(players, "year", date), []);
  const draftPickQuestions = useCallback((date) => buildDraftDaily(players, "pick", date), []);
  const draftDailyBadges = useModeDailyBadges(
    DRAFT_DAILY_BADGE_KEY,
    DRAFT_DAILY_KEYS.year,
    readDraftSharedDailyRecord,
  );
  const draftYearDaily = useQuizDaily({
    storageKey: DRAFT_DAILY_KEYS.year,
    questionsFor: draftYearQuestions,
    onComplete: draftDailyBadges.record,
  });
  const draftPickDaily = useQuizDaily({
    storageKey: DRAFT_DAILY_KEYS.pick,
    questionsFor: draftPickQuestions,
    onComplete: draftDailyBadges.record,
  });
  const draftDaily = draftLobbyMode === "pick" ? draftPickDaily : draftYearDaily;
  const draftSharedStats = modeDailyStats(mergeModeDailyRecords([
    draftYearDaily.record,
    draftPickDaily.record,
  ]));

  function openAwards(from) {
    setAwardsReturn(from);
    setScreen("awards");
  }

  function openHigherDailyAwards(from) {
    setAwardsReturn(from);
    setScreen("daily-awards");
  }

  function storedDraftBest(mode) {
    if (mode !== "year" && mode !== "pick") return 0;
    return readStoredNumber(DRAFT_BEST_KEYS[mode]);
  }

  function playCareer() {
    careerBadges.dismiss();
    career.start();
    setScreen("career");
  }

  function openCareerDaily() {
    career.discard();
    careerDailyBadges.dismiss();
    if (careerDaily.available) careerDaily.start();
    setScreen("career-daily");
  }

  function playDraft(mode) {
    draftBadges.dismiss();
    if (!draft.start(mode)) return;
    setDraftLobbyMode(mode);
    setScreen("draft");
  }

  function openDraftLobby(mode) {
    setDraftLobbyMode(mode === "pick" ? "pick" : "year");
    setScreen("draft-menu");
  }

  function openDraftDaily(mode) {
    const nextMode = mode === "pick" ? "pick" : "year";
    const dailyHook = nextMode === "pick" ? draftPickDaily : draftYearDaily;
    draft.discard();
    setDraftLobbyMode(nextMode);
    draftDailyBadges.dismiss();
    if (dailyHook.available) dailyHook.start();
    setScreen("draft-daily");
  }

  function openCareerAwards(from) {
    setAwardsReturn(from);
    setScreen("career-awards");
  }

  function openDraftAwards(mode, from) {
    if (mode !== "year" && mode !== "pick") return;
    setDraftAwardsMode(mode);
    setAwardsReturn(from);
    setScreen("draft-awards");
  }

  function openCareerDailyAwards(from) {
    setAwardsReturn(from);
    setScreen("career-daily-awards");
  }

  function openDraftDailyAwards(from) {
    setAwardsReturn(from);
    setScreen("draft-daily-awards");
  }

  function advanceDraft() {
    draftBadges.dismiss();
    draft.advance();
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
    if (!daily.available) {
      setScreen("daily");
      return;
    }
    if (daily.official) {
      daily.showOfficial();
    } else {
      daily.start(false);
    }
    setScreen("daily");
  }

  function practiceDaily() {
    if (!daily.available) return;
    badges.dismiss();
    daily.start(true);
    setScreen("daily");
  }

  function leaveClassic() {
    game.discard();
    setScreen("hub");
  }

  function leaveCareer() {
    career.discard();
    setScreen("hub");
  }

  function leaveDraft() {
    draft.discard();
    setScreen("hub");
  }

  function leaveDaily() {
    daily.leave();
    higherDailyBadges.dismiss();
    setScreen("hub");
  }

  function leaveCareerDaily() {
    careerDaily.leave();
    careerDailyBadges.dismiss();
    setScreen("career-menu");
  }

  function leaveDraftDaily() {
    draftDaily.leave();
    draftDailyBadges.dismiss();
    setScreen("draft-menu");
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
  const careerLive = career.phase === "playing" || career.phase === "revealing";
  const careerDailyLive = screen === "career-daily" && (careerDaily.phase === "playing" || careerDaily.phase === "revealing");
  const draftSurface = screen === "draft" || screen === "draft-awards";
  const draftLive = draftSurface && (draft.phase === "playing" || draft.phase === "revealing");
  const draftDailyLive = screen === "draft-daily" && (draftDaily.phase === "playing" || draftDaily.phase === "revealing");
  const draftWrong = screen === "draft" && draftLive && draft.result === "wrong";
  const dailyLive = screen === "daily" && (daily.phase === "playing" || daily.phase === "revealing");
  const wrongFlash = (classicLive && game.result === "wrong")
    || (dailyLive && daily.result === "wrong")
    || draftWrong
    || (draftDailyLive && draftDaily.result === "wrong");
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
        {careerDailyLive ? (
          <p className="scoreboard">
            <span>
              Question <strong>{Math.min(careerDaily.index + 1, careerDaily.total)}</strong>
              {" / "}
              {careerDaily.total}
            </span>
            <span className="score-dot" aria-hidden="true">
              •
            </span>
            <span>
              Correct <strong>{careerDaily.correctCount}</strong>
            </span>
          </p>
        ) : screen === "career-daily" || screen === "career-daily-awards" ? (
          <p className="scoreboard">
            <span>Today&apos;s Challenge</span>
          </p>
        ) : draftDailyLive ? (
          <p className="scoreboard">
            <span>
              Question <strong>{Math.min(draftDaily.index + 1, draftDaily.total)}</strong>
              {" / "}
              {draftDaily.total}
            </span>
            <span className="score-dot" aria-hidden="true">
              •
            </span>
            <span>
              Correct <strong>{draftDaily.correctCount}</strong>
            </span>
          </p>
        ) : screen === "draft-daily" || screen === "draft-daily-awards" ? (
          <p className="scoreboard">
            <span>Today&apos;s Challenge</span>
          </p>
        ) : screen === "career-menu" ? (
          <p className="scoreboard">
            <span>
              Best <strong>{career.best}</strong>
            </span>
          </p>
        ) : screen === "draft-menu" ? (
          <p className="scoreboard">
            <span>
              Best <strong>{storedDraftBest(draftLobbyMode)}</strong>
            </span>
          </p>
        ) : dailyLive ? (
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
        ) : (screen === "career" || screen === "career-awards") && careerLive ? (
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
        ) : screen === "career" || screen === "career-awards" ? (
          <p className="scoreboard">
            <span>
              Best <strong>{career.best}</strong>
            </span>
          </p>
        ) : screen === "hub" ? (
          <p className="scoreboard">
            <span>Pick a game</span>
          </p>
        ) : draftLive ? (
          <p className="scoreboard">
            <span>
              Streak <strong>{draft.streak}</strong>
            </span>
            <span className="score-dot" aria-hidden="true">
              •
            </span>
            <span>
              Best <strong>{draft.best}</strong>
            </span>
          </p>
        ) : draftSurface ? (
          <p className="scoreboard">
            <span>
              Best <strong>{draft.best}</strong>
            </span>
          </p>
        ) : classicLive ? (
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
        ) : (
          <p className="scoreboard">
            <span>
              Best <strong>{game.best}</strong>
            </span>
          </p>
        )}
      </header>

      <main className={`frame ${classicLive || dailyLive ? "is-open" : ""}`}>
        {screen === "hub" ? (
          <HubScreen
            onHigher={() => setScreen("menu")}
            onCareer={() => setScreen("career-menu")}
            onDraftYear={() => openDraftLobby("year")}
            onDraftPick={() => openDraftLobby("pick")}
          />
        ) : null}

        {screen === "menu" ? (
          <StartScreen
            best={game.best}
            dailyStreak={daily.dailyStreak}
            dailyStatus={daily.status}
            todayCorrect={daily.official?.correct ?? 0}
            resumeQuestion={(daily.active?.index ?? 0) + 1}
            onPlay={playClassic}
            onDaily={openDaily}
            onAwards={() => openAwards("menu")}
            onDailyAwards={() => openHigherDailyAwards("menu")}
            onHub={() => setScreen("hub")}
          />
        ) : null}

        {screen === "career-menu" ? (
          <GameLobby
            eyebrow="Career Path"
            title="Career Path"
            lede="See the teams a player joined. Name who it is."
            best={career.best}
            dailyStatus={careerDaily.status}
            dailyStreak={careerDaily.streak}
            todayCorrect={careerDaily.official?.correct ?? 0}
            resumeQuestion={(careerDaily.active?.index ?? 0) + 1}
            onPlay={playCareer}
            onDaily={openCareerDaily}
            onAwards={() => openCareerAwards("career-menu")}
            onDailyAwards={() => openCareerDailyAwards("career-menu")}
            onHub={() => setScreen("hub")}
          />
        ) : null}

        {screen === "draft-menu" ? (
          <GameLobby
            eyebrow="Draft Pick"
            title={draftDailyTitle(draftLobbyMode)}
            lede={draftLobbyMode === "pick" ? "Four choices. Name his overall pick." : "Four choices. Name the year he was drafted."}
            best={storedDraftBest(draftLobbyMode)}
            dailyStatus={draftDaily.status}
            dailyStreak={draftDaily.streak}
            todayCorrect={draftDaily.official?.correct ?? 0}
            resumeQuestion={(draftDaily.active?.index ?? 0) + 1}
            onPlay={() => playDraft(draftLobbyMode)}
            onDaily={() => openDraftDaily(draftLobbyMode)}
            onAwards={() => openDraftAwards(draftLobbyMode, "draft-menu")}
            onDailyAwards={() => openDraftDailyAwards("draft-menu")}
            onHub={() => setScreen("hub")}
          />
        ) : null}

        {screen === "draft" ? (
          <DraftGame
            phase={draft.phase}
            mode={draft.mode}
            streak={draft.streak}
            best={draft.best}
            question={draft.question}
            result={draft.result}
            guess={draft.guess}
            unlockedBadges={draftBadges.freshMode === draft.mode ? draftBadges.fresh : []}
            onSubmit={draft.submit}
            onAdvance={advanceDraft}
            onAgain={() => playDraft(draft.mode)}
            onAwards={() => openDraftAwards(draft.mode, "draft")}
            onDaily={() => openDraftDaily(draft.mode)}
            onMenu={leaveDraft}
          />
        ) : null}

        {screen === "draft-awards" && (draftAwardsMode === "year" || draftAwardsMode === "pick") ? (
          <Achievements
            badges={draftBadges.snapshots[draftAwardsMode]}
            best={draft.mode === draftAwardsMode ? draft.best : storedDraftBest(draftAwardsMode)}
            celebrate={draftBadges.celebrate[draftAwardsMode]}
            catalog={DRAFT_BADGES}
            progressFor={(badge) => draftBadgeProgress(
              badge,
              draftBadges.snapshots[draftAwardsMode],
              draft.mode === draftAwardsMode ? draft.best : storedDraftBest(draftAwardsMode),
            )}
            eyebrow={draftModeLabel(draftAwardsMode)}
            onBack={() => {
              draftBadges.acknowledge(draftAwardsMode);
              setScreen(awardsReturn === "draft-menu" ? "draft-menu" : "draft");
            }}
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
            onMenu={leaveCareer}
            onAwards={() => openCareerAwards("career")}
            onDaily={openCareerDaily}
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
              setScreen(awardsReturn === "career-menu" ? "career-menu" : "career");
            }}
          />
        ) : null}

        {careerDailyLive && careerDaily.question ? (
          <CareerGame
            phase={careerDaily.phase}
            streak={careerDaily.correctCount}
            best={career.best}
            question={careerDaily.question}
            picked={careerDaily.choice}
            result={careerDaily.result}
            onPick={careerDaily.pick}
            onAdvance={careerDaily.advance}
            onAgain={playCareer}
            onMenu={leaveCareerDaily}
            onAwards={() => openCareerDailyAwards("career-daily")}
            kicker="Today's Challenge"
            menuLabel="Back"
            unlockedBadges={careerDailyBadges.fresh}
          />
        ) : null}

        {screen === "career-daily" && careerDaily.phase === "results" && careerDaily.attempt ? (
          <QuizDailyScore
            eyebrow="Career Path Daily"
            attempt={careerDaily.attempt}
            unlockedBadges={careerDailyBadges.fresh}
            onAwards={() => openCareerDailyAwards("career-daily")}
            onBack={leaveCareerDaily}
            backLabel="Career Path"
            onMenu={() => {
              careerDaily.leave();
              careerDailyBadges.dismiss();
              setScreen("hub");
            }}
          />
        ) : null}

        {screen === "career-daily" && careerDaily.phase === "idle" && !careerDaily.available ? (
          <section className="panel daily-score">
            <p className="eyebrow">Career Path Daily</p>
            <h1 className="section-title">Unavailable</h1>
            <p className="lede">Today&apos;s challenge could not be built.</p>
            <button type="button" className="action secondary" onClick={leaveCareerDaily}>
              Career Path
            </button>
          </section>
        ) : null}

        {screen === "career-daily-awards" ? (
          <Achievements
            badges={careerDailyBadges.snapshot}
            celebrate={careerDailyBadges.celebrate}
            catalog={MODE_DAILY_BADGES}
            lede={null}
            progressFor={(badge) => modeDailyBadgeProgress(badge, careerDailyBadges.snapshot, {
              ...modeDailyStats(careerDaily.record),
              total: QUIZ_DAILY_LENGTH,
            })}
            eyebrow="Career Path Daily"
            onBack={() => {
              careerDailyBadges.acknowledge();
              setScreen(awardsReturn === "career-menu" ? "career-menu" : "career-daily");
            }}
          />
        ) : null}

        {draftDailyLive && draftDaily.question ? (
          <DraftGame
            phase={draftDaily.phase}
            mode={draftLobbyMode}
            streak={draftDaily.correctCount}
            best={storedDraftBest(draftLobbyMode)}
            question={draftDaily.question}
            result={draftDaily.result}
            guess={draftDaily.choice}
            onSubmit={draftDaily.pick}
            onAdvance={draftDaily.advance}
            onAgain={() => playDraft(draftLobbyMode)}
            onAwards={() => openDraftDailyAwards("draft-daily")}
            onMenu={leaveDraftDaily}
            kicker="Today's Challenge"
            menuLabel="Back"
            unlockedBadges={draftDailyBadges.fresh}
          />
        ) : null}

        {screen === "draft-daily" && draftDaily.phase === "results" && draftDaily.attempt ? (
          <QuizDailyScore
            eyebrow={`${draftDailyTitle(draftLobbyMode)} Daily`}
            attempt={draftDaily.attempt}
            unlockedBadges={draftDailyBadges.fresh}
            onAwards={() => openDraftDailyAwards("draft-daily")}
            onBack={leaveDraftDaily}
            backLabel={draftDailyTitle(draftLobbyMode)}
            onMenu={() => {
              draftDaily.leave();
              draftDailyBadges.dismiss();
              setScreen("hub");
            }}
          />
        ) : null}

        {screen === "draft-daily" && draftDaily.phase === "idle" && !draftDaily.available ? (
          <section className="panel daily-score">
            <p className="eyebrow">{draftDailyTitle(draftLobbyMode)}</p>
            <h1 className="section-title">Unavailable</h1>
            <p className="lede">Today&apos;s challenge could not be built.</p>
            <button type="button" className="action secondary" onClick={leaveDraftDaily}>
              Back
            </button>
          </section>
        ) : null}

        {screen === "draft-daily-awards" && (draftLobbyMode === "year" || draftLobbyMode === "pick") ? (
          <Achievements
            badges={draftDailyBadges.snapshot}
            celebrate={draftDailyBadges.celebrate}
            catalog={MODE_DAILY_BADGES}
            lede={null}
            progressFor={(badge) => modeDailyBadgeProgress(badge, draftDailyBadges.snapshot, {
              ...draftSharedStats,
              total: QUIZ_DAILY_LENGTH,
            })}
            eyebrow="Draft Pick Daily"
            onBack={() => {
              draftDailyBadges.acknowledge();
              setScreen(awardsReturn === "draft-menu" ? "draft-menu" : "draft-daily");
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

        {screen === "daily-awards" ? (
          <Achievements
            badges={higherDailyBadges.snapshot}
            celebrate={higherDailyBadges.celebrate}
            catalog={HIGHER_DAILY_BADGES}
            lede={null}
            progressFor={(badge) => modeDailyBadgeProgress(badge, higherDailyBadges.snapshot, {
              ...modeDailyStats(daily.record),
              total: DAILY_LENGTH,
            })}
            eyebrow="Higher or Lower Daily"
            onBack={() => {
              higherDailyBadges.acknowledge();
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
            onMenu={leaveClassic}
          />
        ) : null}

        {screen === "daily" && daily.phase === "results" && daily.attempt ? (
          <DailyScore
            attempt={daily.attempt}
            unlockedBadges={[...badges.fresh, ...higherDailyBadges.fresh]}
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
            holdMs={badges.fresh.length ? BADGE_REVEAL_MS : milestone ? MILESTONE_MS : REVEAL_MS}
            onPick={game.pick}
            onAdvance={advanceClassic}
            onMenu={leaveClassic}
            onAwards={() => openAwards("classic")}
          />
        ) : null}

        {screen === "daily" && !daily.available ? (
          <section className="panel daily-score">
            <p className="eyebrow">Daily challenge</p>
            <h1 className="section-title">Unavailable</h1>
            <p className="lede">Today&apos;s challenge could not be built.</p>
            <button type="button" className="action secondary" onClick={() => setScreen("hub")}>
              All Games
            </button>
          </section>
        ) : null}

        {dailyLive && daily.matchup ? (
          <Board
            matchup={daily.matchup}
            phase={daily.phase}
            pickedId={daily.pickedId}
            result={daily.result}
            unlockedBadges={badges.fresh}
            holdMs={badges.fresh.length ? BADGE_REVEAL_MS : REVEAL_MS}
            onPick={daily.pick}
            onAdvance={advanceDaily}
            onMenu={leaveDaily}
            onAwards={() => openAwards("daily")}
          />
        ) : null}

        <p className="snapshot">
          {dataDisclaimer()}
          <span className="snapshot-seasons">{dataSeasonLine()}</span>
        </p>
      </main>
    </div>
  );
}

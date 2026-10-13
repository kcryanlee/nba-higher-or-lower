import { useCallback, useRef, useState } from "react";
import { Analytics } from "@vercel/analytics/react";
import Achievements from "./components/Achievements.jsx";
import Board from "./components/Board.jsx";
import CareerGame from "./components/CareerGame.jsx";
import ChainGame from "./components/ChainGame.jsx";
import DailyScore from "./components/DailyScore.jsx";
import DraftGame from "./components/DraftGame.jsx";
import GameLobby from "./components/GameLobby.jsx";
import GameOver from "./components/GameOver.jsx";
import HubScreen from "./components/HubScreen.jsx";
import MilestoneCover from "./components/MilestoneCover.jsx";
import PkGame from "./components/PkGame.jsx";
import QuizDailyScore from "./components/QuizDailyScore.jsx";
import ScoredGame from "./components/ScoredGame.jsx";
import StartScreen from "./components/StartScreen.jsx";
import { dataDisclaimer, dataSeasonLine } from "./data/dataConfig.js";
import { players } from "./data/players.js";
import { focusRun, openingScreen } from "./game/activeRun.js";
import { CAREER_BADGES, careerBadgeProgress } from "./game/careerBadges.js";
import { CHAIN_BADGES, chainBadgeProgress } from "./game/chainBadges.js";
import { chainChoiceCorrect } from "./game/chain.js";
import { CHAIN_DAILY_KEY, buildChainDaily } from "./game/chainDaily.js";
import { CAREER_DAILY_KEY, buildCareerDaily } from "./game/careerDaily.js";
import { careerPlayerAccepted } from "./game/careerPath.js";
import { DRAFT_BADGES, draftBadgeProgress } from "./game/draftBadges.js";
import { DRAFT_DAILY_KEYS, buildDraftDaily, draftDailyTitle } from "./game/draftDaily.js";
import { DRAFT_BEST_KEYS, draftModeLabel } from "./game/draft.js";
import { SCORED_BADGES, scoredBadgeProgress } from "./game/scoredBadges.js";
import { SCORED_DAILY_KEY, buildScoredDaily } from "./game/scoredDaily.js";
import { SCORED_DAILY_TOTAL, readScoredDailyRecord } from "./game/scoredDailyRecord.js";
import { SCORED_REVEAL_MS, scoredMilestoneBanner, scoredStreakCallout } from "./game/scored.js";
import { BADGE_REVEAL_MS, MILESTONE_MS, milestoneBanner, streakCallout, streakMarkBanner } from "./game/feedback.js";
import {
  CAREER_DAILY_BADGE_KEY,
  CHAIN_DAILY_BADGE_KEY,
  DRAFT_DAILY_BADGE_KEY,
  HIGHER_DAILY_BADGE_KEY,
  MODE_DAILY_BADGES,
  SCORED_DAILY_BADGE_KEY,
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
import { useChain } from "./hooks/useChain.js";
import { useChainBadges } from "./hooks/useChainBadges.js";
import { useDaily } from "./hooks/useDaily.js";
import { useDraft } from "./hooks/useDraft.js";
import { useDraftBadges } from "./hooks/useDraftBadges.js";
import { useGame } from "./hooks/useGame.js";
import { useModeDailyBadges } from "./hooks/useModeDailyBadges.js";
import { useQuizDaily } from "./hooks/useQuizDaily.js";
import { useScored } from "./hooks/useScored.js";
import { useScoredBadges } from "./hooks/useScoredBadges.js";
import { hasPkSeat } from "./hooks/usePk.js";
import { useScoredDaily } from "./hooks/useScoredDaily.js";

const HIGHER_DAILY_BADGES = MODE_DAILY_BADGES.map((badge) => (
  badge.id === "perfect-day"
    ? {
        ...badge,
        detail: `Get ${DAILY_LENGTH}/${DAILY_LENGTH} in a daily challenge`,
        mark: `${DAILY_LENGTH}/${DAILY_LENGTH}`,
      }
    : badge
));

const SCORED_DAILY_BADGES = MODE_DAILY_BADGES.map((badge) => (
  badge.id === "perfect-day"
    ? {
        ...badge,
        detail: `Get ${SCORED_DAILY_TOTAL}/${SCORED_DAILY_TOTAL} ranking positions in a daily challenge`,
        mark: `${SCORED_DAILY_TOTAL}/${SCORED_DAILY_TOTAL}`,
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
  const [screen, setScreen] = useState(() => (hasPkSeat() ? "pk" : openingScreen(players)));
  const pkLeaveRef = useRef(null);
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
    openAnswer: true,
    accepts: careerPlayerAccepted,
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
  const scoredBadges = useScoredBadges();
  const scored = useScored({ onCorrect: scoredBadges.recordStreak });
  const scoredDailyBadges = useModeDailyBadges(SCORED_DAILY_BADGE_KEY, SCORED_DAILY_KEY, readScoredDailyRecord);
  const scoredDaily = useScoredDaily({
    storageKey: SCORED_DAILY_KEY,
    questionsFor: buildScoredDaily,
    onComplete: scoredDailyBadges.record,
  });
  const chainBadges = useChainBadges();
  const chain = useChain({ onCorrect: chainBadges.recordStreak });
  const chainDailyBadges = useModeDailyBadges(CHAIN_DAILY_BADGE_KEY, CHAIN_DAILY_KEY);
  const chainDaily = useQuizDaily({
    storageKey: CHAIN_DAILY_KEY,
    questionsFor: buildChainDaily,
    onComplete: chainDailyBadges.record,
    accepts: chainChoiceCorrect,
  });
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

  function livePhase(phase) {
    return phase === "playing" || phase === "revealing";
  }

  function goHome() {
    if (screen === "hub") return;
    if (screen === "pk") pkLeaveRef.current?.();
    if (screen === "daily" || screen === "daily-awards") {
      daily.leave();
      higherDailyBadges.dismiss();
    } else if (screen === "career-daily" || screen === "career-daily-awards") {
      careerDaily.leave();
      careerDailyBadges.dismiss();
    } else if (screen === "draft-daily" || screen === "draft-daily-awards") {
      draftDaily.leave();
      draftDailyBadges.dismiss();
    } else if (screen === "scored-daily" || screen === "scored-daily-awards") {
      scoredDaily.leave();
      scoredDailyBadges.dismiss();
    } else if (screen === "chain-daily" || screen === "chain-daily-awards") {
      chainDaily.leave();
      chainDailyBadges.dismiss();
    } else if (screen === "classic" || screen === "awards" || screen === "menu") {
      if (!livePhase(game.phase)) game.discard();
    } else if (screen === "career" || screen === "career-awards" || screen === "career-menu") {
      if (!livePhase(career.phase)) career.discard();
    } else if (screen === "draft" || screen === "draft-awards" || screen === "draft-menu") {
      if (!livePhase(draft.phase)) draft.discard();
    } else if (screen === "scored" || screen === "scored-awards" || screen === "scored-menu") {
      if (!livePhase(scored.phase)) scored.discard();
    } else if (screen === "chain" || screen === "chain-awards" || screen === "chain-menu") {
      if (!livePhase(chain.phase)) chain.discard();
    }
    setScreen("hub");
  }

  function playCareer() {
    careerBadges.dismiss();
    focusRun("career");
    career.start();
    setScreen("career");
  }

  function openCareer() {
    careerBadges.dismiss();
    focusRun("career");
    career.resume();
    setScreen("career");
  }

  function openCareerDaily() {
    careerDailyBadges.dismiss();
    if (livePhase(career.phase)) focusRun("career");
    if (careerDaily.available) careerDaily.start();
    setScreen("career-daily");
  }

  function playDraft(mode) {
    draftBadges.dismiss();
    focusRun("draft", mode);
    if (!draft.start(mode)) return;
    setDraftLobbyMode(mode);
    setScreen("draft");
  }

  function openDraft(mode) {
    draftBadges.dismiss();
    focusRun("draft", mode);
    if (!draft.resume(mode)) return;
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
    setDraftLobbyMode(nextMode);
    draftDailyBadges.dismiss();
    if (livePhase(draft.phase) && draft.mode === nextMode) focusRun("draft", nextMode);
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

  function playChain() {
    chainBadges.dismiss();
    focusRun("chain");
    if (!chain.start()) return;
    setScreen("chain");
  }

  function openChain() {
    chainBadges.dismiss();
    focusRun("chain");
    if (!chain.resume()) return;
    setScreen("chain");
  }

  function openChainDaily() {
    chainDailyBadges.dismiss();
    if (livePhase(chain.phase)) focusRun("chain");
    if (chainDaily.available) chainDaily.start();
    setScreen("chain-daily");
  }

  function openChainAwards(from) {
    setAwardsReturn(from);
    setScreen("chain-awards");
  }

  function openChainDailyAwards(from) {
    setAwardsReturn(from);
    setScreen("chain-daily-awards");
  }

  function practiceChainDaily() {
    if (!chainDaily.available) return;
    chainDailyBadges.dismiss();
    chainDaily.start(true);
    setScreen("chain-daily");
  }

  function leaveChain() {
    if (!livePhase(chain.phase)) chain.discard();
    setScreen("hub");
  }

  function leaveChainDaily() {
    chainDaily.leave();
    chainDailyBadges.dismiss();
    if (livePhase(chain.phase)) {
      focusRun("chain");
      setScreen("chain");
      return;
    }
    setScreen("chain-menu");
  }

  function advanceChain() {
    chainBadges.dismiss();
    chain.advance();
  }

  function playScored() {
    scoredBadges.dismiss();
    focusRun("scored");
    if (!scored.start()) return;
    setScreen("scored");
  }

  function openScored() {
    scoredBadges.dismiss();
    focusRun("scored");
    if (!scored.resume()) return;
    setScreen("scored");
  }

  function openScoredDaily() {
    scoredDailyBadges.dismiss();
    if (livePhase(scored.phase)) focusRun("scored");
    if (scoredDaily.available) scoredDaily.start();
    setScreen("scored-daily");
  }

  function openScoredAwards(from) {
    setAwardsReturn(from);
    setScreen("scored-awards");
  }

  function openScoredDailyAwards(from) {
    setAwardsReturn(from);
    setScreen("scored-daily-awards");
  }

  function practiceScoredDaily() {
    if (!scoredDaily.available) return;
    scoredDailyBadges.dismiss();
    scoredDaily.start(true);
    setScreen("scored-daily");
  }

  function leaveScored() {
    if (!livePhase(scored.phase)) scored.discard();
    setScreen("hub");
  }

  function leaveScoredDaily() {
    scoredDaily.leave();
    scoredDailyBadges.dismiss();
    if (livePhase(scored.phase)) {
      focusRun("scored");
      setScreen("scored");
      return;
    }
    setScreen("scored-menu");
  }

  function advanceScored() {
    scoredBadges.dismiss();
    scored.advance();
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
    focusRun("classic");
    game.start();
    setScreen("classic");
  }

  function openClassic() {
    badges.dismiss();
    focusRun("classic");
    game.resume();
    setScreen("classic");
  }

  function openDaily() {
    badges.dismiss();
    if (livePhase(game.phase)) focusRun("classic");
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

  function practiceCareerDaily() {
    if (!careerDaily.available) return;
    careerDailyBadges.dismiss();
    careerDaily.start(true);
    setScreen("career-daily");
  }

  function practiceDraftDaily() {
    if (!draftDaily.available) return;
    draftDailyBadges.dismiss();
    draftDaily.start(true);
    setScreen("draft-daily");
  }

  function leaveClassic() {
    if (!livePhase(game.phase)) game.discard();
    setScreen("hub");
  }

  function leaveCareer() {
    if (!livePhase(career.phase)) career.discard();
    setScreen("hub");
  }

  function leaveDraft() {
    if (!livePhase(draft.phase)) draft.discard();
    setScreen("hub");
  }

  function leaveDaily() {
    daily.leave();
    higherDailyBadges.dismiss();
    if (livePhase(game.phase)) {
      focusRun("classic");
      setScreen("classic");
      return;
    }
    setScreen("menu");
  }

  function leaveCareerDaily() {
    careerDaily.leave();
    careerDailyBadges.dismiss();
    if (livePhase(career.phase)) focusRun("career");
    setScreen("career-menu");
  }

  function leaveDraftDaily() {
    const mode = draftLobbyMode;
    draftDaily.leave();
    draftDailyBadges.dismiss();
    if (livePhase(draft.phase) && draft.mode === mode) {
      focusRun("draft", mode);
      setScreen("draft");
      return;
    }
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
  const scoredLive = screen === "scored" && (scored.phase === "playing" || scored.phase === "revealing");
  const scoredDailyLive = screen === "scored-daily" && (scoredDaily.phase === "playing" || scoredDaily.phase === "revealing");
  const chainLive = chain.phase === "playing" || chain.phase === "revealing";
  const chainDailyLive = screen === "chain-daily" && (chainDaily.phase === "playing" || chainDaily.phase === "revealing");
  const draftWrong = screen === "draft" && draftLive && draft.result === "wrong";
  const dailyLive = screen === "daily" && (daily.phase === "playing" || daily.phase === "revealing");
  const wrongFlash = (classicLive && game.result === "wrong")
    || (dailyLive && daily.result === "wrong")
    || draftWrong
    || (draftDailyLive && draftDaily.result === "wrong")
    || (scoredLive && scored.result === "miss")
    || (scoredDailyLive && scoredDaily.result === "miss")
    || (screen === "chain" && chainLive && chain.result === "wrong")
    || (chainDailyLive && chainDaily.result === "wrong");
  const scoredBefore = scored.streak - (scored.credit ?? 0);
  const scoredMilestone = scoredLive && scored.result === "placed"
    ? scoredMilestoneBanner(scoredBefore, scored.streak)
    : "";
  const classicMilestone = classicLive && game.result === "correct" ? milestoneBanner(game.streak) : "";
  const careerMilestone = screen === "career" && career.phase === "revealing" && career.result === "correct"
    ? streakMarkBanner(career.streak)
    : "";
  const draftMilestone = screen === "draft" && draft.phase === "revealing" && draft.result === "correct"
    ? streakMarkBanner(draft.streak)
    : "";
  const chainMilestone = screen === "chain" && chain.phase === "revealing" && chain.result === "correct"
    ? streakMarkBanner(chain.streak)
    : "";
  const milestone = classicMilestone || careerMilestone || draftMilestone || chainMilestone || scoredMilestone;
  const dismissMilestoneRef = useRef(() => {});
  dismissMilestoneRef.current = () => {
    if (classicMilestone) advanceClassic();
    else if (careerMilestone) advanceCareer();
    else if (draftMilestone) advanceDraft();
    else if (chainMilestone) advanceChain();
    else if (scoredMilestone) advanceScored();
  };

  return (
    <div className="court">
      <Analytics />
      {wrongFlash ? <div className="wrong-flash" aria-hidden="true" /> : null}
      {milestone ? (
        <MilestoneCover message={milestone} onDone={() => dismissMilestoneRef.current()} />
      ) : null}
      <header className="topbar">
        <button
          type="button"
          className={`brand ${screen === "hub" ? "is-home" : ""}`}
          onClick={goHome}
          aria-current={screen === "hub" ? "page" : undefined}
          aria-label={screen === "hub" ? undefined : "Back to all games"}
        >
          <img className="brand-mark" src="/basketball.png" alt="" width="22" height="22" />
          NBA Mini Games
        </button>
        {careerDailyLive ? (
          <p className="scoreboard">
            {careerDaily.practice ? <span>Practice</span> : null}
            {careerDaily.practice ? (
              <span className="score-dot" aria-hidden="true">
                •
              </span>
            ) : null}
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
            {draftDaily.practice ? <span>Practice</span> : null}
            {draftDaily.practice ? (
              <span className="score-dot" aria-hidden="true">
                •
              </span>
            ) : null}
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
        ) : scoredDailyLive ? (
          <p className="scoreboard">
            {scoredDaily.practice ? <span>Practice</span> : null}
            {scoredDaily.practice ? (
              <span className="score-dot" aria-hidden="true">
                •
              </span>
            ) : null}
            <span>
              Question <strong>{Math.min(scoredDaily.index + 1, scoredDaily.total)}</strong>
              {" / "}
              {scoredDaily.total}
            </span>
            <span className="score-dot" aria-hidden="true">
              •
            </span>
            <span>
              Score <strong>{scoredDaily.correctCount}</strong>
            </span>
          </p>
        ) : screen === "scored-daily" || screen === "scored-daily-awards" ? (
          <p className="scoreboard">
            <span>Today&apos;s Challenge</span>
          </p>
        ) : screen === "scored-menu" ? (
          <p className="scoreboard">
            <span>
              Best <strong>{scored.best}</strong>
            </span>
          </p>
        ) : scoredLive ? (
          <p className="scoreboard">
            <span>
              Streak <strong>{scored.streak}</strong>
            </span>
            <span className="score-dot" aria-hidden="true">
              •
            </span>
            <span>
              Best <strong>{scored.best}</strong>
            </span>
          </p>
        ) : screen === "scored" || screen === "scored-awards" ? (
          <p className="scoreboard">
            <span>
              Best <strong>{scored.best}</strong>
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
        ) : screen === "chain-menu" ? (
          <p className="scoreboard">
            <span>
              Best <strong>{chain.best}</strong>
            </span>
          </p>
        ) : chainDailyLive ? (
          <p className="scoreboard">
            {chainDaily.practice ? <span>Practice</span> : null}
            {chainDaily.practice ? (
              <span className="score-dot" aria-hidden="true">
                •
              </span>
            ) : null}
            <span>
              Question <strong>{Math.min(chainDaily.index + 1, chainDaily.total)}</strong>
              {" / "}
              {chainDaily.total}
            </span>
            <span className="score-dot" aria-hidden="true">
              •
            </span>
            <span>
              Correct <strong>{chainDaily.correctCount}</strong>
            </span>
          </p>
        ) : screen === "chain-daily" || screen === "chain-daily-awards" ? (
          <p className="scoreboard">
            <span>Today&apos;s Challenge</span>
          </p>
        ) : (screen === "chain" || screen === "chain-awards") && chainLive ? (
          <p className="scoreboard">
            <span>
              Streak <strong>{chain.streak}</strong>
            </span>
            <span className="score-dot" aria-hidden="true">
              •
            </span>
            <span>
              Best <strong>{chain.best}</strong>
            </span>
          </p>
        ) : screen === "chain" || screen === "chain-awards" ? (
          <p className="scoreboard">
            <span>
              Best <strong>{chain.best}</strong>
            </span>
          </p>
        ) : screen === "hub" ? (
          <p className="scoreboard">
            <span>Pick a game</span>
          </p>
        ) : screen === "pk" ? (
          <p className="scoreboard">
            <span>Live 1 vs 1</span>
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

      <main className={`frame ${classicLive || dailyLive || scoredLive || scoredDailyLive ? "is-open" : ""}`}>
        {screen === "hub" ? (
          <HubScreen
            onHigher={() => setScreen("menu")}
            onCareer={() => setScreen("career-menu")}
            onDraftYear={() => openDraftLobby("year")}
            onDraftPick={() => openDraftLobby("pick")}
            onScored={() => setScreen("scored-menu")}
            onChain={() => setScreen("chain-menu")}
            onPk={() => setScreen("pk")}
          />
        ) : null}

        {screen === "pk" ? (
          <PkGame onLeave={() => setScreen("hub")} leaveRef={pkLeaveRef} />
        ) : null}

        {screen === "chain-menu" ? (
          <GameLobby
            eyebrow="Teammate Chain"
            title="Teammate Chain"
            lede="Two careers. Find a player who was teammates with both."
            best={chain.best}
            dailyStatus={chainDaily.status}
            dailyStreak={chainDaily.streak}
            todayCorrect={chainDaily.official?.correct ?? 0}
            resumeQuestion={(chainDaily.active?.index ?? 0) + 1}
            onPlay={openChain}
            onDaily={openChainDaily}
            onAwards={() => openChainAwards("chain-menu")}
            onDailyAwards={() => openChainDailyAwards("chain-menu")}
            onHub={() => setScreen("hub")}
          />
        ) : null}

        {screen === "chain" && chain.phase !== "gameover" && chain.question ? (
          <ChainGame
            phase={chain.phase}
            streak={chain.streak}
            best={chain.best}
            question={chain.question}
            picked={chain.picked}
            result={chain.result}
            ended={chain.ended}
            onPick={chain.pick}
            onAdvance={advanceChain}
            onAgain={playChain}
            onMenu={leaveChain}
            onAwards={() => openChainAwards("chain")}
            onDaily={openChainDaily}
            unlockedBadges={chainBadges.fresh}
          />
        ) : null}

        {screen === "chain" && chain.phase === "gameover" ? (
          <ChainGame
            phase={chain.phase}
            streak={chain.streak}
            best={chain.best}
            question={chain.question}
            picked={chain.picked}
            result={chain.result}
            ended={chain.ended}
            onPick={chain.pick}
            onAdvance={advanceChain}
            onAgain={playChain}
            onMenu={leaveChain}
            onAwards={() => openChainAwards("chain")}
            onDaily={openChainDaily}
          />
        ) : null}

        {screen === "chain-awards" ? (
          <Achievements
            badges={chainBadges.snapshot}
            best={chain.best}
            celebrate={chainBadges.celebrate}
            catalog={CHAIN_BADGES}
            progressFor={(badge) => chainBadgeProgress(badge, chainBadges.snapshot, chain.best)}
            eyebrow="Teammate Chain"
            onBack={() => {
              chainBadges.acknowledge();
              setScreen(awardsReturn === "chain-menu" || awardsReturn === "chain-daily" ? awardsReturn : "chain");
            }}
          />
        ) : null}

        {chainDailyLive && chainDaily.question ? (
          <ChainGame
            phase={chainDaily.phase}
            streak={chainDaily.correctCount}
            best={chain.best}
            question={chainDaily.question}
            picked={chainDaily.choice}
            result={chainDaily.result}
            onPick={chainDaily.pick}
            onAdvance={chainDaily.advance}
            onAgain={playChain}
            onMenu={leaveChainDaily}
            onAwards={() => openChainAwards("chain-daily")}
            onDailyAwards={() => openChainDailyAwards("chain-daily")}
            kicker="Today's Challenge"
            menuLabel="Back"
            unlockedBadges={chainDailyBadges.fresh}
          />
        ) : null}

        {screen === "chain-daily" && chainDaily.phase === "results" && chainDaily.attempt ? (
          <QuizDailyScore
            attempt={chainDaily.attempt}
            unlockedBadges={chainDailyBadges.fresh}
            onPractice={practiceChainDaily}
            onAwards={() => openChainAwards("chain-daily")}
            onDailyAwards={() => openChainDailyAwards("chain-daily")}
            onMenu={leaveChainDaily}
            menuLabel="Back"
            note="Today's puzzle uses your local date. Everyone gets the same five teammate links. The official score locks after one play."
          />
        ) : null}

        {screen === "chain-daily" && chainDaily.phase === "idle" && !chainDaily.available ? (
          <section className="panel daily-score">
            <p className="eyebrow">Teammate Chain Daily</p>
            <h1 className="section-title">Unavailable</h1>
            <p className="lede">Today&apos;s challenge could not be built.</p>
            <button type="button" className="action secondary" onClick={leaveChainDaily}>
              Teammate Chain
            </button>
          </section>
        ) : null}

        {screen === "chain-daily-awards" ? (
          <Achievements
            badges={chainDailyBadges.snapshot}
            celebrate={chainDailyBadges.celebrate}
            catalog={MODE_DAILY_BADGES}
            lede={null}
            progressFor={(badge) => modeDailyBadgeProgress(badge, chainDailyBadges.snapshot, {
              ...modeDailyStats(chainDaily.record),
              total: QUIZ_DAILY_LENGTH,
            })}
            eyebrow="Teammate Chain Daily"
            onBack={() => {
              chainDailyBadges.acknowledge();
              setScreen(awardsReturn === "chain-menu" ? "chain-menu" : "chain-daily");
            }}
          />
        ) : null}

        {screen === "menu" ? (
          <StartScreen
            best={game.best}
            dailyStreak={daily.dailyStreak}
            dailyStatus={daily.status}
            todayCorrect={daily.official?.correct ?? 0}
            resumeQuestion={(daily.active?.index ?? 0) + 1}
            onPlay={openClassic}
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
            lede="The career is on the board. Name the player."
            best={career.best}
            dailyStatus={careerDaily.status}
            dailyStreak={careerDaily.streak}
            todayCorrect={careerDaily.official?.correct ?? 0}
            resumeQuestion={(careerDaily.active?.index ?? 0) + 1}
            onPlay={openCareer}
            onDaily={openCareerDaily}
            onAwards={() => openCareerAwards("career-menu")}
            onDailyAwards={() => openCareerDailyAwards("career-menu")}
            onHub={() => setScreen("hub")}
          />
        ) : null}

        {screen === "scored-menu" ? (
          <GameLobby
            eyebrow="Who Scored More?"
            title="Who Scored More?"
            lede="Three players from one game. Rank them from most points to fewest."
            best={scored.best}
            dailyStatus={scoredDaily.status}
            dailyStreak={scoredDaily.streak}
            todayCorrect={scoredDaily.official?.correct ?? 0}
            resumeQuestion={(scoredDaily.active?.index ?? 0) + 1}
            dailyTotal={SCORED_DAILY_TOTAL}
            onPlay={openScored}
            onDaily={openScoredDaily}
            onAwards={() => openScoredAwards("scored-menu")}
            onDailyAwards={() => openScoredDailyAwards("scored-menu")}
            onHub={() => setScreen("hub")}
          />
        ) : null}

        {screen === "scored" ? (
          <ScoredGame
            phase={scored.phase}
            streak={scored.streak}
            best={scored.best}
            question={scored.question}
            picks={scored.picks}
            result={scored.result}
            onPick={scored.pick}
            onLock={scored.lock}
            onAdvance={advanceScored}
            onAgain={playScored}
            onMenu={leaveScored}
            onAwards={() => openScoredAwards("scored")}
            onDaily={openScoredDaily}
            unlockedBadges={scoredBadges.fresh}
            callout={scored.result === "placed" ? scoredStreakCallout(scoredBefore, scored.streak) : ""}
            holdMs={scoredBadges.fresh.length ? BADGE_REVEAL_MS : scoredMilestone ? MILESTONE_MS : SCORED_REVEAL_MS}
          />
        ) : null}

        {screen === "scored-awards" ? (
          <Achievements
            badges={scoredBadges.snapshot}
            best={scored.best}
            celebrate={scoredBadges.celebrate}
            catalog={SCORED_BADGES}
            progressFor={(badge) => scoredBadgeProgress(badge, scoredBadges.snapshot, scored.best)}
            eyebrow="Who Scored More?"
            onBack={() => {
              scoredBadges.acknowledge();
              setScreen(awardsReturn === "scored-menu" || awardsReturn === "scored-daily" ? awardsReturn : "scored");
            }}
          />
        ) : null}

        {scoredDailyLive && scoredDaily.question ? (
          <ScoredGame
            phase={scoredDaily.phase}
            streak={scoredDaily.correctCount}
            best={scored.best}
            question={scoredDaily.question}
            picks={scoredDaily.picks}
            result={scoredDaily.result}
            onPick={scoredDaily.pick}
            onLock={scoredDaily.lock}
            onAdvance={scoredDaily.advance}
            onAgain={playScored}
            onMenu={leaveScoredDaily}
            onAwards={() => openScoredAwards("scored-daily")}
            onDailyAwards={() => openScoredDailyAwards("scored-daily")}
            kicker="Today's Challenge"
            menuLabel="Back"
            unlockedBadges={scoredDailyBadges.fresh}
            holdMs={scoredDailyBadges.fresh.length ? BADGE_REVEAL_MS : SCORED_REVEAL_MS}
          />
        ) : null}

        {screen === "scored-daily" && scoredDaily.phase === "results" && scoredDaily.attempt ? (
          <QuizDailyScore
            attempt={scoredDaily.attempt}
            unlockedBadges={scoredDailyBadges.fresh}
            onPractice={practiceScoredDaily}
            onAwards={() => openScoredAwards("scored-daily")}
            onDailyAwards={() => openScoredDailyAwards("scored-daily")}
            onMenu={leaveScoredDaily}
            menuLabel="Back"
            note={`Today's puzzle uses your local date. Everyone ranks the same five games. The official score is out of ${SCORED_DAILY_TOTAL} and locks after one play.`}
          />
        ) : null}

        {screen === "scored-daily" && scoredDaily.phase === "idle" && !scoredDaily.available ? (
          <section className="panel daily-score">
            <p className="eyebrow">Who Scored More? Daily</p>
            <h1 className="section-title">Unavailable</h1>
            <p className="lede">Today&apos;s challenge could not be built.</p>
            <button type="button" className="action secondary" onClick={leaveScoredDaily}>
              Who Scored More?
            </button>
          </section>
        ) : null}

        {screen === "scored-daily-awards" ? (
          <Achievements
            badges={scoredDailyBadges.snapshot}
            celebrate={scoredDailyBadges.celebrate}
            catalog={SCORED_DAILY_BADGES}
            lede={null}
            progressFor={(badge) => modeDailyBadgeProgress(badge, scoredDailyBadges.snapshot, {
              ...modeDailyStats(scoredDaily.record),
              total: SCORED_DAILY_TOTAL,
            })}
            eyebrow="Who Scored More? Daily"
            onBack={() => {
              scoredDailyBadges.acknowledge();
              setScreen(awardsReturn === "scored-menu" ? "scored-menu" : "scored-daily");
            }}
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
            onPlay={() => openDraft(draftLobbyMode)}
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
              setScreen(awardsReturn === "draft-menu" || awardsReturn === "draft-daily" ? awardsReturn : "draft");
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
              setScreen(awardsReturn === "career-menu" || awardsReturn === "career-daily" ? awardsReturn : "career");
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
            onAwards={() => openCareerAwards("career-daily")}
            onDailyAwards={() => openCareerDailyAwards("career-daily")}
            kicker="Today's Challenge"
            menuLabel="Back"
            unlockedBadges={careerDailyBadges.fresh}
          />
        ) : null}

        {screen === "career-daily" && careerDaily.phase === "results" && careerDaily.attempt ? (
          <QuizDailyScore
            attempt={careerDaily.attempt}
            unlockedBadges={careerDailyBadges.fresh}
            onPractice={practiceCareerDaily}
            onAwards={() => openCareerAwards("career-daily")}
            onDailyAwards={() => openCareerDailyAwards("career-daily")}
            onMenu={leaveCareerDaily}
            menuLabel="Back"
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
            onAwards={() => openDraftAwards(draftLobbyMode, "draft-daily")}
            onDailyAwards={() => openDraftDailyAwards("draft-daily")}
            onMenu={leaveDraftDaily}
            kicker="Today's Challenge"
            menuLabel="Back"
            unlockedBadges={draftDailyBadges.fresh}
          />
        ) : null}

        {screen === "draft-daily" && draftDaily.phase === "results" && draftDaily.attempt ? (
          <QuizDailyScore
            attempt={draftDaily.attempt}
            unlockedBadges={draftDailyBadges.fresh}
            onPractice={practiceDraftDaily}
            onAwards={() => openDraftAwards(draftLobbyMode, "draft-daily")}
            onDailyAwards={() => openDraftDailyAwards("draft-daily")}
            onMenu={leaveDraftDaily}
            menuLabel="Back"
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
            onDailyAwards={() => openHigherDailyAwards("daily")}
            onMenu={leaveDaily}
            menuLabel="Back"
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
            onPick={game.pick}
            onAdvance={advanceClassic}
            onMenu={leaveClassic}
            onAwards={() => openAwards("classic")}
            onDaily={openDaily}
          />
        ) : null}

        {screen === "daily" && !daily.available ? (
          <section className="panel daily-score">
            <p className="eyebrow">Daily challenge</p>
            <h1 className="section-title">Unavailable</h1>
            <p className="lede">Today&apos;s challenge could not be built.</p>
            <button type="button" className="action secondary" onClick={leaveDaily}>
              {game.phase === "start" ? "All Games" : "Back"}
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
            onPick={daily.pick}
            onAdvance={advanceDaily}
            onMenu={leaveDaily}
            onAwards={() => openAwards("daily")}
            onDailyAwards={() => openHigherDailyAwards("daily")}
            menuLabel="Back"
          />
        ) : null}

        {screen === "pk" || screen === "scored" || screen === "scored-menu" || screen === "scored-awards" || screen === "scored-daily" || screen === "scored-daily-awards" ? null : (
          <p className="snapshot">
            {dataDisclaimer()}
            <span className="snapshot-seasons">{dataSeasonLine()}</span>
          </p>
        )}
      </main>
    </div>
  );
}

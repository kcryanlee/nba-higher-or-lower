import { useEffect, useRef, useState } from "react";
import { approvedPlayerImage, playerImageUrl } from "../data/playerMedia.js";
import { categoryById } from "../game/categories.js";
import { formatYears } from "../game/careerPath.js";
import { draftModeLabel, formatDraftChoice, formatDraftReveal } from "../game/draft.js";
import { playBuzzer } from "../game/feedback.js";
import { PK_QUESTION_MS, pkModeLabel } from "../game/pkModes.js";
import { teamColors, teamLogoUrl } from "../game/teams.js";
import { savedPkName, usePk } from "../hooks/usePk.js";
import PlayerCard from "./PlayerCard.jsx";
import PlayerSearch from "./PlayerSearch.jsx";
import StatIcon from "./StatIcon.jsx";

function useCountdown(timer) {
  const key = timer?.key ?? null;
  const paused = Boolean(timer?.paused);
  const budget = timer?.remainingMs ?? 0;
  const [elapsed, setElapsed] = useState(0);
  const [activeKey, setActiveKey] = useState(null);

  useEffect(() => {
    if (key == null || paused) return undefined;
    const started = performance.now();
    let frame = 0;
    const loop = () => {
      setActiveKey(key);
      setElapsed(performance.now() - started);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [key, paused]);

  if (!timer || paused || activeKey !== key) return budget;
  return Math.max(0, budget - elapsed);
}

function youAndOpponent(view) {
  const you = view.players.find((player) => player.id === view.you) || null;
  const opponent = view.players.find((player) => player.id !== view.you) || null;
  return { you, opponent };
}

function guessText(question, value) {
  if (value == null || value === "") return "No answer";
  if (question?.kind === "higher") {
    if (value === question.left.id) return question.left.name;
    if (value === question.right.id) return question.right.name;
  }
  if (question?.kind === "draft") return formatDraftChoice(question.mode, value);
  return String(value);
}

function answerLine(question, reveal) {
  if (!question || !reveal) return "";
  if (question.kind === "higher") {
    const winner = reveal.higherId === question.left.id ? question.left.name : question.right.name;
    return `Higher: ${winner}`;
  }
  if (question.kind === "career") return reveal.player;
  return formatDraftReveal(question.mode, reveal.answer);
}

function resultLine(view) {
  const round = view.round;
  if (round.reason === "correct") {
    if (round.winnerId === view.you) return "You take the point";
    const winner = view.players.find((player) => player.id === round.winnerId);
    return `${winner?.name || "Opponent"} takes the point`;
  }
  if (round.reason === "timeout") return "Time's up. No point.";
  return "No point. Both missed.";
}

function linkText(link) {
  if (link === "live") return "Connected";
  if (link === "reconnecting") return "Reconnecting";
  if (link === "connecting") return "Connecting";
  return "Offline";
}

function StatusRow({ view, link }) {
  const { opponent } = youAndOpponent(view);
  const youOn = link === "live";
  return (
    <p className="pk-status">
      <span>
        <i className={youOn ? "is-on" : ""} />
        {linkText(link)}
      </span>
      <span>
        <i className={opponent?.connected ? "is-on" : ""} />
        {opponent
          ? `${opponent.name} ${opponent.connected ? "connected" : "disconnected"}`
          : "Waiting for opponent"}
      </span>
    </p>
  );
}

function ScoreRow({ view }) {
  const { you, opponent } = youAndOpponent(view);
  return (
    <div className="pk-score" aria-live="polite">
      <p>
        <span>{you?.name || "You"}</span>
        <strong data-pk="your-score">{you?.score ?? 0}</strong>
      </p>
      <p className="pk-target">First to {view.target}</p>
      <p>
        <span>{opponent?.name || "Opponent"}</span>
        <strong data-pk="opponent-score">{opponent?.score ?? 0}</strong>
      </p>
    </div>
  );
}

function CareerStop({ stop }) {
  const [failed, setFailed] = useState(false);
  const logo = teamLogoUrl(stop.team);
  return (
    <span className="career-stop">
      {logo && !failed ? (
        <img src={logo} alt="" onError={() => setFailed(true)} />
      ) : (
        <span className="career-blank" aria-hidden="true">{stop.team.slice(0, 1)}</span>
      )}
      <span className="career-team">{stop.team}</span>
      <span className="career-years">{formatYears(stop)}</span>
    </span>
  );
}

function DraftFace({ question }) {
  const [failedSrc, setFailedSrc] = useState("");
  const [failedLogo, setFailedLogo] = useState("");
  const photo = approvedPlayerImage(question.image) || playerImageUrl(question.id);
  const showPhoto = Boolean(photo) && failedSrc !== photo;
  const logo = question.teamLogo || teamLogoUrl(question.team);
  const colors = question.teamColors || teamColors(question.team);
  return (
    <div className="draft-player">
      <span
        className={`photo-frame ${showPhoto ? "" : "is-fallback"}`}
        style={showPhoto ? undefined : {
          "--team-primary": colors.primary,
          "--team-secondary": colors.secondary,
          "--team-ink": colors.ink,
        }}
      >
        {showPhoto ? <img src={photo} alt="" onError={() => setFailedSrc(photo)} /> : null}
      </span>
      <span className="player-copy">
        <span className="player-name">{question.name}</span>
        <span className="player-team">
          {logo && failedLogo !== logo ? (
            <img className="team-logo" src={logo} alt="" onError={() => setFailedLogo(logo)} />
          ) : null}
          {question.team}
        </span>
      </span>
    </div>
  );
}

function Timer({ timer }) {
  const remaining = useCountdown(timer);
  const seconds = Math.ceil(remaining / 1000);
  const width = Math.max(0, Math.min(100, (remaining / PK_QUESTION_MS) * 100));
  return (
    <div className={`pk-timer ${timer?.paused ? "is-paused" : ""}`}>
      <span style={{ width: `${width}%` }} />
      <strong aria-live="polite">{timer?.paused ? "Paused" : `${seconds}s`}</strong>
    </div>
  );
}

function QuestionView({ view, rejectedRound, onAnswer }) {
  const round = view.round;
  const question = round.question;
  const reveal = round.reveal;
  const [sent, setSent] = useState(false);
  const [localPick, setLocalPick] = useState(null);
  const buzzed = useRef(false);
  const rejected = rejectedRound === round.id;

  useEffect(() => {
    if (buzzed.current) return;
    const missed = round.guesses.some((guess) => guess.playerId === view.you && !guess.correct);
    if (!round.youLocked && !missed) return;
    buzzed.current = true;
    playBuzzer();
  }, [round.youLocked, round.guesses, view.you]);

  const blocked = view.paused || (sent && !rejected) || round.youAnswered || round.youLocked || view.phase !== "question";
  const yourGuess = round.guesses.find((guess) => guess.playerId === view.you)?.value ?? localPick;
  const topScore = view.players.reduce((best, player) => Math.max(best, player.score), 0);

  function choose(value) {
    if (blocked) return;
    setLocalPick(value);
    setSent(true);
    onAnswer(round.id, value);
  }

  return (
    <div className="pk-race">
      <ScoreRow view={view} />
      <p className="pk-round">
        {pkModeLabel(view.mode)}
        <span className="score-dot" aria-hidden="true"> • </span>
        Round {round.index}
      </p>
      {view.phase === "question" ? <Timer timer={round.timer} /> : null}
      {view.paused ? <p className="pk-lock">Paused until both players are connected.</p> : null}
      {round.youLocked ? <p className="pk-lock">Wrong. You're locked out. Your opponent can still answer.</p> : null}
      {!round.youLocked && round.opponentLocked ? <p className="pk-lock">Opponent locked out. You can still answer.</p> : null}
      {question.kind === "higher" ? (
        <HigherQuestion question={question} reveal={reveal} phase={view.phase} pickedId={yourGuess} disabled={blocked} onPick={choose} />
      ) : null}
      {question.kind === "career" ? (
        <CareerQuestion question={question} reveal={reveal} phase={view.phase} roundId={round.id} disabled={blocked} onSubmit={choose} />
      ) : null}
      {question.kind === "draft" ? (
        <DraftQuestion question={question} reveal={reveal} phase={view.phase} picked={yourGuess} disabled={blocked} onPick={choose} />
      ) : null}
      {view.phase === "reveal" ? (
        <div className="result-step" role="status">
          <p className={`reveal-title ${round.winnerId === view.you ? "is-right" : round.reason === "correct" ? "is-miss" : ""}`}>
            {resultLine(view)}
          </p>
          <p className="reveal-value">{answerLine(question, reveal)}</p>
          <ul className="pk-guesses">
            {view.players.map((player) => {
              const guess = round.guesses.find((item) => item.playerId === player.id);
              return (
                <li key={player.id}>
                  <span>{player.id === view.you ? "You" : player.name}</span>
                  <strong>{guessText(question, guess?.value)}</strong>
                </li>
              );
            })}
          </ul>
          <p className="pk-next">{topScore >= view.target ? "Final result" : "Next round"}</p>
        </div>
      ) : null}
    </div>
  );
}

function HigherQuestion({ question, reveal, phase, pickedId, disabled, onPick }) {
  const category = categoryById(question.categoryId);
  const showing = phase === "reveal" && reveal && category;
  const left = { ...question.left, [question.categoryId]: showing ? reveal.leftValue : undefined };
  const right = { ...question.right, [question.categoryId]: showing ? reveal.rightValue : undefined };
  return (
    <section className="board">
      <div className="prompt">
        <p className="band category-chip">
          <StatIcon id={question.categoryId} />
          <span>{question.categoryLabel}</span>
          {question.band ? (
            <>
              <span className="score-dot" aria-hidden="true"> • </span>
              <span>{question.band}</span>
            </>
          ) : null}
        </p>
        <h1>{question.prompt}</h1>
      </div>
      <div className="cards">
        <PlayerCard
          player={left}
          category={category}
          revealed={Boolean(showing)}
          picked={pickedId === left.id}
          higher={Boolean(showing && reveal.higherId === left.id)}
          disabled={disabled}
          onSelect={onPick}
        />
        <p className="versus" aria-hidden="true">VS</p>
        <PlayerCard
          player={right}
          category={category}
          revealed={Boolean(showing)}
          picked={pickedId === right.id}
          higher={Boolean(showing && reveal.higherId === right.id)}
          disabled={disabled}
          onSelect={onPick}
        />
      </div>
    </section>
  );
}

function CareerQuestion({ question, reveal, phase, roundId, disabled, onSubmit }) {
  return (
    <section className="panel career-board">
      <p className="band">
        Career Path
        {question.band ? (
          <>
            <span className="score-dot" aria-hidden="true"> • </span>
            {question.band}
          </>
        ) : null}
      </p>
      <h1 className="section-title">Who is this player?</h1>
      {question.position ? <p className="career-position">Position · {question.position}</p> : null}
      <div className="career-path">
        {question.stops.map((stop, index) => (
          <span key={`${stop.team}-${stop.start}-${index}`} className="career-piece">
            {index > 0 ? <span className="career-arrow" aria-hidden="true">→</span> : null}
            <CareerStop stop={stop} />
          </span>
        ))}
      </div>
      <PlayerSearch resetKey={roundId} disabled={disabled} onSubmit={onSubmit} />
      {phase === "reveal" && reveal?.player ? <p className="career-player">{reveal.player}</p> : null}
    </section>
  );
}

function DraftQuestion({ question, reveal, phase, picked, disabled, onPick }) {
  const showing = phase === "reveal" && reveal;
  return (
    <section className="panel draft-board">
      <p className="band">
        Draft Pick
        <span className="score-dot" aria-hidden="true"> • </span>
        {draftModeLabel(question.mode)}
      </p>
      <h1 className="section-title">{question.prompt}</h1>
      <DraftFace question={question} />
      <div className="career-choices" role="group" aria-label={question.prompt}>
        {question.choices.map((choice) => {
          const chosen = picked === choice;
          const correct = Boolean(showing && choice === reveal.answer);
          const missed = Boolean(showing && chosen && choice !== reveal.answer);
          return (
            <button
              key={choice}
              type="button"
              className={`action secondary career-choice ${correct ? "is-correct" : ""} ${missed ? "is-wrong" : ""}`}
              onClick={() => onPick(choice)}
              disabled={disabled}
            >
              {formatDraftChoice(question.mode, choice)}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function Gate({ name, setName, code, setCode, error, link, onCreate, onJoin, onLeave }) {
  return (
    <section className="panel start-screen lobby pk-gate">
      <p className="eyebrow">Live 1 vs 1</p>
      <h1>Race a friend</h1>
      <p className="lede">
        Same question on two devices. First correct answer scores one point. First to 5 wins.
      </p>
      <label className="pk-field">
        <span>Your name</span>
        <input
          value={name}
          maxLength={16}
          autoComplete="nickname"
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      {error ? <p className="pk-error" role="alert">{error}</p> : null}
      <button
        type="button"
        className="action play-main"
        onClick={() => onCreate(name)}
        disabled={link === "connecting"}
      >
        Create room
      </button>
      <form
        className="pk-join"
        onSubmit={(event) => {
          event.preventDefault();
          if (code.length === 4) onJoin(name, code);
        }}
      >
        <label className="pk-field">
          <span>Game code</span>
          <input
            value={code}
            inputMode="text"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            maxLength={4}
            placeholder="AB3K"
            onChange={(event) => {
              setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4));
            }}
          />
        </label>
        <button type="submit" className="action secondary" disabled={code.length !== 4 || link === "connecting"}>
          Join
        </button>
      </form>
      <button type="button" className="lobby-link" onClick={onLeave}>
        All Games
      </button>
    </section>
  );
}

function Lobby({ view, link, onMode, onReady, onLeave }) {
  const { you, opponent } = youAndOpponent(view);
  const host = Boolean(you?.host);
  const draftOn = view.mode === "draft-year" || view.mode === "draft-pick";
  const [copied, setCopied] = useState(false);
  let readyLabel = "Ready";
  if (!opponent) readyLabel = "Waiting for opponent";
  else if (!opponent.connected) readyLabel = "Opponent disconnected";
  else if (you?.ready) readyLabel = "Cancel ready";

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(view.code);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="panel start-screen lobby pk-lobby">
      <p className="eyebrow">Live 1 vs 1</p>
      <h1>Room {view.code}</h1>
      <p className="pk-code" data-pk="code">{view.code}</p>
      <button type="button" className="lobby-link" onClick={copyCode}>
        {copied ? "Code copied" : "Copy code"}
      </button>
      <StatusRow view={view} link={link} />
      <div className="pk-seats">
        {view.players.map((player) => (
          <p key={player.id} className={player.connected ? "is-on" : ""}>
            <strong>{player.name}</strong>
            <span>
              {player.host ? "Host" : "Guest"}
              {player.id === view.you ? " · You" : ""}
              {player.ready ? " · Ready" : ""}
              {player.connected ? "" : " · Disconnected"}
            </span>
          </p>
        ))}
        {view.players.length < 2 ? <p className="is-empty"><strong>Open seat</strong><span>Share the code</span></p> : null}
      </div>
      <div className="pk-modes" role="group" aria-label="Game">
        <button type="button" className={view.mode === "higher" ? "is-on" : ""} disabled={!host} onClick={() => onMode("higher")}>
          Higher or Lower
        </button>
        <button type="button" className={view.mode === "career" ? "is-on" : ""} disabled={!host} onClick={() => onMode("career")}>
          Career Path
        </button>
        <button
          type="button"
          className={draftOn ? "is-on" : ""}
          disabled={!host}
          onClick={() => {
            if (!draftOn) onMode("draft-year");
          }}
        >
          Draft Pick
        </button>
      </div>
      {draftOn ? (
        <div className="pk-modes pk-submodes" role="group" aria-label="Draft format">
          <button type="button" className={view.mode === "draft-year" ? "is-on" : ""} disabled={!host} onClick={() => onMode("draft-year")}>
            Draft Year
          </button>
          <button type="button" className={view.mode === "draft-pick" ? "is-on" : ""} disabled={!host} onClick={() => onMode("draft-pick")}>
            Overall Pick
          </button>
        </div>
      ) : null}
      <p className="lede" data-pk="mode">{pkModeLabel(view.mode)}. First correct answer scores. Wrong answers lock you out.</p>
      {view.notice ? <p className="pk-error">{view.notice}</p> : null}
      <button
        type="button"
        className="action play-main"
        data-pk="ready"
        disabled={!opponent?.connected || link !== "live"}
        onClick={() => onReady(!you?.ready)}
      >
        {readyLabel}
      </button>
      <button type="button" className="lobby-link" onClick={onLeave}>
        Leave room
      </button>
    </section>
  );
}

export default function PkGame({ onLeave, leaveRef }) {
  const pk = usePk();
  const [name, setName] = useState(savedPkName);
  const [code, setCode] = useState("");
  const view = pk.view;
  const leavePk = useRef(pk.leave);
  leavePk.current = pk.leave;

  useEffect(() => {
    if (!leaveRef) return undefined;
    leaveRef.current = () => leavePk.current();
    return () => {
      leaveRef.current = null;
    };
  }, [leaveRef]);

  function exit() {
    pk.leave();
    onLeave();
  }

  if (!view) {
    if (pk.link !== "offline" && !pk.error) {
      return (
        <section className="panel start-screen lobby">
          <p className="eyebrow">Live 1 vs 1</p>
          <h1>{pk.link === "reconnecting" ? "Reconnecting" : "Connecting"}</h1>
          <p className="lede">Finding your room.</p>
        </section>
      );
    }
    return (
      <Gate
        name={name}
        setName={setName}
        code={code}
        setCode={setCode}
        error={pk.error}
        link={pk.link}
        onCreate={(nextName) => pk.create(nextName, "higher")}
        onJoin={(nextName, nextCode) => pk.join(nextName, nextCode)}
        onLeave={exit}
      />
    );
  }

  if (view.phase === "lobby") {
    return (
      <Lobby
        view={view}
        link={pk.link}
        onMode={pk.setMode}
        onReady={pk.setReady}
        onLeave={exit}
      />
    );
  }

  if (view.phase === "countdown") {
    return (
      <section className="pk-count" role="status">
        <ScoreRow view={view} />
        <p>{pkModeLabel(view.mode)}</p>
        <strong data-pk="countdown">{view.countdown}</strong>
        <span>Same question. First correct answer scores.</span>
        <StatusRow view={view} link={pk.link} />
      </section>
    );
  }

  if ((view.phase === "question" || view.phase === "reveal") && view.round?.question) {
    return (
      <section className="pk-live">
        <StatusRow view={view} link={pk.link} />
        <QuestionView
          key={view.round.id}
          view={view}
          rejectedRound={pk.rejectedRound}
          onAnswer={pk.answer}
        />
        <button type="button" className="lobby-link" onClick={exit}>
          Leave room
        </button>
      </section>
    );
  }

  if (view.phase === "results") {
    const { you, opponent } = youAndOpponent(view);
    const youWon = view.matchWinnerId === view.you;
    const winner = view.players.find((player) => player.id === view.matchWinnerId);
    let rematchNote = "Both players have to agree.";
    if (you?.rematch && opponent && !opponent.rematch) rematchNote = `Waiting for ${opponent.name} to agree.`;
    if (opponent?.rematch && !you?.rematch) rematchNote = `${opponent.name} wants a rematch.`;
    if (!opponent?.connected) rematchNote = "Your opponent is disconnected.";
    return (
      <section className="panel game-over pk-results">
        <p className="eyebrow">Live 1 vs 1</p>
        <h1 className="section-title">{youWon ? "You win" : `${winner?.name || "Opponent"} wins`}</h1>
        <ScoreRow view={view} />
        <p className="lede">{pkModeLabel(view.mode)}. First to {view.target}.</p>
        <p className="pk-next">{rematchNote}</p>
        <div className="actions">
          <button
            type="button"
            className="action"
            disabled={!opponent?.connected || pk.link !== "live"}
            onClick={() => pk.rematch(!you?.rematch)}
          >
            {you?.rematch ? "Cancel rematch" : "Rematch"}
          </button>
          <button type="button" className="action secondary" onClick={exit}>
            Leave
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="panel game-over">
      <p className="eyebrow">Live 1 vs 1</p>
      <h1 className="section-title">Match stopped</h1>
      <p className="lede">{view.notice || "Your opponent left."}</p>
      <button type="button" className="action" onClick={exit}>
        Leave
      </button>
    </section>
  );
}

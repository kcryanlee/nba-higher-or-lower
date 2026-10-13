import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

const server = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "error" });

try {
  const { default: CareerGame } = await server.ssrLoadModule("/src/components/CareerGame.jsx");
  const career = await server.ssrLoadModule("/src/game/careerPath.js");

  const html = (text) => renderToStaticMarkup(createElement("i", null, text)).slice(3, -4);

  function board(question, phase = "playing") {
    const markup = renderToStaticMarkup(createElement(CareerGame, {
      phase,
      streak: 100,
      best: 120,
      question,
      result: phase === "revealing" ? "correct" : null,
      onPick() {},
      onAdvance() {},
      onAgain() {},
      onMenu() {},
      onAwards() {},
    }));
    const stops = markup.split('class="career-piece"').slice(1);
    return { markup, stops };
  }

  const hard = career.continueCareerQuestion(99, { random: () => 0.4 }).question;
  const hardBoard = board(hard);
  assert.equal(hard.band.id, "hard");
  assert.equal(hardBoard.stops.length, hard.stops.length);
  assert.equal(hardBoard.markup.includes("is-hidden"), false);
  assert.equal(hardBoard.markup.includes("One team is hidden"), false);
  hard.stops.forEach((stop, index) => assert.ok(hardBoard.stops[index].includes(`>${html(stop.team)}<`)));

  for (let seed = 0; seed < 40; seed += 1) {
    const expert = career.continueCareerQuestion(100, { random: () => (seed + 0.5) / 40 }).question;
    assert.equal(expert.band.id, "expert");
    const playing = board(expert);
    assert.equal(playing.stops.length, expert.stops.length, "the hidden stop keeps its place");
    assert.match(playing.markup, /One team is hidden/);
    assert.match(playing.markup, /Who is this player\?/);
    expert.stops.forEach((stop, index) => {
      const piece = playing.stops[index];
      assert.ok(piece.includes(career.formatYears(stop)), "years stay visible");
      if (index === expert.hiddenIndex) {
        assert.match(piece, /career-stop is-hidden/);
        assert.match(piece, /career-mystery[^>]*>\?</);
        assert.equal(piece.includes(`>${html(stop.team)}<`), false);
      } else {
        assert.equal(piece.includes("is-hidden"), false);
        assert.ok(piece.includes(`>${html(stop.team)}<`));
      }
    });
    assert.equal(playing.markup.includes(html(expert.player)), false);

    const revealed = board(expert, "revealing");
    assert.equal(revealed.markup.includes("is-hidden"), false);
    assert.ok(revealed.stops[expert.hiddenIndex].includes(`>${html(expert.stops[expert.hiddenIndex].team)}<`));
    assert.ok(revealed.markup.includes(html(expert.player)));
  }

  console.log("Career board checks passed.");
} finally {
  await server.close();
}

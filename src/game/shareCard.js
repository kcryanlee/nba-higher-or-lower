export function gameLink() {
  return `${window.location.origin}${window.location.pathname}`;
}

export function shareMessage({ title, streak, best, detail, link }) {
  const lines = [
    `🏀 ${title.toUpperCase()}`,
    `🔥 ${streak} WIN STREAK`,
    `🏆 BEST ${best}`,
  ];
  if (detail) lines.push(detail.toUpperCase());
  lines.push("Think you know the NBA better than me?", `Beat my streak → ${link}`);
  return lines.join("\n");
}

function centerText(ctx, text, x, y, font, color) {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x, y);
}

function drawStreakMark(ctx, streak, x, y) {
  const numberSize = 130;
  const fireSize = 117;
  const gap = 8;
  const fire = "🔥";
  const number = String(streak);

  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillStyle = "#f4efe4";
  ctx.font = `600 ${fireSize}px "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
  const fireWidth = ctx.measureText(fire).width;
  ctx.font = `600 ${numberSize}px Oswald, Impact, sans-serif`;
  const numberWidth = ctx.measureText(number).width;
  let cursor = x - (fireWidth + gap + numberWidth) / 2;

  ctx.font = `600 ${fireSize}px "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
  ctx.fillText(fire, cursor, y);
  cursor += fireWidth + gap;
  ctx.font = `600 ${numberSize}px Oswald, Impact, sans-serif`;
  ctx.fillText(number, cursor, y);
}

export async function renderShareCard({
  title,
  streak,
  best,
  detail,
  fileName = "nba-higher-or-lower.png",
}) {
  await document.fonts.ready;

  const width = 900;
  const height = 1200;
  const canvas = document.createElement("canvas");
  canvas.width = width * 2;
  canvas.height = height * 2;
  const ctx = canvas.getContext("2d");
  ctx.scale(2, 2);

  ctx.fillStyle = "#07111c";
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "#102033";
  ctx.beginPath();
  ctx.roundRect(48, 48, width - 96, height - 96, 36);
  ctx.fill();
  ctx.strokeStyle = "rgba(244, 239, 228, 0.28)";
  ctx.lineWidth = 2;
  ctx.stroke();

  const mid = width / 2;
  centerText(ctx, title.toUpperCase(), mid, 168, "600 42px Oswald, Impact, sans-serif", "#f4efe4");
  drawStreakMark(ctx, streak, mid, 360);
  centerText(ctx, "WIN STREAK", mid, 470, "500 36px Oswald, Impact, sans-serif", "#d7c8b2");
  centerText(ctx, `🏆  BEST ${best}`, mid, 620, "600 40px Oswald, Impact, sans-serif", "#ffb15a");
  if (detail) {
    centerText(
      ctx,
      detail.toUpperCase(),
      mid,
      700,
      "600 40px Oswald, Impact, sans-serif",
      "#f4efe4",
    );
  }
  centerText(ctx, "CAN YOU BEAT MY STREAK?", mid, 900, "600 34px Oswald, Impact, sans-serif", "#f4efe4");
  centerText(ctx, "PLAY NOW  →", mid, 990, "600 36px Oswald, Impact, sans-serif", "#ff7a1a");
  centerText(ctx, "NBA Mini Games", mid, 1088, "500 22px Oswald, Impact, sans-serif", "rgba(244, 239, 228, 0.72)");
  centerText(
    ctx,
    "nba-minigames-hub.vercel.app",
    mid,
    1124,
    "500 18px Barlow, Segoe UI, sans-serif",
    "rgba(183, 170, 152, 0.9)",
  );

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  return new File([blob], fileName, { type: "image/png" });
}

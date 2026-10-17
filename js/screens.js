// Draws what each glass panel shows, on a 2D canvas that becomes a WebGL texture:
// the front is a small window with the project's real output, the back is the
// skill name, like the label on the back of a can.

export const SCREEN_W = 1080;
export const SCREEN_H = 1440;
const R = 34;            // corner radius, matches the glass body
const PAD = 44;

const C = {
  ink: "#0A0A0A", raised: "#151515", line: "#2A2A2A", muted: "#8C8C87",
  paper: "#F2F2F0", white: "#FFFFFF", volt: "#D6FA50",
};

const loadImage = (src) => new Promise((resolve, reject) => {
  const img = new Image();
  img.decoding = "async";
  img.onload = () => resolve(img);
  img.onerror = () => reject(new Error("Could not load " + src));
  img.src = src;
});

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function canvas() {
  const c = document.createElement("canvas");
  c.width = SCREEN_W;
  c.height = SCREEN_H;
  return c;
}

// Keywords are painted volt so a query reads as code even from across the room.
const KEYWORDS = /\b(SELECT|FROM|WHERE|GROUP BY|ORDER BY|FILTER|OVER|AS|round|count|sum|WITH|CASE|WHEN|THEN|END|import|def|for|in)\b/g;

function drawCode(ctx, lines, x, y, w) {
  const size = 25;
  const lh = 38;
  const h = lines.length * lh + 52;
  ctx.fillStyle = C.ink;
  roundRect(ctx, x, y, w, h, 18);
  ctx.fill();
  ctx.font = `500 ${size}px ui-monospace, "SF Mono", Menlo, monospace`;
  ctx.textBaseline = "alphabetic";
  lines.forEach((line, i) => {
    let cx = x + 28;
    const cy = y + 26 + size + i * lh;
    let last = 0;
    for (const m of line.matchAll(KEYWORDS)) {
      const before = line.slice(last, m.index);
      ctx.fillStyle = C.paper;
      ctx.fillText(before, cx, cy);
      cx += ctx.measureText(before).width;
      ctx.fillStyle = C.volt;
      ctx.fillText(m[0], cx, cy);
      cx += ctx.measureText(m[0]).width;
      last = m.index + m[0].length;
    }
    ctx.fillStyle = C.paper;
    ctx.fillText(line.slice(last), cx, cy);
  });
  return h;
}

// An image scaled to the content width, cropped at the bottom if it runs out of room.
function drawImage(ctx, img, x, y, w, maxH) {
  const h = Math.min(maxH, Math.round((img.height / img.width) * w));
  const srcH = Math.round((h / w) * img.width);
  ctx.save();
  roundRect(ctx, x, y, w, h, 14);
  ctx.clip();
  ctx.drawImage(img, 0, 0, img.width, srcH, x, y, w, h);
  ctx.restore();
  return h;
}

export async function drawFront(screen) {
  const c = canvas();
  const ctx = c.getContext("2d");
  ctx.save();
  roundRect(ctx, 0, 0, SCREEN_W, SCREEN_H, R);
  ctx.clip();
  ctx.fillStyle = C.raised;
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);

  // Window bar: the project label on the left, where it lives on the right.
  ctx.fillStyle = C.volt;
  ctx.beginPath();
  ctx.arc(PAD + 9, 62, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = "600 30px Onest, sans-serif";
  ctx.fillStyle = C.white;
  ctx.textBaseline = "middle";
  ctx.fillText(screen.label, PAD + 34, 63);
  ctx.font = "400 24px Onest, sans-serif";
  ctx.fillStyle = C.muted;
  ctx.textAlign = "right";
  ctx.fillText(screen.repo, SCREEN_W - PAD, 63);
  ctx.textAlign = "left";
  ctx.fillStyle = C.line;
  ctx.fillRect(0, 122, SCREEN_W, 2);

  let y = 122 + PAD;
  const w = SCREEN_W - PAD * 2;
  if (screen.code) y += drawCode(ctx, screen.code, PAD, y, w) + 28;
  const images = await Promise.all(screen.images.map(loadImage));
  for (const img of images) {
    const room = SCREEN_H - PAD - y;
    if (room < 80) break;
    y += drawImage(ctx, img, PAD, y, w, room) + 28;
  }
  ctx.restore();
  return c;
}

export function drawBack(screen) {
  const c = canvas();
  const ctx = c.getContext("2d");
  roundRect(ctx, 0, 0, SCREEN_W, SCREEN_H, R);
  ctx.clip();
  ctx.fillStyle = C.ink;
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);

  // The skill name set sideways, the way a can's name runs up its side.
  ctx.save();
  ctx.translate(SCREEN_W / 2, SCREEN_H / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  let size = 400;
  ctx.font = `900 ${size}px Unbounded, sans-serif`;
  const fit = (SCREEN_H - 160) / ctx.measureText(screen.back).width;
  size = Math.min(size, Math.floor(size * fit));
  ctx.font = `900 ${size}px Unbounded, sans-serif`;
  ctx.fillStyle = C.volt;
  ctx.fillText(screen.back, 0, 0);
  ctx.restore();

  ctx.font = "500 26px Onest, sans-serif";
  ctx.fillStyle = C.muted;
  ctx.textBaseline = "alphabetic";
  ctx.fillText("ARTEM ZADVORYANSKIY", PAD, SCREEN_H - PAD);
  ctx.textAlign = "right";
  ctx.fillText(screen.label.split(" · ")[0], SCREEN_W - PAD, SCREEN_H - PAD);
  return c;
}

// Genera los PNGs del icono desde public/icons/icon.svg (fuente).
// Uso: node scripts/generate-icons.mjs
// Requiere: pnpm add -D sharp
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");
const src = path.join(dir, "icon.svg");

await sharp(src).resize(192, 192).png().toFile(path.join(dir, "icon-192.png"));
await sharp(src).resize(512, 512).png().toFile(path.join(dir, "icon-512.png"));

// maskable: arte al 80% centrado sobre fondo pleno (zona segura)
const art = await sharp(src).resize(410, 410).png().toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: "#2563eb" } })
  .composite([{ input: art, left: 51, top: 51 }])
  .png()
  .toFile(path.join(dir, "icon-maskable-512.png"));

// apple-touch-icon: iOS no admite transparencias
await sharp(src)
  .resize(180, 180)
  .flatten({ background: "#2563eb" })
  .png()
  .toFile(path.join(dir, "apple-touch-icon.png"));

console.log("Iconos generados en", dir);

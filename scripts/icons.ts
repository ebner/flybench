/**
 * Renders the app icons (PNG, for the web app manifest and iOS) from their SVG sources
 * in public/icons/. Run after changing the logo:  npm run icons
 */
import sharp from "sharp";

const DIR = "public/icons";
const ICONS: [source: string, out: string, size: number][] = [
  ["icon.svg", "icon-192.png", 192],
  ["icon.svg", "icon-512.png", 512],
  ["icon.svg", "apple-touch-icon.png", 180],
  ["icon-maskable.svg", "icon-maskable-512.png", 512],
];

for (const [source, out, size] of ICONS) {
  await sharp(`${DIR}/${source}`, { density: (72 * size) / 512 * 2 })
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toFile(`${DIR}/${out}`);
  console.log(`${DIR}/${out}`);
}

import sharp from "sharp";
import fs from "fs";

const ogSvg = fs.readFileSync("./public/og-image.svg");
await sharp(ogSvg).resize(1200, 630).png().toFile("./public/og-image.png");
console.log("✓ og-image.png");

const favSvg = fs.readFileSync("./public/favicon.svg");
await sharp(favSvg).resize(512, 512).png().toFile("./public/apple-touch-icon.png");
console.log("✓ apple-touch-icon.png");

await sharp(favSvg).resize(192, 192).png().toFile("./public/icon-192.png");
console.log("✓ icon-192.png");

await sharp(favSvg).resize(32, 32).png().toFile("./public/favicon-32.png");
console.log("✓ favicon-32.png");

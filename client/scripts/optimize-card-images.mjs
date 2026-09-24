import { readdir, mkdir, unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const sourceRoot = path.join(projectRoot, "src", "assets");
const outputRoot = path.join(projectRoot, "public", "cards");
const factions = ["red", "blue", "green", "purple", "pink"];
const clean = process.argv.includes("--clean");

async function unlinkWithRetry(filePath) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      await unlink(filePath);
      return;
    } catch (error) {
      if (error.code !== "EBUSY" || attempt === 9) throw error;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
}

async function getCardFiles(faction) {
  const directory = path.join(sourceRoot, faction);
  const entries = await readdir(directory, { withFileTypes: true });

  return entries
    .filter(
      (entry) =>
        entry.isFile() &&
        [".png", ".webp"].includes(path.extname(entry.name).toLowerCase())
    )
    .map((entry) => path.join(directory, entry.name));
}

async function optimizeImage(inputPath, outputDirectory) {
  const basename = path.basename(inputPath, path.extname(inputPath));
  const thumbPath = path.join(outputDirectory, `${basename}-thumb.webp`);
  const fullPath = path.join(outputDirectory, `${basename}-full.webp`);

  await sharp(inputPath)
    .rotate()
    .resize({ width: 320, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toFile(thumbPath);

  await sharp(inputPath)
    .rotate()
    .resize({ width: 800, withoutEnlargement: true })
    .webp({ quality: 86 })
    .toFile(fullPath);

  return [thumbPath, fullPath];
}

let sourceCount = 0;
let outputCount = 0;

for (const faction of factions) {
  const outputDirectory = path.join(outputRoot, faction);
  await mkdir(outputDirectory, { recursive: true });

  const files = await getCardFiles(faction);
  sourceCount += files.length;

  for (const inputPath of files) {
    const outputs = await optimizeImage(inputPath, outputDirectory);
    outputCount += outputs.length;

    if (clean) {
      for (const outputPath of outputs) {
        const outputStats = await sharp(outputPath).metadata();
        if (!outputStats.format || outputStats.format !== "webp") {
          throw new Error(`Invalid optimized output: ${outputPath}`);
        }
      }
      await unlinkWithRetry(inputPath);
    }
  }
}

console.log(
  `${clean ? "Optimized and removed" : "Optimized"} ${sourceCount} source images into ${outputCount} WebP variants.`
);

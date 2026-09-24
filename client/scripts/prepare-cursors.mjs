import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs/promises";
import sharp from "sharp";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const clientDirectory = path.resolve(scriptDirectory, "..");
const outputDirectory = path.join(clientDirectory, "public", "cursors", "astralia");

const jobs = [
  sharp(path.join(outputDirectory, "chibi-original.png"))
    .resize(320, 320, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .webp({ quality: 86 })
    .toFile(path.join(outputDirectory, "chibi.webp")),
  sharp(path.join(outputDirectory, "sea-lion-references", "sea-lion-closed.jpg"))
    .resize(240, 240, { fit: "cover", position: "attention" })
    .webp({ quality: 88 })
    .toFile(path.join(outputDirectory, "sea-lion-closed.webp")),
  sharp(path.join(outputDirectory, "sea-lion-references", "sea-lion-open.jpg"))
    .extract({ left: 0, top: 55, width: 335, height: 335 })
    .resize(240, 240)
    .webp({ quality: 88 })
    .toFile(path.join(outputDirectory, "sea-lion-open.webp")),
];

const stateNames = ["idle", "hover", "click", "busy", "drag", "move"];
const stateSource = path.join(outputDirectory, "astralia-states-source.png");
const stateSourceHeight = 1024;
const outputFrameWidth = 160;
const outputFrameHeight = 128;
const stateBoundaries = {
  idle: [195, 405, 620, 835, 1044, 1275, 1510],
  hover: [195, 395, 617, 825, 1060, 1293, 1510],
  click: [195, 405, 620, 837, 1055, 1278, 1510],
  busy: [195, 384, 574, 763, 946, 1134, 1311, 1515],
  drag: [190, 367, 630, 778, 955, 1170, 1328, 1515],
  move: [195, 388, 577, 782, 991, 1262, 1515],
};

async function createPochitaAnimations() {
  const source = path.join(outputDirectory, "pochita-preview.gif");
  const { data, info } = await sharp(source, { animated: true })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const pageHeight = info.pageHeight ?? 128;
  const pageCount = info.pages ?? 16;
  const cropSize = 48;
  const cellSize = 64;
  const cropOffset = 16;
  const background = [28, 25, 34];

  const animations = stateNames.map(async (state, stateIndex) => {
    const column = stateIndex % 3;
    const row = Math.floor(stateIndex / 3);
    const output = Buffer.alloc(cropSize * cropSize * pageCount * 4);

    for (let page = 0; page < pageCount; page += 1) {
      for (let y = 0; y < cropSize; y += 1) {
        for (let x = 0; x < cropSize; x += 1) {
          const sourceX = column * cellSize + cropOffset + x;
          const sourceY = page * pageHeight + row * cellSize + cropOffset + y;
          const sourceIndex = (sourceY * info.width + sourceX) * info.channels;
          const outputIndex = ((page * cropSize + y) * cropSize + x) * 4;
          const red = data[sourceIndex];
          const green = data[sourceIndex + 1];
          const blue = data[sourceIndex + 2];
          const backgroundDistance = Math.hypot(
            red - background[0],
            green - background[1],
            blue - background[2],
          );

          output[outputIndex] = red;
          output[outputIndex + 1] = green;
          output[outputIndex + 2] = blue;
          output[outputIndex + 3] = backgroundDistance < 16 ? 0 : 255;
        }
      }
    }

    return sharp(output, {
      raw: {
        width: cropSize,
        height: cropSize * pageCount,
        channels: 4,
        pageHeight: cropSize,
      },
    })
      .gif({ loop: 0, delay: Array(pageCount).fill(90), colours: 128, dither: 0 })
      .toFile(path.join(outputDirectory, `pochita-${state}.gif`));
  });

  return Promise.all(animations);
}

const animalStateAnimations = {
  idle: { animation: "idle", delay: 260 },
  hover: { animation: "cursor_watch", delay: 220 },
  click: { animation: "tickle", delay: 120 },
  busy: { animation: "groom", delay: 180 },
  drag: { animation: "grabbed", delay: 260 },
  move: { animation: "run", delay: 120 },
};

function largestOpaqueBounds(data, width, height) {
  const visited = new Uint8Array(width * height);
  let largest = null;

  for (let start = 0; start < width * height; start += 1) {
    if (visited[start] || data[start * 4 + 3] < 8) continue;
    const stack = [start];
    const component = { size: 0, minX: width, minY: height, maxX: 0, maxY: 0 };
    visited[start] = 1;

    while (stack.length > 0) {
      const pixel = stack.pop();
      const x = pixel % width;
      const y = Math.floor(pixel / width);
      component.size += 1;
      component.minX = Math.min(component.minX, x);
      component.minY = Math.min(component.minY, y);
      component.maxX = Math.max(component.maxX, x);
      component.maxY = Math.max(component.maxY, y);

      for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
        for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
          if (offsetX === 0 && offsetY === 0) continue;
          const nextX = x + offsetX;
          const nextY = y + offsetY;
          if (nextX < 0 || nextX >= width || nextY < 0 || nextY >= height) continue;
          const next = nextY * width + nextX;
          if (visited[next] || data[next * 4 + 3] < 8) continue;
          visited[next] = 1;
          stack.push(next);
        }
      }
    }

    if (!largest || component.size > largest.size) largest = component;
  }

  if (!largest) return { left: 0, top: 0, width, height };
  const left = Math.max(0, largest.minX - 1);
  const top = Math.max(0, largest.minY - 1);
  const right = Math.min(width, largest.maxX + 2);
  const bottom = Math.min(height, largest.maxY + 2);
  return { left, top, width: right - left, height: bottom - top };
}

async function createAnimalAnimations(species, variant) {
  const sourceDirectory = path.join(clientDirectory, "public", "cursors", "animals", "source");
  const destinationDirectory = path.join(clientDirectory, "public", "cursors", "animals");
  const atlasPath = path.join(sourceDirectory, `${species}-${variant}-atlas.png`);
  const atlasData = JSON.parse(
    await fs.readFile(path.join(sourceDirectory, `${species}-${variant}-atlas.json`), "utf8"),
  );
  const frameSize = 64;
  const renderedSize = 54;
  const animations = Object.entries(animalStateAnimations).map(([state, settings]) => {
    const prefix = `pet_${species}_${settings.animation}_`;
    const frames = Object.entries(atlasData.frames)
      .filter(([name]) => name.startsWith(prefix))
      .sort(([left], [right]) => Number(left.slice(prefix.length)) - Number(right.slice(prefix.length)));
    return { state, settings, frames };
  });
  const extractedFrames = new Map();
  let maximumWidth = 1;
  let maximumHeight = 1;

  for (const { frames } of animations) {
    for (const [name, frameData] of frames) {
      if (extractedFrames.has(name)) continue;
      const { x, y, w, h } = frameData.frame;
      const extracted = await sharp(atlasPath)
        .extract({ left: x, top: y, width: w, height: h })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      const bounds = largestOpaqueBounds(extracted.data, extracted.info.width, extracted.info.height);
      maximumWidth = Math.max(maximumWidth, bounds.width);
      maximumHeight = Math.max(maximumHeight, bounds.height);
      extractedFrames.set(name, { ...extracted, bounds });
    }
  }

  const scale = Math.min(renderedSize / maximumWidth, renderedSize / maximumHeight);

  return Promise.all(animations.map(async ({ state, settings, frames }) => {
    const output = Buffer.alloc(frameSize * frameSize * frames.length * 4);

    for (const [index, [name]] of frames.entries()) {
      const extracted = extractedFrames.get(name);
      const targetWidth = Math.max(1, Math.round(extracted.bounds.width * scale));
      const targetHeight = Math.max(1, Math.round(extracted.bounds.height * scale));
      const prepared = await sharp(extracted.data, {
        raw: {
          width: extracted.info.width,
          height: extracted.info.height,
          channels: 4,
        },
      })
        .extract(extracted.bounds)
        .resize(targetWidth, targetHeight, { kernel: "nearest" })
        .ensureAlpha()
        .raw()
        .toBuffer();
      const left = Math.floor((frameSize - targetWidth) / 2);
      const top = frameSize - targetHeight - 5;

      for (let y = 0; y < targetHeight; y += 1) {
        const sourceStart = y * targetWidth * 4;
        const destinationStart = ((index * frameSize + y + top) * frameSize + left) * 4;
        prepared.copy(output, destinationStart, sourceStart, sourceStart + targetWidth * 4);
      }
    }

    return sharp(output, {
      raw: {
        width: frameSize,
        height: frameSize * frames.length,
        channels: 4,
        pageHeight: frameSize,
      },
    })
      .gif({
        loop: 0,
        delay: Array(frames.length).fill(settings.delay),
        colours: 128,
        dither: 0,
      })
      .toFile(path.join(destinationDirectory, `${species}-${state}.gif`));
  }));
}

async function createStateStrip(state, rowIndex) {
  const composites = [];
  const boundaries = stateBoundaries[state];
  const frameCount = boundaries.length - 1;

  for (let columnIndex = 0; columnIndex < frameCount; columnIndex += 1) {
    const left = boundaries[columnIndex];
    const right = boundaries[columnIndex + 1];
    const top = Math.floor((rowIndex * stateSourceHeight) / stateNames.length);
    const bottom = Math.floor(((rowIndex + 1) * stateSourceHeight) / stateNames.length);

    const frame = await sharp(stateSource)
      .extract({ left, top, width: right - left, height: bottom - top })
      .resize(outputFrameWidth - 12, outputFrameHeight - 10, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();

    composites.push({
      input: frame,
      left: columnIndex * outputFrameWidth + 6,
      top: 5,
    });
  }

  return sharp({
    create: {
      width: outputFrameWidth * frameCount,
      height: outputFrameHeight,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(composites)
    .webp({ quality: 88, alphaQuality: 100 })
    .toFile(path.join(outputDirectory, `state-${state}.webp`));
}

for (const [index, state] of stateNames.entries()) {
  jobs.push(createStateStrip(state, index));
}

jobs.push(createPochitaAnimations());
jobs.push(createAnimalAnimations("cat", "ginger"));
jobs.push(createAnimalAnimations("dog", "golden"));

await Promise.all(jobs);
console.log(`Prepared ${jobs.length} cursor assets in ${outputDirectory}`);

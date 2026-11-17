import { readdir, readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const cardsDir = path.join(projectRoot, "client", "public", "cards");
const envFile = path.join(projectRoot, ".env.r2.local");
const mode = process.argv[2] ?? "--check";

if (!["--check", "--upload"].includes(mode)) {
  console.error("Usage: node scripts/upload-cards-r2.mjs [--check|--upload]");
  process.exit(1);
}

async function collectImages(directory) {
  const images = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      images.push(...await collectImages(fullPath));
    } else if (entry.isFile() && entry.name.endsWith(".webp")) {
      const relative = path.relative(cardsDir, fullPath).split(path.sep).join("/");
      images.push({ path: fullPath, key: `cards/${relative}`, size: (await stat(fullPath)).size });
    }
  }
  return images;
}

const images = await collectImages(cardsDir);
images.sort((a, b) => a.key.localeCompare(b.key));
const totalBytes = images.reduce((sum, image) => sum + image.size, 0);
console.log(`${images.length} immagini, ${(totalBytes / 1024 / 1024).toFixed(1)} MiB`);
console.log(`Primo percorso R2: ${images[0]?.key ?? "nessuno"}`);

if (mode === "--check") process.exit(0);
if (!images.length) throw new Error("Nessuna immagine .webp trovata.");
if (existsSync(envFile)) loadEnvFile(envFile);

const bucket = process.env.R2_BUCKET?.trim();
const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
const endpoint = process.env.R2_S3_ENDPOINT?.trim();

if (!bucket || !accessKeyId || !secretAccessKey || !endpoint) {
  throw new Error("Compila R2_BUCKET, R2_S3_ENDPOINT, R2_ACCESS_KEY_ID e R2_SECRET_ACCESS_KEY in .env.r2.local.");
}
if ([accessKeyId, secretAccessKey].includes("REPLACE_ME") || endpoint.includes("YOUR_ACCOUNT_ID")) {
  throw new Error("Sostituisci i valori di esempio in .env.r2.local con quelli forniti da Cloudflare.");
}
if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(bucket)) {
  throw new Error("R2_BUCKET non è un nome di bucket valido.");
}

const endpointUrl = new URL(endpoint);
if (endpointUrl.protocol !== "https:" || !endpointUrl.hostname.endsWith(".r2.cloudflarestorage.com") || endpointUrl.pathname !== "/") {
  throw new Error("R2_S3_ENDPOINT deve essere l'URL HTTPS S3 fornito da Cloudflare, senza un percorso finale.");
}

const { S3Client, PutObjectCommand, ListObjectsV2Command } = await import("@aws-sdk/client-s3");
const client = new S3Client({
  region: "auto",
  endpoint: endpointUrl.toString(),
  forcePathStyle: true,
  requestChecksumCalculation: "WHEN_REQUIRED",
  credentials: { accessKeyId, secretAccessKey },
});

let next = 0;
let uploaded = 0;
const failures = [];

async function uploadWorker() {
  while (next < images.length) {
    const image = images[next++];
    try {
      const body = await readFile(image.path);
      await client.send(new PutObjectCommand({
        Bucket: bucket,
        Key: image.key,
        Body: body,
        ContentType: "image/webp",
        CacheControl: "public, max-age=86400",
      }));
      uploaded++;
      if (uploaded % 50 === 0 || uploaded === images.length) {
        console.log(`Caricate ${uploaded}/${images.length}`);
      }
    } catch (error) {
      failures.push(`${image.key}: ${error.message}`);
    }
  }
}

try {
  await Promise.all(Array.from({ length: 8 }, () => uploadWorker()));
  if (failures.length) {
    console.error(`Upload incompleto: ${failures.length} file non caricati. Puoi rilanciare lo stesso comando.`);
    for (const failure of failures.slice(0, 10)) console.error(failure);
    process.exitCode = 1;
  } else {
    const remote = new Map();
    let continuationToken;
    do {
      const page = await client.send(new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: "cards/",
        ContinuationToken: continuationToken,
      }));
      for (const object of page.Contents ?? []) remote.set(object.Key, object.Size);
      continuationToken = page.NextContinuationToken;
    } while (continuationToken);

    const missing = images.filter((image) => remote.get(image.key) !== image.size);
    if (missing.length) {
      console.error(`Verifica R2 fallita: ${missing.length} immagini mancanti o con dimensione diversa.`);
      for (const image of missing.slice(0, 10)) console.error(image.key);
      process.exitCode = 1;
    } else {
      console.log(`Verifica completata: ${images.length} immagini presenti in R2 con le dimensioni attese.`);
    }
  }
} finally {
  client.destroy();
}

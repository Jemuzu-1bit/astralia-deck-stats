import { spawnSync } from "node:child_process";

if (process.env.VITE_SERVER_URL) {
  throw new Error("Remove VITE_SERVER_URL from Vercel: this deployment serves its own game backend.");
}
if (!process.env.npm_execpath) throw new Error("Run this build with npm run build:vercel.");
const result = spawnSync(process.execPath, [process.env.npm_execpath, "--prefix", "client", "run", "build"], {
  stdio: "inherit",
  env: { ...process.env, VITE_SOCKET_PATH: "/api/game/socket.io" },
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);

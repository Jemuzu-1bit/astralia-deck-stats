import { existsSync } from "node:fs";
import { createGameServer } from "./createGameServer.js";

const clientEnv = new URL("../client/.env.local", import.meta.url);
if (existsSync(clientEnv)) process.loadEnvFile(clientEnv);

const { server } = await createGameServer();
const port = Number(process.env.PORT || 3000);
server.listen(port, () => console.log(`Socket.IO server running on http://localhost:${port}`));

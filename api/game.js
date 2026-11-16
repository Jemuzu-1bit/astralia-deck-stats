import { createGameServer } from "../server/createGameServer.js";

const { server } = await createGameServer({ socketPath: "/api/game/socket.io", serveStatic: false });
export default server;

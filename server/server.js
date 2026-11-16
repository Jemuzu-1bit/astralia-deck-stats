import { createGameServer } from "./createGameServer.js";

const { server } = await createGameServer();
const port = Number(process.env.PORT || 3000);
server.listen(port, () => console.log(`Socket.IO server running on http://localhost:${port}`));

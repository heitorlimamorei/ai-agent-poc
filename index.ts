import { NewApp } from "./src/app.ts";

const app = await NewApp();
export const server = Bun.serve(app);

console.log(`Server listening on http://${app.hostname}:${app.port.toString()}`);

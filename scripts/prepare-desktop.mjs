import { access, cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const standalone = path.join(root, ".next", "standalone");
const server = path.join(standalone, "server.js");

await access(server);

const staticSource = path.join(root, ".next", "static");
const staticTarget = path.join(standalone, ".next", "static");
await rm(staticTarget, { recursive: true, force: true });
await mkdir(path.dirname(staticTarget), { recursive: true });
await cp(staticSource, staticTarget, { recursive: true });

const publicSource = path.join(root, "public");
const publicTarget = path.join(standalone, "public");
await rm(publicTarget, { recursive: true, force: true });
await cp(publicSource, publicTarget, { recursive: true });

console.log("KERN desktop server bundle prepared.");

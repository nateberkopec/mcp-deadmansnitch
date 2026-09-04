import { lstatSync, readFileSync } from "node:fs";
import { agentNames, loadAgentFile } from "./amp/plugin/index.ts";

const read = (path) => JSON.parse(readFileSync(path, "utf8"));
for (const path of [".amp", ".amp/plugins", ".amp/plugins/factory", ".amp/plugins/factory/index.ts"]) {
  if (lstatSync(path).isSymbolicLink()) throw new Error(`Amp plugin path cannot be a symbolic link: ${path}`);
}
const agents = new Set(agentNames);
for (const name of agents) loadAgentFile(name);
const queues = read("factory/queues.json");
const config = read("factory/automations/config.json");
if (config.version !== 1) throw new Error("unsupported automation configuration");
for (const [name, automation] of Object.entries(config.automations)) {
  if (!agents.has(automation.agent)) throw new Error(`${name} has an unknown agent`);
  if (
    automation.project !== "main" ||
    typeof automation.cron !== "string" ||
    automation.cron.split(" ").length !== 5 ||
    !automation.cron.startsWith("0 ")
  ) {
    throw new Error(`${name} lacks an executable dispatcher`);
  }
  if (automation.queue && !queues[automation.queue]) throw new Error(`${name} has an unknown queue`);
  if (!["implementation-candidate", "suggestions"].includes(automation.output)) {
    throw new Error(`${name} has an unknown output`);
  }
  if (!automation.queue || automation.skipWhenFull !== true) {
    throw new Error(`${name} lacks finding backpressure`);
  }
}
for (const [name, queue] of Object.entries(queues)) {
  if (name !== "implementation" && (!Number.isSafeInteger(queue.capacity) || queue.capacity > 5)) {
    throw new Error(`${name} exceeds suggestion capacity`);
  }
}
const agentGuideWords = readFileSync("AGENTS.md", "utf8").trim().split(/\s+/).length;
if (agentGuideWords > 100) throw new Error("AGENTS.md exceeds 100 words");
console.log("Factory configuration checks passed.");

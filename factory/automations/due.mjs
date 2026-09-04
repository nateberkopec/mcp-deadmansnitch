import { readFileSync } from "node:fs";

const config = JSON.parse(readFileSync(new URL("./config.json", import.meta.url), "utf8"));
const now = new Date(process.env.NOW ?? Date.now());
if (Number.isNaN(now.getTime())) throw new Error("invalid NOW");
const matches = (expression, value) =>
  expression === "*" ||
  Number(expression) === value ||
  (expression.startsWith("*/") && value % Number(expression.slice(2)) === 0);
const scheduled = Object.entries(config.automations)
  .filter(([, automation]) => automation.cron)
  .filter(([, automation]) => {
    const [minute, hour, day, month, weekday] = automation.cron.split(" ");
    return (
      matches(minute, 0) &&
      matches(hour, now.getUTCHours()) &&
      matches(day, now.getUTCDate()) &&
      matches(month, now.getUTCMonth() + 1) &&
      matches(weekday, now.getUTCDay())
    );
  })
  .map(([name]) => name);
const requested = process.env.AUTOMATION;
if (requested && !Object.hasOwn(config.automations, requested)) {
  throw new Error(`unknown automation: ${requested}`);
}
console.log(JSON.stringify(requested ? [requested] : scheduled));

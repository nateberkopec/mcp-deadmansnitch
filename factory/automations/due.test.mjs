import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const dispatcher = fileURLToPath(new URL("./due.mjs", import.meta.url));

const run = ({ now, automation } = {}) => {
  const env = { ...process.env };
  delete env.NOW;
  delete env.AUTOMATION;
  if (now !== undefined) env.NOW = now;
  if (automation !== undefined) env.AUTOMATION = automation;
  return spawnSync(process.execPath, [dispatcher], { encoding: "utf8", env });
};

const due = (now) => {
  const result = run({ now });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
};

test("a delayed matching-hour start remains due", () => {
  assert.deepEqual(due("2026-09-04T08:59:59.999Z"), ["refactor"]);
});

test("daily selection crosses the UTC day boundary", () => {
  assert.deepEqual(due("2026-11-01T23:59:59.999Z"), []);
  assert.deepEqual(due("2026-11-02T00:59:59.999Z"), ["qaExplorer"]);
  assert.deepEqual(due("2026-11-02T01:59:59.999Z"), ["loopHealth"]);
});

test("weekly selection observes UTC weekday boundaries", () => {
  assert.deepEqual(due("2026-11-02T05:47:00.000Z"), []);
  assert.deepEqual(due("2026-11-03T05:47:00.000Z"), ["securityRedTeam"]);
  assert.deepEqual(due("2026-11-04T06:47:00.000Z"), ["qaExplorer", "docDrift"]);
  assert.deepEqual(due("2026-11-05T07:47:00.000Z"), ["flakeHunter"]);
  assert.deepEqual(due("2026-11-06T08:47:00.000Z"), ["refactor"]);
});

test("monthly selection observes the first UTC day boundary", () => {
  assert.deepEqual(due("2026-10-31T06:45:00.000Z"), ["qaExplorer"]);
  assert.deepEqual(due("2026-11-01T06:45:00.000Z"), ["qaExplorer", "dependencySweep"]);
  assert.deepEqual(due("2026-11-01T07:45:00.000Z"), ["coverageRatchet"]);
  assert.deepEqual(due("2026-11-02T06:45:00.000Z"), ["qaExplorer"]);
});

test("explicit dispatch selects a known automation outside its schedule", () => {
  const result = run({ now: "2026-11-02T12:30:00.000Z", automation: "bugFinder" });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), ["bugFinder"]);
});

test("explicit dispatch rejects an unknown automation", () => {
  const result = run({ now: "2026-11-02T12:30:00.000Z", automation: "unknown" });
  assert.notEqual(result.status, 0);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /unknown automation: unknown/);
});

for (const automation of ["constructor", "toString", "__proto__"]) {
  test(`explicit dispatch rejects inherited property ${automation}`, () => {
    const result = run({ now: "2026-11-02T12:30:00.000Z", automation });
    assert.notEqual(result.status, 0);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, new RegExp(`unknown automation: ${automation}`));
  });
}

test("an invalid NOW fails clearly", () => {
  const result = run({ now: "definitely-not-a-clock" });
  assert.notEqual(result.status, 0);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /invalid NOW/);
});

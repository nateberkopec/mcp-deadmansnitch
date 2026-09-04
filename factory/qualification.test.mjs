import assert from "node:assert/strict";
import test from "node:test";
import factoryPlugin from "./amp/plugin/index.ts";

const message = (role, text) => ({ role, content: [{ type: "text", text }] });
const result = (value) => ({ exitCode: 0, stdout: typeof value === "string" ? value : JSON.stringify(value), stderr: "" });
const failure = () => ({ exitCode: 1, stdout: "", stderr: "injected persistence failure" });

async function harness() {
  const issues = new Map([[1, { number: 1, body: "FACTORY_CHIEF T-chief\nFACTORY_MAX_CONCURRENCY 1", labels: new Set(["factory:control"]), comments: [] }]]);
  const threads = new Map();
  const refs = new Set();
  const requests = [];
  const created = [];
  const prs = new Map();
  let tools;
  let commands;
  let modes;
  let sequence = 0;
  const h = {
    issues, threads, refs, requests, created, prs,
    failComment: () => false,
    reply: async () => "ACCEPT",
    usageAvailable: true,
    webhook: undefined,
    issue(number, labels = []) {
      issues.set(number, { number, body: "", labels: new Set(labels), comments: [] });
    },
    comments(number = 1) { return issues.get(number).comments.map(({ body }) => body); },
    call(name, input = {}, id = "T-chief") { return tools.get(name).execute(input, { thread: { id } }).then(JSON.parse); },
    async prepare() {
      const inputs = [];
      await commands.get("factory.prepare-automations")({ thread: { id: "T-chief" }, ui: { async input(options) { inputs.push(options); } } });
      return inputs;
    },
    async reload() {
      tools = new Map();
      commands = new Map();
      modes = new Map();
      await factoryPlugin({
        createAgent(options) {
          const definition = { ...options, kind: "agent-definition" };
          return {
            definition,
            async createThread(settings) {
              assert.equal(settings.executor, "orb");
              assert.ok([...modes.values()].some((mode) => mode.agent === definition));
              const id = `T-agent-${++sequence}`;
              const transcript = [];
              const thread = {
                id, definition, transcript, settings, status: "idle", cancelled: false,
                async appendUserMessage({ content }) { transcript.push(message("user", content)); thread.status = "running"; },
                async messages() { return transcript; },
                async agent() { return { definition }; },
                state: { async get() { return thread.status; } },
                async waitForResponse({ timeoutMs }) {
                  assert.ok(timeoutMs > 0);
                  const text = await h.reply(thread);
                  const response = message("assistant", text);
                  transcript.push(response);
                  thread.status = "idle";
                  return response;
                },
                async cancel() { thread.cancelled = true; thread.status = "idle"; },
              };
              created.push(thread);
              threads.set(id, thread);
              return thread;
            },
          };
        },
        registerAgentMode(mode) { assert.ok(!modes.has(mode.key)); modes.set(mode.key, mode); },
        registerTool(tool) { tools.set(tool.name, tool); },
        registerCommand(name, options, handler) { commands.set(name, handler); },
        async createWebhook(options) { h.webhook = options; return { url: "https://ampcode.com/test-webhook-credential" }; },
        threads: { get(id) { assert.ok(threads.has(id), `unknown thread ${id}`); return threads.get(id); } },
        async $(strings, ...values) {
          const command = strings.reduce((text, part, index) => text + part + (values[index] ?? ""), "").replace(/^mise exec -- /, "");
          requests.push(command);
          if (command.startsWith("amp threads usage")) return h.usageAvailable ? result("usage=1") : failure();
          if (command.startsWith("gh label create")) return result("");
          if (command.startsWith("gh repo view")) return result("owner/repo");
          if (command.startsWith("gh issue list")) {
            const label = command.match(/--label (\S+)/)[1];
            return result([...issues.values()].filter((issue) => issue.labels.has(label)));
          }
          if (command.startsWith("gh issue create")) {
            h.issue(1, ["factory:control"]);
            issues.get(1).body = values.at(-1);
            return result("https://github.com/owner/repo/issues/1");
          }
          if (command.startsWith("gh issue view")) return result(issues.get(Number(values[0])));
          if (command.startsWith("gh issue comment")) {
            const body = values.at(-1);
            if (h.failComment(body)) return failure();
            issues.get(Number(values[0])).comments.push({ body, createdAt: new Date().toISOString() });
            return result("");
          }
          if (command.startsWith("gh issue edit")) {
            const issue = issues.get(Number(values[0]));
            for (const [, action, label] of command.matchAll(/--(add|remove)-label (\S+)/g)) {
              if (action === "add") issue.labels.add(label);
              else issue.labels.delete(label);
            }
            return result("");
          }
          if (command.startsWith("gh api --method POST")) {
            const ref = command.match(/-f ref=(\S+)/)[1].replace("refs/", "");
            if (refs.has(ref)) return failure();
            refs.add(ref);
            return result("");
          }
          if (command.startsWith("gh api")) {
            const ref = command.match(/git\/ref\/(\S+)/)[1];
            return ref === "heads/main" ? result("head-main") : refs.has(ref) ? result({}) : failure();
          }
          if (command.startsWith("gh pr view")) return result(prs.get(Number(values[0])));
          if (command.startsWith("gh pr comment")) {
            prs.get(Number(values[0])).comments.push({ body: values.at(-1) });
            return result("");
          }
          if (command.startsWith("gh pr merge")) {
            const pr = prs.get(Number(values[0]));
            assert.equal(values.at(-1), pr.headRefOid);
            pr.state = "MERGED";
            return result("");
          }
          throw new Error(`unexpected external operation: ${command}`);
        },
      });
      h.modes = modes;
    },
    pr(number, issue) {
      const pr = { headRefOid: "head-a", headRefName: `factory/issue-${issue}`, state: "OPEN", mergeable: "MERGEABLE", closingIssuesReferences: [{ number: issue }], statusCheckRollup: [{ status: "COMPLETED", conclusion: "SUCCESS" }], comments: [] };
      prs.set(number, pr);
      return pr;
    },
  };
  await h.reload();
  return h;
}

test("startup and recovery retain one chief and grant no implementation assignment", async () => {
  const h = await harness();
  h.issues.clear();
  const first = await h.call("factory_start_chief_of_staff", { maxConcurrency: 1 });
  await h.reload();
  const recovered = await h.call("factory_start_chief_of_staff", { maxConcurrency: 1 });
  assert.equal(recovered.threadID, first.threadID);
  assert.equal(h.created.length, 1);
  assert.equal(h.created[0].transcript.length, 1);
  assert.match(h.created[0].transcript[0].content[0].text, /wait for an explicit assignment/);
  assert.equal(h.issues.size, 1);
  assert.equal(h.modes.size, 8);
});

test("unrecognized controllers cannot launch work", async () => {
  const h = await harness();
  await assert.rejects(h.call("factory_start_issue", { issue: 2 }, "T-other"), /only the active chief/);
  assert.equal(h.created.length, 0);
});

test("worker capacity, concurrent starts, restart recovery, and attempt exhaustion", async () => {
  const h = await harness();
  h.issue(2);
  h.issue(3);
  const starts = await Promise.allSettled([h.call("factory_start_issue", { issue: 2 }), h.call("factory_start_issue", { issue: 3 })]);
  assert.equal(starts[0].status, "fulfilled");
  assert.equal(starts[1].status, "rejected");
  assert.match(starts[1].reason.message, /capacity/);
  assert.deepEqual([...h.issues.get(2).labels].sort(), ["factory:active", "factory:implementation"]);
  await h.reload();
  const recovered = await h.call("factory_start_issue", { issue: 2 });
  assert.equal(recovered.threadID, starts[0].value.threadID);
  for (let attempt = 2; attempt <= 5; attempt += 1) {
    const continued = await h.call("factory_continue_issue", { issue: 2, instruction: "Fix the failed gate." });
    assert.equal(continued.attempt, attempt);
    assert.equal(continued.threadID, recovered.threadID);
  }
  assert.match(h.created[0].transcript[2].content[0].text, /^Read docs\/MISTAKES.md/);
  for (let retry = 0; retry < 2; retry += 1) assert.equal((await h.call("factory_continue_issue", { issue: 2, instruction: "Retry" })).blocked, true);
  assert.equal(h.created.length, 1);
  assert.equal(h.created[0].transcript.length, 5);
  assert.equal(h.comments(2).filter((body) => body.startsWith("FACTORY_BLOCKED")).length, 1);
  assert.ok(h.comments().some((body) => body.startsWith("FACTORY_USAGE issue-worker")));
});

test("a lost worker record never creates another worker on retry", async () => {
  const h = await harness();
  h.issue(2);
  h.failComment = (body) => body.startsWith("FACTORY_WORKER");
  await assert.rejects(h.call("factory_start_issue", { issue: 2 }), /persistence/);
  h.failComment = () => false;
  await h.reload();
  await assert.rejects(h.call("factory_start_issue", { issue: 2 }), /reserved/);
  assert.equal(h.created.length, 1);
});

for (const [automation, label, capacity] of [["qaExplorer", "factory:suggestion:qa", 5], ["bugFinder", "factory:suggestion:bug", 5], ["factoryImprovement", "factory:suggestion:factory", 5], ["loopHealth", "factory:active", 1]]) {
  test(`${automation} records backpressure without creating an orb`, async () => {
    const h = await harness();
    for (let index = 0; index < capacity; index += 1) h.issue(index + 2, [label]);
    const input = { automation, eventID: "event-1" };
    assert.equal((await h.call("factory_run_automation", input)).skipped, "queue-full");
    await h.reload();
    assert.equal((await h.call("factory_run_automation", input)).duplicate, true);
    assert.equal(h.created.length, 0);
    assert.match(h.comments()[0], / SKIPPED queue-full /);
  });
}

test("duplicate delivery and lost completion recover one completed automation", async () => {
  const h = await harness();
  h.failComment = (body) => body.includes(" COMPLETE ");
  const input = { automation: "loopHealth", eventID: "event-1" };
  await assert.rejects(h.call("factory_run_automation", input), /persistence/);
  h.failComment = () => false;
  await h.reload();
  const completed = await h.call("factory_run_automation", input);
  assert.equal(completed.threadID, h.created[0].id);
  assert.equal((await h.call("factory_run_automation", input)).duplicate, true);
  assert.equal(h.created.length, 1);
  assert.match(h.comments().at(-1), / 1 COMPLETE T-agent-1 \d+ms\nusage=1/);
});

test("concurrent duplicate delivery observes the running automation", async () => {
  const h = await harness();
  let finish;
  let started;
  const running = new Promise((resolve) => { started = resolve; });
  h.reply = () => { started(); return new Promise((resolve) => { finish = resolve; }); };
  const input = { automation: "loopHealth", eventID: "event-1" };
  const first = h.call("factory_run_automation", input);
  await running;
  assert.equal((await h.call("factory_run_automation", input)).active, true);
  finish("ACCEPT");
  await first;
  assert.equal(h.created.length, 1);
});

test("failed automations cancel, record unavailable usage, and exhaust their configured budget", async () => {
  const h = await harness();
  h.reply = async () => { throw new Error("injected timeout"); };
  h.usageAvailable = false;
  const input = { automation: "loopHealth", eventID: "event-1" };
  const limit = JSON.parse((await import("node:fs")).readFileSync(new URL("./agents/maintenance.json", import.meta.url), "utf8")).attemptLimit;
  for (let attempt = 1; attempt <= limit; attempt += 1) {
    assert.equal((await h.call("factory_run_automation", input)).failed, true);
    await h.reload();
  }
  assert.equal((await h.call("factory_run_automation", input)).failed, "attempts-exhausted");
  assert.equal(h.created.length, limit);
  assert.ok(h.created.every((thread) => thread.cancelled));
  assert.equal(h.comments().filter((body) => body.includes(" FAILED ")).length, limit);
  assert.ok(h.comments().filter((body) => body.includes(" FAILED ")).every((body) => body.includes("Amp usage unavailable")));
});

test("changed heads, failed checks, and forged review provenance block merge", async () => {
  const h = await harness();
  h.issue(2);
  await h.call("factory_start_issue", { issue: 2 });
  const pr = h.pr(3, 2);
  await h.call("factory_review_pull_request", { pullRequest: 3 });
  pr.headRefOid = "head-b";
  await assert.rejects(h.call("factory_merge_pull_request", { pullRequest: 3 }), /not ready/);
  await h.call("factory_review_pull_request", { pullRequest: 3 });
  for (const check of [[], [{ status: "IN_PROGRESS", conclusion: "" }], [{ status: "COMPLETED", conclusion: "FAILURE" }]]) {
    pr.statusCheckRollup = check;
    await assert.rejects(h.call("factory_merge_pull_request", { pullRequest: 3 }), /not ready/);
  }
  pr.statusCheckRollup = [{ status: "COMPLETED", conclusion: "SUCCESS" }];
  const reviewer = h.created.at(-1);
  reviewer.transcript[0].content[0].text = "Review a different head";
  await assert.rejects(h.call("factory_merge_pull_request", { pullRequest: 3 }), /provenance/);
  assert.equal(pr.state, "OPEN");
});

test("a changed head during review invalidates acceptance", async () => {
  const h = await harness();
  const pr = h.pr(3, 2);
  h.reply = async () => { pr.headRefOid = "head-b"; return "ACCEPT"; };
  await assert.rejects(h.call("factory_review_pull_request", { pullRequest: 3 }), /changed during review/);
  assert.equal(pr.comments.length, 0);
  assert.ok(h.comments().some((body) => body.startsWith("FACTORY_USAGE reviewer")));
});

test("a qualified head merges and records worker usage", async () => {
  const h = await harness();
  h.issue(2);
  await h.call("factory_start_issue", { issue: 2 });
  const pr = h.pr(3, 2);
  await h.call("factory_review_pull_request", { pullRequest: 3 });
  assert.equal((await h.call("factory_merge_pull_request", { pullRequest: 3 })).mergedHead, "head-a");
  assert.equal(pr.state, "MERGED");
  assert.ok(!h.issues.get(2).labels.has("factory:active"));
  assert.ok(h.comments().some((body) => body.startsWith("FACTORY_USAGE issue-worker")));
});

test("webhook preparation uses owner handoff and deduplicates deliveries", async () => {
  const h = await harness();
  const messages = [];
  const inputs = await h.prepare();
  assert.equal(inputs[0].initialValue, "https://ampcode.com/test-webhook-credential");
  assert.ok(!h.requests.some((command) => /gh (secret|variable)/.test(command)));
  const ctx = { thread: { id: "T-chief", async appendUserMessage(value) { messages.push(value); } } };
  const event = { id: "delivery-1", body: new TextEncoder().encode(JSON.stringify({ automations: ["loopHealth"] })) };
  await h.webhook.handler(event, ctx);
  await h.webhook.handler(event, ctx);
  assert.equal(messages.length, 1);
  assert.match(messages[0].content, /Use eventID delivery-1/);
  assert.deepEqual(h.comments(), ["FACTORY_EVENT delivery-1 DELIVERED"]);
  assert.equal(h.created.length, 0);
  await assert.rejects(h.webhook.handler({ ...event, id: "delivery-2", body: new TextEncoder().encode('{"automations":["unconfigured"]}') }, ctx), /invalid automation event/);
  await assert.rejects(h.webhook.handler(event, { ...ctx, thread: { id: "T-other" } }), /not owned/);
});

test("conflict resolution creates a separate orb and invalidates the old review", async () => {
  const h = await harness();
  h.issue(2);
  await h.call("factory_start_issue", { issue: 2 });
  const pr = h.pr(3, 2);
  await h.call("factory_review_pull_request", { pullRequest: 3 });
  pr.mergeable = "CONFLICTING";
  h.reply = async () => { pr.mergeable = "MERGEABLE"; pr.headRefOid = "head-b"; return "Resolved"; };
  const resolved = await h.call("factory_resolve_conflicts", { pullRequest: 3 });
  assert.equal(resolved.resolved, true);
  assert.equal(h.created.length, 3);
  assert.equal(h.created.at(-1).definition.display.label, "Conflict resolver");
  await assert.rejects(h.call("factory_merge_pull_request", { pullRequest: 3 }), /not ready/);
  assert.ok(h.comments().some((body) => body.startsWith("FACTORY_USAGE conflict-resolver")));
});

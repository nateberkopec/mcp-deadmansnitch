import { readFileSync } from "node:fs";
import type {
  Agent,
  AgentReasoningEffort,
  AgentThreadExecutor,
  BuiltinAgentMode,
  CreateAgentConfig,
  PluginAgentModel,
  PluginAPI,
  PluginToolContext,
  ThreadID,
} from "@ampcode/plugin";

export const description =
  "Shepherds one GitHub issue through implementation, CI, review, conflict resolution, and merge.";

const controllerTools = [
  "factory_start_issue",
  "factory_continue_issue",
  "factory_review_pull_request",
  "factory_resolve_conflicts",
  "factory_pull_request_status",
  "factory_merge_pull_request",
  "factory_run_automation",
  "factory_agent_result",
  "factory_start_chief_of_staff",
];

const positiveInteger = (input: Record<string, unknown>, key: string): number => {
  const value = input[key];
  if (!Number.isSafeInteger(value) || Number(value) < 1) {
    throw new Error(`${key} must be a positive integer`);
  }
  return Number(value);
};

const threadID = (input: Record<string, unknown>): ThreadID => {
  const value = input.threadID;
  if (typeof value !== "string" || !/^T-[0-9A-Za-z-]+$/.test(value)) {
    throw new Error("threadID must be an Amp thread ID");
  }
  return value as ThreadID;
};

interface AgentFile {
  label: string;
  extends: BuiltinAgentMode;
  model: PluginAgentModel | null;
  reasoningEffort: AgentReasoningEffort;
  toolset: "controller" | "worker";
  executor: AgentThreadExecutor;
  visibility: "private" | "workspace";
  timeoutMs: number;
  attemptLimit: number;
  context: string[];
  authority: string[];
  output: string;
  prompt: string;
}

interface ConfiguredAgent {
  agent: Agent;
  config: AgentFile;
}

export const agentNames = [
  "chief-of-staff",
  "issue-worker",
  "reviewer",
  "conflict-resolver",
  "qa-explorer",
  "bug-finder",
  "factory-improver",
  "maintenance",
] as const;

export const loadAgentFile = (name: string): AgentFile => {
  const path = new URL(`../../agents/${name}.json`, import.meta.url);
  const value = JSON.parse(readFileSync(path, "utf8")) as Partial<AgentFile>;
  const strings = (items: unknown): items is string[] =>
    Array.isArray(items) && items.every((item) => typeof item === "string");
  if (
    typeof value.label !== "string" ||
    value.label.length > 24 ||
    !["low", "medium", "high", "ultra"].includes(value.extends ?? "") ||
    (value.model !== null && (typeof value.model !== "string" || !value.model.includes("/"))) ||
    !["none", "minimal", "low", "medium", "high", "xhigh", "max"].includes(value.reasoningEffort ?? "") ||
    !["controller", "worker"].includes(value.toolset ?? "") ||
    value.executor !== "orb" ||
    !["private", "workspace"].includes(value.visibility ?? "") ||
    !Number.isSafeInteger(value.timeoutMs) ||
    Number(value.timeoutMs) < 1 ||
    !Number.isSafeInteger(value.attemptLimit) ||
    Number(value.attemptLimit) < 1 ||
    !strings(value.context) ||
    !strings(value.authority) ||
    typeof value.output !== "string" ||
    typeof value.prompt !== "string"
  ) {
    throw new Error(`invalid agent definition: ${name}`);
  }
  return value as AgentFile;
};

interface AutomationFile {
  version: number;
  automations: Record<
    string,
    {
      agent: (typeof agentNames)[number];
      project: string;
      cron?: string;
      event?: string;
      authority: string;
      condition: string;
      output: string;
      queue?: string;
      skipWhenFull?: boolean;
      retirement: string;
    }
  >;
}

interface QueueFile {
  [key: string]: {
    label: string;
    activeLabel?: string;
    capacity: number | string;
  };
}

interface GitHubComment {
  body: string;
  createdAt: string;
}

interface ReviewState {
  generation: number;
  head: string;
  issue: number;
  threadID: ThreadID;
  verdict: "ACCEPT" | "FEEDBACK";
}

interface PullRequestState {
  headRefOid: string;
  mergeable: string;
  state: string;
  comments: GitHubComment[];
  statusCheckRollup: Array<{ conclusion: string; status: string }>;
  closingIssuesReferences: Array<{ number: number }>;
  headRefName: string;
}

export default async function factoryPlugin(amp: PluginAPI): Promise<void> {
  const agentFiles = new Map(agentNames.map((name) => [name, loadAgentFile(name)]));
  const automationFile = JSON.parse(
    readFileSync(new URL("../../automations/config.json", import.meta.url), "utf8"),
  ) as AutomationFile;
  const queues = JSON.parse(readFileSync(new URL("../../queues.json", import.meta.url), "utf8")) as QueueFile;
  if (
    automationFile.version !== 1 ||
    Object.values(automationFile.automations).some(({ agent }) => !agentFiles.has(agent))
  ) {
    throw new Error("invalid automation configuration");
  }
  const configuredAgents = new Map<string, ConfiguredAgent>();
  const configuredAgent = (name: (typeof agentNames)[number]): ConfiguredAgent => {
    const existing = configuredAgents.get(name);
    if (existing !== undefined) return existing;
    const config = agentFiles.get(name);
    if (config === undefined) {
      throw new Error(`missing agent definition: ${name}`);
    }
    const options: CreateAgentConfig = {
      extends: config.extends,
      tools: config.toolset === "controller" ? "all" : { include: "all", exclude: controllerTools },
      reasoningEffort: config.reasoningEffort,
      instructions: [
        config.prompt,
        `Context: ${config.context.join(", ")}.`,
        `Authority: ${config.authority.join(", ")}.`,
        `Output: ${config.output}`,
      ].join("\n"),
      display: { label: config.label },
    };
    if (config.model !== null) {
      options.model = config.model;
    }
    const agent = amp.createAgent(options);
    amp.registerAgentMode({ key: name, description: config.output, agent: agent.definition });
    const configured = { agent, config };
    configuredAgents.set(name, configured);
    return configured;
  };
  for (const name of agentNames) configuredAgent(name);

  const issueComments = async (issue: number): Promise<GitHubComment[]> => {
    const result = await amp.$`gh issue view ${issue} --json comments`;
    if (result.exitCode !== 0) {
      throw new Error(result.stderr);
    }
    return (JSON.parse(result.stdout) as { comments: GitHubComment[] }).comments;
  };

  const pullRequestState = async (pullRequest: number): Promise<PullRequestState> => {
    const result = await amp.$`gh pr view ${pullRequest} --json headRefOid,headRefName,mergeable,state,statusCheckRollup,comments,closingIssuesReferences`;
    if (result.exitCode !== 0) {
      throw new Error(result.stderr);
    }
    return JSON.parse(result.stdout) as PullRequestState;
  };

  const control = async (): Promise<{ capacity: number; issue: number; threadID: ThreadID } | undefined> => {
    const result = await amp.$`gh issue list --state open --label factory:control --limit 2 --json body,number`;
    if (result.exitCode !== 0) {
      throw new Error(result.stderr);
    }
    const controls = JSON.parse(result.stdout) as Array<{ body: string; number: number }>;
    if (controls.length === 0) {
      return undefined;
    }
    const chief = controls[0]?.body.match(/^FACTORY_CHIEF (T-[0-9A-Za-z-]+)$/m);
    const capacity = controls[0]?.body.match(/^FACTORY_MAX_CONCURRENCY (\d+)$/m);
    if (controls.length !== 1 || chief === null || capacity === null) {
      throw new Error("factory control state is invalid");
    }
    return { capacity: Number(capacity[1]), issue: controls[0].number, threadID: chief[1] as ThreadID };
  };

  const authorizeChief = async (
    ctx: PluginToolContext,
  ): Promise<{ capacity: number; issue: number; threadID: ThreadID }> => {
    const state = await control();
    if (state === undefined || state.threadID !== ctx.thread.id) {
      throw new Error("only the active chief of staff may use this tool");
    }
    return state;
  };
  const usageRecords = new Set<ThreadID>();
  const usageDetails = async (id: ThreadID) => {
    const usage = await amp.$`amp threads usage ${id} --details`;
    return usage.exitCode === 0 ? usage.stdout.slice(0, 2000) : "Amp usage unavailable";
  };
  const recordUsage = async (issue: number, role: string, id: ThreadID, startedAt?: number) => {
    const elapsed = startedAt === undefined ? "elapsed-unavailable" : `${Date.now() - startedAt}ms`;
    const record = await amp.$`gh issue comment ${issue} --body ${`FACTORY_USAGE ${role} ${id} ${elapsed}\n${await usageDetails(id)}`}`;
    if (record.exitCode !== 0) throw new Error(record.stderr);
    usageRecords.add(id);
  };
  const runAgent = async (agent: Agent, config: AgentFile, message: string, issue: number, role: string) => {
    const thread = await agent.createThread({ executor: config.executor, visibility: config.visibility });
    const startedAt = Date.now();
    try {
      await thread.appendUserMessage({ type: "user-message", content: message });
      const response = await thread.waitForResponse({ timeoutMs: config.timeoutMs });
      const text = response.content
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join("\n");
      return { threadID: thread.id, text, startedAt };
    } catch (error) {
      await thread.cancel();
      await recordUsage(issue, `${role}-failed`, thread.id, startedAt);
      throw error;
    }
  };

  let mutationQueue = Promise.resolve();
  const pullRequestQueues = new Map<number, Promise<void>>();
  const acquire = async (
    previous: Promise<void>,
    replace: (next: Promise<void>) => void,
  ): Promise<() => void> => {
    let release = (): void => {};
    replace(
      new Promise<void>((resolve) => {
        release = resolve;
      }),
    );
    await previous;
    return release;
  };
  const acquireMutation = (): Promise<() => void> =>
    acquire(mutationQueue, (next) => {
      mutationQueue = next;
    });
  const acquirePullRequest = (pullRequest: number): Promise<() => void> =>
    acquire(pullRequestQueues.get(pullRequest) ?? Promise.resolve(), (next) => {
      pullRequestQueues.set(pullRequest, next);
    });

  const reserveBranch = async (branch: string): Promise<boolean> => {
    const repository = await amp.$`gh repo view --json nameWithOwner --jq .nameWithOwner`;
    const base = await amp.$`gh api ${`repos/${repository.stdout.trim()}/git/ref/heads/main`} --jq .object.sha`;
    if (repository.exitCode !== 0 || base.exitCode !== 0) {
      throw new Error(repository.stderr || base.stderr);
    }
    const endpoint = `repos/${repository.stdout.trim()}/git/ref/heads/${branch}`;
    const reservation = await amp.$`gh api --method POST ${`repos/${repository.stdout.trim()}/git/refs`} -f ref=${`refs/heads/${branch}`} -f sha=${base.stdout.trim()}`;
    if (reservation.exitCode === 0) {
      return true;
    }
    const existing = await amp.$`gh api ${endpoint}`;
    if (existing.exitCode !== 0) {
      throw new Error(reservation.stderr);
    }
    return false;
  };
  const { agent: worker, config: workerConfig } = configuredAgent("issue-worker");
  const { agent: reviewer, config: reviewerConfig } = configuredAgent("reviewer");
  const { agent: resolver, config: resolverConfig } = configuredAgent("conflict-resolver");
  const { agent: chief, config: chiefConfig } = configuredAgent("chief-of-staff");
  const chiefStartupPrompt = (capacity: number): string =>
    `Prepare the factory controller with maximum implementation concurrency ${capacity}. Read factory/guardrails/factory-operation.md, report readiness and existing control state, then wait for an explicit assignment. Startup grants no authority to launch workers or automations, create implementation issues, merge, or begin unattended execution.`;

  const reviewGenerations = new Map<number, number>();
  const reviewStates = new Map<number, ReviewState>();
  const resolverStates = new Map<number, { threadID: ThreadID; text: string; startedAt: number }>();

  amp.registerTool({
    name: "factory_start_issue",
    description: "Create the single persistent implementation worker for a GitHub issue.",
    inputSchema: {
      type: "object",
      properties: { issue: { type: "integer", minimum: 1 } },
      required: ["issue"],
    },
    async execute(input, ctx) {
      const release = await acquireMutation();
      try {
        const { capacity } = await authorizeChief(ctx);
        const issue = positiveInteger(input, "issue");
        const comments = await issueComments(issue);
        const workers = comments.flatMap(({ body }) =>
          [...body.matchAll(/^FACTORY_WORKER (T-[0-9A-Za-z-]+)$/gm)].map((match) => match[1]),
        );
        if (workers.length > 1) {
          throw new Error(`issue #${issue} has multiple workers`);
        }
        const activeLabel = await amp.$`gh label create factory:active --color 0052CC --force`;
        const implementationLabel = await amp.$`gh label create factory:implementation --color 0E8A16 --force`;
        const active = await amp.$`gh issue list --state open --label factory:active --limit 100 --json number`;
        if (activeLabel.exitCode !== 0 || implementationLabel.exitCode !== 0 || active.exitCode !== 0) {
          throw new Error(activeLabel.stderr || implementationLabel.stderr || active.stderr);
        }
        const activeIssues = (JSON.parse(active.stdout) as Array<{ number: number }>).map(({ number }) => number);
        if (!activeIssues.includes(issue) && activeIssues.length >= capacity) {
          throw new Error("worker capacity is full");
        }
        const activate = await amp.$`gh issue edit ${issue} --add-label factory:active --add-label factory:implementation`;
        if (activate.exitCode !== 0) {
          throw new Error(activate.stderr);
        }
        if (workers.length === 1) {
          const id = workers[0] as ThreadID;
          const thread = amp.threads.get(id);
          const prompt = `Implement GitHub issue #${issue} on factory/issue-${issue}.`;
          const messages = JSON.stringify(await thread.messages({ full: true, from: "start", limit: 20 }));
          if (!messages.includes(prompt)) {
            await thread.appendUserMessage({ type: "user-message", content: prompt });
          }
          return JSON.stringify({ issue, threadID: id, resumed: true });
        }
        const branch = `factory/issue-${issue}`;
        if (!(await reserveBranch(branch))) {
          throw new Error(`worker startup is reserved for issue #${issue}; recover its missing worker record before retrying`);
        }
        const thread = await worker.createThread({ executor: workerConfig.executor, visibility: workerConfig.visibility });
        const record = await amp.$`gh issue comment ${issue} --body ${`FACTORY_WORKER ${thread.id}\nFACTORY_ATTEMPT 1`}`;
        if (record.exitCode !== 0) {
          throw new Error(record.stderr);
        }
        await thread.appendUserMessage({
          type: "user-message",
          content: `Implement GitHub issue #${issue} on ${branch}.`,
        });
        return JSON.stringify({ issue, threadID: thread.id, attempt: 1, branch });
      } finally {
        release();
      }
    },
  });

  amp.registerTool({
    name: "factory_continue_issue",
    description: "Send a check failure or review finding to an issue's existing worker.",
    inputSchema: {
      type: "object",
      properties: {
        issue: { type: "integer", minimum: 1 },
        instruction: { type: "string", minLength: 1 },
      },
      required: ["issue", "instruction"],
    },
    async execute(input, ctx) {
      const release = await acquireMutation();
      try {
        const state = await authorizeChief(ctx);
        const issue = positiveInteger(input, "issue");
        if (typeof input.instruction !== "string" || input.instruction.length === 0) {
          throw new Error("instruction is required");
        }
        const comments = await issueComments(issue);
        const workers = comments.flatMap(({ body }) =>
          [...body.matchAll(/^FACTORY_WORKER (T-[0-9A-Za-z-]+)$/gm)].map((match) => match[1]),
        );
        if (workers.length !== 1) {
          throw new Error(`issue #${issue} must have exactly one worker`);
        }
        const id = workers[0] as ThreadID;
        const definition = (await amp.threads.get(id).agent()).definition;
        if (definition.kind !== "agent-definition" || definition.display?.label !== "Issue worker") {
          throw new Error(`issue #${issue} has an invalid worker`);
        }
        const attempts = comments.flatMap(({ body }) =>
          [...body.matchAll(/^FACTORY_ATTEMPT (\d+)$/gm)].map((match) => Number(match[1])),
        );
        const attempt = Math.max(0, ...attempts) + 1;
        if (attempt > (workerConfig.attemptLimit ?? 1)) {
          if (!comments.some(({ body }) => body === "FACTORY_BLOCKED attempt budget exhausted")) {
            const blocked = await amp.$`gh issue comment ${issue} --body ${"FACTORY_BLOCKED attempt budget exhausted"}`;
            if (blocked.exitCode !== 0) throw new Error(blocked.stderr);
            await recordUsage(state.issue, "issue-worker", id);
          }
          return JSON.stringify({ issue, threadID: id, blocked: true });
        }
        const record = await amp.$`gh issue comment ${issue} --body ${`FACTORY_ATTEMPT ${attempt}`}`;
        if (record.exitCode !== 0) {
          throw new Error(record.stderr);
        }
        await amp.threads.get(id).appendUserMessage({
          type: "user-message",
          content:
            attempt >= 3
              ? `Read docs/MISTAKES.md before this attempt.\n${input.instruction}`
              : input.instruction,
        });
        return JSON.stringify({ issue, threadID: id, attempt });
      } finally {
        release();
      }
    },
  });

  amp.registerTool({
    name: "factory_review_pull_request",
    description: "Launch a fresh independent reviewer for the current pull request head.",
    inputSchema: {
      type: "object",
      properties: { pullRequest: { type: "integer", minimum: 1 } },
      required: ["pullRequest"],
    },
    async execute(input, ctx) {
      const controlState = await authorizeChief(ctx);
      const pullRequest = positiveInteger(input, "pullRequest");
      const release = await acquirePullRequest(pullRequest);
      try {
        const before = await pullRequestState(pullRequest);
        if (
          before.closingIssuesReferences.length !== 1 ||
          before.headRefName !== `factory/issue-${before.closingIssuesReferences[0].number}`
        ) {
          throw new Error("pull request must belong to one factory issue branch");
        }
        const prior = reviewStates.get(pullRequest);
        if (prior?.head === before.headRefOid) {
          if (!usageRecords.has(prior.threadID)) {
            await recordUsage(controlState.issue, "reviewer", prior.threadID);
          }
          return JSON.stringify({ pullRequest, threadID: prior.threadID, verdict: prior.verdict, duplicate: true });
        }
        const generation = (reviewGenerations.get(pullRequest) ?? 0) + 1;
        reviewGenerations.set(pullRequest, generation);
        reviewStates.delete(pullRequest);
        const result = await runAgent(
          reviewer,
          reviewerConfig,
          `Review pull request #${pullRequest} at head ${before.headRefOid}. Return ACCEPT or FEEDBACK as instructed.`,
          controlState.issue,
          "reviewer",
        );
        try {
          const after = await pullRequestState(pullRequest);
        if (after.headRefOid !== before.headRefOid) {
          throw new Error("pull request changed during review");
        }
        const verdict = result.text.trim().split(/\r?\n/, 1)[0] === "ACCEPT" ? "ACCEPT" : "FEEDBACK";
        const issue = before.closingIssuesReferences[0].number;
        const current = reviewGenerations.get(pullRequest) === generation;
        const marker = `FACTORY_REVIEW ${before.headRefOid} ${verdict} ISSUE ${issue} REVIEWER ${result.threadID} GENERATION ${generation}`;
        const comment = await amp.$`gh pr comment ${pullRequest} --body ${`${marker}\n\n${result.text}`}`;
        if (comment.exitCode !== 0) {
          throw new Error(comment.stderr);
        }
        if (current) {
          reviewStates.set(pullRequest, {
            generation,
            head: before.headRefOid,
            issue,
            threadID: result.threadID,
            verdict,
          });
        }
          return JSON.stringify({
            pullRequest,
            threadID: result.threadID,
            verdict,
            generation,
            current,
            report: result.text,
          });
        } finally {
          await recordUsage(controlState.issue, "reviewer", result.threadID, result.startedAt);
        }
      } finally {
        release();
      }
    },
  });

  amp.registerTool({
    name: "factory_resolve_conflicts",
    description: "Launch a fresh resolver for a pull request that conflicts with main.",
    inputSchema: {
      type: "object",
      properties: { pullRequest: { type: "integer", minimum: 1 } },
      required: ["pullRequest"],
    },
    async execute(input, ctx) {
      const state = await authorizeChief(ctx);
      const pullRequest = positiveInteger(input, "pullRequest");
      const before = await pullRequestState(pullRequest);
      const prior = resolverStates.get(pullRequest);
      if (before.mergeable !== "CONFLICTING") {
        if (prior !== undefined && !usageRecords.has(prior.threadID)) {
          await recordUsage(state.issue, "conflict-resolver", prior.threadID, prior.startedAt);
        }
        return JSON.stringify({ pullRequest, noConflict: true, threadID: prior?.threadID });
      }
      const result = await runAgent(
        resolver,
        resolverConfig,
        `Resolve conflicts for pull request #${pullRequest}.`,
        state.issue,
        "conflict-resolver",
      );
      resolverStates.set(pullRequest, result);
      try {
        const after = await pullRequestState(pullRequest);
        return JSON.stringify({
          pullRequest,
          threadID: result.threadID,
          resolved: after.mergeable !== "CONFLICTING",
          report: result.text,
        });
      } finally {
        await recordUsage(state.issue, "conflict-resolver", result.threadID, result.startedAt);
      }
    },
  });

  amp.registerTool({
    name: "factory_pull_request_status",
    description: "Read deterministic current-head, mergeability, check, and review state from GitHub.",
    inputSchema: {
      type: "object",
      properties: { pullRequest: { type: "integer", minimum: 1 } },
      required: ["pullRequest"],
    },
    async execute(input, ctx) {
      await authorizeChief(ctx);
      return JSON.stringify(await pullRequestState(positiveInteger(input, "pullRequest")));
    },
  });

  amp.registerTool({
    name: "factory_merge_pull_request",
    description: "Merge only a conflict-free current head with successful checks and an accepting current-head review.",
    inputSchema: {
      type: "object",
      properties: { pullRequest: { type: "integer", minimum: 1 } },
      required: ["pullRequest"],
    },
    async execute(input, ctx) {
      const controlState = await authorizeChief(ctx);
      const pullRequest = positiveInteger(input, "pullRequest");
      const release = await acquirePullRequest(pullRequest);
      try {
        const state = await pullRequestState(pullRequest);
      const issue = state.closingIssuesReferences[0]?.number;
      const checksPassed =
        state.statusCheckRollup.length > 0 &&
        state.statusCheckRollup.every(
          ({ conclusion, status }) => status === "COMPLETED" && conclusion === "SUCCESS",
        );
      const review = reviewStates.get(pullRequest);
      if (
        issue === undefined ||
        state.closingIssuesReferences.length !== 1 ||
        state.headRefName !== `factory/issue-${issue}` ||
        state.state !== "OPEN" ||
        state.mergeable !== "MERGEABLE" ||
        !checksPassed ||
        review?.head !== state.headRefOid ||
        review.issue !== issue ||
        review.verdict !== "ACCEPT"
      ) {
        throw new Error("pull request is not ready to merge");
      }
      const reviewerThread = amp.threads.get(review.threadID);
      const reviewerDefinition = (await reviewerThread.agent()).definition;
      const reviewStart = await reviewerThread.messages({ full: true, from: "start", limit: 20 });
      const reviewEnd = await reviewerThread.messages({ full: true, from: "end", limit: 20 });
      const expectedPrompt = `Review pull request #${pullRequest} at head ${state.headRefOid}. Return ACCEPT or FEEDBACK as instructed.`;
      const prompted = reviewStart.some(
        (message) =>
          message.role === "user" &&
          message.content.some((block) => block.type === "text" && block.text === expectedPrompt),
      );
      const response = reviewEnd.findLast(({ role }) => role === "assistant");
      const responseVerdict = response?.content
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join("\n")
        .trim()
        .split(/\r?\n/, 1)[0];
      if (
        reviewerDefinition.kind !== "agent-definition" ||
        reviewerDefinition.display?.label !== "PR reviewer" ||
        !prompted ||
        responseVerdict !== "ACCEPT"
      ) {
        throw new Error("review provenance is invalid");
      }
      const workers = (await issueComments(issue)).flatMap(({ body }) =>
        [...body.matchAll(/^FACTORY_WORKER (T-[0-9A-Za-z-]+)$/gm)].map((match) => match[1]),
      );
      if (workers.length !== 1) {
        throw new Error("issue worker provenance is invalid");
      }
      const workerThread = amp.threads.get(workers[0] as ThreadID);
      const workerDefinition = (await workerThread.agent()).definition;
      const workerStart = await workerThread.messages({ full: true, from: "start", limit: 20 });
      const workerPrompted = workerStart.some(
        (message) =>
          message.role === "user" &&
          message.content.some(
            (block) => block.type === "text" && block.text === `Implement GitHub issue #${issue} on factory/issue-${issue}.`,
          ),
      );
      if (
        workerDefinition.kind !== "agent-definition" ||
        workerDefinition.display?.label !== "Issue worker" ||
        !workerPrompted
      ) {
        throw new Error("issue worker provenance is invalid");
      }
      const result = await amp.$`gh pr merge ${pullRequest} --squash --match-head-commit ${state.headRefOid}`;
      if (result.exitCode !== 0) {
        throw new Error(result.stderr);
      }
      const deactivate = await amp.$`gh issue edit ${issue} --remove-label factory:active`;
        await recordUsage(controlState.issue, "issue-worker", workers[0] as ThreadID);
        return JSON.stringify({
          pullRequest,
          issue,
          mergedHead: state.headRefOid,
          labelRemoved: deactivate.exitCode === 0,
        });
      } finally {
        release();
      }
    },
  });

  amp.registerTool({
    name: "factory_run_automation",
    description: "Launch one due automation unless its bounded output queue is full.",
    inputSchema: {
      type: "object",
      properties: {
        automation: { type: "string" },
        eventID: { type: "string" },
      },
      required: ["automation", "eventID"],
    },
    async execute(input, ctx) {
      const state = await authorizeChief(ctx);
      if (
        typeof input.automation !== "string" ||
        typeof input.eventID !== "string" ||
        !/^[0-9A-Za-z._-]+$/.test(input.eventID)
      ) {
        throw new Error("automation and eventID are required");
      }
      const automation = automationFile.automations[input.automation];
      if (automation === undefined || automation.project !== "main") {
        throw new Error("automation is unavailable in the main project");
      }
      const configured = configuredAgent(automation.agent);
      const marker = `FACTORY_AUTOMATION ${input.eventID} ${input.automation}`;
      const record = async (body: string) => {
        const result = await amp.$`gh issue comment ${state.issue} --body ${body}`;
        if (result.exitCode !== 0) throw new Error(result.stderr);
      };
      const complete = async (attempt: number, id: ThreadID, startedAt: number, text: string) => {
        const durationMs = Date.now() - startedAt;
        await record(`${marker} ${attempt} COMPLETE ${id} ${durationMs}ms\n${await usageDetails(id)}`);
        return JSON.stringify({ automation: input.automation, threadID: id, durationMs, report: text });
      };
      const release = await acquireMutation();
      let attempt = 1;
      let start = Date.now();
      let thread: Awaited<ReturnType<Agent["createThread"]>>;
      try {
        const records = (await issueComments(state.issue))
          .map(({ body }) => body)
          .filter((body) => body.startsWith(`${marker} `));
        if (records.some((body) => / (COMPLETE|SKIPPED) /.test(body))) {
          return JSON.stringify({ automation: input.automation, duplicate: true });
        }
        const starts = records.filter((body) => body.split(" ")[4] === "STARTED");
        const latest = starts.at(-1);
        if (latest !== undefined) {
          const parts = latest.split(" ");
          attempt = Number(parts[3]);
          const id = parts[5] as ThreadID;
          start = Number(parts[6]);
          if (records.some((body) => body.startsWith(`${marker} ${attempt} FAILED `))) {
            attempt += 1;
          } else {
            const existing = amp.threads.get(id);
            const current = await existing.state.get();
            if (current === "running" || current === "awaiting-approval") {
              return JSON.stringify({ automation: input.automation, threadID: id, active: true });
            }
            const messages = await existing.messages({ full: true, from: "end", limit: 20 });
            const response = messages.findLast(({ role }) => role === "assistant");
            if (response !== undefined) {
              const text = response.content
                .filter((block) => block.type === "text")
                .map((block) => block.text)
                .join("\n");
              return await complete(attempt, id, start, text);
            }
            await record(
              `${marker} ${attempt} FAILED ${id} ${Date.now() - start}ms recovery\n${await usageDetails(id)}`,
            );
            attempt += 1;
          }
        }
        if (attempt > configured.config.attemptLimit) {
          return JSON.stringify({ automation: input.automation, failed: "attempts-exhausted" });
        }
        if (automation.queue !== undefined && automation.skipWhenFull === true) {
          const queue = queues[automation.queue];
          if (queue === undefined) throw new Error("invalid automation queue");
          const capacity = typeof queue.capacity === "number" ? queue.capacity : state.capacity;
          const labelName = queue.activeLabel ?? queue.label;
          const label = await amp.$`gh label create ${labelName} --color D4C5F9 --force`;
          const entries = await amp.$`gh issue list --state open --label ${labelName} --limit 100 --json number`;
          if (label.exitCode !== 0 || entries.exitCode !== 0) {
            throw new Error(label.stderr || entries.stderr);
          }
          if ((JSON.parse(entries.stdout) as unknown[]).length >= capacity) {
            await record(`${marker} ${attempt} SKIPPED queue-full ${Date.now()}`);
            return JSON.stringify({ automation: input.automation, skipped: "queue-full" });
          }
        }
        thread = await configured.agent.createThread({
          executor: configured.config.executor,
          visibility: configured.config.visibility,
        });
        start = Date.now();
        await record(`${marker} ${attempt} STARTED ${thread.id} ${start}`);
        await thread.appendUserMessage({
          type: "user-message",
          content: `Run automation ${input.automation} from factory/automations/config.json.`,
        });
      } finally {
        release();
      }
      let text: string;
      try {
        const response = await thread.waitForResponse({ timeoutMs: configured.config.timeoutMs });
        text = response.content
          .filter((block) => block.type === "text")
          .map((block) => block.text)
          .join("\n");
      } catch {
        await thread.cancel();
        await record(
          `${marker} ${attempt} FAILED ${thread.id} ${Date.now() - start}ms agent-run\n${await usageDetails(thread.id)}`,
        );
        return JSON.stringify({ automation: input.automation, threadID: thread.id, failed: true });
      }
      return await complete(attempt, thread.id, start, text);
    },
  });

  amp.registerTool({
    name: "factory_agent_result",
    description: "Read the state and latest response of a factory agent.",
    inputSchema: {
      type: "object",
      properties: { threadID: { type: "string" } },
      required: ["threadID"],
    },
    async execute(input, ctx) {
      await authorizeChief(ctx);
      const id = threadID(input);
      const thread = amp.threads.get(id);
      const messages = await thread.messages({ full: true, from: "end", limit: 20 });
      const response = messages.findLast(({ role }) => role === "assistant");
      const text = response?.content
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join("\n");
      return JSON.stringify({ threadID: id, state: await thread.state.get(), text });
    },
  });

  amp.registerTool({
    name: "factory_start_chief_of_staff",
    description: "Start or recover the chief-of-staff thread, report readiness, and wait for an explicit assignment.",
    inputSchema: {
      type: "object",
      properties: {
        maxConcurrency: { type: "integer", minimum: 1, maximum: 10 },
        recover: { type: "boolean" },
      },
      required: ["maxConcurrency"],
    },
    async execute(input) {
      const maxConcurrency = positiveInteger(input, "maxConcurrency");
      if (maxConcurrency > 10) {
        throw new Error("maxConcurrency cannot exceed 10");
      }
      const label = await amp.$`gh label create factory:control --color 5319E7 --force`;
      if (label.exitCode !== 0) {
        throw new Error(label.stderr);
      }
      const existing = await control();
      if (existing !== undefined) {
        const thread = amp.threads.get(existing.threadID);
        const prompt = chiefStartupPrompt(existing.capacity);
        const messages = JSON.stringify(await thread.messages({ full: true, from: "start", limit: 20 }));
        if (!messages.includes(prompt)) {
          await thread.appendUserMessage({ type: "user-message", content: prompt });
        }
        return JSON.stringify({
          threadID: existing.threadID,
          maxConcurrency: existing.capacity,
          resumed: true,
        });
      }
      const reserved = await reserveBranch("factory/control");
      if (!reserved && input.recover !== true) {
        throw new Error("factory startup is reserved; retry with recover after confirming the prior launch failed");
      }
      const thread = await chief.createThread({ executor: chiefConfig.executor, visibility: chiefConfig.visibility });
      const record = await amp.$`gh issue create --title ${"Factory control"} --label factory:control --body ${`FACTORY_CHIEF ${thread.id}\nFACTORY_MAX_CONCURRENCY ${maxConcurrency}`}`;
      if (record.exitCode !== 0) {
        throw new Error(record.stderr);
      }
      await thread.appendUserMessage({
        type: "user-message",
        content: chiefStartupPrompt(maxConcurrency),
      });
      return JSON.stringify({ threadID: thread.id, maxConcurrency, controlIssue: record.stdout.trim() });
    },
  });

  amp.registerCommand(
    "factory.prepare-automations",
    {
      title: "Prepare factory automations",
      category: "factory",
      description: "Register the Amp wake-up webhook for installation through the owner's local GitHub CLI.",
    },
    async (ctx) => {
      if (ctx.thread === undefined) {
        throw new Error("open the chief-of-staff thread first");
      }
      const state = await control();
      if (state === undefined || state.threadID !== ctx.thread.id) {
        throw new Error("prepare automations from the active chief-of-staff thread");
      }
      const registration = await amp.createWebhook({
        key: "factory-automations",
        handler: async (event, webhook) => {
          const release = await acquireMutation();
          try {
            const current = await control();
            if (current === undefined || current.threadID !== webhook.thread.id) {
              throw new Error("automation webhook is not owned by the active chief of staff");
            }
            const marker = `FACTORY_EVENT ${event.id} DELIVERED`;
            if ((await issueComments(current.issue)).some(({ body }) => body === marker)) {
              return;
            }
            const payload = JSON.parse(new TextDecoder().decode(event.body)) as { automations?: unknown };
            if (
              !Array.isArray(payload.automations) ||
              payload.automations.some(
                (name) => typeof name !== "string" || automationFile.automations[name] === undefined,
              )
            ) {
              throw new Error("invalid automation event");
            }
            await webhook.thread.appendUserMessage({
              type: "user-message",
              content: `Run due automations: ${payload.automations.join(", ")}. Use eventID ${event.id} for each run and process duplicate event IDs only once.`,
            });
            const record = await amp.$`gh issue comment ${current.issue} --body ${marker}`;
            if (record.exitCode !== 0) {
              throw new Error(record.stderr);
            }
          } finally {
            release();
          }
        },
      });
      await ctx.ui.input({
        title: "Copy the private webhook URL",
        helpText: "Run bin/install-factory-automations locally and paste this URL into its masked prompt. Treat the URL as a credential; keep it out of chat, logs, and shell commands. GitHub configuration has not changed.",
        initialValue: registration.url,
        submitButtonText: "Done",
      });
    },
  );
}

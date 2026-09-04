import type { PluginAPI, PluginToolContext, ThreadID } from "@ampcode/plugin";

export const description =
  "Shepherds one GitHub issue through implementation, CI, review, conflict resolution, and merge.";

const controllerTools = [
  "factory_start_issue",
  "factory_continue_issue",
  "factory_worker_status",
  "factory_review_pull_request",
  "factory_resolve_conflicts",
  "factory_pull_request_status",
  "factory_merge_pull_request",
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

  const control = async (): Promise<{ capacity: number; threadID: ThreadID } | undefined> => {
    const result = await amp.$`gh issue list --state open --label factory:control --limit 2 --json body`;
    if (result.exitCode !== 0) {
      throw new Error(result.stderr);
    }
    const controls = JSON.parse(result.stdout) as Array<{ body: string }>;
    if (controls.length === 0) {
      return undefined;
    }
    const chief = controls[0]?.body.match(/^FACTORY_CHIEF (T-[0-9A-Za-z-]+)$/m);
    const capacity = controls[0]?.body.match(/^FACTORY_MAX_CONCURRENCY (\d+)$/m);
    if (controls.length !== 1 || chief === null || capacity === null) {
      throw new Error("factory control state is invalid");
    }
    return { capacity: Number(capacity[1]), threadID: chief[1] as ThreadID };
  };

  const authorizeChief = async (ctx: PluginToolContext): Promise<number> => {
    const state = await control();
    if (state === undefined || state.threadID !== ctx.thread.id) {
      throw new Error("only the active chief of staff may use this tool");
    }
    return state.capacity;
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
  const worker = amp.createAgent({
    extends: "high",
    tools: { include: "all", exclude: controllerTools },
    instructions:
      "Own exactly one GitHub issue. Read AGENTS.md, docs/ARCHITECTURE.md, the issue, and only its routed guardrails. Inspect current HEAD before changing anything. Check out the reserved factory/issue-N branch, create or continue its pull request with Closes #N in the body, keep the diff narrow, run bin/check-dev-env, and update the issue with durable progress. Never merge. Stop and report anything requiring authority.",
    display: { label: "Issue worker" },
  });

  const reviewer = amp.createAgent({
    extends: "high",
    tools: { include: "all", exclude: controllerTools },
    instructions:
      "Review one pull request without changing code. Inspect its current head, issue, diff, tests, and routed guardrails. Return ACCEPT as the first line only when there is no further feedback; otherwise return FEEDBACK followed by concrete findings. Do not post the factory marker or merge.",
    display: { label: "PR reviewer" },
  });

  const resolver = amp.createAgent({
    extends: "high",
    tools: { include: "all", exclude: controllerTools },
    instructions:
      "Resolve merge conflicts for one pull request in a fresh orb. Merge current main into its branch without destructive git operations, preserve both intended behaviors, run bin/check-dev-env, commit, push, and report. Never merge the pull request.",
    display: { label: "Conflict resolver" },
  });

  const chief = amp.createAgent({
    extends: "high",
    tools: "all",
    instructions:
      "Act as chief of staff. Read factory/readme.md and docs/PLAN.md. Compare current HEAD with the plan, open issues, pull requests, and active work. Treat phases only as guidance about what is timely. Create the smallest independently mergeable issues only when capacity exists, assign one worker thread to each issue, and shepherd every active issue through checks, current-head review, conflict resolution, and merge. Reuse an issue's worker thread for fixes. Merge only with factory_merge_pull_request, never directly. Stop only for an interminable blocker or required authority.",
    display: { label: "Chief of staff" },
  });

  const reviewGenerations = new Map<number, number>();
  const reviewStates = new Map<number, ReviewState>();

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
        const capacity = await authorizeChief(ctx);
        const issue = positiveInteger(input, "issue");
        const comments = await issueComments(issue);
        const workers = comments.flatMap(({ body }) =>
          [...body.matchAll(/^FACTORY_WORKER (T-[0-9A-Za-z-]+)$/gm)].map((match) => match[1]),
        );
        if (workers.length > 1) {
          throw new Error(`issue #${issue} has multiple workers`);
        }
        const label = await amp.$`gh label create factory:active --color 0052CC --force`;
        const active = await amp.$`gh issue list --state open --label factory:active --limit 100 --json number`;
        if (label.exitCode !== 0 || active.exitCode !== 0) {
          throw new Error(label.stderr || active.stderr);
        }
        const activeIssues = (JSON.parse(active.stdout) as Array<{ number: number }>).map(({ number }) => number);
        if (!activeIssues.includes(issue) && activeIssues.length >= capacity) {
          throw new Error("worker capacity is full");
        }
        const activate = await amp.$`gh issue edit ${issue} --add-label factory:active`;
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
        await reserveBranch(branch);
        const thread = await worker.createThread({ executor: "orb", visibility: "workspace" });
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
        await authorizeChief(ctx);
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
        if (attempt > 5) {
          const blocked = await amp.$`gh issue comment ${issue} --body ${"FACTORY_BLOCKED attempt budget exhausted"}`;
          if (blocked.exitCode !== 0) {
            throw new Error(blocked.stderr);
          }
          return JSON.stringify({ issue, threadID: id, blocked: true });
        }
        const record = await amp.$`gh issue comment ${issue} --body ${`FACTORY_ATTEMPT ${attempt}`}`;
        if (record.exitCode !== 0) {
          throw new Error(record.stderr);
        }
        await amp.threads.get(id).appendUserMessage({
          type: "user-message",
          content: input.instruction,
        });
        return JSON.stringify({ issue, threadID: id, attempt });
      } finally {
        release();
      }
    },
  });

  amp.registerTool({
    name: "factory_worker_status",
    description: "Read an issue worker's current Amp state.",
    inputSchema: {
      type: "object",
      properties: { threadID: { type: "string" } },
      required: ["threadID"],
    },
    async execute(input, ctx) {
      await authorizeChief(ctx);
      const id = threadID(input);
      return JSON.stringify({ threadID: id, state: await amp.threads.get(id).state.get() });
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
      await authorizeChief(ctx);
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
      const generation = (reviewGenerations.get(pullRequest) ?? 0) + 1;
      reviewGenerations.set(pullRequest, generation);
      reviewStates.delete(pullRequest);
      const result = await reviewer.run(
        `Review pull request #${pullRequest} at head ${before.headRefOid}. Return ACCEPT or FEEDBACK as instructed.`,
        {
          executor: "orb",
          visibility: "workspace",
          timeoutMs: 3_600_000,
        },
      );
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
        reviewStates.set(pullRequest, { generation, head: before.headRefOid, issue, threadID: result.threadID, verdict });
      }
        return JSON.stringify({ pullRequest, threadID: result.threadID, verdict, generation, current, report: result.text });
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
      await authorizeChief(ctx);
      const pullRequest = positiveInteger(input, "pullRequest");
      const result = await resolver.run(`Resolve conflicts for pull request #${pullRequest}.`, {
        executor: "orb",
        visibility: "workspace",
        timeoutMs: 3_600_000,
      });
      return JSON.stringify({ pullRequest, threadID: result.threadID, report: result.text });
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
      await authorizeChief(ctx);
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
    name: "factory_start_chief_of_staff",
    description: "Start a chief-of-staff thread that creates and shepherds work just in time.",
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
        const prompt = `Run the factory with maximum concurrency ${existing.capacity}.`;
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
      const thread = await chief.createThread({ executor: "orb", visibility: "workspace" });
      const record = await amp.$`gh issue create --title ${"Factory control"} --label factory:control --body ${`FACTORY_CHIEF ${thread.id}\nFACTORY_MAX_CONCURRENCY ${maxConcurrency}`}`;
      if (record.exitCode !== 0) {
        throw new Error(record.stderr);
      }
      await thread.appendUserMessage({
        type: "user-message",
        content: `Run the factory with maximum concurrency ${maxConcurrency}.`,
      });
      return JSON.stringify({ threadID: thread.id, maxConcurrency, controlIssue: record.stdout.trim() });
    },
  });
}

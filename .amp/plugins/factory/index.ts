import type { PluginAPI } from "@ampcode/plugin";

export const description =
  "Runs deterministic factory gates in Amp orbs and routes maintenance loops to repository runbooks.";

export const workerPrompt =
  "Read AGENTS.md, docs/ARCHITECTURE.md, and the routed guardrail. Keep the diff narrow and report skipped proof.";

export const automationRunbooks = {
  twinDrift: "docs/automations/twin-drift.md",
  dependencySweep: "docs/automations/dependency-sweep.md",
  release: "docs/automations/release.md",
  securityRedTeam: "docs/automations/security-red-team.md",
  docDrift: "docs/automations/doc-drift.md",
  coverageRatchet: "docs/automations/coverage-ratchet.md",
  flakeHunter: "docs/automations/flake-hunter.md",
  refactor: "docs/automations/refactor.md",
  qaExplorer: "docs/automations/qa-explorer.md",
  factoryImprovement: "docs/automations/factory-improvement.md",
  loopHealth: "docs/automations/loop-health.md",
} as const;

export const factoryImprovementPrompt =
  "Read docs/automations/factory-improvement.md and analyze all implementing-agent sessions since the recorded boundary. Update docs/factory-improvements.md with aggregate, redacted process evidence only; never copy secrets or sensitive transcript content.";

export interface GateReport {
  gate: string;
  passed: boolean;
  exitCode: number;
}

/** Run the Phase 0 gate in the executor hosting this plugin. */
export async function phaseZeroLintGate(amp: PluginAPI): Promise<GateReport> {
  const result = await amp.$`mise run lint`;
  return {
    gate: "mise run lint",
    passed: result.exitCode === 0,
    exitCode: result.exitCode,
  };
}

/** Prove in an orb that a failing exit code blocks and a passing one proceeds. */
export async function phaseZeroGateSpike(amp: PluginAPI): Promise<string> {
  const failedResult = await amp.$`mise run __phase_zero_intentional_failure__`;
  if (failedResult.exitCode === 0) {
    throw new Error("intentional failure gate unexpectedly passed");
  }

  const success = await phaseZeroLintGate(amp);
  if (!success.passed) {
    throw new Error(`${success.gate} failed with exit code ${success.exitCode}`);
  }

  return JSON.stringify({ blockedOnFailure: true, proceededOnSuccess: true });
}

/** Register the Phase 0 pipeline entry points. Run them from an orb. */
export default function factoryPlugin(amp: PluginAPI): void {
  amp.registerTool({
    name: "factory_phase_zero_gate_spike",
    description: "Run the deterministic Phase 0 fail-then-pass gate spike in this orb.",
    inputSchema: { type: "object", properties: {}, required: [] },
    async execute() {
      if (amp.system.executor.kind !== "remote") {
        throw new Error("factory gate spikes must run in an orb");
      }
      return phaseZeroGateSpike(amp);
    },
  });

  amp.registerCommand(
    "factory.phase-zero-lint",
    {
      title: "Run Phase 0 lint gate",
      category: "factory",
      description: "Run the deterministic Phase 0 lint gate in this orb.",
    },
    async (ctx) => {
      if (amp.system.executor.kind !== "remote") {
        await ctx.ui.notify("Start an orb thread before running the factory gate.");
        return;
      }

      const report = await phaseZeroLintGate(amp);
      await ctx.ui.notify(JSON.stringify(report));
      if (!report.passed) {
        throw new Error(`${report.gate} failed with exit code ${report.exitCode}`);
      }
    },
  );
}

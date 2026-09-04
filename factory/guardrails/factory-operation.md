# Factory operation

The chief of staff is the sole GitHub issue manager and lifecycle controller. It maintains the labeled capacities in `factory/queues.json`, creates implementation issues only when worker capacity exists, and promotes suggestions only after deduplication and triage.

Every other factory role runs in its configured Amp orb with its repository-owned agent definition. One implementation issue has one persistent worker. Reviews, conflict resolution, judgments, and automation runs use separate orbs. A changed pull-request head repeats CI and review.

Mechanical progress follows exit codes and checked state. Models propose work and make review judgments; they do not waive gates. The chief merges only through the plugin's merge tool. Attempts stop at their configured limit and produce an interminable-blocker report when exhausted.

Automations follow `factory/automations/config.json`. Finding-producing runs stop under queue backpressure. They report to the chief; the chief alone creates, rewrites, closes, promotes, or deletes suggestion issues.

Publishing, destructive operations, account changes, and factory activation wait for explicit human authority. After the seal, factory changes also require an owner-signed current head.

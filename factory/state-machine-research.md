# Factory state-machine research

## Recommendation

Use one typed TypeScript transition table as both executable dispatch data and the input to an exhaustive finite-state checker. Keep effects outside the model. This can completely explore the factory's bounded abstraction without adding another language or generated runtime code.

```text
idle -> working -> checking -> reviewing -> ready -> merged
                    |             |          |
                    v             v          v
                 blocked       working    checking
                    ^             |
                    |             v
                    +-------- conflicted
```

The model should cover attempts 1–5, two symbolic heads, worker and issue-reference counts 0–2, check results, review verdicts, mergeability, conflict resolution, and terminal outcomes. It should reject reachable states that violate:

- one worker per implementation issue;
- no sixth attempt;
- accepted review belongs to the current head and issue;
- merge requires successful checks, one issue reference, one worker, current acceptance, and no conflict;
- merged and blocked are terminal;
- every nonterminal state has a valid next action.

The checker should emit the shortest failing event trace and derive a stable diagram and transition test vectors. The authoritative transition table can remain under 30 nonblank lines.

TLA+/TLC becomes preferable only if the factory later needs proofs about unbounded concurrency, fairness, or liveness. Alloy is useful for relational structure; PlusCal, Stateright, and SCXML add more language or generation cost than this bounded protocol currently warrants.

References: [Stateright model checking](https://www.stateright.rs/getting-started.html#model-checking-in-more-detail), [TLA+](https://lamport.azurewebsites.net/tla/tla.html), [Alloy](https://alloytools.org/), [SCXML](https://www.w3.org/TR/scxml/).

Implementation is deferred until the issue lifecycle stabilizes enough that the table will not merely encode churn.

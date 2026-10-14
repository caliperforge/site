---
title: cf-invariants — building the missing layer in Cairo testing
slug: caliperforge-origins
date: 2026-06-01
author: Michael Moffett
---

## The gap

snforge ships with a fuzzer. It generates random scalar values for a single function's arguments and runs that function in isolation against the property assertions in your test file. That works for math-shaped properties on pure functions. It does not cover stateful invariant testing. The shape there is different: pick a random sequence of calls, with random callers, random values, and random ordering. Apply the sequence to a live contract. Check that a class invariant holds across every intermediate state.

The class invariants I have in mind are the ones every protocol team has written on a whiteboard at some point. `total_supply == sum(balances)` on a token. `is_executed(pid)` only ever transitioning false→true on a governance contract. `reserve_a * reserve_b` non-decreasing on a constant-product AMM. They are properties of state, not properties of a single function call. The bugs that violate them rarely look like the bug Foundry's fuzzer finds on one call. They look like sequences.

The maintainers of starknet-foundry know this. [Issue #2464](https://github.com/foundry-rs/starknet-foundry/issues/2464) is the open roadmap entry "Research Variant and Differential Testing, Better Fuzzing Algorithms" — size 5, still open, and stateful invariant testing is the canonical example downstream. It is what Foundry's `invariant`, Halmos, and Echidna cover on the Solidity side. Cairo does not have it yet. That is the gap cf-invariants is built around.

## What we built

[cf-invariants](https://github.com/caliperforge/cf-invariants-starknet) is a Rust CLI that sits next to snforge, not on top of it. It reads a Scarb project, generates a per-run harness that fuzzes random call sequences against a contract, runs `snforge test` as a subprocess, and emits a structured `scorecard.json` plus a human-readable scorecard. The scorecard reports `N/M invariants violated` and the failing call sequence. snforge stays the execution engine. cf-invariants is a sequence-search and reporting layer around it. Apache-2.0. No exclusivity, no fork, no claim on the upstream namespace.

The repo carries 42 tests across six Rust crates and a Cairo crate of reference contracts. The Rust crates are a sequence searcher, an snforge subprocess driver, a Cairo metadata reader, a scorecard renderer, an opt-in AI suggestion module, and a CLI front. Pinned toolchain: [snforge 0.61.0](https://github.com/foundry-rs/starknet-foundry/releases/tag/v0.61.0), [scarb 2.18.0](https://github.com/software-mansion/scarb/releases/tag/v2.18.0), Cairo 2.18.0, sierra 1.8.0.

One detail of the design needs naming early, because it shapes how the tool gets used. cf-invariants includes an opt-in AI suggestion module that calls Anthropic Claude Sonnet 4.6 against a versioned prompt and returns candidate invariants tagged by class. Every AI-suggested invariant carries `InvariantSource::AiSuggested { model, prompt_version, timestamp_utc }` at the type level in Rust, and the developer reviews and accepts (or rejects) each one before it runs. The tag stays in the scorecard output. Two of the three reference findings below were AI-suggested and author-reviewed. One was hand-written. The point of the type-level tag is that a reviewer, a grant reader, or a downstream contributor can tell at a glance which invariants came from where. The disclosure is structural, not a banner.

## What's verifiable today

Three Cairo 2.x reference contracts sit on Starknet Sepolia, source-verified on Voyager. Each carries a planted bug on a distinct surface, and cf-invariants surfaces a counterexample on a single fuzz run for each:

```
ERC20Ref         0x01def8…b055b    conservation invariant violated, seed 42
Governance       0x066738…794e6    executed-state monotonicity violated, seed 7
SingleSideAmm    0x05351d…c81f8    constant-product solvency violated, seed 11
```

The deployment manifest (class hashes, declare/deploy tx hashes, Voyager links per contract) lives at [STARKNET_SEPOLIA_DEPLOYMENTS.md](https://github.com/caliperforge/cf-invariants-starknet/blob/main/STARKNET_SEPOLIA_DEPLOYMENTS.md). The full reproducible findings report — failing call sequences, relevant Cairo source lines, the cf-invariants scorecard for each contract, and a cross-check from a direct `snforge test` invocation — lives at [STARKNET_SEPOLIA_FINDINGS.md](https://github.com/caliperforge/cf-invariants-starknet/blob/main/STARKNET_SEPOLIA_FINDINGS.md). Everything reproduces from a clean clone at the pinned toolchain.

A representative invariant signature, lifted from the AMM suite:

```rust
#[invariant(
    class = "solvency",
    source = InvariantSource::AiSuggested {
        model: "claude-sonnet-4-6",
        prompt_version: "invariant_suggestion_v1",
        timestamp_utc: "2026-05-30T19:14:22Z",
    },
)]
fn k_does_not_decrease(state: &State) -> bool {
    state.reserve_a * state.reserve_b >= state.prev_k
}
```

The scorecard line for that run reads `1/1 invariants violated · seed=11 · counterexample: [mint(100), swap_a_for_b(40), swap_a_for_b(30)]`. The bug is one line of arithmetic in `swap_a_for_b` that ignores the current reserves. cf-invariants surfaces it on cold start.

## What's next

The honest open question is integration shape. cf-invariants today shells out to `snforge test` and parses its output. That is the conservative call: no fork, no namespace squat, no exclusivity. If the snforge maintainers would prefer a different shape (a structured runner API, a library entry point, a specific scorecard schema), I would rather refactor against their direction than guess. A focused upstream PR is a cleaner long-term landing spot than a documented sidecar pattern. That is the conversation I am trying to start on [issue #2464](https://github.com/foundry-rs/starknet-foundry/issues/2464).

Past that, there is more depth to add on Cairo before moving sideways. A richer set of canonical invariant classes. A properly versioned scorecard schema. Tighter integration with Voyager, so that surfaced counterexamples can be re-run against forked-Sepolia state. Move support (Sui, Aptos) is the next chain target after Cairo deepens. Solidity is already served by Foundry's `invariant`, Halmos, and Echidna, and there is no reason to add another tool there.

The long-game thesis is plain. There is currently no production-grade stateful invariant testing tool for Cairo 2.x. cf-invariants is the only one I am aware of, the field is unoccupied, and the maintainers' own roadmap names the gap. Three commitments make the bet real: keep shipping, keep the integration question open with the snforge team, keep the AI suggestion module honest about which invariants came from where. Inside two to three release cycles, this is the reference Cairo 2.x stateful invariant testing tool.

If you are a Cairo developer running into the same gap, the repo is at [github.com/caliperforge/cf-invariants-starknet](https://github.com/caliperforge/cf-invariants-starknet). The findings report is the fastest way to see what the tool does. The issue tracker is the right place to push back on anything in the design that does not fit your project.

— Michael Moffett

Full AI policy at [caliperforge.com/ai-disclosure](https://caliperforge.com/ai-disclosure).

---
title: Stateful invariant testing for Solana/Anchor — cf-invariants-anchor on Crucible
slug: cf-invariants-anchor-on-crucible
date: 2026-06-02
author: Michael Moffett
---

## The gap

Solana's Anchor framework has two open invariant-fuzzing harnesses: Asymmetric Research's [Crucible](https://github.com/asymmetric-research/crucible) (LibAFL + LiteSVM, Apache-2.0, v0.2.0) and Ackee Blockchain's [Trident](https://github.com/Ackee-Blockchain/trident). Both ship the execution rails. Generate calldata that matches an Anchor IDL, drive it through LiteSVM, surface a crash if something panics or fails an assertion. That part is good. What neither tool addresses is *what to assert*. The invariants you actually want fuzzed against a vault program (conservation, monotonic accounting, no-unauthorized-withdrawal) still come out of someone's head. The harness assumes you wrote them down.

The Cairo tool [cf-invariants](https://github.com/caliperforge/cf-invariants-starknet) targets the same gap on snforge. cf-invariants-anchor is the Anchor sibling. It ingests an Anchor IDL, proposes ranked candidate invariants from a class library, and emits a ready-to-run Crucible `#[fuzz_fixture]` + `#[invariant_test]` source file. Phase 0 ships one class: `balance_conservation`. Monotonicity, access-control, and oracle-freshness are queued. cf-invariants-anchor does not rebuild Crucible. Crucible stays the execution engine. cf-invariants-anchor is the authoring layer that sits on top of it.

## What we built

[github.com/caliperforge/cf-invariants-anchor](https://github.com/caliperforge/cf-invariants-anchor) is public today, Apache-2.0. A Cargo workspace of five Rust crates: an Anchor IDL parser, a candidate-invariant suggester with an extensible `ClassRegistry`, an emit pipeline that renders Crucible-compatible fuzz source, a scorecard renderer, and the CLI front. Phase 0 ships the heuristic suggester path. The Phase 1 AI suggester (Anthropic Claude against a versioned prompt, mirroring the cf-invariants Cairo design) is the next milestone. Every AI-suggested invariant will carry source provenance at the type level: `model`, `prompt_version`, `timestamp_utc`. Same disclosure shape as the Cairo tool. A reviewer or downstream contributor can read off where any given invariant came from at the point of the run.

The repo carries two reference Anchor programs. `vault_ref` is the clean variant. `vault_ref_planted` carries a deliberate off-by-one on the conservation surface: `withdraw` transfers `amount` lamports but decrements `vault.amount` by `amount - 1`. The emitted balance-conservation invariant catches the drift in a 2-action sequence.

## What's verifiable today

This is the first CaliperForge build-to-win artifact proven by CI, not by hand. The workflow at [`.github/workflows/ci.yml`](https://github.com/caliperforge/cf-invariants-anchor/blob/main/.github/workflows/ci.yml) builds the workspace, builds both reference programs via `cargo build-sbf`, and runs the Crucible v0.2.0 harness against each on every push. The assertions are unambiguous:

- `vault_ref_clean`: **0 invariants violated.**
- `vault_ref_planted`: **≥1 invariant violated** — the bookkeeping drift surfaces inside the 30-second Crucible timeout.

The real captured outputs from the green run on 2026-06-02 are committed at [`findings/vault_ref_clean/scorecard.md`](https://github.com/caliperforge/cf-invariants-anchor/blob/main/findings/vault_ref_clean/scorecard.md) and [`findings/vault_ref_planted/scorecard.md`](https://github.com/caliperforge/cf-invariants-anchor/blob/main/findings/vault_ref_planted/scorecard.md). The `.expected.{json,md}` siblings stay in the tree as the authored reference. The unsuffixed files are what CI captured. Pinned toolchain: rustc 1.96.0, Solana CLI 2.1.21, Solana platform-tools v1.52, Crucible v0.2.0 (anchor-lang 1.0.1).

For local reproduction: clone the repo, clone Crucible to a sibling directory (the fuzz `Cargo.toml`s use a path dep), install the pinned Solana CLI, and run [`scripts/run_phase0_harness.sh`](https://github.com/caliperforge/cf-invariants-anchor/blob/main/scripts/run_phase0_harness.sh). The script wraps the same `cargo build-sbf` and `crucible run` calls CI uses. The README's "Pinned toolchain" section is the version authority; the `.tool-versions` file is informational.

One thing worth saying plainly: this took four CI runs to go green. The first failed on a `cargo-build-sbf` toolchain pin — platform-tools v1.52 is required because Crucible v0.2.0's deps need edition2024, which earlier platform-tools' rustc 1.84 cannot build. The second failed on a real `anchor-lang` 1.0.x `CpiContext` API drift: code that read correctly against the docs I had been working from did not compile against the version Crucible v0.2.0 actually pins. The third failed on a `use`-glob ambiguity. The fourth went green.

That arc is why the standing rule on every CaliperForge artifact is CI-green-is-the-only-proof. Under verified-by-reading-the-code, the anchor-lang API drift would have shipped as a published-but-unbuilt artifact. With CI as the gate, the failures stayed inside the cloud, the pins got corrected, and what is public today actually builds and runs.

## What's next

The Cairo build was the proof of concept. cf-invariants-anchor is the second VM. A Move target (Sui, Aptos) is queued behind Phase 1 here. The cross-VM thesis is that the invariant-authoring layer generalizes: the class library (`balance_conservation`, monotonicity, access-control, oracle-freshness) is the same across VMs even when the execution engines underneath (snforge, Crucible, Move Prover plumbing) differ. Two VMs running in CI is not yet evidence the thesis holds. Three would be more interesting. The honest claim today is that the second VM is public, runs in CI on every push, and surfaces a planted bug end-to-end.

The Phase 1 milestone here is turning on the AI suggester path against the versioned prompt, with `InvariantSource::AiSuggested { model, prompt_version, timestamp_utc }` tagging in the emitted source. That is the next visible commit cluster. Trident as a second emit target follows. None of that is shipped today. What is shipped is the Crucible seam, the two reference programs, and the green CI badge.

If you ship Anchor programs and find yourself writing the same conservation or monotonicity invariants by hand for each new contract, the repo is at [github.com/caliperforge/cf-invariants-anchor](https://github.com/caliperforge/cf-invariants-anchor). The CI badge tells you whether the artifact builds today. Issues and PRs are open.

— Michael Moffett

Built with AI assistance; AI-suggested invariants are tagged in source. Full policy at [caliperforge.com/ai-disclosure](https://caliperforge.com/ai-disclosure).

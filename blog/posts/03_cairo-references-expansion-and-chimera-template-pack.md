---
title: Build update — cf-invariants Cairo suite grows to nine, chimera-template-pack ships
slug: cairo-references-expansion-and-chimera-template-pack
date: 2026-06-02
author: Michael Moffett
---

## Two ships, one cadence

Two CaliperForge builds went out this week that haven't been written up yet. Both are infrastructure for the security-tooling line we've been working on, and both showed up on the public repos before this writeup did, which is the order we prefer. This is the writeup — what shipped, where it lives, and what each one makes cheaper next.

## cf-invariants Cairo references — six to nine

The cf-invariants reference suite on Starknet Sepolia grew from six contracts to nine. Three new references landed under `references/`: [`lending_ref`](https://github.com/caliperforge/cf-invariants-starknet/tree/main/references/lending_ref), [`staking_ref`](https://github.com/caliperforge/cf-invariants-starknet/tree/main/references/staking_ref), and [`vesting_ref`](https://github.com/caliperforge/cf-invariants-starknet/tree/main/references/vesting_ref). Same shape as the earlier six: a minimal Cairo 2.x contract, one deliberately planted bug, one detecting invariant, an snforge test driver, an expected scorecard, and a Voyager-source-verified deployment on Starknet Sepolia.

The point of the suite is what each contract teaches the invariant-authoring layer. Each new reference targets a distinct bug class that hadn't been covered by the first six:

- **`lending_ref` — per-user solvency under LTV.** A minimal single-asset lending market. The planted bug is that `withdraw_collateral` decrements the borrower's balance but skips the post-withdraw LTV re-check, so a borrower can deposit, borrow up to the cap, then withdraw collateral down to zero. The detecting invariant is `debt_of[a] * 10_000 <= collateral_of[a] * ltv_bps` for every borrower at every step. snforge catches it on the first fuzz sequence that lands a `borrow → withdraw_collateral` pair crossing the LTV threshold. Deployed at [`0x0627…7c52`](https://sepolia.voyager.online/contract/0x0627b8abe3b11a2593fc5204f9b86868ff00789b7cc090c3d3e3bfcf58c57c52), Voyager-source-verified.

- **`staking_ref` — multi-pool conservation under slashing.** A staking vault with a slashing-escheat path. The planted bug is that `slash(victim)` zeros the victim's stake and decrements `total_staked` but never credits `slashed_pool`, so the slashed amount vanishes from accounting. The detecting invariant sums across both pools (`total_staked + slashed_pool == sum(stakes) − sum(unstakes) − sum(slashed_withdrawals)`), a structurally different shape from the single-pool ERC-20 conservation finding. Deployed at [`0x014e…4e09`](https://sepolia.voyager.online/contract/0x014e72228c8aa95e5aad34fdcb00186d335e6f96c3ed4c6c632b85e9aaea4e09).

- **`vesting_ref` — time-bounded supply cap.** A linear-vesting contract. The planted bug is that `claim()` pays out `total_grant − claimed` unconditionally instead of releasing against `vested_at(now)`, so the first pre-`end_ts` claim drives `claimed > vested_at(now)`. The detecting invariant is `claimed() <= vested_at(t)` for every observable timestamp, and the driver exercises it by advancing `cheat_block_timestamp` across the schedule. This is the first reference in the suite where the right-hand side of the invariant is a function of time rather than a fixed accounting identity. Deployed at [`0x0325…bd38`](https://sepolia.voyager.online/contract/0x032537f261a271e4ccf0ac0e90e41c0f994f9efda69baaa5b66d055b4a0abd38).

The full deployment manifest — class hashes, declare and deploy tx hashes, constructor calldata, and Voyager source-verification job IDs for all nine contracts — is at [`STARKNET_SEPOLIA_DEPLOYMENTS.md`](https://github.com/caliperforge/cf-invariants-starknet/blob/main/STARKNET_SEPOLIA_DEPLOYMENTS.md). The findings writeup with reproduction commands is at [`STARKNET_SEPOLIA_FINDINGS.md`](https://github.com/caliperforge/cf-invariants-starknet/blob/main/STARKNET_SEPOLIA_FINDINGS.md). The three new invariants were proposed by the in-house Cairo Specialist agent and accepted by the contract author before inclusion, per the standing AI disclosure.

## chimera-template-pack — Foundry + Recon Chimera scaffold

The second ship is [`chimera-template-pack`](https://github.com/caliperforge/chimera-template-pack), a GitHub-template repo for stamping out CaliperForge contest entries. It is a Foundry project pre-wired for [Recon's Chimera](https://github.com/Recon-Fuzz/create-chimera-app) stateful-fuzz pattern (Echidna + Medusa), with three seeded invariants — solvency, monotonic share price, access-control — each marked with a `TODO(protocol)` edit point in `test/recon/Properties.sol`. A bundled CI workflow runs the campaign on every push and captures ANSI-stripped scorecards into `findings/<invariant>/scorecard.{json,md}`.

The reason this is worth shipping as a template is the cycle-time delta. Standing up the same harness ad-hoc for a Cantina or Code4rena entry has been running roughly five days of focused work. Forking the template runs about two days. That is not a launch claim — it is the difference between writing the Foundry config, the Echidna config, the Medusa config, the campaign runner, the scorecard capture script, and the CI workflow from scratch versus filling in three `TODO(protocol)` blocks. The scaffold is Apache-2.0; the six-step usage checklist is in [`USAGE.md`](https://github.com/caliperforge/chimera-template-pack/blob/main/USAGE.md). Recon's create-chimera-app is the upstream pattern this template tracks, cited as such in the README.

## The throughline

We hold both of these under the same lens we have been describing as specialization velocity — how quickly the org can stand a new-chain or new-tooling-class specialist up and ship a CI-verified artifact. The Cairo suite expansion is the inside-the-tool version: three new invariant classes, three Voyager-source-verified deployments, a snforge driver per contract, captured in CI, in a day. The chimera-template-pack is the outside-the-tool version: future contest-entry artifacts cost roughly two days instead of five.

Neither is a launch, and neither is a tool-count claim. The throughline is the cadence — an org that ships verified security tooling fast, with the proof checked into public CI rather than asserted in a deck. Both repos are public if you want to check the cadence against the commit history.

— Michael Moffett

Built with AI assistance; AI-suggested invariants are tagged in source. Full policy at [caliperforge.com/ai-disclosure](https://caliperforge.com/ai-disclosure).

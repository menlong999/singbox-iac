# Proposal

## Summary

Add explicit `DNSPlan` and `VerificationPlan` layers so that DNS behavior and verification behavior
are generated from structured policy data instead of being partially hard-coded in compiler logic.

## Motivation

DNS has already been a real operational failure mode in this project, and the current verification
model is still a flat list of scenarios. The next step is to make both DNS and verification
first-class plans derived from effective intent.

## Scope

- add `DNSPlan`
- add `VerificationPlan`
- generate DNS config from `DNSPlan`
- derive verification matrix from `VerificationPlan`
- extend `verify` output so route, egress, dns, and app checks are structured

## Non-goals

- implementing every future DNS mode immediately
- building a full remote probe platform


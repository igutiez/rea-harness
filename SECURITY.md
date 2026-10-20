# Security policy

## Reporting a vulnerability

Use GitHub's private reporting, which is enabled on this repository:

**[Report a vulnerability](https://github.com/igutiez/rea-harness/security/advisories/new)** — or
Security → Advisories → Report a vulnerability.

That channel is private between you and the maintainer. Please use it instead of a public issue for
anything you think is exploitable. If you are not sure whether something qualifies, use it anyway;
a false alarm costs nothing and a public zero-day costs everyone.

A useful report says what you did, what happened, and what you expected. A reproduction beats a
description. You do not need a proof of concept, a CVSS score or a suggested patch.

**What to expect:** a first reply within a few days, and a fix released as a normal patch version
once it exists. This is a private, unfunded project, so there is no bug bounty and no SLA.

## What this repository is, so scope is not a guess

`rea-harness` is a local command-line tool. It installs skill content into an AI assistant's
directories, writes hooks the assistant runs on your machine, keeps session records under `.rsc/`,
and — only with `--with-rea` — delegates an MCP registration to REA's own `rea setup`. It has no
server, no account and no network service of its own.

The interesting attack surface is where **someone else's input reaches your machine or your
assistant**:

- **`.rsc.json`** travels through git, so anyone who can open a pull request can write it, and parts
  of it are read back into the model's context. Validation escapes and injected text count.
- **Hooks** are wired into your assistant's settings and run commands. A path that lets a repository
  decide those commands is a real finding.
- **Session records and memory** hold your work. A read from a project, worktree or scope that should
  not see them counts, and so does a write where they were not meant to go.
- **Skill and agent content** is injected into the model's context. Prose that makes the assistant
  act against the user's intent is in scope.
- **The installer** writes into directories you share with your own work. Overwriting or deleting
  what the harness did not create is a finding, whether or not it is exploitable.
- **The REA registration** writes user-level assistant configuration (`~/.claude.json`,
  `~/.codex/config.toml`, `$DSH_HOME/cordis.patch.yml`, …). A path that escapes the project root, a
  symlink followed out of it, or a registration that survives an explicit refusal counts. The
  registration is delegated to `rea setup --skill=false`; a defect in REA's own client writers is a
  finding for the REA project, not for this harness.
- **Artifact analysis** reads untrusted files. A parser, decompiler or provider escape belongs to
  REA or to that provider; report it upstream. What belongs here is the harness boundary: never
  executing a target from the installer, never widening a declared runtime action, and never
  presenting an inference as an observation.

Out of scope: the assistants themselves (report those to their vendors), REA's MCP server and
providers (report to [morluto/rea](https://github.com/morluto/rea)), npm registry or GitHub
infrastructure, and anything that needs an attacker who already has your shell.

## Before you report a guard

The harness guards (commit conventions, dangerous-command denial, branch discipline) **fail open on
purpose** and each one has a documented per-project switch. That is a design decision, written down,
not an oversight: a guard that guesses is a guard that gets turned off, and a harness that blocks
real work gets uninstalled. "The guard can be bypassed" is only a finding if the bypass makes the
guard claim it is armed while it is not — that one we do want to hear about.

## Responsible use of REA

REA analyzes artifacts. Use it only on targets you own or are explicitly authorized to inspect. The
harness does not grant authorization, does not execute an untrusted target on your behalf, and does
not relax REA's provider or runtime boundaries. Reports that amount to "this tool can inspect a
binary" are not vulnerabilities.

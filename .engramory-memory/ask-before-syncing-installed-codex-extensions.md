---
name: Ask before syncing installed Codex extensions
description: Prompt the user to update installed Codex counterparts after committing Skill, MCP, or tool changes
type: project
created: 2026-07-31
updated: 2026-07-31
---

After successfully committing changes to a Skill, MCP server, or tool maintained in Azusa, ask the user whether the corresponding installed item in Codex should be updated. A source commit does not imply that the installed copy has been synchronized.

Do not update or overwrite the installed Codex item until the user confirms, unless the same request already explicitly instructs the agent to perform that update.

Why: Azusa contains source copies of reusable Codex capabilities, while Codex may run separate installed copies that otherwise become stale after repository changes.

How to apply: After the commit succeeds, identify whether the changed capability has a corresponding Codex installation and ask a concise synchronization question. If the user agrees, compare source and installed paths, update the installed copy using the appropriate installer or documented workflow, and verify that the copies match.

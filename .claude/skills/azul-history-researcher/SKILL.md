---
name: azul-history-researcher
description: This skill should be used when the user asks to "find more history events for Azul", "run the history researcher", "add timeline entries", "search for Azul events", "improve existing entries", "run azul-history-researcher", or wants to research, scrape or expand historical events about the city and Partido de Azul, Buenos Aires, Argentina.
---

# Azul History Researcher

Run the `azul-history-researcher` agent to find, verify, and persist new historical events about the Partido de Azul as Markdown timeline entries.

## How to invoke

Dispatch the agent using the Agent tool with `subagent_type: general-purpose`, embedding the full system prompt from the agent file. The agent file lives at:

`.claude/agents/azul-history-researcher.md`

## Invocation template

Read the agent file first, then launch it:

1. Read `.claude/agents/azul-history-researcher.md` to get the full system prompt
2. Launch with:

```
Agent({
  description: "Azul history research session",
  subagent_type: "general-purpose",
  prompt: "<full content of the agent file body> \n\n## Task\n<user's specific request, or 'find new events and improve existing ones' if none given>"
})
```

## What the agent does

- Inventories the current timeline directory (`gedcom-analyzer/src/test/resources/timeline/history/`)
- Mines anniversary articles ("50 años de...", "100 aniversario de...") in local media
- Fetches all known primary sources (Wikipedia, Hemeroteca de Azul, IFDT 156 PDF, etc.)
- Runs targeted searches for known-important topics (Salamone, molinos, town foundings, industries, floods, clubs, etc.)
- Deduplicates against existing files before writing
- Writes one `.md` file per new event
- **Self-updates the agent file** — rebuilds the "Existing entries" list and appends any new domain knowledge discovered
- Reports a table: filename · year · title · source

## Output location

All timeline `.md` files go to: `gedcom-analyzer/src/test/resources/timeline/history/`

## Notes

- Never invent or guess month/day — only set dates confirmed by a source
- Salidores.com is a secondary aggregator; always try to find the original source first
- When in doubt, include the event — it's better to have too many entries for human review than to miss history
- The agent self-improves: after each run it rewrites its own "Existing entries" list so the next run starts with an accurate inventory

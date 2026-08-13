@AGENTS.md

# Commands
- typecheck: npm run typecheck
- lint: npm run lint
- build: npm run build
- test: npm test
- dev: npm run dev

# Workflow rules
- IMPORTANT: max 3 attempts at any single failing error. Then STOP and report
  what you tried, the exact error text, and 2 suspected causes. Never retry the
  same approach repeatedly.
- YOU MUST show real command output as evidence before calling a task done.
- Never edit files outside the scope of the current task.
- Never add a dependency, mock data, or a placeholder API response without asking.
- If a network/install command fails, report the blocked domain and stop. Do not
  retry more than twice.
- Currency in this project is Afghani (AFN) only. Never introduce "$", USD
  formatting, or any exchange-rate API. Amounts are entered manually by admin.
- No third-party carrier tracking (DHL, FedEx, AfterShip). Tracking is internal.
- When compacting, preserve TASKS.md progress and the list of modified files.

# Frontend
- This is an operations tool. Clarity and scan-speed beat decoration.
- Avoid generic AI-template aesthetics: no Inter/Roboto/system-font defaults, no
  purple gradients, no three-identical-rounded-cards hero layouts.
- Reuse existing components before creating new ones. One source of truth for
  spacing, color and type — no one-off inline styles.

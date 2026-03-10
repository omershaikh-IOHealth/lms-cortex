# Team_Task_Guide.md

# How We Work with Tasks

**Healthcare Automation Team — Internal Reference**
* * *

## 1\. The Three Rules

*   **One place only.** Every task lives in ClickUp — in the _All Automation Tasks_ list. If it is not in ClickUp, it does not exist.
*   **Update your status, not just comments.** Moving the task to the correct status is how the manager sees progress. A comment buried in the thread does not count.
*   **Fill the fields before you start.** Priority, Due Date, Healthcare Domain, Automation Tool, and R&D checkbox must all be set before a task moves to In Progress.
* * *

## 2\. Task Statuses

| Status | What it means |
| ---| --- |
| Backlog | Task exists but not started. Not yet assigned. |
| Scoped | Fields complete, ready to be picked up. |
| In Progress | You are actively working on it right now. |
| In Review | Work done, handed off for feedback or approval. |
| Blocked | Cannot proceed. Fill Blocked Reason immediately. |
| Testing | Deployed and being validated in test environment. |
| Done | Complete, tested, and signed off. Nothing left. |

> **⚠️ When you go Blocked:** Fill the Blocked Reason field immediately and tag the manager in a comment. A task should never sit in Blocked for more than 24 hours without a resolution plan.
* * *

## 3\. Fields

| Field | What to fill in |
| ---| --- |
| Assignee | Your name. Set when the task is created. |
| Start Date | The date of initiation. Set on the parent task and on each subtask. |
| Due Date | The deadline. Set on the parent task and on each subtask. |
| Priority | Urgent / High / Normal / Low |
| Healthcare Domain | Clinical Operations, RCM/Billing, Insurance, Patient Onboarding, Internal/HR, Compliance, Cross-Domain |
| Task Complexity | Simple (1 Day) / Medium (2-3 Days) / Complex (1 Week+) / Epic (1 Month+) |
| R&D | Checkbox — tick if the task is exploratory/experimental. Leave unchecked for standard delivery. |
| Automation Tool | n8n or Other |
| Relevant Product | Cortex, Optima, Super App, Other, Not Applicable |
| Project Relation | Saudi German, MedGulf, Burjeel Hospital, Claritev, Not Applicable |
| Blocked Reason | One sentence. Fill only when status = Blocked. |

> **ℹ️ Assignee, Start Date and Due Date are built-in fields** — they already exist on every task. Set a due date on subtasks too, not just the parent task.
* * *

## 4\. Priority

| Level | When to use it | What it means for you |
| ---| ---| --- |
| 🔴 Urgent | Production broken or client cannot proceed | Drop everything. Start within the hour. |
| 🟠 High | Must ship this sprint | Work on this after Urgent items. Do not defer without manager approval. |
| 🟡 Normal | Standard delivery work | The default. Work in due-date order. |
| ⚪ Low | Nice to have | Pick up during slack time. Can be deferred. |

> **Priority ≠ Complexity.** A task can be Urgent and Simple (1 day), or Low priority but Epic (1 month). ClickUp auto-escalates to Urgent if the due date is within 48 hours and priority has not been updated — so set due dates accurately.
* * *

## 5\. Phasing Long Tasks

For **Complex (1 Week+) and Epic (1 Month+)** work, break the project into **separate parent tasks — one per phase**. Each phase task is a full task in its own right, with its own due date, assignee, priority, status, and fields. You set a personal deadline per phase and manage them independently. The project never appears as a single task that has been "In Progress" for weeks.

If a project starts with unknowns — feasibility questions, architecture decisions, or model experiments — that work is **Phase 0**, an R&D task (R&D checkbox checked) that runs before any delivery phase begins. Phase 0 has its own deadline and closes with a Go/Pivot/Pause/Handoff outcome. Only when Phase 0 closes as Go does Phase 1 activate.

| \[Phase 0\] MedGulf Prescription Intake — R&D & Feasibility → due 27 Feb — Nadjib — In Progress ☑ R&D |  |
| ---| --- |
| \[Phase 1\] MedGulf Prescription Intake — Discovery & Scoping → due 3 Mar — Nadjib — In Progress |  |
| \[Phase 2\] MedGulf Prescription Intake — Build & Integration → due 14 Mar — Nadjib/Salah — Scoped |  |
| \[Phase 3\] MedGulf Prescription Intake — Testing & Handoff → due 18 Mar — Salah — Scoped |  |

Phase 0 is the only task with R&D checked. When it closes with a Go outcome, mark it Done and activate Phase 1. Each downstream phase has its own deadline you set independently.
**Link the phases using task dependencies:** Open Phase 1 → Link tasks → "Waiting on" → select Phase 0. Repeat for each subsequent phase. ClickUp surfaces dependent tasks in the dependency chain until the preceding phase is marked Done.

**Link the phases using task dependencies:** Open Phase 2 → Link tasks → "Waiting on" → select Phase 1. Repeat for Phase 3 waiting on Phase 2. ClickUp surfaces dependent tasks in the dependency chain.

### **How many phases?**

| Complexity | Suggested phases |
| ---| --- |
| Complex (1 Week+) | 2–3 — e.g. Discovery → Build → Testing |
| Epic (1 Month+) | 3–4 — e.g. Discovery → Build → Integration → Testing & Handoff |
| Simple / Medium | No phases needed |

**Naming convention:** `[Phase N] Project name — Phase label`

> **Phase 0 is optional.** Only create it if the project genuinely starts with unknowns. Don't force R&D onto work where the approach is already clear.

## 6\. Parent Tasks and Subtasks

| Level | Type | Use it for |
| ---| ---| --- |
| Level 1 | Parent Task | The full deliverable. All fields filled. Final deadline lives here. |
| Level 2 | Subtask | A specific phase or component. Has its own assignee, due date, and priority. |
| Level 3 | Checklist item | Small steps inside a subtask, under 15 minutes each. No assignee or status needed. |

**Maximum two levels deep — no sub-subtasks.** If you feel you need a sub-subtask, it belongs in the checklist of the subtask above it.

### Subtask vs new task

| Create a subtask when... | Create a new task when... |
| ---| --- |
| It is part of the same deliverable | It is a separate initiative that could stand alone |
| It needs its own assignee or deadline | It has a different domain, product, or client |
| Completing it moves the parent forward | It will be delivered in a different sprint |
| It blocks or depends on other subtasks | It came from a completely separate request |

* * *

## 7\. R&D Tasks

The **R&D checkbox** flags that a task is in an exploratory or experimental phase — not standard delivery. Any task in any domain can enter R&D mode.

| R&D = Checked ✓ | R&D = Unchecked |
| ---| --- |
| Exploratory phase. Outcome is unknown. Success means learning, not necessarily a shipped feature. Use for spikes, proof-of-concepts, and model experiments. | Standard delivery. The approach is known, the output is defined, there is a clear definition of done. |

### Rules

*   **All standard fields still apply.** R&D work is still time-boxed and owned by someone. Priority, Due Date, Domain, and Project Relation must be filled.
*   **Every R&D task must have a due date.** When it arrives, the assignee presents findings — even if the finding is "this approach doesn't work."
*   **Different Definition of Done.** Before marking an R&D task Done, post a comment with one of these outcomes:

| Outcome | Meaning |
| ---| --- |
| Go | Approach validated. Converting to a delivery task. |
| Pivot | This path doesn't work. Next experiment: \[describe\]. |
| Pause | Deprioritised. Documented here for future reference. |
| Handoff | Findings ready. Assigning to \[name\] for delivery. |

*   **When R&D (Phase 0) converts to delivery:** mark Phase 0 as Done with a Go comment. Then activate Phase 1 — move it from Scoped to In Progress and set its due date. Phase 1 retains its dependency on Phase 0 so the full R&D history stays one click away. Do not rename or repurpose the Phase 0 task.

**Naming convention:** Prefix R&D task names with `Spike:` or `R&D:` so they are identifiable in any view without a filter.
Spike: LangGraph multi-agent routing for Cortex prescription intake
R&D: LoRA fine-tuning feasibility on MedGulf clinical notes
* * *

## 8\. Day-to-Day Routine

### Every morning

1. Open **Blocked** / **At Risk** view first. Address anything there before starting new work.
2. Check the **Team Board**. Anything in In Progress for 5+ days without movement needs a status update.
3. Work through your queue: **Urgent → High → Normal**, then by nearest due date within each level.

### When you start a task

1. Move it from Scoped → **In Progress**.
2. Confirm all fields are filled. Do not start an incomplete task.
3. If the task is Complex (1 Week+) or Epic (1 Month+), create separate phase tasks before you begin — each with its own due date, assignee, and dependency link to the previous phase. If the project has unknowns, create a Phase 0 R&D task first.
4. When you finish a phase, mark that phase task Done — the next phase task will automatically move to Scoped and the next assignee will be notified.

### When you finish a task

1. Move it to **In Review** and tag the reviewer in a comment with a brief handoff note.
2. Do not mark it Done yourself unless you are also the reviewer.
3. All subtasks must be Done before the parent can move to In Review.

### When you get blocked

1. Move the task to **Blocked** immediately.
2. Fill the **Blocked Reason** field.
3. Tag the manager in a comment. Do not wait until standup.

> The manager reads the board — not Google Chat messages or WhatsApp.
* * *

## 9\. Quick Reference

**Before starting a task**

- [ ] Assignee is set
- [ ] Due Date is set (on task and subtasks)
- [ ] Priority is set
- [ ] Healthcare Domain is filled
- [ ] Automation Tool is filled
- [ ] Relevant Product is tagged
- [ ] Project Relation is tagged
- [ ] R&D checkbox ticked if exploratory
- [ ] Subtasks created if Complex (1 Week+) or Epic (1 Month+)
- [ ] Phase tasks created with dependencies if this is Complex or Epic work
- [ ] Phase 0 R&D task created first if the project has unknowns (R&D checkbox checked)

**Before marking Done**

- [ ] All subtasks are Done
- [ ] Reviewer has been tagged in a comment
- [ ] A brief handoff note has been left
- [ ] Status moved to In Review (not Done directly)
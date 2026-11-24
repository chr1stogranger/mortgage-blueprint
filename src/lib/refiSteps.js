// The refi step layout's steps, in order (Refi Hunter Phase 3). Shared by
// RefiSteps (the sticky bar) and OverviewTab (which sections each step shows).
// Qualifying (assets, debts, REO, income, pre-qual, equity) got its own step
// ahead of Review & send (Christo 2026-11-24).
export const REFI_STEPS = ["Current loan", "New loan", "Costs", "Qualifying", "Review & send"];
export const REFI_STEP_KEYS = ["current", "new", "costs", "qualify", "review"];

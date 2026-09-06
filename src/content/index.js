// Lazy entry points for the tab content modules. Both MortgageBlueprint.jsx
// and OverviewTab.jsx import from here so Rollup can split each tab into its
// own chunk instead of bundling all 15 into the main index chunk.
import { lazyWithRetry } from "../lib/lazyWithRetry.js";

export const SetupContent = lazyWithRetry(() => import("./SetupContent"));
export const IncomeContent = lazyWithRetry(() => import("./IncomeContent"));
export const AssetsContent = lazyWithRetry(() => import("./AssetsContent"));
export const DebtsContent = lazyWithRetry(() => import("./DebtsContent"));
export const ReoContent = lazyWithRetry(() => import("./ReoContent"));
export const AmortContent = lazyWithRetry(() => import("./AmortContent"));
export const SellContent = lazyWithRetry(() => import("./SellContent"));
export const RentVsBuyContent = lazyWithRetry(() => import("./RentVsBuyContent"));
export const InvestContent = lazyWithRetry(() => import("./InvestContent"));
export const CostsContent = lazyWithRetry(() => import("./CostsContent"));
export const CalculatorContent = lazyWithRetry(() => import("./CalculatorContent"));
export const QualifyContent = lazyWithRetry(() => import("./QualifyContent"));
export const TaxContent = lazyWithRetry(() => import("./TaxContent"));
export const Prop19Content = lazyWithRetry(() => import("./Prop19Content"));
export const TeamContent = lazyWithRetry(() => import("./TeamContent"));

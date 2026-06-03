// src/lib/devPropCheck.js
//
// Dev-only guard for the "curated props object drift" bug class (CIO audit H-4).
//
// Every content component (SetupContent, CalculatorContent, ...) receives its
// props from TWO hand-maintained supply sites in MortgageBlueprint.jsx:
//   1. its standalone `{tab === "..."}` render site (a curated object literal)
//   2. the giant `<OverviewTab {...{...}}>` block, re-spread to all children
// A prop added to one site but not the other compiles fine and then silently
// renders `undefined` in production (React #130 — this crashed the 2026-06-01
// deploy). The build can't catch it because the props are runtime object
// literals.
//
// This check runs in DEV ONLY (call sites are wrapped in
// `if (import.meta.env.DEV)`, which Vite replaces with `if (false)` in
// production builds, so the whole call is dead-code-eliminated — zero prod
// cost). It compares the props a component DECLARES (its destructured
// parameters without default values) against the keys actually PASSED, and
// logs a loud console.error naming the missing ones.
//
// Props with default values (`foo = null`) are treated as optional and are
// not checked — a default means the component is designed to work without it.

export function devCheckProps(componentName, props, required) {
  if (!props || typeof props !== "object") {
    console.error(`[PropCheck] <${componentName}> rendered with no props object at all.`);
    return;
  }
  const missing = required.filter((k) => !(k in props));
  if (missing.length > 0) {
    console.error(
      `[PropCheck] <${componentName}> is missing prop(s): ${missing.join(", ")}.\n` +
      `Check BOTH supply sites in MortgageBlueprint.jsx — the standalone ` +
      `{tab === "..."} render site AND the <OverviewTab {...{...}}> block ` +
      `(~line 5280). A prop present in only one of them works on one tab and ` +
      `crashes/blanks on the other (React #130).`
    );
  }
}

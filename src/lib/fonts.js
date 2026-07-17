// src/lib/fonts.js
//
// RealStack Brand Kit font tokens — single in-repo source of truth.
// (Same hybrid system as loan-pipeline, adopted for Blueprint 2026-07-17.)
//
// FONT — Inter, everything including numeric/financial data. Digit alignment
//        comes from `font-variant-numeric: tabular-nums` (global, index.css),
//        never from a monospaced face.
// MONO — Geist Mono, used ONLY for uppercase labels / overlines / NMLS
//        accents. JetBrains Mono is retired; it survives solely as a
//        last-resort fallback in the stack below.

export const FONT = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
export const MONO = "'Geist Mono', 'SF Mono', 'JetBrains Mono', monospace";

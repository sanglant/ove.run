// Auto-generated TypeScript types from Rust via ts-rs.
// Source: src-tauri/bindings/
// Do not edit the bindings directly — regenerate with `cargo test` in src-tauri.
//
// Not all generated bindings are re-exported here. Types with shape mismatches
// that the frontend resolves differently are kept as manual definitions in index.ts:
//   - TrustLevel: frontend uses 1 | 2 | 3 (numeric), generated uses string variant names
//   - ArbiterStateRow: depends on generated TrustLevel, kept as ArbiterState in index.ts
//   - AgentSettings/AppSettings: env_vars is Record<string,string> (not optional values)
//   - Project, ContextUnit, Memory, Story: generated uses plain string for typed union fields

export type { AgentType } from "../../src-tauri/bindings/AgentType";
export type { AgentStatus } from "../../src-tauri/bindings/AgentStatus";
export type { GlobalSettings } from "../../src-tauri/bindings/GlobalSettings";
export type { Consolidation } from "../../src-tauri/bindings/Consolidation";
export type { QualityGateConfig } from "../../src-tauri/bindings/QualityGateConfig";

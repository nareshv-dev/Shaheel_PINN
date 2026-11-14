# Acceptance Test Report

| Test | Result | Evidence / limitation |
|---|---|---|
| Assign fault to any cell | Pass by implementation | 100-cell selector and grid drop target |
| Playback survives navigation | Pass by architecture | Engine is owned by `AppInner`, not a page |
| Mechanism-specific what-if state | Pass by implementation | Derived values include temperature, voltage, resistance, SOH, stress and concentration |
| Multiple faults | Pass by implementation | Profiles are keyed by cell ID |
| Fault removal and reset | Pass by implementation | Explicit callbacks restore saved baseline |
| Scenario/S6 mapping | Pass by implementation | Exact stable IDs and base relationships |
| Early-warning claims | Pass | Early Warning removed; anomaly detection remains retrospective |
| Frontend build | Pass | TypeScript and Vite build completed |
| Browser interaction replay | Unavailable | Playwright browser executable is not installed in the environment |

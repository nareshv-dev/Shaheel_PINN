# Simulation Engine

The application-level engine lives in `frontend/src/App.tsx`, above route
components. It owns the selected scenario, selected cell, fault profiles,
simulation clock, playback status, active fault cells, derived pack cells, and
simulation events. Route changes do not unmount this state.

Each tick starts from the saved reference pack and applies only active
interactive profiles. This prevents cumulative drift and keeps saved research
data separate from what-if values. Thermal, voltage, resistance, capacity,
mechanical-stress, and concentration deviations are explicitly labelled
illustrative values.

Reset removes interactive profiles, restores the saved reference values, clears
the clock, and records a reset event. B1/B3 future-SOH inference and predictive
early-warning metrics remain disabled.

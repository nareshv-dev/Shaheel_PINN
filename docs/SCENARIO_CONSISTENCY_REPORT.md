# Scenario Consistency Report

## Authoritative mapping

The application uses `data/demo/demo_scenario_instances.json` for stable
`scenario_instance_id` records. Each record supplies the scenario family,
declared fault cells, split, and (for S6 records) the base S5 instance and
candidate charge rate.

The selected instance is shared through `AppState`. The displayed pack
metadata, grid, 3D twin, cell inspection, anomaly view, early-warning view,
and intervention view all use that selected instance.

## S6 relationship

S6 intervention records are linked by `scenario_instance_id` when an S6
candidate is selected, or by `base_scenario` when its S5 source scenario is
selected. Unrelated intervention groups are not combined with the selected
scenario.

The pack snapshot remains a saved reference snapshot. When a different
scenario is selected, its stable metadata and declared fault flags are mapped
onto the reference values; the interface does not claim that a new PyBaMM
simulation was executed.

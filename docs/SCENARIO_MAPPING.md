# Scenario Mapping

`data/demo/demo_scenario_instances.json` is the authoritative runtime mapping
for stable scenario instance IDs, scenario family, declared fault cells, split,
and S6 base/candidate relationships.

S6 intervention rows are selected by exact `scenario_instance_id` for an S6
instance, or by exact `base_scenario` when an S5 source instance is selected.
The UI never selects an intervention group from a display label or an
unrelated benchmark.

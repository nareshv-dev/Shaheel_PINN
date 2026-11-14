# Fault Injection Guide

Fault Injection Studio is an **Interactive What-If** demonstration. It is a
deterministic state-transition model and does not execute a new PyBaMM solve or
PINN inference.

Select any cell, choose a mechanism, configure severity, threshold, start time,
and duration, then assign the profile. A fault marker can also be dragged onto
any cell in the 10x10 grid. Start, pause, resume, and reset control playback.

The saved research snapshot is retained separately from the interactive state.
Reset restores the saved values. Multiple cells can hold independent
configurations; assigning a second profile to the same cell replaces its
previous interactive profile.

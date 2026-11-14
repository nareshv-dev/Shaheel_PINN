# Authoritative Scientific Protocol (Source of Truth)

Extracted programmatically from user context and project files.

- **Required Models:**
  1. Data-only baseline (pure data-driven neural network, physics-informed residuals = 0).
  2. Prior-style PINN (bulk diffusion & thermal equation residuals integrated into loss function).
  3. Proposed PC-MP-PINN (Incorporating coordinate transformation and Cheng-Verbrugge spherical linear-elastic analytical stress equations).
- **Training-label Budget:** Exactly 300 samples total per training condition.
- **Random Seeds:** 11, 22, 33.
- **Held-out Test Conditions:** Constant discharge rate of 1.25C under 20.0°C and 32.5°C ambient temperatures.

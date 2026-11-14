"""BatteryPINN — multi-physics PINN core.

Ported from PINN_EV_Battery_MultiPhysics.ipynb (Team 23, KPR IET).
Single trunk network: inputs (r~, t~, C-rate, T_amb) -> outputs (c~, T, sigma_r, sigma_theta).
Hard-constrained initial/boundary conditions are built into the output algebra,
not penalised in the loss.
"""
import torch
import torch.nn as nn
import numpy as np

DTYPE = torch.float32
DTS = 50.0       # temperature reference scale [K]
SIG = 20.0e6     # stress reference scale [Pa]


class BatteryPINN(nn.Module):
    def __init__(self, hidden, depth, activation, const, cr_lo, cr_hi, ta_lo, ta_hi):
        super().__init__()
        act = {"tanh": nn.Tanh, "silu": nn.SiLU, "gelu": nn.GELU}[activation]
        dims = [4] + [hidden] * depth + [4]
        layers = []
        for i in range(len(dims) - 1):
            layers.append(nn.Linear(dims[i], dims[i + 1]))
            if i < len(dims) - 2:
                layers.append(act())
        self.net = nn.Sequential(*layers)
        for m in self.net:
            if isinstance(m, nn.Linear):
                nn.init.xavier_normal_(m.weight, gain=1.0)
                nn.init.zeros_(m.bias)

        reg = lambda n, v: self.register_buffer(
            n, torch.tensor(np.asarray(v, dtype=np.float64).reshape(-1, 1), dtype=DTYPE))
        reg("c0n",    const["c0n"])
        reg("T_amb",  const["T_amb"])
        reg("alpha",  const["alpha"])
        reg("flux",   const["flux"])
        reg("rho_cp", const["rho_cp"])
        reg("t_end",  const["t_end"])
        self.register_buffer("qgrid", torch.tensor(const["qgrid"], dtype=DTYPE))
        reg("cr_s", 2.0 * (const["c_rate"] - cr_lo) / max(cr_hi - cr_lo, 1e-9) - 1.0)
        reg("ta_s", 2.0 * (const["T_amb_C"] - ta_lo) / max(ta_hi - ta_lo, 1e-9) - 1.0)
        # adaptive loss weights: pde_c, bc_sym, bc_flux, pde_T, pde_m, data
        self.log_s = nn.Parameter(torch.zeros(6))

    def forward(self, r, t, k):
        x = torch.cat([2.0 * r - 1.0, 2.0 * t - 1.0, self.cr_s[k], self.ta_s[k]], dim=1)
        o = self.net(x)
        c  = self.c0n[k] + t * o[:, 0:1]
        T  = self.T_amb[k] + DTS * t * o[:, 1:2]
        sr = SIG * (1.0 - r) * o[:, 2:3]
        st = SIG * o[:, 3:4]
        return c, T, sr, st

    def q_gen(self, t, k):
        g = self.qgrid[k]
        n = g.shape[1]
        x = t.clamp(0.0, 1.0) * (n - 1)
        i0 = x.floor().long().clamp(0, n - 2)
        w = x - i0.to(x.dtype)
        q0 = torch.gather(g, 1, i0)
        q1 = torch.gather(g, 1, i0 + 1)
        return q0 * (1.0 - w) + q1 * w

    def forward_continuous(self, r, t, cr_scaled, ta_scaled, c0n, T_amb_K):
        """Deployment-time forward pass: continuous (cr, T_amb) instead of a
        discrete training-condition index k. Used by the digital twin, which
        needs arbitrary per-cell operating points, not just the training grid."""
        x = torch.cat([2.0 * r - 1.0, 2.0 * t - 1.0, cr_scaled, ta_scaled], dim=1)
        o = self.net(x)
        c  = c0n + t * o[:, 0:1]
        T  = T_amb_K + DTS * t * o[:, 1:2]
        sr = SIG * (1.0 - r) * o[:, 2:3]
        st = SIG * o[:, 3:4]
        return c, T, sr, st


def d(y, x):
    return torch.autograd.grad(y, x, torch.ones_like(y), create_graph=True)[0]


def residuals(model, T_, hAV, eps_r=1e-4):
    r, t, k = T_["col_r"], T_["col_t"], T_["col_k"]
    c, Temp, sr, st = model(r, t, k)
    c_t  = d(c, t)
    c_r  = d(c, r)
    c_rr = d(c_r, r)
    L_pde_c = ((c_t - model.alpha[k] * (c_rr + 2.0 / (r + eps_r) * c_r)) ** 2).mean()

    T_t = d(Temp, t)
    dTdt = T_t / model.t_end[k]
    q = model.q_gen(t, k)
    norm = model.rho_cp[k] * DTS / model.t_end[k]
    res_T = (model.rho_cp[k] * dTdt - q + hAV * (Temp - model.T_amb[k])) / norm
    L_pde_T = (res_T ** 2).mean() + ((d(Temp, r) / DTS) ** 2).mean()

    sr_r = d(sr, r)
    L_pde_m = (((sr_r + 2.0 / (r + eps_r) * (sr - st)) / SIG) ** 2).mean()

    c0, *_ = model(T_["b0_r"], T_["b0_t"], T_["b0_k"])
    L_bc_sym = (d(c0, T_["b0_r"]) ** 2).mean()

    cR, *_ = model(T_["bR_r"], T_["bR_t"], T_["bR_k"])
    L_bc_flux = ((d(cR, T_["bR_r"]) - model.flux[T_["bR_k"]]) ** 2).mean()

    dc, dT, dsr, dst = model(T_["d_r"], T_["d_t"], T_["d_k"])
    L_data = (((dc - T_["d_c"]) ** 2).mean()
              + (((dT - model.T_amb[T_["d_k"]]) / DTS - T_["d_T"]) ** 2).mean()
              + ((dsr / SIG - T_["d_sr"]) ** 2).mean()
              + ((dst / SIG - T_["d_st"]) ** 2).mean())

    return dict(pde_c=L_pde_c, bc_sym=L_bc_sym, bc_flux=L_bc_flux,
                pde_T=L_pde_T, pde_m=L_pde_m, data=L_data)


LOSS_KEYS = ["pde_c", "bc_sym", "bc_flux", "pde_T", "pde_m", "data"]


def total_loss(model, T_, hAV, adaptive=True):
    parts = residuals(model, T_, hAV)
    if adaptive:
        tot = sum(torch.exp(-model.log_s[i]) * parts[k] + model.log_s[i]
                  for i, k in enumerate(LOSS_KEYS))
    else:
        w = torch.exp(-model.log_s.detach())
        tot = sum(w[i] * parts[k] for i, k in enumerate(LOSS_KEYS))
    return tot, parts

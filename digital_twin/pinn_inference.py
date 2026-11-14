"""Deployment-only inference wrapper for the trained BatteryPINN.

No PyBaMM dependency. Takes continuous (C-rate, T_amb) per call instead of a
discrete training-condition index, so it can serve ANY virtual cell the digital
twin invents -- including degraded cell 37 running at an off-nominal effective
C-rate. This is the module a real BMS would embed.
"""
import os, json
import numpy as np
import torch
import torch.nn as nn

HERE = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.path.join(HERE, "model")


class PINNInference:
    def __init__(self, model_dir=MODEL_DIR):
        with open(os.path.join(model_dir, "inference_config.json")) as f:
            self.cfg = json.load(f)
        c = self.cfg
        act = {"tanh": nn.Tanh, "silu": nn.SiLU, "gelu": nn.GELU}[c["activation"]]
        dims = [4] + [c["hidden"]] * c["depth"] + [4]
        layers = []
        for i in range(len(dims) - 1):
            layers.append(nn.Linear(dims[i], dims[i + 1]))
            if i < len(dims) - 2:
                layers.append(act())
        self.net = nn.Sequential(*layers)
        state = torch.load(os.path.join(model_dir, "pinn_weights.pt"), map_location="cpu")
        self.net.load_state_dict(state)
        self.net.eval()

        self.DTS = c["DTS"]
        self.SIG = c["SIG"]
        self.CR_LO, self.CR_HI = c["CR_LO"], c["CR_HI"]
        self.TA_LO, self.TA_HI = c["TA_LO"], c["TA_HI"]
        self.Rp = c["Rp"]
        self.c_max = c["c_max"]
        self.c0n_mean = c["c0n_mean"]

    @torch.no_grad()
    def predict(self, r_norm, t_norm, c_rate, T_amb_C):
        """r_norm, t_norm: scalars or 1-D arrays (broadcastable).
        c_rate, T_amb_C: scalars (one operating point per call).
        Returns dict of physical fields, same shape as r_norm/t_norm."""
        r_norm = np.atleast_1d(np.asarray(r_norm, dtype=np.float32))
        t_norm = np.atleast_1d(np.asarray(t_norm, dtype=np.float32))
        n = max(len(r_norm), len(t_norm))
        r_norm = np.broadcast_to(r_norm, (n,))
        t_norm = np.broadcast_to(t_norm, (n,))

        cr_s = 2.0 * (np.clip(c_rate, self.CR_LO, self.CR_HI) - self.CR_LO) / max(self.CR_HI - self.CR_LO, 1e-9) - 1.0
        ta_s = 2.0 * (np.clip(T_amb_C, self.TA_LO, self.TA_HI) - self.TA_LO) / max(self.TA_HI - self.TA_LO, 1e-9) - 1.0

        r_t = torch.tensor(r_norm).reshape(-1, 1)
        t_t = torch.tensor(t_norm).reshape(-1, 1)
        cr_t = torch.full_like(r_t, float(cr_s))
        ta_t = torch.full_like(r_t, float(ta_s))

        x = torch.cat([2.0 * r_t - 1.0, 2.0 * t_t - 1.0, cr_t, ta_t], dim=1)
        o = self.net(x)

        T_amb_K = T_amb_C + 273.15
        c_tilde = self.c0n_mean + t_t * o[:, 0:1]
        T = T_amb_K + self.DTS * t_t * o[:, 1:2]
        sigma_r = self.SIG * (1.0 - r_t) * o[:, 2:3]
        sigma_t = self.SIG * o[:, 3:4]

        return dict(
            c_norm=c_tilde.numpy().ravel(),
            c_mol_m3=(c_tilde * self.c_max).numpy().ravel(),
            T_K=T.numpy().ravel(),
            T_C=(T - 273.15).numpy().ravel(),
            sigma_r_MPa=(sigma_r / 1e6).numpy().ravel(),
            sigma_t_MPa=(sigma_t / 1e6).numpy().ravel(),
        )

    @torch.no_grad()
    def predict_cell_state(self, t_norm, c_rate, T_amb_C):
        """Convenience: scalar-time snapshot at the particle surface (r=1) and
        centre (r=0), which is what the pack dashboard actually displays."""
        out_surface = self.predict(1.0, t_norm, c_rate, T_amb_C)
        out_centre = self.predict(0.0, t_norm, c_rate, T_amb_C)
        return dict(
            c_surface_norm=float(out_surface["c_norm"][0]),
            c_centre_norm=float(out_centre["c_norm"][0]),
            T_C=float(out_surface["T_C"][0]),
            sigma_r_MPa=float(out_centre["sigma_r_MPa"][0]),   # max at centre
            sigma_t_MPa=float(out_surface["sigma_t_MPa"][0]),  # max at surface
        )


_singleton = None


def load_model():
    global _singleton
    if _singleton is None:
        _singleton = PINNInference()
    return _singleton

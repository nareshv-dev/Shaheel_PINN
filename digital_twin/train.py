"""Train the multi-physics BatteryPINN on the existing PyBaMM-generated dataset
(unified_dataset_candidate_v1.csv) and export a deployment-ready checkpoint for
the real-time digital twin.

This reuses the already-generated 45,360-row dataset (no need to re-run the full
PyBaMM sweep) but DOES call PyBaMM to pull the real Chen2020 physical/mechanical
parameters and to re-solve each of the 21 operating conditions for the metadata
(jn, rho_cp) the physics residual needs -- i.e. the PyBaMM half of the pipeline
really runs, it just doesn't re-write the dataset that's already on disk.
"""
import os, sys, json, time, warnings
warnings.filterwarnings("ignore")
import numpy as np
import pandas as pd
import torch

sys.path.insert(0, os.path.dirname(__file__))
from pinn_core import BatteryPINN, total_loss, LOSS_KEYS, DTS, SIG

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
CSV_PATH = os.path.join(ROOT, "unified_dataset_candidate_v1.csv")
MODEL_DIR = os.path.join(HERE, "model")
os.makedirs(MODEL_DIR, exist_ok=True)

SEED = 42
np.random.seed(SEED)
torch.manual_seed(SEED)
torch.set_default_dtype(torch.float32)
DEVICE = torch.device("cpu")

HIDDEN, DEPTH, ACTIVATION = 96, 4, "tanh"
N_COLLOCATION, N_BOUNDARY, N_DATA = 700, 150, 220   # per training condition, CPU-scaled
ADAM_EPOCHS, ADAM_LR = 2200, 1.5e-3
LBFGS_ITERS = 250
NQ = 90  # heat-source table resolution, matches n_t in the data


def log(msg):
    print(f"[train] {msg}", flush=True)


def build_pybamm_parameters():
    import pybamm
    pv = pybamm.ParameterValues("Chen2020")
    P = dict(
        Rp=float(pv["Negative particle radius [m]"]),
        Ds=float(pv["Negative particle diffusivity [m2.s-1]"]),
        c_max=float(pv["Maximum concentration in negative electrode [mol.m-3]"]),
        h=float(pv["Total heat transfer coefficient [W.m-2.K-1]"]),
        A_cool=float(pv["Cell cooling surface area [m2]"]),
        V_cell=float(pv["Cell volume [m3]"]),
        Q_cell=float(pv["Nominal cell capacity [A.h]"]),
        Omega=3.497e-6, E_mod=15.0e9, nu=0.30,
    )
    P["hAV"] = P["h"] * P["A_cool"] / P["V_cell"]
    P["K_mech"] = P["Omega"] * P["E_mod"] / (3.0 * (1.0 - P["nu"]))
    F_CONST = 96485.33212
    return pv, P, F_CONST


def resolve_condition_metadata(pv, c_rate, T_amb_C, voltage_cutoff=2.5):
    """Re-solve one PyBaMM condition to recover jn and rho_cp for the physics
    residual (these aren't stored in the flat training CSV)."""
    import pybamm
    T_amb = T_amb_C + 273.15
    pvc = pv.copy()
    pvc.update({"Ambient temperature [K]": T_amb, "Initial temperature [K]": T_amb})
    model = pybamm.lithium_ion.SPMe(options={"thermal": "lumped"})
    exp = pybamm.Experiment([f"Discharge at {c_rate}C until {voltage_cutoff}V"])
    sol = pybamm.Simulation(model, parameter_values=pvc, experiment=exp).solve()
    t_end = float(sol["Time [s]"].entries[-1])
    jn = float(np.mean(sol["X-averaged negative electrode interfacial current density [A.m-2]"].entries))
    rho_cp = float(np.asarray(sol["Volume-averaged effective heat capacity [J.K-1.m-3]"](t=[0.0])).ravel()[0])
    q = np.asarray(sol["Volume-averaged total heating [W.m-3]"](t=np.linspace(0, t_end, NQ))).ravel()
    return t_end, jn, rho_cp, q


def main():
    t0 = time.time()
    log(f"loading dataset: {CSV_PATH}")
    data = pd.read_csv(CSV_PATH)
    log(f"rows={len(data):,}  conditions={data.cond_id.nunique()}")

    log("loading PyBaMM Chen2020 parameter set ...")
    pv, PARAMS, F_CONST = build_pybamm_parameters()

    cond_rows = (data.groupby("cond_id")
                 .agg(split=("split", "first"), c_rate=("c_rate", "first"),
                      T_amb_C=("T_amb_C", "first"), c0_norm=("c_norm", "first"))
                 .reset_index())
    K = len(cond_rows)
    log(f"re-solving {K} PyBaMM conditions for jn / rho_cp metadata ...")

    t_end_arr = np.zeros(K); jn_arr = np.zeros(K); rho_cp_arr = np.zeros(K)
    qgrid = np.zeros((K, NQ))
    for i, row in cond_rows.iterrows():
        t_end, jn, rho_cp, q = resolve_condition_metadata(pv, row.c_rate, row.T_amb_C)
        t_end_arr[i] = t_end; jn_arr[i] = jn; rho_cp_arr[i] = rho_cp
        qgrid[i] = q
        log(f"  cond {int(row.cond_id):2d}  {row.c_rate:>4}C @ {row.T_amb_C:>4.0f}C  "
            f"t_end={t_end:6.0f}s  jn={jn:8.2f}  rho_cp={rho_cp:10.0f}")

    CONST = dict(
        t_end=t_end_arr,
        jn=jn_arr,
        c0n=cond_rows.c0_norm.values,
        T_amb=cond_rows.T_amb_C.values + 273.15,
        rho_cp=rho_cp_arr,
        c_rate=cond_rows.c_rate.values,
        T_amb_C=cond_rows.T_amb_C.values,
        qgrid=qgrid,
    )
    CONST["alpha"] = PARAMS["Ds"] * CONST["t_end"] / PARAMS["Rp"] ** 2
    CONST["flux"] = -CONST["jn"] * PARAMS["Rp"] / (PARAMS["Ds"] * F_CONST * PARAMS["c_max"])

    tr_mask = (cond_rows.split == "train").values
    CR_LO, CR_HI = float(cond_rows.c_rate[tr_mask].min()), float(cond_rows.c_rate[tr_mask].max())
    TA_LO, TA_HI = float(cond_rows.T_amb_C[tr_mask].min()), float(cond_rows.T_amb_C[tr_mask].max())
    log(f"input scaling (train split): C-rate [{CR_LO},{CR_HI}]  T_amb [{TA_LO},{TA_HI}]C")

    # ---- collocation + labelled tensors (train split only) -----------------
    rng = np.random.default_rng(SEED)
    train_ids = cond_rows[cond_rows.split == "train"].cond_id.values

    def latin_hypercube(n, dim):
        out = np.empty((n, dim))
        for dd in range(dim):
            cuts = (np.arange(n) + rng.random(n)) / n
            out[:, dd] = rng.permutation(cuts)
        return out

    rt, kt = [], []
    for cid in train_ids:
        s = latin_hypercube(N_COLLOCATION, 2)
        s[:, 0] = 1e-3 + s[:, 0] * (1.0 - 1e-3)
        rt.append(s); kt.append(np.full(N_COLLOCATION, cid))
    col_rt = np.vstack(rt); col_k = np.concatenate(kt)

    b0_t = np.vstack([latin_hypercube(N_BOUNDARY, 1) for _ in train_ids])
    b0_k = np.concatenate([np.full(N_BOUNDARY, c) for c in train_ids])
    bR_t, bR_k = b0_t.copy(), b0_k.copy()

    frames = []
    for cid in train_ids:
        s = data[data.cond_id == cid]
        frames.append(s.sample(n=min(N_DATA, len(s)), random_state=int(SEED + cid)))
    dat = pd.concat(frames, ignore_index=True)

    T = lambda a, grad=False: torch.tensor(
        np.asarray(a, dtype=np.float64).reshape(-1, 1), dtype=torch.float32,
        device=DEVICE, requires_grad=grad)
    Ki = lambda a: torch.tensor(np.asarray(a, dtype=np.int64), dtype=torch.long, device=DEVICE)

    TENSORS = dict(
        col_r=T(col_rt[:, 0], True), col_t=T(col_rt[:, 1], True), col_k=Ki(col_k),
        b0_r=T(np.zeros(len(b0_t)), True), b0_t=T(b0_t[:, 0], True), b0_k=Ki(b0_k),
        bR_r=T(np.ones(len(bR_t)), True), bR_t=T(bR_t[:, 0], True), bR_k=Ki(bR_k),
        d_r=T(dat.r_norm.values), d_t=T(dat.t_norm.values), d_k=Ki(dat.cond_id.values),
        d_c=T(dat.c_norm.values), d_T=T(dat.T_rise_K.values / DTS),
        d_sr=T(dat.sigma_r_MPa.values * 1e6 / SIG), d_st=T(dat.sigma_t_MPa.values * 1e6 / SIG),
    )
    log(f"collocation points: {len(TENSORS['col_r']):,} interior, "
        f"{len(TENSORS['b0_r']):,} per boundary, {len(TENSORS['d_r']):,} labelled")

    model = BatteryPINN(HIDDEN, DEPTH, ACTIVATION, CONST, CR_LO, CR_HI, TA_LO, TA_HI).to(DEVICE)
    n_par = sum(p.numel() for p in model.parameters() if p.requires_grad)
    log(f"architecture 4 -> {' -> '.join([str(HIDDEN)]*DEPTH)} -> 4 ({ACTIVATION})  "
        f"{n_par:,} trainable params")

    # ---- stage 1: Adam + cosine annealing -----------------------------------
    opt = torch.optim.Adam(model.parameters(), lr=ADAM_LR)
    sched = torch.optim.lr_scheduler.CosineAnnealingLR(opt, T_max=ADAM_EPOCHS)
    log(f"stage 1 — Adam, {ADAM_EPOCHS} epochs")
    for epoch in range(ADAM_EPOCHS):
        opt.zero_grad()
        loss, parts = total_loss(model, TENSORS, PARAMS["hAV"], adaptive=True)
        loss.backward()
        opt.step()
        sched.step()
        if epoch % 200 == 0 or epoch == ADAM_EPOCHS - 1:
            comp = "  ".join(f"{k}={v.item():.2e}" for k, v in parts.items())
            log(f"  epoch {epoch:5d}  loss={loss.item():.4e}  {comp}")

    # ---- stage 2: L-BFGS (weights frozen) -----------------------------------
    log(f"stage 2 — L-BFGS, {LBFGS_ITERS} iterations")
    opt2 = torch.optim.LBFGS(model.parameters(), lr=1.0, max_iter=LBFGS_ITERS,
                              line_search_fn="strong_wolfe", history_size=50,
                              tolerance_grad=1e-9, tolerance_change=1e-12)

    def closure():
        opt2.zero_grad()
        loss, _ = total_loss(model, TENSORS, PARAMS["hAV"], adaptive=False)
        loss.backward()
        return loss

    opt2.step(closure)
    final_loss, final_parts = total_loss(model, TENSORS, PARAMS["hAV"], adaptive=False)
    log(f"final loss={final_loss.item():.4e}  "
        + "  ".join(f"{k}={v.item():.2e}" for k, v in final_parts.items()))

    # ---- quick held-out sanity check ----------------------------------------
    test_ids = cond_rows[cond_rows.split == "test"].cond_id.values
    if len(test_ids):
        sub = data[data.cond_id.isin(test_ids)]
        with torch.no_grad():
            rr = T(sub.r_norm.values); tt = T(sub.t_norm.values); kk = Ki(sub.cond_id.values)
            c_hat, T_hat, sr_hat, st_hat = model(rr, tt, kk)
        c_true = sub.c_norm.values
        rel_l2 = float(np.linalg.norm(c_hat.numpy().ravel() - c_true) / np.linalg.norm(c_true))
        log(f"held-out TEST concentration relative L2 = {rel_l2:.4f} "
            f"({'OK' if rel_l2 < 0.05 else 'check'})")

    # ---- export deployment checkpoint ---------------------------------------
    torch.save(model.net.state_dict(), os.path.join(MODEL_DIR, "pinn_weights.pt"))
    cfg = dict(
        hidden=HIDDEN, depth=DEPTH, activation=ACTIVATION,
        DTS=DTS, SIG=SIG,
        CR_LO=CR_LO, CR_HI=CR_HI, TA_LO=TA_LO, TA_HI=TA_HI,
        Rp=PARAMS["Rp"], c_max=PARAMS["c_max"], hAV=PARAMS["hAV"],
        c0n_mean=float(cond_rows.c0_norm.mean()),
        trained_at=time.strftime("%Y-%m-%d %H:%M:%S"),
        held_out_rel_l2=rel_l2 if len(test_ids) else None,
        n_params=n_par,
    )
    with open(os.path.join(MODEL_DIR, "inference_config.json"), "w") as f:
        json.dump(cfg, f, indent=2)
    log(f"saved {MODEL_DIR}/pinn_weights.pt and inference_config.json")
    log(f"done in {time.time()-t0:.1f}s")


if __name__ == "__main__":
    main()

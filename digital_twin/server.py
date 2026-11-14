"""Flask server for the PINN battery pack digital twin.

Serves the static dashboard and a small REST API backed by the live
SimulationEngine. The engine runs continuously in its own thread; this server
only ever reads its current state, so the simulation keeps advancing in real
time whether or not a browser is polling it.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS

from simulation_engine import get_engine
from pack_config import SCENARIOS

HERE = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(HERE, "static")

app = Flask(__name__, static_folder=STATIC_DIR, static_url_path="")
CORS(app)
engine = get_engine()


@app.route("/")
def index():
    return send_from_directory(STATIC_DIR, "index.html")


@app.route("/api/snapshot")
def api_snapshot():
    return jsonify(engine.snapshot())


@app.route("/api/history/<int:cell_id>")
def api_history(cell_id):
    return jsonify(dict(cell_id=cell_id, points=engine.cell_history(cell_id)))


@app.route("/api/events")
def api_events():
    return jsonify(dict(events=engine.event_log()))


@app.route("/api/scenarios")
def api_scenarios():
    return jsonify({k: dict(name=v["name"], description=v["description"],
                             intervention=v["intervention"])
                     for k, v in SCENARIOS.items()})


@app.route("/api/control", methods=["POST"])
def api_control():
    body = request.get_json(force=True, silent=True) or {}
    if "scenario" in body:
        engine.set_scenario(body["scenario"])
    if "running" in body:
        engine.set_running(bool(body["running"]))
    if "speed" in body:
        engine.set_speed(body["speed"])
    if body.get("reset"):
        engine.reset()
    return jsonify(dict(ok=True))


if __name__ == "__main__":
    print("PINN Battery Pack Digital Twin")
    print("  dashboard : http://127.0.0.1:5057/")
    print("  api       : http://127.0.0.1:5057/api/snapshot")
    app.run(host="127.0.0.1", port=5057, debug=False, threaded=True)

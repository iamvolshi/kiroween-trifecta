"""Runs the REAL Rosie agent code (feat/rosie-agent c329444) with a fixed folder instead of the native
picker (a native dialog cannot be clicked by a script). usage: rosie_agent_run.py <rosie_pkg_dir> <base> <code> <home> <folder>"""
import sys
sys.path.insert(0, sys.argv[1])
from pathlib import Path
from rosie_agent.agent import Rosie
from rosie_agent.config import State

pkg, base, code, home, folder = sys.argv[1:6]
r = Rosie(base, State(Path(home)), lambda: folder, say=lambda m: print("Rosie:", m, flush=True))
r.pair(code)
try:
    r.run()
except Exception as e:  # unpaired by the app ends the loop
    print("Rosie stopped:", type(e).__name__, flush=True)

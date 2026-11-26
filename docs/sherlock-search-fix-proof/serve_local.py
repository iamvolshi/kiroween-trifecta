import json, sys, uvicorn
from pathlib import Path
from fastapi.testclient import TestClient
from sherlock.api import create_app
I = Path(r"D:\kiroween-trifecta\_inputs\frankenstein")
app = create_app(case_store=Path(sys.argv[1]), static_dir=None)
with TestClient(app) as c:
    b = "/api/search"
    c.post(b + "/cases", json={"case_id": "frankenstein", "name": "frankenstein"})
    st = c.post(b + "/cases/frankenstein/load", json={"text": (I/"frankenstein.txt").read_text("utf-8-sig", errors="replace"), "filename": "frankenstein.txt", "k_record": json.loads((I/"k_record.json").read_text("utf-8"))}).json()
    print("loaded", {k: st[k] for k in ("entry_count","k_entry_count","ready")}, flush=True)
# loaded in-process; now serve the same app on a port
import threading
uvicorn.run(app, host="127.0.0.1", port=8090, log_level="warning")

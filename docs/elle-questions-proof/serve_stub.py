"""Proof only: the real bots connector, booted with a STUB judge and a STUB
reasoner (test doubles, never a live model), so the Lessons page can show
question folders before a live ELLE route holds a candidate.

    python serve_stub.py <bots checkout> <data dir> <port>

The judge holds every candidate GRAY. The reasoner answers each sealed
section with a fixed, labelled stub block. Every value the page shows still
comes from the connector: GET /questions over the real KATIE record.
"""
from __future__ import annotations

import re
import sys
from http.server import ThreadingHTTPServer
from pathlib import Path

bots, data, port = Path(sys.argv[1]), Path(sys.argv[2]), int(sys.argv[3])
sys.path.insert(0, str(bots))

from bot import connector as conn  # noqa: E402
from bot.config import Route  # noqa: E402
from bot.persona import load_cartridge  # noqa: E402

STATES = ["suspicion", "opinion", "consideration"]
REQUESTS: list[str] = []


def stub_judge(text: str, rule: str) -> str:
    return "GRAY"


def stub_reasoner(request: str) -> str:
    REQUESTS.append(request)
    out = []
    for i, sid in enumerate(re.findall(r"^=== SECTION (q\d+) ===$", request, re.M)):
        out += [
            f"=== {sid} ===",
            f"STATE: {STATES[i % len(STATES)]}",
            f"OBSERVATIONS: stub observation for {sid}",
            f"CONCERNS: stub concern for {sid}",
            f"SCRATCH PAD: stub scratch note for {sid}",
            f"IDEAS: stub idea for {sid}",
            f"=== END {sid} ===",
        ]
    return "\n".join(out)


persona = load_cartridge(bots / "cartridges" / "frankenstein.json")
route = Route(provider="stub", model="stub-model", api_key="stub", url="")
c = conn.boot_connector(persona, data, lambda *a: "Stub reply.", resolve=lambda m, r: route,
                        elle_judge=stub_judge, elle_reasoner=stub_reasoner)
for message in ("I love thunderstorms at night", "I hate cold coffee", "I prefer the book to the film"):
    c.chat({"message": message, "persona": "Frankenstein", "register": "book"})
(data / "reasoning-request.txt").write_text(c.questions()["reasoning"] or "", encoding="utf-8")
server = ThreadingHTTPServer(("127.0.0.1", port), conn.make_handler(c, "127.0.0.1"))
print(f"stub connector on http://127.0.0.1:{port}", flush=True)
server.serve_forever()

"""[CAPSTONE INTEGRATION TARGET] Exercise Plato's process and telemetry boundaries.

Offline fixtures are deliberately named ``fixture_*`` and never launch Electron.
Live MCP uses the official Python SDK over stdio, opt-in configuration, discovered
schemas, and finite deadlines. No tool names are assumed for an upstream adapter.
"""
from __future__ import annotations

import argparse
import asyncio
import copy
import json
import math
import os
from pathlib import Path
import re
import sys
import time
from typing import Any, Callable
import uuid

REQUEST_ID = re.compile(r"[A-Za-z0-9_-]{1,64}\Z")
SOURCE_ID = re.compile(r"[A-Za-z0-9_-]{1,40}\Z")
MAX_SAFE_INTEGER = 9_007_199_254_740_991


class ValidationError(ValueError):
    """The caller supplied an unsupported operation or malformed data."""


class LabTimeout(TimeoutError):
    """A bounded MCP operation did not complete before its deadline."""


def json_log(event: str, *, sink: Callable[[str], None] = print, **fields: Any) -> None:
    """Do not include payloads, credentials, or remote evaluation source in logs."""
    sink(json.dumps({"timestamp": time.time(), "event": event, **fields}, allow_nan=False))


def _exact(value: Any, keys: set[str], label: str) -> dict[str, Any]:
    if not isinstance(value, dict) or set(value) != keys:
        raise ValidationError(f"{label} requires exactly: {', '.join(sorted(keys))}")
    return value


def _identifier(value: Any, pattern: re.Pattern, label: str) -> None:
    if not isinstance(value, str) or pattern.fullmatch(value) is None:
        raise ValidationError(f"{label} contains unsupported characters or length")


def _number(value: Any, low: float, high: float, label: str, *, integer=False) -> None:
    valid_type = type(value) is int if integer else type(value) in (int, float)
    if not valid_type or not low <= value <= high or not math.isfinite(value):
        raise ValidationError(f"{label} must be finite in [{low}, {high}]")


def validate_request(payload: Any) -> dict[str, str]:
    _exact(payload, {"requestId"}, "snapshot request")
    _identifier(payload["requestId"], REQUEST_ID, "requestId")
    return dict(payload)


def validate_telemetry(packet: Any) -> dict[str, Any]:
    _exact(packet, {"version", "sequence", "timestamp", "source", "objects", "hardware"}, "telemetry")
    if type(packet["version"]) is not int or packet["version"] != 1:
        raise ValidationError("version must be integer 1")
    for key in ("sequence", "timestamp"):
        _number(packet[key], 0, MAX_SAFE_INTEGER, key, integer=True)
    _identifier(packet["source"], SOURCE_ID, "source")
    if not isinstance(packet["objects"], list) or len(packet["objects"]) > 64:
        raise ValidationError("objects must be an array of at most 64 tracks")
    seen = set()
    for track in packet["objects"]:
        _exact(track, {"id", "x", "y", "confidence"}, "track")
        _identifier(track["id"], SOURCE_ID, "track.id")
        if track["id"] in seen:
            raise ValidationError("track ids must be unique")
        seen.add(track["id"])
        for key in ("x", "y"):
            _number(track[key], -1, 1, key)
        _number(track["confidence"], 0, 1, "confidence")
    _exact(packet["hardware"], {"camera", "projector"}, "hardware")
    if any(status not in ("online", "offline") for status in packet["hardware"].values()):
        raise ValidationError("hardware values must be online or offline")
    return copy.deepcopy(packet)


def example_packet(*, sequence: int = 1) -> dict[str, Any]:
    return {"version": 1, "sequence": sequence, "timestamp": 1_700_000_000_000,
            "source": "touchdesigner", "objects": [
                {"id": "shadow-1", "x": .2, "y": -.3, "confidence": .95}],
            "hardware": {"camera": "online", "projector": "online"}}


class TelemetryFixture:
    """Clock-injected model; actual network/Electron proof requires the app tests."""
    def __init__(self, *, stale_after_ms: int = 1500, disconnected_after_ms: int = 5000):
        _number(stale_after_ms, 1, MAX_SAFE_INTEGER, "stale_after_ms", integer=True)
        _number(disconnected_after_ms, stale_after_ms, MAX_SAFE_INTEGER, "disconnected_after_ms", integer=True)
        self.stale_after_ms = stale_after_ms
        self.disconnected_after_ms = disconnected_after_ms
        self.packet: dict[str, Any] | None = None
        self.received_at: int | None = None
        self.sequences: dict[str, int] = {}
        self.rejected = 0
        self.connected = False
        self.transport: str | None = None

    def ingest(self, packet: Any, *, now_ms: int, transport: str = "ws") -> None:
        try:
            value = validate_telemetry(packet)
            _number(now_ms, 0, MAX_SAFE_INTEGER, "now_ms", integer=True)
            if transport not in ("ws", "osc"):
                raise ValidationError("transport must be ws or osc")
            source = value["source"]
            if value["sequence"] <= self.sequences.get(source, -1):
                raise ValidationError("sequence must increase for each source")
        except ValidationError:
            self.rejected += 1
            raise
        self.sequences.pop(source, None)
        self.sequences[source] = value["sequence"]
        if len(self.sequences) > 32:
            del self.sequences[next(iter(self.sequences))]
        self.packet, self.received_at = value, now_ms
        self.connected, self.transport = True, transport

    def disconnect(self) -> None:
        self.connected = False

    def snapshot(self, now_ms: int) -> dict[str, Any]:
        state = "disconnected"
        if self.connected and self.received_at is not None:
            age = max(0, now_ms - self.received_at)
            state = ("disconnected" if age > self.disconnected_after_ms else
                     "stale" if age > self.stale_after_ms else "live")
        return {"state": state, "telemetry": copy.deepcopy(self.packet),
                "transport": self.transport, "receivedAt": self.received_at,
                "rejected": self.rejected, "listeners": {"ws": "listening", "osc": "listening"}}


def failure(code: str, message: str) -> dict[str, Any]:
    return {"ok": False, "error": {"code": code, "message": message}}


async def invoke_snapshot(payload: Any, *, trusted: bool = True,
                          delay_seconds: float = 0, timeout_seconds: float = 2,
                          store: TelemetryFixture | None = None,
                          logger: Callable[[str], None] = print) -> dict[str, Any]:
    """Model Main authorization and caller deadline; this does not call Electron IPC.

    asyncio.wait_for cancels the local fixture. Real Electron invoke cannot cancel
    Main merely because preload stops awaiting it; handlers must bound their work.
    """
    correlation = str(uuid.uuid4())
    if not trusted:
        json_log("ipc.rejected", sink=logger, correlation=correlation, code="UNTRUSTED_SENDER")
        return failure("UNTRUSTED_SENDER", "Invoking frame is not the trusted application frame")
    try:
        request = validate_request(payload)
    except ValidationError as exc:
        json_log("ipc.rejected", sink=logger, correlation=correlation, code="INVALID_REQUEST")
        return failure("INVALID_REQUEST", str(exc))
    _number(timeout_seconds, .001, 30, "timeout_seconds")
    _number(delay_seconds, 0, 30, "delay_seconds")
    correlation = request["requestId"]
    json_log("ipc.invoke", sink=logger, correlation=correlation, channel="plato:snapshot")

    async def handle():
        await asyncio.sleep(delay_seconds)
        return (store or TelemetryFixture()).snapshot(int(time.time() * 1000))

    try:
        value = await asyncio.wait_for(handle(), timeout_seconds)
        json_log("ipc.resolve", sink=logger, correlation=correlation)
        return {"ok": True, "value": value}
    except TimeoutError:
        json_log("ipc.timeout", sink=logger, correlation=correlation, timeout_seconds=timeout_seconds)
        return failure("TIMEOUT", "Main did not respond before the caller deadline")
    except Exception:
        json_log("ipc.error", sink=logger, correlation=correlation, code="INTERNAL")
        return failure("INTERNAL", "Snapshot handler failed")


class OfflineMCP:
    """Synthetic tools for repeatable lessons, never upstream names or API claims."""
    def __init__(self):
        self.spawned = False
        self.title = "Plato"
        self.tools = [
            {"name": "fixture_spawn", "description": "Simulate an owned window",
             "inputSchema": {"type": "object", "properties": {"entry": {"type": "string"}},
                             "required": ["entry"], "additionalProperties": False}},
            {"name": "fixture_main", "description": "Inspect a simulated Main security policy",
             "inputSchema": {"type": "object", "properties": {}, "additionalProperties": False}},
            {"name": "fixture_renderer", "description": "Simulate textContent mutation",
             "inputSchema": {"type": "object", "properties": {"text": {"type": "string"}},
                             "required": ["text"], "additionalProperties": False}},
        ]

    async def list_tools(self):
        await asyncio.sleep(0)
        return copy.deepcopy(self.tools)

    async def call_tool(self, name, arguments):
        await asyncio.sleep(0)
        if name == "fixture_spawn":
            _exact(arguments, {"entry"}, "fixture_spawn")
            if not isinstance(arguments["entry"], str) or not arguments["entry"]:
                raise ValidationError("entry must be a nonempty string")
            self.spawned = True
            return {"mode": "offline-fixture", "process": "main", "windowId": 1,
                    "entry": arguments["entry"]}
        if not self.spawned:
            raise ValidationError("owned window must be spawned before inspection")
        if name == "fixture_main":
            _exact(arguments, set(), "fixture_main")
            return {"mode": "offline-fixture", "contextIsolation": True,
                    "nodeIntegration": False, "sandbox": True}
        if name == "fixture_renderer":
            _exact(arguments, {"text"}, "fixture_renderer")
            if not isinstance(arguments["text"], str) or len(arguments["text"]) > 500:
                raise ValidationError("text must be a string of at most 500 characters")
            self.title = arguments["text"]
            return {"mode": "offline-fixture", "textContent": self.title,
                    "nodeAvailable": False, "htmlExecuted": False}
        raise ValidationError("unknown fixture tool")


def _plain(value: Any) -> Any:
    return value.model_dump(mode="json", by_alias=True) if hasattr(value, "model_dump") else value


def validate_tool_arguments(arguments: dict[str, Any], schema: dict[str, Any]) -> None:
    """Validate a discovered schema without fetching schema URLs or echoing payloads."""
    def inspect(value):
        if isinstance(value, dict):
            for key, child in value.items():
                if key in ("$ref", "$dynamicRef") and (not isinstance(child, str) or not child.startswith("#")):
                    raise ValidationError("tool schema must be self-contained; external references are disabled")
                inspect(child)
        elif isinstance(value, list):
            for child in value:
                inspect(child)
    inspect(schema)
    try:
        from jsonschema.validators import validator_for
        from referencing import Registry
    except ImportError as exc:
        raise RuntimeError("Install requirements.txt to validate live inputSchema") from exc
    try:
        validator = validator_for(schema)
        validator.check_schema(schema)
        validator(schema, registry=Registry()).validate(arguments)
    except Exception as exc:
        raise ValidationError("arguments or discovered inputSchema are invalid; inspect them locally") from exc


class MCPBroker:
    """A session must discover names and schemas before making tool calls."""
    def __init__(self, session, *, timeout_seconds: float = 5,
                 logger: Callable[[str], None] = print):
        _number(timeout_seconds, .001, 30, "timeout_seconds")
        self.session, self.timeout_seconds, self.logger = session, timeout_seconds, logger
        self.catalog: dict[str, dict[str, Any]] = {}

    async def _bounded(self, event, operation, **fields):
        correlation = str(uuid.uuid4())
        json_log(f"{event}.start", sink=self.logger, correlation=correlation, **fields)
        try:
            result = await asyncio.wait_for(operation, self.timeout_seconds)
        except TimeoutError as exc:
            json_log(f"{event}.timeout", sink=self.logger, correlation=correlation,
                     timeout_seconds=self.timeout_seconds, **fields)
            raise LabTimeout(f"{event} exceeded {self.timeout_seconds}s") from exc
        except Exception as exc:
            json_log(f"{event}.error", sink=self.logger, correlation=correlation,
                     error_type=type(exc).__name__, **fields)
            raise
        json_log(f"{event}.success", sink=self.logger, correlation=correlation, **fields)
        return result

    async def discover(self):
        raw = await self._bounded("mcp.discover", self.session.list_tools())
        # The SDK returns ListToolsResult; fixtures return a plain list.
        rows = raw if isinstance(raw, list) else getattr(raw, "tools", None)
        if not isinstance(rows, list):
            raise ValidationError("list_tools returned no tool array")
        discovered = [_plain(row) for row in rows]
        catalog = {}
        for row in discovered:
            if not isinstance(row, dict) or not isinstance(row.get("name"), str) or not isinstance(row.get("inputSchema"), dict):
                raise ValidationError("invalid discovered tool declaration")
            if row["name"] in catalog:
                raise ValidationError("duplicate discovered tool name")
            catalog[row["name"]] = row
        self.catalog = catalog
        return discovered

    async def call(self, name: str, arguments: dict[str, Any]):
        if name not in self.catalog:
            raise ValidationError("tool must appear in list_tools before it can be called")
        if not isinstance(arguments, dict):
            raise ValidationError("tool arguments must be an object")
        if not isinstance(self.session, OfflineMCP):
            validate_tool_arguments(arguments, self.catalog[name]["inputSchema"])
        result = _plain(await self._bounded("mcp.call", self.session.call_tool(name, arguments), tool=name))
        if isinstance(result, dict) and result.get("isError"):
            json_log("mcp.call.rejected", sink=self.logger, tool=name)
            raise ValidationError("MCP tool returned isError; inspect the server's local diagnostic")
        return result


def load_live_config(path: str | Path) -> dict[str, Any]:
    config = json.loads(Path(path).read_text(encoding="utf-8"))
    if not isinstance(config, dict):
        raise ValidationError("MCP config must be an object")
    required = {"adapter", "command", "args", "timeout_seconds"}
    if not required <= set(config) or set(config) - required - {"capabilities"}:
        raise ValidationError("MCP config requires adapter, command, args, timeout_seconds; capabilities is optional")
    if config["adapter"] not in ("electron-driver", "laststance"):
        raise ValidationError("adapter must be electron-driver or laststance")
    if not isinstance(config["command"], str) or not config["command"]:
        raise ValidationError("command must be a reviewed executable path")
    if not isinstance(config["args"], list) or not all(isinstance(arg, str) for arg in config["args"]):
        raise ValidationError("args must be an array of strings, never a shell command string")
    _number(config["timeout_seconds"], .1, 30, "timeout_seconds")
    capabilities = config.get("capabilities", {})
    if not isinstance(capabilities, dict) or set(capabilities) - {"spawn", "main", "renderer", "stop"}:
        raise ValidationError("capabilities must select spawn/main/renderer/stop mappings")
    for role, call in capabilities.items():
        _exact(call, {"tool", "arguments"}, role)
        if not isinstance(call["tool"], str) or not isinstance(call["arguments"], dict):
            raise ValidationError(f"{role} requires a discovered tool name and arguments object")
    if config["adapter"] == "laststance" and set(capabilities) & {"spawn", "main", "stop"}:
        raise ValidationError("renderer CDP adapter cannot own a session or evaluate Electron Main")
    return config


async def live_mcp(config: dict[str, Any], *, discovery_only: bool = False) -> dict[str, Any]:
    """Opt-in privileged laboratory; adapter credentials stay in local environment.

    Configure an absolute executable + argv. SDK stdio transports are not HTTP
    /mcp endpoints. Caller-selected tools are reviewed against list_tools schemas.
    """
    if os.environ.get("VOLTFORGE_LIVE_MCP") != "1":
        raise ValidationError("live MCP requires VOLTFORGE_LIVE_MCP=1")
    try:
        from mcp import ClientSession, StdioServerParameters
        from mcp.client.stdio import stdio_client
    except ImportError as exc:
        raise RuntimeError("Install requirements.txt before using live MCP") from exc
    timeout = config["timeout_seconds"]
    parameters = StdioServerParameters(command=config["command"], args=config["args"])

    async def run():
        async with stdio_client(parameters) as (reader, writer):
            async with ClientSession(reader, writer) as session:
                broker = MCPBroker(session, timeout_seconds=timeout)
                await broker._bounded("mcp.initialize", session.initialize())
                catalog = await broker.discover()
                if discovery_only:
                    return {"mode": "live-discovery", "adapter": config["adapter"], "tools": catalog}
                calls = config.get("capabilities", {})
                required = {"spawn", "main", "renderer", "stop"} if config["adapter"] == "electron-driver" else {"renderer"}
                if not required <= set(calls):
                    raise ValidationError(f"Map discovered tools for: {', '.join(sorted(required))}")
                # Check every mapping before the first privileged operation.
                for call in calls.values():
                    if call["tool"] not in broker.catalog:
                        raise ValidationError("mapped tool missing from discovered catalog")
                    validate_tool_arguments(call["arguments"], broker.catalog[call["tool"]]["inputSchema"])
                results = {}
                owns_session = False
                try:
                    for role in ("spawn", "main", "renderer"):
                        if role in calls:
                            call = calls[role]
                            # A timed-out spawn may still launch remotely; cleanup remains necessary.
                            if role == "spawn":
                                owns_session = True
                            results[role] = await broker.call(call["tool"], call["arguments"])
                finally:
                    if owns_session:
                        call = calls["stop"]
                        results["stop"] = await broker.call(call["tool"], call["arguments"])
                return {"mode": "live", "adapter": config["adapter"], "results": results}

    try:
        # Cooperative deadline covers initialization/calls; SDK cancellation and
        # process cleanup can extend shutdown. Inspect/terminate a wedged owned
        # Windows session manually; this is not a remote hard-kill guarantee.
        return await asyncio.wait_for(run(), timeout * 8)
    except TimeoutError as exc:
        json_log("mcp.session.timeout", timeout_seconds=timeout * 8)
        raise LabTimeout("MCP session exceeded total deadline; inspect the owned Windows process") from exc


async def architecture_lab() -> dict[str, Any]:
    if os.environ.get("VOLTFORGE_LIVE_MCP") == "1":
        path = os.environ.get("VOLTFORGE_MCP_CONFIG")
        if not path:
            raise ValidationError("set VOLTFORGE_MCP_CONFIG to a reviewed local configuration")
        return await live_mcp(load_live_config(path))
    broker = MCPBroker(OfflineMCP())
    catalog = await broker.discover()
    return {"mode": "offline-fixture", "tools": catalog,
            "spawn": await broker.call("fixture_spawn", {"entry": "dist/main.js"}),
            "main": await broker.call("fixture_main", {}),
            "renderer": await broker.call("fixture_renderer", {"text": "Plato — shadow pipeline ready"})}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("operation", choices=("discover", "architecture"))
    parser.add_argument("--config", type=Path)
    parser.add_argument("--live", action="store_true", help="Explicitly authorize configured local/SSH stdio MCP process")
    args = parser.parse_args()
    try:
        if args.live:
            if not args.config:
                parser.error("--live requires --config")
            os.environ["VOLTFORGE_LIVE_MCP"] = "1"
            result = asyncio.run(live_mcp(load_live_config(args.config), discovery_only=args.operation == "discover"))
        else:
            # CLI default is deterministic even when a shell contains live notebook env vars.
            os.environ.pop("VOLTFORGE_LIVE_MCP", None)
            if args.operation == "discover":
                result = asyncio.run(MCPBroker(OfflineMCP()).discover())
            else:
                result = asyncio.run(architecture_lab())
        print(json.dumps(result, indent=2, ensure_ascii=False))
        return 0
    except Exception as exc:
        json_log("lab.failed", sink=lambda line: print(line, file=sys.stderr), error_type=type(exc).__name__)
        print(str(exc), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

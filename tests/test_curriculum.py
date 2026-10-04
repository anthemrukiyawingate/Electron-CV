"""[CAPSTONE INTEGRATION TARGET] Falsify notebook boundary and harness assumptions."""
import asyncio
import contextlib
import io
import json
import pathlib
import subprocess
import sys
import unittest
from unittest.mock import patch

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import notebook_support as lab


class SecurityContractTests(unittest.TestCase):
    def test_remote_schema_references_never_trigger_fetch(self):
        with self.assertRaises(lab.ValidationError):
            lab.validate_tool_arguments({}, {"$ref": "https://example.invalid/private-schema"})

    def test_accept_exact_request(self):
        self.assertEqual(lab.validate_request({"requestId": "lab-123"}), {"requestId": "lab-123"})

    def test_reject_payload_smuggling_and_code(self):
        for payload in [None, [], {"requestId": 3}, {"requestId": ""},
                        {"requestId": "x", "command": "process.exit()"},
                        {"requestId": "require('fs').readFileSync('/etc/passwd')"},
                        {"requestId": "x" * 65}]:
            with self.subTest(payload=payload):
                with self.assertRaises(lab.ValidationError):
                    lab.validate_request(payload)

    def test_sender_authority_precedes_handler(self):
        result = asyncio.run(lab.invoke_snapshot({"requestId": "valid"}, trusted=False))
        self.assertEqual(result["error"]["code"], "UNTRUSTED_SENDER")

    def test_valid_packet_and_monotonic_sequence(self):
        store = lab.TelemetryFixture(stale_after_ms=1000)
        store.ingest(lab.example_packet(sequence=2), now_ms=100)
        self.assertEqual(store.snapshot(101)["state"], "live")
        with self.assertRaises(lab.ValidationError):
            store.ingest(lab.example_packet(sequence=1), now_ms=102)
        self.assertEqual(store.snapshot(102)["rejected"], 1)
        self.assertEqual(store.snapshot(102)["telemetry"]["sequence"], 2)

    def test_duplicate_tracks_reject(self):
        packet = lab.example_packet()
        packet["objects"].append(dict(packet["objects"][0]))
        with self.assertRaises(lab.ValidationError):
            lab.validate_telemetry(packet)

    def test_reference_age_thresholds_and_history_bound(self):
        store = lab.TelemetryFixture()
        store.ingest(lab.example_packet(), now_ms=0)
        self.assertEqual(store.snapshot(1501)["state"], "stale")
        self.assertEqual(store.snapshot(5001)["state"], "disconnected")
        for index in range(40):
            packet = lab.example_packet()
            packet["source"] = f"source-{index}"
            store.ingest(packet, now_ms=index)
        self.assertEqual(len(store.sequences), 32)

    def test_offline_stale_and_disconnect_are_distinct(self):
        store = lab.TelemetryFixture(stale_after_ms=1000)
        self.assertEqual(store.snapshot(0)["state"], "disconnected")
        store.ingest(lab.example_packet(), now_ms=10)
        self.assertEqual(store.snapshot(1011)["state"], "stale")
        store.disconnect()
        self.assertEqual(store.snapshot(1012)["state"], "disconnected")

    def test_packet_rejects_nonfinite_unknown_and_bool_numeric(self):
        mutations = [lambda p: p.update(extra=True),
                     lambda p: p.update(sequence=True),
                     lambda p: p["objects"][0].update(x=float("nan")),
                     lambda p: p["hardware"].update(camera="ready"),
                     lambda p: p.update(objects=[p["objects"][0]] * 65)]
        for mutation in mutations:
            packet = lab.example_packet()
            mutation(packet)
            with self.assertRaises(lab.ValidationError):
                lab.validate_telemetry(packet)


class AsyncFailureTests(unittest.IsolatedAsyncioTestCase):
    async def test_malformed_catalog_and_tool_error_reject(self):
        class Malformed(lab.OfflineMCP):
            async def list_tools(self):
                return ["not-a-tool-declaration"]
        with self.assertRaises(lab.ValidationError):
            await lab.MCPBroker(Malformed(), logger=lambda _: None).discover()
        class Rejected(lab.OfflineMCP):
            async def call_tool(self, name, arguments):
                return {"isError": True, "content": []}
        broker = lab.MCPBroker(Rejected(), logger=lambda _: None)
        await broker.discover()
        with self.assertRaises(lab.ValidationError):
            await broker.call("fixture_spawn", {"entry": "dist/main.js"})

    async def test_live_disabled_before_sdk_or_process_launch(self):
        with patch.dict("os.environ", {}, clear=True):
            with self.assertRaises(lab.ValidationError):
                await lab.live_mcp({})

    async def test_mcp_discovers_before_calls_and_no_guessed_tools(self):
        records = []
        broker = lab.MCPBroker(lab.OfflineMCP(), timeout_seconds=.05, logger=records.append)
        with self.assertRaises(lab.ValidationError):
            await broker.call("fixture_spawn", {})
        catalog = await broker.discover()
        self.assertIn("fixture_spawn", {tool["name"] for tool in catalog})
        with self.assertRaises(lab.ValidationError):
            await broker.call("start_app", {})
        result = await broker.call("fixture_spawn", {"entry": "dist/main.js"})
        self.assertEqual(result["process"], "main")
        self.assertTrue(all(isinstance(json.loads(line), dict) for line in records))
        self.assertTrue(any(json.loads(line)["event"] == "mcp.call.success" for line in records))

    async def test_mcp_timeout_is_structured_and_bounded(self):
        class Slow(lab.OfflineMCP):
            async def call_tool(self, name, arguments):
                await asyncio.sleep(.25)
        records = []
        broker = lab.MCPBroker(Slow(), timeout_seconds=.01, logger=records.append)
        await broker.discover()
        with self.assertRaises(lab.LabTimeout):
            await broker.call("fixture_spawn", {"entry": "dist/main.js"})
        self.assertEqual(json.loads(records[-1])["event"], "mcp.call.timeout")

    async def test_ipc_timeout_releases_caller_and_retry_succeeds(self):
        result = await lab.invoke_snapshot({"requestId": "slow"}, delay_seconds=.1, timeout_seconds=.01)
        self.assertEqual(result["error"]["code"], "TIMEOUT")
        result = await lab.invoke_snapshot({"requestId": "retry"})
        self.assertTrue(result["ok"])

    async def test_cancelled_call_and_invalid_arguments(self):
        broker = lab.MCPBroker(lab.OfflineMCP(), logger=lambda _: None)
        await broker.discover()
        with self.assertRaises(lab.ValidationError):
            await broker.call("fixture_spawn", {"entry": "x", "command": "rm"})


class HarnessTests(unittest.TestCase):
    def test_manifest_covers_exact_backlog_ids(self):
        import re
        expected = set(re.findall(r"^### (VF-\d{3})", (ROOT / "handoff/BACKLOG.md").read_text(), re.M))
        manifest = json.loads((ROOT / "scripts/agent-tasks.json").read_text())
        self.assertEqual({task["id"] for task in manifest["tasks"]}, expected)

    def test_task_selection_emits_exact_instructions(self):
        result = subprocess.run([sys.executable, str(ROOT / "scripts/agent_harness.py"),
                                 "prepare", "VF-200"], cwd=ROOT, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        task = json.loads(result.stdout)
        self.assertIn("As a Senior AI Developer and QA Auditor", task["developer_instruction"])
        self.assertIn("Senior Graphics Programmer", task["frontend_instruction"])
        self.assertEqual(task["task"]["id"], "VF-200")
        self.assertGreater(len(task["task"]["failure_cases"]), 2)

    def test_unknown_task_fails_without_launching_agent(self):
        result = subprocess.run([sys.executable, str(ROOT / "scripts/agent_harness.py"),
                                 "prepare", "invented"], cwd=ROOT, capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("unknown task", result.stderr.lower())


if __name__ == "__main__":
    unittest.main()

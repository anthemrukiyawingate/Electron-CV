# Plato: the physical-shadow dashboard

> **[CAPSTONE INTEGRATION TARGET]** Turn observed movement into a validated, visible desktop signal while retaining the Electron privilege boundary.

The executable reference is at the repository root. `src/main.ts` owns loopback ingress and window authority; `src/preload.ts` exposes two named operations; `src/renderer.ts` is compiled using browser libraries without Node globals. The dashboard renders spatial objects, reported camera/projector states, rejected packet counts, listener health, and connection freshness. There is no device-control command or arbitrary shell/file operation.

## Run the reference

Use Node **22.13+ or 24 LTS**, a graphical desktop, and the supplied lockfile. Initial installation and the first Electron invocation require access to npm and Electron's release binary host.

```bash
npm ci
npm run check
npm test
npm start
```

In another terminal, start either producer:

```bash
npm run telemetry:simulate
npm run telemetry:simulate -- --osc
```

Both simulators emit the same two-object motion at 20 Hz. Each run uses a new source ID and increasing sequence. The simulator periodically reports the projector offline to exercise the UI; it does not query physical hardware. Stop with Ctrl+C. A WebSocket connection failure exits with a structured JSON error. UDP provides no acknowledgement, so a running OSC simulator does not prove delivery.

| Setting | Default | Meaning |
| --- | --- | --- |
| `VOLTFORGE_WS_PORT` | `8765` | WebSocket listener and simulator destination on `127.0.0.1` |
| `VOLTFORGE_OSC_PORT` | `9000` | OSC UDP listener and simulator destination on `127.0.0.1` |

Values must be decimal integers from 1024 through 65535. Configure the same values in the app and simulator processes. Invalid values stop application startup. An occupied port appears as `ERROR` in the listener status and emits `listener_error`; the other transport remains available. Resolve the conflict and restart the app to rebind. **Refresh status** retries the bounded IPC status request; it does not restart sockets or hardware.

## Physical pipeline

```text
Camera → TouchDesigner tracking → normalized object positions
                                ├→ Godot shadow scene → projector
                                └→ native WS producer / OSC → Electron Main
                                                           → isolated Preload
                                                           → Plato canvas
```

TouchDesigner should normalize the measured region into `[-1,1] × [-1,1]`, choose stable object IDs, and include the state of the actual camera acquisition and projector/output subsystem. Godot can publish the same contract using a native WebSocket client. Use `ws://127.0.0.1:8765/`; no subpath, browser Origin, TLS, or credentials are part of this local reference protocol. Browser-origin handshakes are refused. Native clients sharing the machine are inside the local trust assumption; loopback is confinement, not authentication.

Remote physical producers need an independently authenticated gateway/tunnel ending on this workstation. Do not change the bind address to `0.0.0.0`. Ordinary TCP SSH forwarding cannot carry the OSC UDP stream. There is no direct TouchDesigner project, Godot project, camera driver, or projector driver in this reference, and physical integration must be validated on the target rig.

### TouchDesigner Python adapter

The following DAT-module example uses Python's standard library to emit the supported OSC string message. Invoke `send_frame()` from a rate-limited Execute DAT or tracking callback at 20–30 Hz. Replace the sample coordinates and device flags with measurements from the actual network. Positive X is right; positive Y is up. The example's source changes each time the DAT module is re-created, so its sequence can safely restart.

```python
# [CAPSTONE INTEGRATION TARGET] Adapt tracked objects to Plato's constrained OSC ingress.
import json
import socket
import time
import uuid

_udp = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
_udp.settimeout(1.0)
_source = "touchdesigner-" + uuid.uuid4().hex[:12]
_sequence = 0

def _osc_string(value):
    raw = value.encode("utf-8") + b"\x00"
    return raw + b"\x00" * ((-len(raw)) % 4)

def send_frame():
    global _sequence
    payload = {
        "version": 1, "sequence": _sequence,
        "timestamp": time.time_ns() // 1_000_000, "source": _source,
        "objects": [{"id": "shadow-01", "x": 0.3, "y": -0.2, "confidence": 0.98}],
        "hardware": {"camera": "online", "projector": "offline"},
    }
    packet = (_osc_string("/plato/telemetry") + _osc_string(",s")
              + _osc_string(json.dumps(payload, separators=(",", ":"))))
    if len(packet) > 16384:
        raise ValueError("Frame exceeds Plato's packet limit")
    _udp.sendto(packet, ("127.0.0.1", 9000))
    _sequence += 1

def close():
    _udp.close()  # Call when the DAT/network is shut down or recreated.
```

Use a socket lifecycle hook to call `close()` when replacing the adapter. Standard UDP reports local send failures, but there is no delivery acknowledgement; inspect Plato's sequence and listener state to verify reception. This snippet is an integration recipe, not a claim of a tested TouchDesigner project.

### Godot 4 GDScript adapter

Attach this example to a Node in a native Godot application. Polling happens each frame; transmission is limited to 20 Hz. It sends metadata about the scene, never video or executable code. Replace the example object and reported hardware state with the scene's measurements. A new source is assigned when the Node is created; a reconnect within the same Node retains its increasing sequence.

```gdscript
# [CAPSTONE INTEGRATION TARGET] Export native Godot tracking through the local WS contract.
extends Node

var peer := WebSocketPeer.new()
var source := "godot-" + str(Time.get_unix_time_from_system()).replace(".", "-")
var sequence := 0
var elapsed := 0.0
var retry_elapsed := 0.0
var connecting_elapsed := 0.0

func _ready() -> void:
    connect_local()

func connect_local() -> void:
    connecting_elapsed = 0.0
    var result := peer.connect_to_url("ws://127.0.0.1:8765/")
    if result != OK:
        push_warning("Plato connection could not be started: " + str(result))

func _process(delta: float) -> void:
    peer.poll()
    if peer.get_ready_state() == WebSocketPeer.STATE_CLOSED:
        retry_elapsed += delta
        if retry_elapsed >= 2.0:
            retry_elapsed = 0.0
            connect_local()
        return
    if peer.get_ready_state() == WebSocketPeer.STATE_CONNECTING:
        connecting_elapsed += delta
        if connecting_elapsed >= 2.0:
            peer.close(-1) # Bound connection attempts; retry through STATE_CLOSED.
        return
    if peer.get_ready_state() != WebSocketPeer.STATE_OPEN:
        return
    elapsed += delta
    if elapsed < 0.05:
        return
    elapsed = 0.0
    var packet := {
        "version": 1, "sequence": sequence,
        "timestamp": int(Time.get_unix_time_from_system() * 1000.0), "source": source,
        "objects": [{"id": "shadow-01", "x": 0.3, "y": -0.2, "confidence": 0.98}],
        "hardware": {"camera": "online", "projector": "offline"}
    }
    var message := JSON.stringify(packet)
    if message.to_utf8_buffer().size() <= 16384 and peer.get_current_outbound_buffered_amount() < 65536:
        if peer.send_text(message) == OK:
            sequence += 1

func _exit_tree() -> void:
    peer.close(-1) # Immediate resource cleanup; Node is no longer polling.
```

This recipe targets native Godot, since browser WebSocket Origin headers are intentionally refused by Plato. Its polling, text-send, state, buffer and close methods follow the [Godot WebSocketPeer reference](https://docs.godotengine.org/en/stable/classes/class_websocketpeer.html). Validate the snippet against the installed Godot version and the real scene before deployment. Coordinate producer shutdown/reconnect behavior with the execution workstation operator.

## Exact JSON contract

Send one UTF-8 JSON text WebSocket message per frame, at most **16,384 bytes**. Binary frames are rejected. Unknown fields at every level are rejected.

```json
{
  "version": 1,
  "sequence": 1,
  "timestamp": 1790985600000,
  "source": "touchdesigner-rig-01",
  "objects": [
    { "id": "shadow-01", "x": 0.3, "y": -0.2, "confidence": 0.98 }
  ],
  "hardware": { "camera": "online", "projector": "offline" }
}
```

`version` is exactly `1`. `sequence` and `timestamp` are nonnegative JavaScript safe integers; timestamp is producer Unix milliseconds. `source` and object `id` match `^[A-Za-z0-9_-]{1,40}$`. There are zero through 64 objects, with unique IDs per frame. Coordinates are finite numbers in `[-1,1]`, and confidence is in `[0,1]`. The hardware fields accept only `online` or `offline`. No string is evaluated or inserted as HTML.

Main tracks increasing sequence numbers for the 32 most recently active sources. Duplicate and lower numbers from a remembered source are rejected. Restart a producer with a new session-specific source ID, or continue its sequence. This bounded cache is a replay sanity check, not cryptographic replay protection; eviction and application restarts clear historical protection. Multiple producers share one latest-frame display, so the most recent valid packet wins. They are not automatically fused into a scene.

At most four WebSocket connections are accepted. Each connection has a 60-message/second window and both transports share a 120-message/second window. Excess packets increase `rejected`; parsing stays bounded. Rejection logs are limited to two per second, while the rejection count is retained. Oversized WebSocket messages close that connection through the WebSocket implementation. OSC messages exceeding the size bound are rejected. Native local processes can still occupy capacity; the app is not a multi-tenant gateway.

## Supported OSC subset

The only accepted OSC message is address **`/plato/telemetry`**, type tag **`,s`**, and exactly one string argument containing the JSON above. OSC strings are UTF-8, terminated with NUL, then padded with zero bytes to a multiple of four. No trailing bytes, nonzero padding, bundles, timetags, integer/float argument variants, or alternate addresses are supported. The complete datagram is limited to 16,384 bytes.

In TouchDesigner, configure an OSC sender capable of transmitting a string argument, supply the JSON as that string, and send it to `127.0.0.1:9000`. A CHOP that emits only numeric channels will need a script/DAT adapter. `encodeOsc()` in `src/shared/contracts.ts` and the `--osc` simulator are executable reference encoders. Extend the protocol only by adding schema tests and a versioned contract first.

## Renderer interface and lifecycle

```typescript
window.plato.getSnapshot(): Promise<Result<Snapshot>>
window.plato.onSnapshot(callback: (value: Snapshot) => void): () => void
```

`getSnapshot` generates its own correlation ID and invokes `plato:snapshot` with exactly `{requestId}`. The ID must match `^[A-Za-z0-9_-]{1,64}$`. Main checks the requesting WebContents identity, top-frame identity, and exact application file URL. A child frame, foreign window, changed URL, unknown payload field, or invalid ID fails closed. Main limits valid status calls to 30 per second. There is no public raw IPC, channel argument, Electron event object, or arbitrary invocation API. The subscription strips Electron's event object and returns an unsubscribe function.

Success is `{ok:true,value:Snapshot}`. Failure is `{ok:false,error:{code,message}}`, where code is `INVALID_REQUEST`, `UNTRUSTED_SENDER`, `TIMEOUT`, or `INTERNAL`. Main logs `ipc_complete`, `ipc_rejected`, or `ipc_failed`; successful calls include request IDs. Main's operation deadline is 1.5 seconds, with a 2-second Preload deadline. These deadlines release pending clients; they do not cancel work already executing remotely.

`Snapshot` contains `state`, `telemetry` (the contract above or `null`), `transport` (`ws`, `osc`, or `null`), `receivedAt` (local Unix milliseconds or `null`), `rejected`, and `listeners` (`ws`/`osc`, each `starting`, `listening`, or `error`). The status uses **local receipt time**, never the producer clock: live through 1.5 seconds, stale after 1.5 seconds, disconnected after 5 seconds or before the first packet. A valid newer frame restores live status. Stale/disconnected positions remain visible but dimmed; they are not current movement.

Main publishes after accepted packets and every 500 ms. Renderer shows empty, loading, error, rejected, live, stale, and disconnected states. The object history is bounded to 60 trail points per object. A `requestAnimationFrame` loop eases movement; canvas resolution scales between 50% and 100% under frame pressure, with device-pixel ratio capped at two. Reduced-motion preference removes easing/trails, and a hidden document stops the animation loop. Displayed FPS is a rolling sample, not a 60 FPS guarantee.

## Verification and packaging

```bash
npm run check
npm run test:unit
npm run test:electron
npm run package
npm run make
```

`tests/core/contracts.test.ts` falsifies schema, sender URL/frame policy, ordering, freshness, rate windows, OSC bounds, and deadlines. `tests/core/transport.test.ts` uses real loopback WebSocket/UDP sockets to verify accepted frames, malformed rejection, browser-origin refusal, oversized connection closure, and occupied-port recovery state. Restricted hosts must permit local sockets for these tests.

`tests/electron.spec.ts` launches actual Electron with **`chromiumSandbox: true`**. It checks absent Node globals, the exact bridge surface, rejection from a separate untrusted window using the same preload, rendered objects, rejected malicious strings, reported offline hardware, stale/disconnected/recovery transitions, and refresh behavior. It records `test-results/electron/plato-live.png`. Run it on a graphical desktop; do not disable the sandbox to obtain a pass. See the root validation dossier for actual runs and remaining host checks.

The Electron test also replaces the status handler from privileged test code with deliberately stalled work and verifies the Preload's typed `TIMEOUT` envelope and structured correlation log. This fault injection is confined to the test harness. To exercise a packaged application, set `VOLTFORGE_ELECTRON_EXECUTABLE` to the absolute executable path before `npm run test:electron`; leave it unset for the development bundle. The test reserves local ports 18765 and 19000.

Forge bundles `dist/` into an ASAR application. `package` produces a platform directory in `out/`; `make` produces a ZIP for the current Linux, Windows, or macOS host. These are unsigned classroom artifacts, not an installer/update/signing system. The configuration deliberately has no signing credentials. Windows output must be built and smoke-tested on Windows; ZIP extraction, first startup, firewall behavior, accessibility, 4K frame pacing, and hardware integration remain release gates for the execution workstation.

The Build environment team exclusively owns version control, GitHub transfer, release identifiers, publication, signing, and release distribution. Development supplies these files, the lockfile, and test evidence.

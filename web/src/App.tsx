import { useState } from "react";
import {
  useZMKApp,
  connectSerial,
  isWebSerialSupported,
  isWebBluetoothSupported,
  isUserCancelledError,
} from "@cormoran/zmk-studio-react-hook";
import { connect as connectGatt } from "@zmkfirmware/zmk-studio-ts-client/transport/gatt";
import { ZMKAppContext } from "@cormoran/zmk-studio-react-hook";
import { GestureActions } from "./GestureActions";

/**
 * Step 1 of the gesture-action project: prove the browser can reach the
 * keyboard over both transports and enumerate its custom RPC subsystems.
 *
 * Nothing here is gesture-specific yet. Once a subsystem shows up in the list
 * below, the settings UI has somewhere to talk to.
 */
export function App() {
  const zmk = useZMKApp();
  const [connectError, setConnectError] = useState<string | null>(null);

  const serialSupported = isWebSerialSupported();
  const bluetoothSupported = isWebBluetoothSupported();

  async function connectWith(transport: () => Promise<never>) {
    setConnectError(null);
    try {
      await zmk.connect(transport as Parameters<typeof zmk.connect>[0]);
    } catch (err) {
      // Closing the browser's own device picker is a normal outcome, not a failure.
      if (isUserCancelledError(err)) {
        return;
      }
      setConnectError(err instanceof Error ? err.message : String(err));
    }
  }

  const { deviceInfo, customSubsystems, isLoading, error } = zmk.state;
  const subsystems = customSubsystems?.subsystems ?? [];

  return (
    <ZMKAppContext.Provider value={zmk}>
    <main>
      <h1>ZMK Gesture Action</h1>
      <p className="lede">
        Connection check. Connect a keyboard, then confirm its custom RPC
        subsystems are listed.
      </p>

      <section>
        <h2>Transport support</h2>
        <ul className="support">
          <li>
            <Badge ok={serialSupported} /> Web Serial (USB)
          </li>
          <li>
            <Badge ok={bluetoothSupported} /> Web Bluetooth
          </li>
        </ul>
        {!serialSupported && !bluetoothSupported && (
          <p className="warn">
            This browser exposes neither transport. Use a Chromium-based browser
            (Chrome or Edge) over HTTPS, or Bluefy on iOS.
          </p>
        )}
      </section>

      <section>
        <h2>Connection</h2>
        {zmk.isConnected ? (
          <button onClick={zmk.disconnect}>Disconnect</button>
        ) : (
          <div className="row">
            <button
              onClick={() => connectWith(connectSerial as never)}
              disabled={!serialSupported || isLoading}
            >
              Connect over USB
            </button>
            <button
              onClick={() => connectWith(connectGatt as never)}
              disabled={!bluetoothSupported || isLoading}
            >
              Connect over Bluetooth
            </button>
          </div>
        )}
        {isLoading && <p className="muted">Connecting…</p>}
        {(connectError ?? error) && (
          <p className="warn">{connectError ?? error}</p>
        )}
      </section>

      {zmk.isConnected && (
        <>
          <section>
            <h2>Device</h2>
            <dl>
              <dt>Name</dt>
              <dd>{deviceInfo?.name ?? "—"}</dd>
              <dt>Serial</dt>
              <dd>{formatSerial(deviceInfo?.serialNumber)}</dd>
            </dl>
          </section>

          <section>
            <h2>Custom subsystems ({subsystems.length})</h2>
            {subsystems.length === 0 ? (
              <p className="muted">
                None reported. The firmware is reachable but exposes no custom
                RPC subsystems.
              </p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Index</th>
                    <th>Identifier</th>
                  </tr>
                </thead>
                <tbody>
                  {subsystems.map((s, i) => (
                    <tr key={s.identifier ?? i}>
                      <td className="num">{i}</td>
                      <td>
                        <code>{s.identifier}</code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <GestureActions />
        </>
      )}

      <footer>
        <a href="https://github.com/jpttm/zmk-feature-gesture-action">
          Source
        </a>{" "}
        · MIT · built on{" "}
        <a href="https://github.com/cormoran/react-zmk-studio">
          @cormoran/zmk-studio-react-hook
        </a>
      </footer>
    </main>
    </ZMKAppContext.Provider>
  );
}

function Badge({ ok }: { ok: boolean }) {
  return (
    <span className={ok ? "badge ok" : "badge no"}>{ok ? "yes" : "no"}</span>
  );
}

function formatSerial(serial: Uint8Array | undefined): string {
  if (!serial || serial.length === 0) {
    return "—";
  }
  return Array.from(serial)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

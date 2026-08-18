import { useState } from "react";
import {
  useZMKApp,
  connectSerial,
  isWebSerialSupported,
  isWebBluetoothSupported,
  isUserCancelledError,
  ZMKAppContext,
} from "@cormoran/zmk-studio-react-hook";
import { connect as connectGatt } from "@zmkfirmware/zmk-studio-ts-client/transport/gatt";
import { GestureActions } from "./GestureActions";
import { GettingStarted } from "./GettingStarted";
import { Credits } from "./Credits";
import { LangProvider, LangToggle, useT } from "./i18n";
import { ThemeProvider, ThemeToggle } from "./theme";

export function App() {
  return (
    <LangProvider>
      <ThemeProvider>
        <Page />
      </ThemeProvider>
    </LangProvider>
  );
}

function Page() {
  const t = useT();
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
        <header className="pageHead">
          <div>
            <h1>{t("title")}</h1>
            <p className="subtitle">{t("subtitle")}</p>
            <p className="credit muted small">
              {t("unofficial")} ·{" "}
              <a href="https://x.com/tu_no_tu" target="_blank" rel="noreferrer">
                @tu_no_tu
              </a>{" "}
              ·{" "}
              <a
                href="https://github.com/jpttm/zmk-feature-gesture-action"
                target="_blank"
                rel="noreferrer"
              >
                GitHub
              </a>{" "}
              · ZMK
            </p>
            <p className="muted small devStatus">{t("devStatus")}</p>
          </div>
          <div className="headToggles">
            <LangToggle />
            <ThemeToggle />
          </div>
        </header>

        <GettingStarted />

        <div className="cols">
        <aside className="side">
        {/* Only useful while deciding how to connect. Once connected it is a
            settled question taking up the top of the sidebar. */}
        {!zmk.isConnected && (
        <section>
          <h2>{t("transportSupport")}</h2>
          <ul className="support">
            <li>
              <Badge ok={serialSupported} /> {t("webSerial")}
            </li>
            <li>
              <Badge ok={bluetoothSupported} /> {t("webBluetooth")}
            </li>
          </ul>
          {!serialSupported && !bluetoothSupported && (
            <p className="warn">{t("noTransport")}</p>
          )}
        </section>
        )}

        <section>
          <h2>{t("connection")}</h2>
          {zmk.isConnected ? (
            <button className="ghost" onClick={zmk.disconnect}>
              {t("disconnect")}
            </button>
          ) : (
            <div className="row">
              <button
                onClick={() => connectWith(connectSerial as never)}
                disabled={!serialSupported || isLoading}
              >
                {t("connectUsb")}
              </button>
              <button
                onClick={() => connectWith(connectGatt as never)}
                disabled={!bluetoothSupported || isLoading}
              >
                {t("connectBle")}
              </button>
            </div>
          )}
          {isLoading && <p className="muted">{t("connecting")}</p>}
          {(connectError ?? error) && (
            <p className="warn">{connectError ?? error}</p>
          )}
        </section>

        {zmk.isConnected && (
          <>
            <section>
              <h2>{t("device")}</h2>
              <dl>
                <dt>{t("deviceName")}</dt>
                <dd>{deviceInfo?.name ?? "—"}</dd>
                <dt>{t("serial")}</dt>
                <dd>{formatSerial(deviceInfo?.serialNumber)}</dd>
              </dl>
            </section>

            <details className="diagnostics">
              <summary className="muted small">{t("diagnostics")}</summary>
              <p className="muted small">{t("subsystemsHint")}</p>
              <h2>
                {t("subsystems")} ({subsystems.length})
              </h2>
              {subsystems.length === 0 ? (
                <p className="muted">{t("noSubsystems")}</p>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th className="slotCol">{t("index")}</th>
                      <th>{t("identifier")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subsystems.map((s, i) => (
                      <tr key={s.identifier ?? i}>
                        <td className="slotCol">{i}</td>
                        <td>
                          <code>{s.identifier}</code>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </details>
          </>
        )}
        </aside>

        <div className="work">
          {zmk.isConnected ? (
            <GestureActions />
          ) : (
            <p className="muted placeholder">{t("connectFirst")}</p>
          )}
        </div>
        </div>

        <footer>
          <Credits />
          <p className="footLine">
            ころころKit ·{" "}
            <a href="https://github.com/jpttm/zmk-feature-gesture-action">
              {t("source")}
            </a>{" "}
            · MIT
          </p>
        </footer>
      </main>
    </ZMKAppContext.Provider>
  );
}

function Badge({ ok }: { ok: boolean }) {
  const t = useT();
  return (
    <span className={ok ? "badge ok" : "badge no"}>
      {ok ? t("yes") : t("no")}
    </span>
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

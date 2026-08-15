import { useCallback, useEffect, useState } from "react";
import type { RpcConnection } from "@zmkfirmware/zmk-studio-ts-client";
import { call_rpc } from "@zmkfirmware/zmk-studio-ts-client";

export interface BehaviorInfo {
  id: number;
  displayName: string;
}

/**
 * The device's own behaviour list, so the picker offers exactly what this
 * firmware can actually invoke rather than a table baked into the page.
 *
 * Details are fetched one behaviour per round trip, which is what the official
 * protocol offers. Over BLE that is slow enough to be worth showing progress
 * for, so the list is exposed as it fills rather than all at once at the end.
 */
export function useBehaviors(connection: RpcConnection | null) {
  const [behaviors, setBehaviors] = useState<BehaviorInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (conn: RpcConnection) => {
    setLoading(true);
    setError(null);
    setBehaviors([]);

    try {
      const listed = await call_rpc(conn, { behaviors: { listAllBehaviors: true } });
      const ids = listed.behaviors?.listAllBehaviors?.behaviors ?? [];

      const collected: BehaviorInfo[] = [];
      for (const id of ids) {
        const details = await call_rpc(conn, {
          behaviors: { getBehaviorDetails: { behaviorId: id } },
        });
        const d = details.behaviors?.getBehaviorDetails;
        if (!d) continue;

        collected.push({ id: d.id, displayName: d.displayName || String(d.id) });
        setBehaviors([...collected].sort((a, b) => a.displayName.localeCompare(b.displayName)));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!connection) {
      setBehaviors([]);
      return;
    }
    void load(connection);
  }, [connection, load]);

  return { behaviors, loading, error };
}

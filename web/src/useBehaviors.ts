import { useCallback, useEffect, useRef, useState } from "react";
import type { RpcConnection } from "@zmkfirmware/zmk-studio-ts-client";
import { call_rpc } from "@zmkfirmware/zmk-studio-ts-client";

/** One accepted value for a parameter, as the keyboard describes it. */
export interface ParamDescription {
  name: string;
  nil?: unknown;
  constant?: number;
  range?: { min: number; max: number };
  hidUsage?: unknown;
  layerId?: unknown;
}

export interface BehaviorInfo {
  id: number;
  displayName: string;
  /** First parameter set; behaviours here have at most one. */
  param1: ParamDescription[];
  param2: ParamDescription[];
}

/* Details are cached across sessions, one cache per keyboard. A behaviour id
 * is a CRC16 of its node name, so the same id names the same behaviour on any
 * firmware - but its metadata (display name, parameter shapes) can differ
 * between keyboards when they carry different modules or versions under the
 * same name. Scoping by device serial keeps a CLine46 and a moNa2 on the same
 * browser from reading each other's details. Without a serial the cache is
 * shared, as before. */
const CACHE_BASE = "zmk-gesture-action.behaviors.v1";
const cacheKey = (scope: string | null) => (scope ? `${CACHE_BASE}.${scope}` : CACHE_BASE);

function readCache(scope: string | null): Record<string, BehaviorInfo> {
  try {
    const raw = localStorage.getItem(cacheKey(scope));
    return raw ? (JSON.parse(raw) as Record<string, BehaviorInfo>) : {};
  } catch {
    return {};
  }
}

function writeCache(scope: string | null, cache: Record<string, BehaviorInfo>) {
  try {
    localStorage.setItem(cacheKey(scope), JSON.stringify(cache));
  } catch {
    // A full or disabled localStorage costs a slow reconnect, nothing more.
  }
}

/**
 * The device's own behaviour list, so the picker offers exactly what this
 * firmware can actually invoke rather than a table baked into the page.
 *
 * The protocol offers one behaviour per round trip, and a BLE round trip is
 * around 95ms measured, so a first connection spends several seconds here.
 * Only the id list is fetched every time; details already seen come from
 * localStorage, which makes every connection after the first effectively
 * instant.
 */
type BehaviorDetails = { metadata?: { param1?: unknown[]; param2?: unknown[] }[] };

const set1 = (d: BehaviorDetails) => d.metadata?.[0]?.param1;
const set2 = (d: BehaviorDetails) => d.metadata?.[0]?.param2;

export function useBehaviors(connection: RpcConnection | null, scope: string | null = null) {
  const [behaviors, setBehaviors] = useState<BehaviorInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Read at load time rather than listed as a dependency: the device info
  // that supplies the scope can land a beat after the connection, and that
  // must not trigger a second full fetch.
  const scopeRef = useRef(scope);
  scopeRef.current = scope;

  const load = useCallback(async (conn: RpcConnection) => {
    setLoading(true);
    setError(null);
    setBehaviors([]);

    const t0 = performance.now();
    let cacheHits = 0;
    let fetchedCount = 0;
    try {
      const listed = await call_rpc(conn, { behaviors: { listAllBehaviors: true } });
      const ids = listed.behaviors?.listAllBehaviors?.behaviors ?? [];

      const scopeNow = scopeRef.current;
      const cache = readCache(scopeNow);
      const collected: BehaviorInfo[] = [];
      let fetched = false;

      // Show everything already known before going near the radio, so a repeat
      // connection has a usable picker immediately.
      for (const id of ids) {
        const hit = cache[String(id)];
        if (hit) {
          collected.push(hit);
          cacheHits++;
        }
      }
      if (collected.length > 0) {
        setBehaviors([...collected].sort((a, b) => a.displayName.localeCompare(b.displayName)));
      }

      for (const id of ids) {
        if (cache[String(id)]) continue;

        const details = await call_rpc(conn, {
          behaviors: { getBehaviorDetails: { behaviorId: id } },
        });
        const d = details.behaviors?.getBehaviorDetails;
        if (!d) continue;

        const info: BehaviorInfo = {
          id: d.id,
          displayName: d.displayName || String(d.id),
          param1: (set1(d) ?? []) as ParamDescription[],
          param2: (set2(d) ?? []) as ParamDescription[],
        };
        cache[String(id)] = info;
        fetched = true;
        fetchedCount++;
        collected.push(info);
        setBehaviors([...collected].sort((a, b) => a.displayName.localeCompare(b.displayName)));
      }

      if (fetched) {
        writeCache(scopeNow, cache);
      }
      // Phase timing, so slow reconnects can be diagnosed from numbers
      // instead of impressions. Read it in the browser console.
      console.info(
        `[timing] behaviors: ${Math.round(performance.now() - t0)}ms ` +
          `(${cacheHits} cached, ${fetchedCount} fetched)`,
      );
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

/** A layer as the keymap orders it. */
export interface LayerInfo {
  /** Position in the keymap, which is what a layer bitmask indexes. */
  index: number;
  /** The keymap's own name for it, empty if unnamed. */
  name: string;
}

/**
 * The keymap's layers, in order.
 *
 * This is the keyboard's own answer, so it stays right when layers are added
 * or removed at runtime - which a compile-time layer count would not.
 *
 * Deliberately keyed on array position rather than Layer.id: ids survive
 * reordering, but the bitmasks this feeds index layers by position, and mixing
 * the two would point a mask at the wrong layer.
 */
export function useLayers(connection: RpcConnection | null): LayerInfo[] {
  const [layers, setLayers] = useState<LayerInfo[]>([]);

  useEffect(() => {
    if (!connection) {
      setLayers([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const t0 = performance.now();
        const res = await call_rpc(connection, { keymap: { getKeymap: true } });
        console.info(`[timing] keymap (layer names): ${Math.round(performance.now() - t0)}ms`);
        const got = res.keymap?.getKeymap?.layers ?? [];
        if (!cancelled) {
          setLayers(got.map((l, index) => ({ index, name: l.name ?? "" })));
        }
      } catch {
        // Not fatal: callers fall back to plain numbers.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [connection]);

  return layers;
}

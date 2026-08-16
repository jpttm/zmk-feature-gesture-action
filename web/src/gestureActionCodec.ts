/**
 * Wire codec for the jpttm__gesture_action subsystem.
 *
 * Hand-written against protobufjs's Writer/Reader rather than generated,
 * to keep the page buildable with nothing but `npm install` - no protoc, no
 * buf. The schema is four small messages; if it grows much beyond this,
 * switch to generated code and delete this file.
 *
 * Field numbers must stay in step with
 * proto/jpttm/gesture_action/gesture_action.proto.
 */
import { Writer, Reader } from "protobufjs/minimal";

export const SUBSYSTEM_ID = "jpttm__gesture_action";

/** Empty slot: nothing stored, so the devicetree default runs instead. */
export const UNSET = 0;

export interface Group {
  index: number;
  name: string;
  activeLayers: number;
}

export interface Action {
  slot: number;
  behaviorId: number;
  param1: number;
  param2: number;
}

export type Request =
  | { kind: "getActions"; startSlot: number }
  | { kind: "getSlotNames"; startSlot: number }
  | { kind: "getGroups" }
  | { kind: "getDefaults"; startSlot: number }
  | { kind: "setGroupLayers"; index: number; activeLayers: number; persist: boolean }
  | { kind: "setAction"; action: Action; persist: boolean }
  | { kind: "resetAction"; slot: number; persist: boolean };

export type Response =
  | { kind: "error"; message: string }
  | { kind: "getActions"; totalSlots: number; startSlot: number; actions: Action[] }
  | { kind: "setAction"; success: boolean }
  | { kind: "resetAction"; success: boolean }
  | { kind: "getSlotNames"; totalSlots: number; startSlot: number; names: string[] }
  | {
      kind: "getGroups";
      groups: Group[];
      /* Absent on firmware built before the board started declaring this;
         callers fall back rather than guessing. */
      reservedLayers?: number;
    }
  | { kind: "getDefaults"; totalSlots: number; startSlot: number; actions: Action[] }
  | { kind: "setGroupLayers"; success: boolean }
  | { kind: "unknown" };

const WIRE_VARINT = 0;
const WIRE_LEN = 2;

const tag = (field: number, wire: number) => (field << 3) | wire;

function writeAction(w: Writer, action: Action): void {
  // proto3 omits zero-valued scalars; the reader defaults them back to 0.
  if (action.slot) w.uint32(tag(1, WIRE_VARINT)).uint32(action.slot);
  if (action.behaviorId) w.uint32(tag(2, WIRE_VARINT)).uint32(action.behaviorId);
  if (action.param1) w.uint32(tag(3, WIRE_VARINT)).uint32(action.param1);
  if (action.param2) w.uint32(tag(4, WIRE_VARINT)).uint32(action.param2);
}

function readAction(r: Reader, end: number): Action {
  const action: Action = { slot: 0, behaviorId: 0, param1: 0, param2: 0 };
  while (r.pos < end) {
    const t = r.uint32();
    switch (t >>> 3) {
      case 1:
        action.slot = r.uint32();
        break;
      case 2:
        action.behaviorId = r.uint32();
        break;
      case 3:
        action.param1 = r.uint32();
        break;
      case 4:
        action.param2 = r.uint32();
        break;
      default:
        r.skipType(t & 7);
    }
  }
  return action;
}

export function encodeRequest(request: Request): Uint8Array {
  const w = Writer.create();

  switch (request.kind) {
    case "getActions": {
      const inner = Writer.create();
      if (request.startSlot) inner.uint32(tag(1, WIRE_VARINT)).uint32(request.startSlot);
      w.uint32(tag(1, WIRE_LEN)).bytes(inner.finish());
      break;
    }
    case "setAction": {
      const inner = Writer.create();
      // Always emit the submessage, even when every field is zero: nanopb
      // keys has_action off its presence, and slot 0 is a real slot.
      const actionBytes = Writer.create();
      writeAction(actionBytes, request.action);
      inner.uint32(tag(1, WIRE_LEN)).bytes(actionBytes.finish());
      if (request.persist) inner.uint32(tag(2, WIRE_VARINT)).bool(true);
      w.uint32(tag(2, WIRE_LEN)).bytes(inner.finish());
      break;
    }
    case "resetAction": {
      const inner = Writer.create();
      if (request.slot) inner.uint32(tag(1, WIRE_VARINT)).uint32(request.slot);
      if (request.persist) inner.uint32(tag(2, WIRE_VARINT)).bool(true);
      w.uint32(tag(3, WIRE_LEN)).bytes(inner.finish());
      break;
    }
    case "getSlotNames": {
      const inner = Writer.create();
      if (request.startSlot) inner.uint32(tag(1, WIRE_VARINT)).uint32(request.startSlot);
      w.uint32(tag(4, WIRE_LEN)).bytes(inner.finish());
      break;
    }
    case "getGroups": {
      w.uint32(tag(5, WIRE_LEN)).bytes(new Uint8Array(0));
      break;
    }
    case "getDefaults": {
      const inner = Writer.create();
      if (request.startSlot) inner.uint32(tag(1, WIRE_VARINT)).uint32(request.startSlot);
      w.uint32(tag(7, WIRE_LEN)).bytes(inner.finish());
      break;
    }
    case "setGroupLayers": {
      const inner = Writer.create();
      if (request.index) inner.uint32(tag(1, WIRE_VARINT)).uint32(request.index);
      if (request.activeLayers)
        inner.uint32(tag(2, WIRE_VARINT)).uint32(request.activeLayers);
      if (request.persist) inner.uint32(tag(3, WIRE_VARINT)).bool(true);
      w.uint32(tag(6, WIRE_LEN)).bytes(inner.finish());
      break;
    }
  }

  return w.finish();
}

export function decodeResponse(payload: Uint8Array): Response {
  const r = Reader.create(payload);
  const end = r.len;
  let result: Response = { kind: "unknown" };

  while (r.pos < end) {
    const t = r.uint32();
    const field = t >>> 3;

    if ((t & 7) !== WIRE_LEN) {
      r.skipType(t & 7);
      continue;
    }

    const innerEnd = r.uint32() + r.pos;

    switch (field) {
      case 1: {
        let message = "";
        while (r.pos < innerEnd) {
          const it = r.uint32();
          if (it >>> 3 === 1) message = r.string();
          else r.skipType(it & 7);
        }
        result = { kind: "error", message };
        break;
      }
      case 2: {
        let totalSlots = 0;
        let startSlot = 0;
        const actions: Action[] = [];
        while (r.pos < innerEnd) {
          const it = r.uint32();
          switch (it >>> 3) {
            case 1:
              totalSlots = r.uint32();
              break;
            case 2:
              startSlot = r.uint32();
              break;
            case 3: {
              const actionEnd = r.uint32() + r.pos;
              actions.push(readAction(r, actionEnd));
              break;
            }
            default:
              r.skipType(it & 7);
          }
        }
        result = { kind: "getActions", totalSlots, startSlot, actions };
        break;
      }
      case 3:
      case 4: {
        let success = false;
        while (r.pos < innerEnd) {
          const it = r.uint32();
          if (it >>> 3 === 1) success = r.bool();
          else r.skipType(it & 7);
        }
        result = { kind: field === 3 ? "setAction" : "resetAction", success };
        break;
      }
      case 5: {
        let totalSlots = 0;
        let startSlot = 0;
        const names: string[] = [];
        while (r.pos < innerEnd) {
          const it = r.uint32();
          switch (it >>> 3) {
            case 1:
              totalSlots = r.uint32();
              break;
            case 2:
              startSlot = r.uint32();
              break;
            case 3:
              names.push(r.string());
              break;
            default:
              r.skipType(it & 7);
          }
        }
        result = { kind: "getSlotNames", totalSlots, startSlot, names };
        break;
      }
      case 6: {
        const groups: Group[] = [];
        let reservedLayers: number | undefined;
        while (r.pos < innerEnd) {
          const it = r.uint32();
          if (it >>> 3 === 3) {
            reservedLayers = r.uint32();
          } else if (it >>> 3 === 1) {
            const groupEnd = r.uint32() + r.pos;
            const group: Group = { index: 0, name: "", activeLayers: 0 };
            while (r.pos < groupEnd) {
              const gt = r.uint32();
              switch (gt >>> 3) {
                case 1:
                  group.index = r.uint32();
                  break;
                case 2:
                  group.name = r.string();
                  break;
                case 3:
                  group.activeLayers = r.uint32();
                  break;
                default:
                  r.skipType(gt & 7);
              }
            }
            groups.push(group);
          } else {
            r.skipType(it & 7);
          }
        }
        result = { kind: "getGroups", groups, reservedLayers };
        break;
      }
      case 8: {
        let totalSlots = 0;
        let startSlot = 0;
        const actions: Action[] = [];
        while (r.pos < innerEnd) {
          const it = r.uint32();
          switch (it >>> 3) {
            case 1:
              totalSlots = r.uint32();
              break;
            case 2:
              startSlot = r.uint32();
              break;
            case 3: {
              const actionEnd = r.uint32() + r.pos;
              actions.push(readAction(r, actionEnd));
              break;
            }
            default:
              r.skipType(it & 7);
          }
        }
        result = { kind: "getDefaults", totalSlots, startSlot, actions };
        break;
      }
      case 7: {
        let success = false;
        while (r.pos < innerEnd) {
          const it = r.uint32();
          if (it >>> 3 === 1) success = r.bool();
          else r.skipType(it & 7);
        }
        result = { kind: "setGroupLayers", success };
        break;
      }
      default:
        r.pos = innerEnd;
    }
  }

  return result;
}

export const gestureActionCodec = {
  encode: encodeRequest,
  decode: decodeResponse,
};

// CA3/CA5: in-process fan-out of live events to a citizen's open app (one SSE stream per citizen).
// One API instance only (the app already needs exactly one for the background jobs). With several
// instances this would move to Postgres LISTEN/NOTIFY, which is how the per-ticket stream already works.
import { EventEmitter } from "node:events";

export type CitizenLiveEvent =
  | { type: "close_request"; reportId: string | null; ticketId: string; ticketCode: string; note: string | null; officialName: string | null; requestedAt: string }
  | { type: "state"; ticketId: string; ticketCode: string; state: string };

const bus = new EventEmitter();
bus.setMaxListeners(0);

export const subscribeCitizen = (citizenId: string, fn: (e: CitizenLiveEvent) => void): (() => void) => {
  bus.on(citizenId, fn);
  return () => bus.off(citizenId, fn);
};
export const publishToCitizen = (citizenId: string, e: CitizenLiveEvent): void => {
  bus.emit(citizenId, e);
};

import Log from "../../../shared/log/Log";
import { DSEventsReader } from "./DSEventsReader";

export default class DSEventsLoader {
  static loadFile(data: Uint8Array, progress: ((percent: number) => void) | undefined = undefined): Log {
    if (progress) {
      progress(1); // Loading is fast and we don't know how long dslog vs dsevents will take
    }
    let dsEvents = new DSEventsReader(data);
    let log = new Log(false, false);
    if (!dsEvents.isSupportedVersion()) {
      throw new Error("Unsupported dsEvent version");
    }
    dsEvents.forEach((entry) => {
      log.putString("/DSEvents", entry.timestamp, entry.text);
    });

    return log;
  }
}

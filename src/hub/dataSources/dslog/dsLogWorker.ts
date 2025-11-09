import Log from "../../../shared/log/Log";
import DSEventsLoader from "./DSEventsLoader";
import DSLogLoader from "./DSLogLoader";

self.onmessage = (event) => {
  // WORKER SETUP
  let { id, payload } = event.data;
  function resolve(result: any) {
    self.postMessage({ id: id, payload: result });
  }
  function progress(percent: number) {
    self.postMessage({ id: id, progress: percent });
  }
  function reject() {
    self.postMessage({ id: id });
  }

  // MAIN LOGIC

  // Run worker
  let logs: Log[] = [];
  if (payload[0] !== null) {
    try {
      let log = DSLogLoader.loadFile(payload[0], progress);
      logs.push(log);
    } catch (e) {
      reject();
      return;
    }
  }
  if (payload[1] !== null) {
    try {
      let log = DSEventsLoader.loadFile(payload[1], progress);
      logs.push(log);
    } catch (e) {
      reject();
      return;
    }
  }
  resolve(Log.mergeLogs(logs).toSerialized());
};

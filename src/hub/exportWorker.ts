// Copyright (c) 2021-2026 Littleton Robotics
// http://github.com/Mechanical-Advantage
//
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file
// at the root directory of this project.

import { IWritable, McapWriter } from "@mcap/core";
import { IReadable } from "@mcap/core/dist/esm/src/types";
import ExportOptions from "../shared/ExportOptions";
import Log from "../shared/log/Log";
import LogFieldTree from "../shared/log/LogFieldTree";
import { AKIT_TIMESTAMP_KEYS, filterFieldByPrefixes, getLogValueText } from "../shared/log/LogUtil";
import LoggableType from "../shared/log/LoggableType";
import { cleanFloat } from "../shared/util";
import { WPILOGEncoder, WPILOGEncoderRecord } from "./dataSources/wpilog/WPILOGEncoder";
import LogExporter from "./LogExporter";

self.onmessage = async (event) => {
  // WORKER SETUP
  self.onmessage = null;
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
  let options: ExportOptions = payload.options;
  let log = Log.fromSerialized(payload.log);
  try {
    resolve(await LogExporter.generateBin(log, options, progress));
  } catch (e) {
    reject();
  }
};

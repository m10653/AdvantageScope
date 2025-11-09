// import CommandLineHandler from "../../../main/CommandLineHandler";
import Log from "../../../shared/log/Log";
import { PROTO_PREFIX, STRUCT_PREFIX } from "../../../shared/log/LogUtil";
import LoggableType from "../../../shared/log/LoggableType";
import CustomSchemas from "../schema/CustomSchemas";
import { WPILOGDecoder } from "./WPILOGDecoder";
import WPILOGLoader from "./WPILOGFileLoader";
// import * as fs from "fs";
// var self = {
//   onmessage: function (tmp: any) {},
//   postMessage: function (data: any) {
//     return;
//     console.log(data.id + " " + data.progress);
//   }
// };

// function torun() {
//   //"D:\\FRC_20240302_141552_VAASH_P1.wpilog"
//   var file = "";
//   // file = "D:\\Robotics\\robotics logs\\FRC_20240302_141552_VAASH_P1.wpilog";
//   file = "D:\\Robotics\\robotics logs\\FRC_20240303_205029_VAASH_E10.wpilog";
//   // file = "D:\\Robotics\\robotics logs\\MIMIL_Q63_C8A241B2394C4853202020500E3318FF_2024-03-02_10-38-03.hoot.wpilog";
//   const buffer = fs.readFileSync(file);
//   console.profile();
//   // for (let i = 0; i < 5; i++) {
//   console.time("slow-big");
//   self.onmessage({ data: { id: 0, payload: [buffer] } });
//   console.timeEnd("slow-big");
//   // }

//   console.profileEnd();
//   console.log("Done");
// }
self.onmessage = async (event) => {
  // WORKER SETUP
  let { id, payload } = event.data;
  // function resolve(result: any) {
  //   self.postMessage({ id: id, payload: result });
  // }
  function progress(percent: number) {
    self.postMessage({ id: id, progress: percent });
  }
  function reject() {
    self.postMessage({ id: id });
  }

  // MAIN LOGIC

  // Run worker
  try {
    let outLog = WPILOGLoader.loadFile(payload[0], progress);
    self.postMessage({ id: id, payload: outLog.log });
  } catch (e) {
    reject();
  }
};

// torun();
// let cliHandler = new CommandLineHandler();
// cliHandler.parseArgs();
//   return log.toSerialized((x) => {
//     //TODO: Time limit/update limit progress updates here
//     if (progress) {
//       progress(0.2 + x * 0.8);
//     }
//   });
// }

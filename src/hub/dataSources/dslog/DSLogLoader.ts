import Log from "../../../shared/log/Log";
import { DSLogReader } from "./DSLogReader";

export default class DSLogLoader {
  static loadFile(data: Uint8Array, progress: ((percent: number) => void) | undefined = undefined): Log {
    if (progress) {
      progress(1); // Loading is fast and we don't know how long dslog vs dsevents will take
    }
    let log = new Log();
    let dsLog = new DSLogReader(data);
    if (!dsLog.isSupportedVersion()) {
      throw new Error("Unsupported dsLog version");
    }
    dsLog.forEach((entry) => {
      log.putNumber("/DSLog/TripTimeMS", entry.timestamp, entry.tripTimeMs);
      log.putNumber("/DSLog/PacketLoss", entry.timestamp, entry.packetLoss);
      log.putNumber("/DSLog/BatteryVoltage", entry.timestamp, entry.batteryVolts);
      log.putNumber("/DSLog/RioCPUUtilization", entry.timestamp, entry.rioCpuUtilization);
      log.putBoolean("/DSLog/Status/Brownout", entry.timestamp, entry.brownout);
      log.putBoolean("/DSLog/Status/Watchdog", entry.timestamp, entry.watchdog);
      log.putBoolean("/DSLog/Status/DSTeleop", entry.timestamp, entry.dsTeleop);
      log.putBoolean("/DSLog/Status/DSDisabled", entry.timestamp, entry.dsDisabled);
      log.putBoolean("/DSLog/Status/RobotTeleop", entry.timestamp, entry.robotTeleop);
      log.putBoolean("/DSLog/Status/RobotAuto", entry.timestamp, entry.robotAuto);
      log.putBoolean("/DSLog/Status/RobotDisabled", entry.timestamp, entry.robotDisabled);
      log.putNumber("/DSLog/CANUtilization", entry.timestamp, entry.canUtilization);
      log.putNumberArray("/DSLog/PowerDistributionCurrents", entry.timestamp, entry.powerDistributionCurrents);

      // Signal strength and bandwidth are not logged:
      // https://www.chiefdelphi.com/t/alternate-viewer-for-driver-station-logs-dslog/120629/11
      //
      // log.putNumber("/DSLog/WifiDb", entry.timestamp, entry.wifiDb);
      // log.putNumber("/DSLog/WifiMb", entry.timestamp, entry.wifiMb);
    });
    return log;
  }
}

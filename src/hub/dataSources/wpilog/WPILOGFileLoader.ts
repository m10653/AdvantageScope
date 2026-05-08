import Log from "../../../shared/log/Log";
import fs from "fs";
import { WPILOGDecoder } from "./WPILOGDecoder";
import LoggableType from "../../../shared/log/LoggableType";
import { PROTO_PREFIX, STRUCT_PREFIX } from "../../../shared/log/LogUtil";
import CustomSchemas from "../schema/CustomSchemas";
abstract class LogLoader {}

export default class WPILOGLoader extends LogLoader {
  static loadFile(
    data: Uint8Array,
    progress: ((percent: number) => void) | undefined = undefined
  ): { serializedLog: any; log: Log } {
    let log = new Log(false);
    let reader = new WPILOGDecoder(data);
    let totalBytes = data.byteLength;
    let entryIds: { [id: number]: string } = {};
    let entryTypes: { [id: number]: string } = {};
    let lastProgressTimestamp = new Date().getTime();
    reader.forEach((record, byteCount) => {
      if (record.isControl()) {
        if (record.isStart()) {
          let startData = record.getStartData();
          entryIds[startData.entry] = startData.name;
          entryTypes[startData.entry] = startData.type;
          switch (startData.type) {
            case "boolean":
              log.createBlankField(startData.name, LoggableType.Boolean);
              break;
            case "int":
            case "int64":
            case "float":
            case "double":
              log.createBlankField(startData.name, LoggableType.Number);
              break;
            case "string":
            case "json":
              log.createBlankField(startData.name, LoggableType.String);
              break;
            case "boolean[]":
              log.createBlankField(startData.name, LoggableType.BooleanArray);
              break;
            case "int[]":
            case "int64[]":
            case "float[]":
            case "double[]":
              log.createBlankField(startData.name, LoggableType.NumberArray);
              break;
            case "string[]":
              log.createBlankField(startData.name, LoggableType.StringArray);
              break;
            default: // Default to raw
              log.createBlankField(startData.name, LoggableType.Raw);
              break;
          }
          log.setWpilibType(startData.name, startData.type);
          log.setMetadataString(startData.name, startData.metadata);
        } else if (record.isSetMetadata()) {
          let setMetadataData = record.getSetMetadataData();
          if (setMetadataData.entry in entryIds) {
            log.setMetadataString(entryIds[setMetadataData.entry], setMetadataData.metadata);
          }
        }
      } else {
        let key = entryIds[record.getEntry()];
        let type = entryTypes[record.getEntry()];
        let timestamp = Math.max(0, record.getTimestamp() / 1000000.0);
        if (key && type) {
          try {
            switch (type) {
              case "boolean":
                log.putBoolean(key, timestamp, record.getBoolean());
                break;
              case "int":
              case "int64":
                log.putNumber(key, timestamp, record.getInteger());
                break;
              case "float":
                log.putNumber(key, timestamp, record.getFloat());
                break;
              case "double":
                log.putNumber(key, timestamp, record.getDouble());
                break;
              case "string":
                log.putString(key, timestamp, record.getString());
                break;
              case "boolean[]":
                log.putBooleanArray(key, timestamp, record.getBooleanArray());
                break;
              case "int[]":
              case "int64[]":
                log.putNumberArray(key, timestamp, record.getIntegerArray());
                break;
              case "float[]":
                log.putNumberArray(key, timestamp, record.getFloatArray());
                break;
              case "double[]":
                log.putNumberArray(key, timestamp, record.getDoubleArray());
                break;
              case "string[]":
                log.putStringArray(key, timestamp, record.getStringArray());
                break;
              case "json":
                log.putJSON(key, timestamp, record.getString());
                break;
              case "msgpack":
                log.putMsgpack(key, timestamp, record.getRaw());
                break;
              default: // Default to raw
                if (type.startsWith(STRUCT_PREFIX)) {
                  let schemaType = type.split(STRUCT_PREFIX)[1];
                  if (schemaType.endsWith("[]")) {
                    log.putStruct(key, timestamp, record.getRaw(), schemaType.slice(0, -2), true);
                  } else {
                    log.putStruct(key, timestamp, record.getRaw(), schemaType, false);
                  }
                } else if (type.startsWith(PROTO_PREFIX)) {
                  let schemaType = type.split(PROTO_PREFIX)[1];
                  log.putProto(key, timestamp, record.getRaw(), schemaType);
                } else {
                  log.putRaw(key, timestamp, record.getRaw());
                  if (CustomSchemas.has(type)) {
                    try {
                      CustomSchemas.get(type)!(log, key, timestamp, record.getRaw());
                    } catch {
                      console.error('Failed to decode custom schema "' + type + '"');
                    }
                    log.setGeneratedParent(key);
                  }
                }
                break;
            }
          } catch (error) {
            console.error("Failed to decode WPILOG record:", error);
          }
        }
      }

      if (progress) {
        // Send progress update
        let now = new Date().getTime();
        if (now - lastProgressTimestamp > 1000 / 60) {
          lastProgressTimestamp = now;
          progress((byteCount / totalBytes) * 0.2);
        }
      }
    });

    return {
      serializedLog: log.toSerialized((x) => {
        //TODO: need to remove this hack, only way to finish import is to serialize the log even though that is not needed all the times and is not clear/transparent what is actualy happening.
        //TODO: Time limit/update limit progress updates here
        if (progress) {
          progress(0.2 + x * 0.8);
        }
      }),
      log: log
    };
  }
}

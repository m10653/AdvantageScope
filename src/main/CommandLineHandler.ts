import { ArgumentParser, SubParser } from "argparse";
import DSEventsLoader from "../hub/dataSources/dslog/DSEventsLoader";
import DSLogLoader from "../hub/dataSources/dslog/DSLogLoader";
import RLOGDecoder from "../hub/dataSources/rlog/RLOGDecoder";
import WPILOGLoader from "../hub/dataSources/wpilog/WPILOGFileLoader";
import LogExporter from "../hub/LogExporter";
import ExportOptions from "../shared/ExportOptions";
import Log from "../shared/log/Log";
import { PREFS_FILENAME } from "./electron/ElectronConstants";
import { convertHoot } from "./electron/owletInterface";
import fs from "fs";
import path from "path";

export default class CommandLineHandler {
  private parser: ArgumentParser;
  private subparsers: SubParser;

  constructor() {
    this.parser = new ArgumentParser({
      description: "AdvantageScope CLI"
    });

    this.subparsers = this.parser.add_subparsers({
      title: "subcommands",
      description: "AdvantageScope subcommands",
      help: "Additional help",
      dest: "command"
    });

    this.setupConvertParser();
  }

  public async parseArgs() {
    let out = this.parser.parse_args();

    if (out.command === "convert") {
      let logs: Log[] = [];
      for (let file of out.input) {
        try {
          let label = path.basename(file);
          let log = await this.loadLog(file, {
            acceptCtreLicense: out["accept-ctre-license"],
            progress: (v) => this.showProgress(`Loading ${label}`, v)
          });
          this.clearProgress();
          logs.push(log);
        } catch (e) {
          this.clearProgress();
          process.stderr.write(`error: Failed to load ${file}: ${e}\n`);
          process.exit(1);
        }
      }
      if (logs.length === 0) {
        this.parser.error("No logs loaded");
        process.exit(1);
      }
      let mergedLog = logs[0];
      for (let i = 1; i < logs.length; i++) {
        mergedLog.mergeWith(logs[i]);
      }
      let options: ExportOptions = {
        format: out.format,
        samplingMode: out["sampling-mode"],
        samplingPeriod: out["sampling-period"],
        prefixes: out.prefixes,
        includeGenerated: out["include-generated"]
      };
      let result: Uint8Array | string;
      try {
        result = await LogExporter.generateBin(mergedLog, options, (v) =>
          this.showProgress("Exporting", v)
        );
      } catch (e) {
        this.clearProgress();
        process.stderr.write(`error: Export failed: ${e}\n`);
        process.exit(1);
      }
      this.clearProgress();
      fs.writeFileSync(out.output, result!);
      process.stderr.write(`Done: ${out.output}\n`);
    }
  }

  private async loadLog(
    file: string,
    opts: { acceptCtreLicense: boolean; progress: (v: number) => void }
  ): Promise<Log> {
    let data = fs.readFileSync(file);

    if (file.endsWith(".wpilog")) {
      return WPILOGLoader.loadFile(data, opts.progress).log;
    }

    if (file.endsWith(".rlog")) {
      let log = new Log(false);
      let decoder = new RLOGDecoder(true);
      if (!decoder.decode(log, data, opts.progress)) {
        throw new Error("RLOGDecoder reported failure");
      }
      return log;
    }

    if (file.endsWith(".dslog")) {
      let log = DSLogLoader.loadFile(data);
      let eventsPath = file.slice(0, -".dslog".length) + ".dsevents";
      if (fs.existsSync(eventsPath)) {
        log.mergeWith(DSEventsLoader.loadFile(fs.readFileSync(eventsPath)));
      }
      return log;
    }

    if (file.endsWith(".dsevents")) {
      return DSEventsLoader.loadFile(data);
    }

    if (file.endsWith(".hoot")) {
      return this.loadHoot(file, opts.acceptCtreLicense, opts.progress);
    }

    throw new Error(`Unrecognized file extension. Supported: .wpilog, .rlog, .dslog, .dsevents, .hoot`);
  }

  private async loadHoot(
    file: string,
    acceptCtreLicense: boolean,
    progress: (v: number) => void
  ): Promise<Log> {
    let prefs: { ctreLicenseAccepted?: boolean } = {};
    if (fs.existsSync(PREFS_FILENAME)) {
      try {
        prefs = JSON.parse(fs.readFileSync(PREFS_FILENAME, "utf8"));
      } catch {}
    }

    if (!prefs.ctreLicenseAccepted) {
      if (!acceptCtreLicense) {
        throw new Error(
          "Hoot decoding requires agreement to the CTRE license.\n" +
            "  Pass --accept-ctre-license to accept and proceed, or open AdvantageScope GUI to accept first.\n" +
            "  License: https://raw.githubusercontent.com/CrossTheRoadElec/Phoenix-Releases/refs/heads/master/CTRE_LICENSE.txt"
        );
      }
      prefs.ctreLicenseAccepted = true;
      fs.writeFileSync(PREFS_FILENAME, JSON.stringify(prefs, null, 2));
    }

    let wpilogPath = await convertHoot(file);
    try {
      return WPILOGLoader.loadFile(fs.readFileSync(wpilogPath), progress).log;
    } finally {
      fs.rmSync(wpilogPath, { force: true });
    }
  }

  private showProgress(label: string, value: number) {
    let pct = Math.round(value * 100);
    process.stderr.write(`\r${label}: ${pct}%   `);
  }

  private clearProgress() {
    process.stderr.write("\r\x1b[K");
  }

  private validateInputPath(filename: string): string {
    if (!fs.existsSync(filename)) {
      this.parser.error(`Input file not found: ${filename}`);
    }
    return filename;
  }

  private validateOutputPath(filename: string): string {
    let dir = path.dirname(path.resolve(filename));
    if (!fs.existsSync(dir)) {
      this.parser.error(`Output directory does not exist: ${dir}`);
    }
    if (fs.existsSync(filename)) {
      process.stderr.write(`warning: output file will be overwritten: ${filename}\n`);
    }
    return filename;
  }

  private setupConvertParser() {
    const convertParser = this.subparsers.add_parser("convert", { help: "Convert log files" });

    convertParser.add_argument("--input", {
      help: "Input log files (.wpilog, .rlog, .dslog, .dsevents, .hoot)",
      required: true,
      type: (x: string) => this.validateInputPath(x),
      nargs: "+"
    });

    convertParser.add_argument("--output", {
      help: "Output file path",
      required: true,
      type: (x: string) => this.validateOutputPath(x)
    });

    convertParser.add_argument("--format", {
      help: "Export format",
      choices: ["csv-table", "csv-list", "wpilog", "mcap"],
      required: true
    });

    convertParser.add_argument("--sampling-mode", {
      help: "Sampling mode (default: changes)",
      choices: ["changes", "fixed", "akit"],
      default: "changes",
      required: false
    });

    convertParser.add_argument("--sampling-period", {
      help: "Sampling period in milliseconds (default: 20, used with --sampling-mode fixed)",
      default: 20,
      type: "int",
      required: false
    });

    convertParser.add_argument("--prefixes", {
      help: "Comma-separated field prefixes to include (default: all fields)",
      default: "",
      required: false
    });

    convertParser.add_argument("--include-generated", {
      help: "Include generated/derived fields (default: true)",
      default: true,
      action: "store_true",
      required: false
    });

    convertParser.add_argument("--accept-ctre-license", {
      help: "Accept the CTRE license agreement required for .hoot file decoding",
      default: false,
      action: "store_true",
      required: false
    });
  }
}

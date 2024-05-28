import * as path from "path";
import { platform } from "os";
import { Stream } from "stream";
import { exec } from "child_process";

type ErrorData = {
  line: number;
  message: string;
};

const VERTEX_EXTS = ["vert", "vs"];
const FRAGMENT_EXTS = ["frag", "fs"];

export class ErrorManager {
  static async checkSource(content: string, stage: string): Promise<ErrorData[]> {
    const platformName = this.getPlatformName();

    // Base is the path where this file is located
    const base = path.resolve(__dirname, "..");
    const validatorPath = path.join(base, "bin", `glslangValidator${platformName}`);
    const result = exec(`${validatorPath} --stdin -C -S ${stage}`);

    if (!result.stdout || !result.stdin) {
      return [];
    }

    const errors: ErrorData[] = [];

    // Handle errors from the validator
    result.stdout.on("data", (data: string) => {
      const linesWithErrors = this.getLinesWithErrors(data);
      errors.push(...linesWithErrors.map(this.getErrorData));
    });

    // Stream the file content to the validator
    const stdinStream = new Stream.Readable();
    stdinStream.push(content);
    stdinStream.push(null);
    stdinStream.pipe(result.stdin);

    return new Promise((resolve) => {
      result.on("close", () => {
        resolve(errors);
      });
    });
  }

  static getErrorData(row: string): {
    line: number;
    message: string;
  } {
    // Remove the error or warning prefix
    if (row.startsWith("ERROR: 0:")) {
      row = row.substring(9);
    } else if (row.startsWith("WARNING: 0:")) {
      row = row.substring(11);
    } else {
      return { line: -1, message: row };
    }

    // Find the line number
    const colonIndex = row.indexOf(":");
    const line = Number(row.substring(0, colonIndex));
    const message = row.substring(colonIndex + 1).trim();
    return { line, message };
  }

  static getStageName(filePath: string): string {
    const [ext1, ext2] = path.extname(filePath).split(".");

    if (VERTEX_EXTS.includes(ext1) || VERTEX_EXTS.includes(ext2)) {
      return "vert";
    }

    if (FRAGMENT_EXTS.includes(ext1) || FRAGMENT_EXTS.includes(ext2)) {
      return "frag";
    }

    throw new Error("Unsupported file extension");
  }

  static getLinesWithErrors(data: string): string[] {
    const rows = data.split("\n");
    const results: string[] = [];

    for (const row of rows) {
      if (row.startsWith("ERROR: ") || row.startsWith("WARNING: ")) {
        results.push(row);
      }
    }

    return results;
  }

  static getPlatformName(): string {
    switch (platform()) {
      case "win32":
        return "Windows";
      case "linux":
        return "Linux";
      case "darwin":
        return "Mac";
      default:
        throw new Error("Unsupported platform");
    }
  }
}

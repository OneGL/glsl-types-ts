import path from "path";
import fs from "fs/promises";
import { Graph } from "./graph";

const VALID_EXTENSIONS = [".glsl", ".vert", ".vs", ".fs", ".frag", ".comp", ".geom", ".tesc", ".tese"];

export class IncludeResolver {
  private graph: Graph = new Graph();
  private files: Map<string, string> = new Map();

  static async resolve(filePath: string): Promise<string> {
    filePath = path.resolve(filePath);
    const includeGraph = new IncludeResolver();
    await includeGraph.buildIncludeGraph(filePath);
    return await includeGraph.combineFiles(filePath);
  }

  private async combineFiles(filePath: string): Promise<string> {
    let output = "";

    const neighbors = this.graph.getNeighbors(filePath);

    for (const neighbor of neighbors) {
      output += await this.combineFiles(neighbor);
    }

    output += await this.getFile(filePath);

    return output;
  }

  private async getFile(filePath: string): Promise<string> {
    let content = this.files.get(filePath);

    if (content) {
      return content;
    }

    content = await fs.readFile(filePath, "utf-8");
    this.files.set(filePath, content);
    return content;
  }

  private async buildIncludeGraph(filePath: string): Promise<Graph> {
    const neighbors = await this.getIncludes(filePath);

    for (const neighbor of neighbors) {
      this.graph.addEdge(filePath, neighbor);

      if (this.graph.hasCycle()) {
        throw new Error(`Cycle detected in import graph`);
      }

      await this.buildIncludeGraph(neighbor);
    }

    return this.graph;
  }

  private async getIncludes(filePath: string): Promise<string[]> {
    let includes: string[] = [];
    const content = await this.getFile(filePath);

    const INCLUDE_REGEX = /\s*#\s*include\s+"(.*?)"\s*/g;

    let match;
    while ((match = INCLUDE_REGEX.exec(content))) {
      const importedFile = match[1];

      if (!VALID_EXTENSIONS.includes(path.extname(importedFile))) {
        console.warn(`The file ${importedFile} is not a valid glsl file`);
        continue;
      }

      includes.push(this.getAbsolutePath(importedFile, filePath));
    }

    return includes;
  }

  private getAbsolutePath(filePath: string, parentPath: string): string {
    if (filePath.startsWith(".")) {
      return path.resolve(path.dirname(parentPath), filePath);
    }

    return filePath;
  }
}

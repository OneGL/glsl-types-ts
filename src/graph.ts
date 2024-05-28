export class Graph {
  private adjList: Map<string, string[]>;

  constructor() {
    this.adjList = new Map();
  }

  addEdge(src: string, dest: string): void {
    const neighbors = this.adjList.get(src);

    if (neighbors) {
      neighbors.push(dest);
    } else {
      this.adjList.set(src, [dest]);
    }
  }

  getNeighbors(node: string): string[] {
    return this.adjList.get(node) || [];
  }

  private dfs(node: string, visited: Set<string>, recStack: Set<string>): boolean {
    if (recStack.has(node)) {
      return true;
    }

    if (visited.has(node)) {
      return false;
    }

    visited.add(node);
    recStack.add(node);

    const neighbors = this.adjList.get(node) || [];
    for (const neighbor of neighbors) {
      if (this.dfs(neighbor, visited, recStack)) {
        return true;
      }
    }

    recStack.delete(node);
    return false;
  }

  hasCycle(): boolean {
    const visited = new Set<string>();
    const recStack = new Set<string>();

    const nodes = Array.from(this.adjList.keys());

    for (const node of nodes) {
      if (this.dfs(node, visited, recStack)) {
        return true;
      }
    }

    return false;
  }
}

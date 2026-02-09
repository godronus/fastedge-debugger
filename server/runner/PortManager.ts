/**
 * Port Manager
 *
 * Manages port allocation for HTTP WASM server instances
 * Allocates ports from 8100-8199 range
 */

export class PortManager {
  private readonly minPort = 8100;
  private readonly maxPort = 8199;
  private allocatedPorts = new Set<number>();
  private lastAllocatedPort = this.minPort - 1; // Track last allocated port for sequential allocation

  /**
   * Allocate an available port from the pool
   * Sequential allocation to avoid reusing recently released ports (TCP TIME_WAIT)
   * Synchronous to prevent race conditions when allocating in parallel
   * @returns The allocated port number
   * @throws Error if no ports are available
   */
  allocate(): number {
    // Try ports sequentially starting from the last allocated port
    for (let offset = 1; offset <= (this.maxPort - this.minPort + 1); offset++) {
      const port = this.minPort + ((this.lastAllocatedPort - this.minPort + offset) % (this.maxPort - this.minPort + 1));
      if (!this.allocatedPorts.has(port)) {
        this.allocatedPorts.add(port);
        this.lastAllocatedPort = port;
        return port;
      }
    }

    throw new Error(
      `No available ports in range ${this.minPort}-${this.maxPort}. All ports are allocated.`
    );
  }

  /**
   * Release a previously allocated port back to the pool
   * @param port The port number to release
   */
  release(port: number): void {
    this.allocatedPorts.delete(port);
  }

  /**
   * Get the number of currently allocated ports
   */
  getAllocatedCount(): number {
    return this.allocatedPorts.size;
  }

  /**
   * Get the number of available ports
   */
  getAvailableCount(): number {
    return this.maxPort - this.minPort + 1 - this.allocatedPorts.size;
  }

  /**
   * Check if a specific port is allocated
   */
  isAllocated(port: number): boolean {
    return this.allocatedPorts.has(port);
  }

  /**
   * Reset all allocations (useful for testing)
   */
  reset(): void {
    this.allocatedPorts.clear();
  }
}

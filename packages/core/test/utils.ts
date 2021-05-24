export function waitTime(timeout: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, timeout));
}

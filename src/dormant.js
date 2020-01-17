// @flow

/*
dormant XX million sec
 */
export function dormant(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Truncate number to 2 decimal places
export function truncate2(num: number): number {
    return num < 0
      ? Math.ceil(num * 100) / 100     // negative → towards zero
      : Math.floor(num * 100) / 100;   // positive → towards zero
}
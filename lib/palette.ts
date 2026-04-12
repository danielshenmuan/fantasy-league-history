export const PALETTE = [
  "#E69F00",
  "#56B4E9",
  "#009E73",
  "#F0E442",
  "#0072B2",
  "#D55E00",
  "#CC79A7",
  "#000000",
  "#999999",
  "#882255",
];

export function colorForManager(
  guid: string,
  managers: { manager_guid: string }[],
): string {
  const idx = managers.findIndex((m) => m.manager_guid === guid);
  return PALETTE[idx % PALETTE.length] ?? PALETTE[0];
}

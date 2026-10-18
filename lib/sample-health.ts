/**
 * DESIGN PREVIEW ONLY. A real assessment from the analyst engine (v0.3.0) for one sample roster,
 * pasted in so the page can be designed before the data endpoint exists. Percentiles and bands only:
 * raw Fantasy Value totals stay internal.
 */
export type Band = "elite" | "strong" | "neutral" | "weak";
export type Confidence = "high" | "medium" | "low" | "none";

export const SAMPLE = {
  teamLabel: "Sample team",
  league: "14 teams · 9 categories · 13 roster spots",
  categories: [
    { key: "AST", label: "Assists", percentile: 96, band: "elite" },
    { key: "3PM", label: "3-pointers", percentile: 84, band: "strong" },
    { key: "FT%", label: "Free throw %", percentile: 79, band: "strong" },
    { key: "STL", label: "Steals", percentile: 48, band: "neutral" },
    { key: "PTS", label: "Points", percentile: 46, band: "neutral" },
    { key: "BLK", label: "Blocks", percentile: 38, band: "weak" },
    { key: "REB", label: "Rebounds", percentile: 28, band: "weak" },
    { key: "TO", label: "Turnovers", hint: "fewer is better", percentile: 11, band: "weak" },
    { key: "FG%", label: "Field goal %", percentile: 5, band: "weak" },
  ] as { key: string; label: string; hint?: string; percentile: number; band: Band }[],
  roster: [
    { name: "James Harden", confidence: "high", note: "" },
    { name: "Josh Giddey", confidence: "high", note: "" },
    { name: "Darius Garland", confidence: "high", note: "" },
    { name: "Jayson Tatum", confidence: "medium", note: "Returning from injury: leans on his earlier seasons." },
    { name: "Cameron Boozer", confidence: "none", note: "No NBA data yet: counted as an average player." },
    { name: "Quentin Grimes", confidence: "high", note: "" },
    { name: "Onyeka Okongwu", confidence: "high", note: "" },
    { name: "Damian Lillard", confidence: "medium", note: "Missed last season: estimated from the two before." },
    { name: "Kevin Porter Jr.", confidence: "medium", note: "" },
    { name: "Dereck Lively II", confidence: "low", note: "Small sample: treat with care." },
    { name: "Kristaps Porzingis", confidence: "medium", note: "" },
    { name: "Herbert Jones", confidence: "medium", note: "" },
    { name: "Gui Santos", confidence: "high", note: "" },
    { name: "Max Strus", confidence: "medium", note: "On IL: not counted.", il: true },
  ] as { name: string; confidence: Confidence; note: string; il?: boolean }[],
  assumptions: [
    "Players are estimated from their last three seasons, weighted toward the most recent and capped at 65 games a season. Aging and role changes are not modelled.",
    "Your team is compared with 500 simulated 14-team snake drafts, where each pick is one of the best five players left. Positions are ignored.",
    "Every counted player's production is added up. Daily lineup limits are not modelled.",
    "Bands by percentile among simulated teams: elite 85 and up, strong 60 and up, neutral 40 and up, otherwise weak.",
    "Players with no NBA data count as an average rostered player.",
  ],
};

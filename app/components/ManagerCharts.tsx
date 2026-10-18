"use client";

import { tokens } from "@/lib/tokens";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Row = {
  year: number;
  rank: number;
  wins: number;
  losses: number;
  points_for: number;
  league_avg: number;
  team_name: string;
};

export default function ManagerCharts({ seasons }: { seasons: Row[] }) {
  return (
    <div className="space-y-12">
      <section>
        <h2 className="title-2 mb-6 text-ink">Rank by year</h2>
        <div className="h-64">
          <ResponsiveContainer>
            <LineChart data={seasons}>
              <CartesianGrid strokeDasharray="3 3" stroke={tokens.hairline} />
              <XAxis dataKey="year" stroke={tokens.ink} />
              <YAxis reversed domain={[1, "dataMax"]} allowDecimals={false} stroke={tokens.ink} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="rank"
                stroke={tokens.primary}
                strokeWidth={3}
                dot={{ r: 5, fill: tokens.primary }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section>
        <h2 className="title-2 mb-6 text-ink">Wins / losses by year</h2>
        <div className="h-64">
          <ResponsiveContainer>
            <BarChart data={seasons}>
              <CartesianGrid strokeDasharray="3 3" stroke={tokens.hairline} />
              <XAxis dataKey="year" stroke={tokens.ink} />
              <YAxis stroke={tokens.ink} />
              <Tooltip />
              <Legend />
              <Bar dataKey="wins" stackId="a" fill={tokens.primary} />
              <Bar dataKey="losses" stackId="a" fill={tokens.chip} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

    </div>
  );
}

"use client";

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
        <h2 className="text-xl font-semibold mb-4 text-[#14213D]">Rank by year</h2>
        <div className="h-64">
          <ResponsiveContainer>
            <LineChart data={seasons}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
              <XAxis dataKey="year" stroke="#14213D" />
              <YAxis reversed domain={[1, "dataMax"]} allowDecimals={false} stroke="#14213D" />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="rank"
                stroke="#FCA311"
                strokeWidth={3}
                dot={{ r: 5, fill: "#FCA311" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4 text-[#14213D]">Wins / losses by year</h2>
        <div className="h-64">
          <ResponsiveContainer>
            <BarChart data={seasons}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
              <XAxis dataKey="year" stroke="#14213D" />
              <YAxis stroke="#14213D" />
              <Tooltip />
              <Legend />
              <Bar dataKey="wins" stackId="a" fill="#FCA311" />
              <Bar dataKey="losses" stackId="a" fill="#14213D" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

    </div>
  );
}

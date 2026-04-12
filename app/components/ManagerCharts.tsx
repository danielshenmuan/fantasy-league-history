"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
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

      <section>
        <h2 className="text-xl font-semibold mb-4 text-[#14213D]">
          Points for vs league average
        </h2>
        <div className="h-64">
          <ResponsiveContainer>
            <LineChart data={seasons}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
              <XAxis dataKey="year" stroke="#14213D" />
              <YAxis stroke="#14213D" />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="points_for"
                stroke="#FCA311"
                strokeWidth={3}
                name="You"
                dot={{ r: 4, fill: "#FCA311" }}
              />
              <Line
                type="monotone"
                dataKey="league_avg"
                stroke="#14213D"
                strokeDasharray="4 4"
                strokeWidth={2}
                name="League avg"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}

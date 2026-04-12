#!/usr/bin/env bun
import { getDevYahooClient } from "@/lib/yahoo/dev-client";

const client = getDevYahooClient();
if (!client) throw new Error("No dev client");

const key = process.argv[2] ?? "454.l.8876";
const parsed = await client.get<any>(`/league/${key}/standings`);
const teams = parsed?.fantasy_content?.league?.standings?.teams?.team ?? [];
const first = Array.isArray(teams) ? teams[0] : teams;
console.log(JSON.stringify(first, null, 2));
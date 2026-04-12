#!/usr/bin/env bun
import { getDevYahooClient } from "@/lib/yahoo/dev-client";

const client = getDevYahooClient();
if (!client) throw new Error("No dev client");

const key = process.argv[2] ?? "466.l.13411";
const parsed = await client.get<any>(`/league/${key};out=metadata`);
console.log(JSON.stringify(parsed, null, 2));
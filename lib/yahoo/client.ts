import { XMLParser } from "fast-xml-parser";

const YAHOO_TOKEN_URL = "https://api.login.yahoo.com/oauth2/get_token";
const YAHOO_FANTASY_BASE = "https://fantasysports.yahooapis.com/fantasy/v2";

export type YahooTokens = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
};

const xml = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseTagValue: true,
  trimValues: true,
});

export class YahooClient {
  private tokens: YahooTokens;
  private clientId: string;
  private clientSecret: string;
  private lastRequestAt = 0;
  private readonly minRequestSpacingMs = 1000;

  constructor(opts: {
    tokens: YahooTokens;
    clientId: string;
    clientSecret: string;
  }) {
    this.tokens = opts.tokens;
    this.clientId = opts.clientId;
    this.clientSecret = opts.clientSecret;
  }

  getTokens(): YahooTokens {
    return this.tokens;
  }

  private async ensureFreshToken(): Promise<void> {
    if (Date.now() < this.tokens.expires_at - 60_000) return;
    const body = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      redirect_uri: "oob",
      refresh_token: this.tokens.refresh_token,
      grant_type: "refresh_token",
    });
    const res = await fetch(YAHOO_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!res.ok) {
      throw new Error(`Yahoo token refresh failed: ${res.status} ${await res.text()}`);
    }
    const json = (await res.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };
    this.tokens = {
      access_token: json.access_token,
      refresh_token: json.refresh_token ?? this.tokens.refresh_token,
      expires_at: Date.now() + json.expires_in * 1000,
    };
  }

  private async throttle(): Promise<void> {
    const elapsed = Date.now() - this.lastRequestAt;
    if (elapsed < this.minRequestSpacingMs) {
      await new Promise((r) => setTimeout(r, this.minRequestSpacingMs - elapsed));
    }
    this.lastRequestAt = Date.now();
  }

  async get<T = unknown>(path: string, retries = 3): Promise<T> {
    await this.ensureFreshToken();
    await this.throttle();
    const url = path.startsWith("http") ? path : `${YAHOO_FANTASY_BASE}${path}`;
    let lastErr: unknown;
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${this.tokens.access_token}`,
            Accept: "application/xml",
          },
        });
        if (res.status === 999 || (res.status >= 500 && res.status < 600)) {
          throw new Error(`Yahoo transient error ${res.status}`);
        }
        if (!res.ok) {
          throw new Error(`Yahoo error ${res.status}: ${await res.text()}`);
        }
        const text = await res.text();
        return xml.parse(text) as T;
      } catch (err) {
        lastErr = err;
        const backoff = 500 * Math.pow(2, attempt);
        await new Promise((r) => setTimeout(r, backoff));
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
  }
}

export function buildAuthorizeUrl(opts: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const params = new URLSearchParams({
    client_id: opts.clientId,
    redirect_uri: opts.redirectUri,
    response_type: "code",
    scope: "fspt-r",
    state: opts.state,
  });
  return `https://api.login.yahoo.com/oauth2/request_auth?${params}`;
}

export async function exchangeCode(opts: {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  code: string;
}): Promise<YahooTokens> {
  const body = new URLSearchParams({
    client_id: opts.clientId,
    client_secret: opts.clientSecret,
    redirect_uri: opts.redirectUri,
    code: opts.code,
    grant_type: "authorization_code",
  });
  const res = await fetch(YAHOO_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new Error(`Yahoo code exchange failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };
  return {
    access_token: json.access_token,
    refresh_token: json.refresh_token,
    expires_at: Date.now() + json.expires_in * 1000,
  };
}

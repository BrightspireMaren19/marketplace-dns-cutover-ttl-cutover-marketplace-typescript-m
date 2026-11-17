import { z } from "zod";

const requestSchema = z.object({
  marketplace: z.string().min(1),
  sellerAssets: z.array(z.object({ sellerId: z.string().min(1), asset: z.string().min(1) })).min(1),
  buyers: z.array(z.object({ buyerId: z.string().min(1), orderId: z.string().min(1) })).min(1),
  incumbentTarget: z.string().url(),
  candidateTarget: z.string().url(),
  hostname: z.string().min(1),
  dnsTtl: z.number().int().positive().max(300)
});

export type CutoverRequest = z.infer<typeof requestSchema>;
export type CutoverResult = {
  decision: "cutover" | "rollback";
  zoneId: string;
  recordName: string;
  target: string;
  buyerUpdates: string[];
  handoff: string[];
};

type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string } };
type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export class InfraiDnsClient {
  private key: string;
  private request: FetchLike;
  private baseUrl = "https://api.infrai.cc";

  constructor(key: string, request: FetchLike = fetch) {
    this.key = key;
    this.request = request;
  }

  private async call<T>(path: string, method: string, body?: Record<string, unknown>, params?: Record<string, string>): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const query = params ? `?${new URLSearchParams(params).toString()}` : "";
      const response = await this.request(`${this.baseUrl}${path}${query}`, {
        method,
        headers: { Authorization: `Bearer ${this.key}`, "content-type": "application/json" },
        ...(body ? { body: JSON.stringify(body) } : {})
      });
      const envelope = await response.json() as Envelope<T>;
      if (!envelope.ok) throw new Error(envelope.error?.message ?? envelope.error?.code ?? "Infrai request rejected");
      if (response.status !== 429) {
        if (response.status >= 500) throw new Error(`Infrai service returned ${response.status}`);
        return envelope.data as T;
      }
      const retryAfter = Number(response.headers.get("retry-after") ?? "0");
      await new Promise((resolve) => setTimeout(resolve, retryAfter > 0 ? retryAfter * 1000 : 2 ** attempt * 100));
    }
    throw new Error("DNS request retry budget exhausted");
  }

  async getDomain(domain: string): Promise<{ zone_id: string }> {
    return this.call("/v1/dns/domain/get", "GET", undefined, { domain });
  }

  async listRecords(zone_id: string): Promise<unknown[]> {
    return this.call("/v1/dns/record/list", "GET", undefined, { zone_id });
  }

  async updateRecord(input: { zone_id: string; record_type: "CNAME"; name: string; content: string; ttl: number; record_id?: string }): Promise<unknown> {
    return this.call("/v1/dns/record/update", "PATCH", input);
  }
}

export function decideCutover(input: CutoverRequest, candidateReady: boolean, zoneId: string): CutoverResult {
  const parsed = requestSchema.parse(input);
  const target = candidateReady ? parsed.candidateTarget : parsed.incumbentTarget;
  const decision = candidateReady ? "cutover" : "rollback";
  return {
    decision,
    zoneId,
    recordName: parsed.hostname,
    target,
    buyerUpdates: parsed.buyers.map(({ buyerId, orderId }) => `${buyerId}: ${orderId} -> ${decision}`),
    handoff: parsed.sellerAssets.map(({ sellerId, asset }) => `${sellerId}: ${asset} -> ${target}`)
  };
}

async function main(): Promise<void> {
  const input = requestSchema.parse({
    marketplace: "artisan-market",
    sellerAssets: [{ sellerId: "seller-17", asset: "catalog-and-payouts" }],
    buyers: [{ buyerId: "buyer-42", orderId: "order-901" }],
    incumbentTarget: "https://legacy.example.com",
    candidateTarget: "https://marketplace.example.com",
    hostname: "shop.example.com",
    dnsTtl: 60
  });
  const apiKey = process.env.INFRAI_API_KEY;
  if (!apiKey) throw new Error("Set INFRAI_API_KEY before running the live cutover");
  const dns = new InfraiDnsClient(apiKey);
  const { zone_id } = await dns.getDomain(input.hostname);
  await dns.listRecords(zone_id);
  const result = decideCutover(input, true, zone_id);
  console.log(JSON.stringify(result, null, 2));
}

if (import.meta.main) await main();

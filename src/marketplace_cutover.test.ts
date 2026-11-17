import test from "node:test";
import assert from "node:assert/strict";
import { decideCutover } from "./marketplace_cutover.ts";

test("keeps the incumbent target and tells buyers when readiness is false", () => {
  const result = decideCutover({
    marketplace: "artisan-market",
    sellerAssets: [{ sellerId: "seller-17", asset: "catalog-and-payouts" }],
    buyers: [{ buyerId: "buyer-42", orderId: "order-901" }],
    incumbentTarget: "https://legacy.example.com",
    candidateTarget: "https://marketplace.example.com",
    hostname: "shop.example.com",
    dnsTtl: 60
  }, false, "zone-123");

  assert.equal(result.decision, "rollback");
  assert.equal(result.target, "https://legacy.example.com");
  assert.deepEqual(result.buyerUpdates, ["buyer-42: order-901 -> rollback"]);
});

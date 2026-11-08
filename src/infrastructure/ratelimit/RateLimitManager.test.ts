import { describe, it, expect } from "bun:test";
import { UtilClientIp } from "./UtilClientIp";

describe("UtilClientIp", () => {
  const server = { requestIP: () => ({ address: "192.0.2.10" }) };
  const req = (xff?: string) =>
    new Request("http://localhost/", {
      headers: xff ? { "x-forwarded-for": xff } : {},
    });

  it("[SEC-07] ignores X-Forwarded-For when no proxy is trusted", () => {
    expect(UtilClientIp.resolve(req("203.0.113.1"), server, 0)).toBe(
      "192.0.2.10",
    );
  });

  it("[SEC-07] takes the entry at position -hops when proxies are trusted", () => {
    expect(UtilClientIp.resolve(req("1.1.1.1, 2.2.2.2"), server, 1)).toBe(
      "2.2.2.2",
    );
    expect(
      UtilClientIp.resolve(req("1.1.1.1, 2.2.2.2, 3.3.3.3"), server, 2),
    ).toBe("2.2.2.2");
    // Fewer entries than trusted hops → the socket address.
    expect(UtilClientIp.resolve(req("2.2.2.2"), server, 3)).toBe("192.0.2.10");
    expect(UtilClientIp.resolve(req(), null, 1)).toBe("unknown");
  });
});

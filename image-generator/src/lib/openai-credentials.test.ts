import { describe, expect, it } from "vitest";

import { parseOpenAICredentials } from "./openai-credentials";

function headers(apiKey = "sk-test", baseURL?: string) {
  const values = new Headers({ "x-openai-api-key": apiKey });

  if (baseURL !== undefined) {
    values.set("x-openai-base-url", baseURL);
  }

  return values;
}

describe("parseOpenAICredentials", () => {
  it("accepts and trims an API key with the official endpoint default", () => {
    expect(parseOpenAICredentials(headers("  sk-test  "))).toEqual({
      ok: true,
      data: { apiKey: "sk-test", baseURL: undefined },
    });
  });

  it("rejects a missing API key", () => {
    expect(parseOpenAICredentials(new Headers())).toEqual({
      ok: false,
      error: "请输入 API Key。",
    });
  });

  it("rejects a blank API key", () => {
    expect(parseOpenAICredentials(headers("   "))).toEqual({
      ok: false,
      error: "请输入 API Key。",
    });
  });

  it("normalizes a compatible HTTPS endpoint", () => {
    expect(parseOpenAICredentials(headers("sk-test", " https://gateway.example.com/v1/ "))).toEqual({
      ok: true,
      data: { apiKey: "sk-test", baseURL: "https://gateway.example.com/v1" },
    });
  });

  it("rejects malformed endpoints", () => {
    expect(parseOpenAICredentials(headers("sk-test", "not a url"))).toEqual({
      ok: false,
      error: "API 地址格式不正确。",
    });
  });

  it("rejects non-HTTPS endpoints", () => {
    expect(parseOpenAICredentials(headers("sk-test", "http://api.example.com/v1"))).toEqual({
      ok: false,
      error: "API 地址必须使用 HTTPS。",
    });
  });

  it("rejects endpoint credentials", () => {
    expect(parseOpenAICredentials(headers("sk-test", "https://user:pass@api.example.com/v1"))).toEqual({
      ok: false,
      error: "API 地址不能包含用户名或密码。",
    });
  });

  it.each([
    "https://localhost/v1",
    "https://api.localhost/v1",
    "https://127.0.0.1/v1",
    "https://10.0.0.1/v1",
    "https://172.16.0.1/v1",
    "https://192.168.1.1/v1",
    "https://169.254.1.1/v1",
  ])("rejects local and private endpoint %s", (baseURL) => {
    expect(parseOpenAICredentials(headers("sk-test", baseURL))).toEqual({
      ok: false,
      error: "API 地址不能指向本地或私有网络。",
    });
  });
});

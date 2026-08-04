import { describe, expect, it } from "vitest";

import { loadSessionCredentials, saveSessionCredentials } from "./session-credentials";

function createStorage() {
  const values = new Map<string, string>();

  return {
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
    removeItem(key: string) {
      values.delete(key);
    },
  };
}

describe("session credentials", () => {
  it("saves and loads an API key and compatible endpoint", () => {
    const storage = createStorage();

    saveSessionCredentials(storage, {
      apiKey: "sk-test",
      baseURL: "https://gateway.example.com/v1",
    });

    expect(loadSessionCredentials(storage)).toEqual({
      apiKey: "sk-test",
      baseURL: "https://gateway.example.com/v1",
    });
  });

  it("returns empty values when the tab has no credentials", () => {
    expect(loadSessionCredentials(createStorage())).toEqual({ apiKey: "", baseURL: "" });
  });

  it("removes an empty compatible endpoint", () => {
    const storage = createStorage();
    saveSessionCredentials(storage, {
      apiKey: "sk-test",
      baseURL: "https://gateway.example.com/v1",
    });

    saveSessionCredentials(storage, { apiKey: "sk-next", baseURL: "" });

    expect(loadSessionCredentials(storage)).toEqual({ apiKey: "sk-next", baseURL: "" });
  });
});

export type OpenAICredentials = {
  apiKey: string;
  baseURL?: string;
};

type CredentialResult =
  | { ok: true; data: OpenAICredentials }
  | { ok: false; error: string };

function isPrivateIPv4(hostname: string): boolean {
  const octets = hostname.split(".").map(Number);

  if (
    octets.length !== 4 ||
    octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)
  ) {
    return false;
  }

  const [first, second] = octets;

  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
}

function isPrivateIPv6(hostname: string): boolean {
  const normalized = hostname.replace(/^\[|\]$/g, "").toLowerCase();

  return (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    /^fe[89ab]/.test(normalized)
  );
}

function isLocalOrPrivateHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase();

  return (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    isPrivateIPv4(normalized) ||
    isPrivateIPv6(normalized)
  );
}

export function parseOpenAICredentials(headers: Headers): CredentialResult {
  const apiKey = headers.get("x-openai-api-key")?.trim() ?? "";

  if (!apiKey) {
    return { ok: false, error: "请输入 API Key。" };
  }

  const rawBaseURL = headers.get("x-openai-base-url")?.trim();
  if (!rawBaseURL) {
    return { ok: true, data: { apiKey, baseURL: undefined } };
  }

  let url: URL;

  try {
    url = new URL(rawBaseURL);
  } catch {
    return { ok: false, error: "API 地址格式不正确。" };
  }

  if (url.protocol !== "https:") {
    return { ok: false, error: "API 地址必须使用 HTTPS。" };
  }

  if (url.username || url.password) {
    return { ok: false, error: "API 地址不能包含用户名或密码。" };
  }

  if (isLocalOrPrivateHost(url.hostname)) {
    return { ok: false, error: "API 地址不能指向本地或私有网络。" };
  }

  return {
    ok: true,
    data: {
      apiKey,
      baseURL: url.toString().replace(/\/+$/, ""),
    },
  };
}

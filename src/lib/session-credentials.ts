type SessionStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type SessionCredentials = {
  apiKey: string;
  baseURL: string;
};

const API_KEY_STORAGE_KEY = "image-generator:openai-api-key";
const BASE_URL_STORAGE_KEY = "image-generator:openai-base-url";

export function loadSessionCredentials(storage: SessionStorage): SessionCredentials {
  return {
    apiKey: storage.getItem(API_KEY_STORAGE_KEY) ?? "",
    baseURL: storage.getItem(BASE_URL_STORAGE_KEY) ?? "",
  };
}

export function saveSessionCredentials(
  storage: SessionStorage,
  credentials: SessionCredentials,
): void {
  storage.setItem(API_KEY_STORAGE_KEY, credentials.apiKey);

  if (credentials.baseURL) {
    storage.setItem(BASE_URL_STORAGE_KEY, credentials.baseURL);
  } else {
    storage.removeItem(BASE_URL_STORAGE_KEY);
  }
}

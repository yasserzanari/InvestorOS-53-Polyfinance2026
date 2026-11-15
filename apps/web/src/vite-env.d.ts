/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly DEV: boolean;
  readonly VITE_API_TARGET?: string;
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_AUTH_REQUIRED?: string;
  readonly VITE_COGNITO_ISSUER?: string;
  readonly VITE_COGNITO_CLIENT_ID?: string;
  readonly VITE_COGNITO_DOMAIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

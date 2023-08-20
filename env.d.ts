declare global {
  namespace NodeJS {
    interface ProcessEnv {
      DATALAKE_URL: string;
      DATALAKE_KEY: string;
      LOGTAIL_SOURCE_TOKEN: string;
      PRIVATE_RPC_ENDPOINT_MAINNET: string;
      PRIVATE_RPC_ENDPOINT_SEPOLIA: string;
      PRIVATE_RPC_ENDPOINT_GNOSIS: string;
    }
  }
}

export {}

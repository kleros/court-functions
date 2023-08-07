declare global {
  namespace NodeJS {
    interface ProcessEnv {
      DATALAKE_URL: string;
      DATALAKE_KEY: string;
      LOGTAIL_SOURCE_TOKEN: string;
    }
  }
}

export {}

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NOTICE_METAEVIDENCE_URL: string;
      DATALAKE_URL: string;
      DATALAKE_KEY: string;
      LOGTAIL_SOURCE_TOKEN: string;
    }
  }
}

export {}

import { Logtail } from "@logtail/node";

const logtail = new Logtail(process.env.LOGTAIL_SOURCE_TOKEN);

async function enrichLogs(log: any) {
  return {
      ...log,
      process: __filename
  };
}

logtail.use(enrichLogs);

export default logtail;

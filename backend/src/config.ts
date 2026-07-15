import "dotenv/config";

export const config = {
  port: Number(process.env.PORT ?? 4000),
  navMode: (process.env.NAV_MODE ?? "mock") as "mock" | "live",
  nav: {
    baseHost: process.env.NAV_BASE_HOST ?? "",
    odataPort: Number(process.env.NAV_ODATA_PORT ?? 7348),
    soapPort: Number(process.env.NAV_SOAP_PORT ?? 7347),
    company: process.env.NAV_COMPANY ?? "",
    user: process.env.NAV_SERVICE_USER ?? "",
    password: process.env.NAV_SERVICE_PASSWORD ?? "",
  },
};

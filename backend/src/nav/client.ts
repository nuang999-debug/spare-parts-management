import { config } from "../config";
import { createMockNavClient } from "./mockClient";
import { NavClient } from "./types";

function createLiveNavClient(): NavClient {
  throw new Error(
    "NAV_MODE=live is not implemented yet. The NAV OData pages and SOAP codeunit " +
      "wrappers described in nav-integration-spec.md must exist and be published first."
  );
}

export const navClient: NavClient =
  config.navMode === "live" ? createLiveNavClient() : createMockNavClient();

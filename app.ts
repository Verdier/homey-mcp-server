import sourceMapSupport from "source-map-support";
sourceMapSupport.install();

import Homey from "homey";
import HomeyMCPServer from "./lib/mcp-server";
import { Logger } from "./lib/utils";

class HomeyMCPServerApp extends Homey.App {
  async onInit(): Promise<void> {
    Logger.info("Homey MCP Server is starting...");

    try {
      await HomeyMCPServer.initialize(this.homey);

      Logger.info("MCP Server initialized successfully");
      Logger.info(
        "MCP endpoint available at: http://[your-homey-ip]/api/app/com.verdier.mcp-server/mcp"
      );
      Logger.info("🔒 Using Homey Bearer Token authentication");
    } catch (error) {
      Logger.error("Failed to initialize MCP Server:", error);
    }
  }

  async onUninit(): Promise<void> {
    Logger.info("MCP Server shutting down");
  }
}

export = HomeyMCPServerApp;

// Homey MCP Server API endpoints

import HomeyMCPServer from "./lib/mcp-server";

exports.mcp = async function ({ homey, body }: { homey: any; body: any }) {
  try {
    const mcpServer = HomeyMCPServer.getInstance();

    if (!mcpServer) {
      throw new Error("MCP Server not initialized");
    }

    const response = await mcpServer.handleMCPRequest(body);
    return response;
  } catch (error) {
    const errorResponse = {
      jsonrpc: "2.0",
      id: body?.id || null,
      error: {
        code: -32603,
        message: "Internal error",
        data: error instanceof Error ? error.message : String(error),
      },
    };
    return errorResponse;
  }
};

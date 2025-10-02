import { Logger } from "./utils";
import HomeyTools from "./homey-tools";
import type {
  JSONRPCRequest,
  JSONRPCResponse,
  JSONRPCError,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";

/**
 * Homey MCP Server - Lightweight HTTP/JSON-RPC implementation
 *
 * This implements the Model Context Protocol over HTTP using Homey's native API routing.
 * Uses official MCP SDK types for protocol compliance while keeping implementation simple.
 */
class HomeyMCPServer {
  private static instance: HomeyMCPServer | null = null;
  private homeyTools: HomeyTools;

  private constructor(homey: any) {
    this.homeyTools = new HomeyTools(homey);
  }

  static getInstance(): HomeyMCPServer | null {
    return HomeyMCPServer.instance;
  }

  static async initialize(homey: any): Promise<HomeyMCPServer> {
    if (HomeyMCPServer.instance) {
      Logger.info(
        "MCP Server already initialized, returning existing instance"
      );
      return HomeyMCPServer.instance;
    }

    Logger.info("Initializing Homey MCP Server...");
    HomeyMCPServer.instance = new HomeyMCPServer(homey);

    try {
      await HomeyMCPServer.instance.homeyTools.initialize();
      Logger.info("MCP Server ready");
    } catch (error) {
      Logger.error(
        "Initialization warning (continuing with limited functionality):",
        error
      );
    }

    return HomeyMCPServer.instance;
  }

  // ==================== Request Handler ====================

  async handleMCPRequest(
    request: JSONRPCRequest
  ): Promise<JSONRPCResponse | JSONRPCError> {
    Logger.info(`MCP: ${request.method}`, { id: request.id });

    try {
      switch (request.method) {
        case "initialize":
          return this.handleInitialize(request);
        case "tools/list":
          return this.handleToolsList(request);
        case "tools/call":
          return this.handleToolCall(request);
        default:
          return this.error(
            request.id!,
            -32601,
            `Method not found: ${request.method}`
          );
      }
    } catch (error) {
      Logger.error("Request handling error:", error);
      return this.error(request.id!, -32603, "Internal error", error);
    }
  }

  // ==================== Protocol Handlers ====================

  private handleInitialize(request: JSONRPCRequest): JSONRPCResponse {
    return this.success(request.id!, {
      protocolVersion: "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: {
        name: "homey-mcp-server",
        version: "1.0.0",
      },
    });
  }

  private handleToolsList(request: JSONRPCRequest): JSONRPCResponse {
    return this.success(request.id!, {
      tools: this.getToolDefinitions(),
    });
  }

  private getToolDefinitions(): Tool[] {
    return [
      {
        name: "list_devices",
        description: "List all Homey devices with their current state",
        inputSchema: {
          type: "object",
          properties: {
            zone: {
              type: "string",
              description: "Filter by zone name (optional)",
            },
          },
        },
      },
      {
        name: "control_device",
        description: "Control a Homey device capability",
        inputSchema: {
          type: "object",
          properties: {
            device_id: { type: "string", description: "Homey device ID" },
            capability: {
              type: "string",
              description: "Capability (e.g., 'onoff', 'dim')",
            },
            value: { description: "Value to set" },
          },
          required: ["device_id", "capability", "value"],
        },
      },
      {
        name: "get_device_info",
        description: "Get detailed information about a specific device",
        inputSchema: {
          type: "object",
          properties: {
            device_id: { type: "string", description: "Homey device ID" },
          },
          required: ["device_id"],
        },
      },
      {
        name: "list_zones",
        description: "List all Homey zones",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "list_flows",
        description: "List automation flows",
        inputSchema: {
          type: "object",
          properties: {
            enabled_only: {
              type: "boolean",
              description: "Only show enabled flows (default: false)",
            },
          },
        },
      },
      {
        name: "trigger_flow",
        description: "Trigger an automation flow",
        inputSchema: {
          type: "object",
          properties: {
            flow_id: { type: "string", description: "Flow ID to trigger" },
          },
          required: ["flow_id"],
        },
      },
      {
        name: "get_flow_info",
        description: "Get detailed information about a flow",
        inputSchema: {
          type: "object",
          properties: {
            flow_id: { type: "string", description: "Flow ID" },
          },
          required: ["flow_id"],
        },
      },
    ];
  }

  private async handleToolCall(
    request: JSONRPCRequest
  ): Promise<JSONRPCResponse | JSONRPCError> {
    const { name, arguments: args } = (request.params as any) || {};
    const toolArgs = (args || {}) as Record<string, any>;

    try {
      const result = await this.executeTool(name, toolArgs);
      return this.success(request.id!, {
        content: [{ type: "text", text: result }],
      });
    } catch (error) {
      Logger.error(`Tool execution failed: ${name}`, error);
      return this.error(request.id!, -32603, `Tool failed: ${name}`, error);
    }
  }

  // ==================== Tool Execution ====================

  private async executeTool(
    name: string,
    args: Record<string, any>
  ): Promise<string> {
    switch (name) {
      case "list_devices":
        return this.homeyTools.listDevices(args?.zone);

      case "control_device":
        return this.homeyTools.controlDevice(
          args.device_id,
          args.capability,
          args.value
        );

      case "get_device_info":
        return this.homeyTools.getDeviceInfo(args.device_id);

      case "list_zones":
        return this.homeyTools.listZones();

      case "list_flows":
        return this.homeyTools.listFlows(args?.enabled_only);

      case "trigger_flow":
        return this.homeyTools.triggerFlow(args.flow_id);

      case "get_flow_info":
        return this.homeyTools.getFlowInfo(args.flow_id);

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  // ==================== Response Helpers ====================

  private success(id: string | number, result: any): JSONRPCResponse {
    return {
      jsonrpc: "2.0",
      id,
      result,
    };
  }

  private error(
    id: string | number,
    code: number,
    message: string,
    error?: any
  ): JSONRPCError {
    return {
      jsonrpc: "2.0",
      id,
      error: {
        code,
        message,
        ...(error && {
          data: error instanceof Error ? error.message : String(error),
        }),
      },
    };
  }
}

export = HomeyMCPServer;

export class Logger {
  static log(level: string, message: string, data: any = null): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${level.toUpperCase()}: ${message}`;

    console.log(logMessage);
    if (data) {
      console.log(JSON.stringify(data, null, 2));
    }
  }

  static info(message: string, data?: any): void {
    this.log("info", message, data);
  }

  static error(message: string, data?: any): void {
    this.log("error", message, data);
  }

  static debug(message: string, data?: any): void {
    this.log("debug", message, data);
  }

  static warn(message: string, data?: any): void {
    this.log("warn", message, data);
  }
}

export class ErrorHandler {
  static formatMCPError(error: Error, code: number = -32603): any {
    return {
      error: {
        code: code,
        message: error.message,
        data: {
          type: error.constructor.name,
          stack: error.stack,
        },
      },
    };
  }

  static formatHomeyError(error: Error): any {
    return {
      success: false,
      error: {
        message: error.message,
        type: error.constructor.name,
        stack: error.stack,
      },
    };
  }

  static handleAsyncError(error: Error, context: string = "Unknown"): void {
    Logger.error(`Async error in ${context}:`, {
      message: error.message,
      stack: error.stack,
    });
  }

  static createMCPErrorResponse(
    id: string | number | null,
    code: number,
    message: string,
    data?: any
  ): any {
    return {
      jsonrpc: "2.0",
      id: id,
      error: {
        code: code,
        message: message,
        data: data,
      },
    };
  }
}

export class ValidationHelper {
  static validateDeviceId(deviceId: any): string {
    if (typeof deviceId !== "string" || deviceId.length === 0) {
      throw new Error("Device ID must be a non-empty string");
    }
    return deviceId;
  }

  static validateCapability(capability: any): string {
    if (typeof capability !== "string" || capability.length === 0) {
      throw new Error("Capability must be a non-empty string");
    }
    return capability;
  }

  static validateCapabilityValue(value: any): string | number | boolean {
    // Handle null/undefined
    if (value === null || value === undefined) {
      throw new Error("Capability value cannot be null or undefined");
    }

    // If already a boolean or number, return as-is
    if (typeof value === "boolean") return value;
    if (typeof value === "number") {
      if (!isFinite(value)) {
        throw new Error("Capability value cannot be NaN or Infinity");
      }
      return value;
    }

    // Handle string conversions
    if (typeof value === "string") {
      // Empty strings are invalid
      if (value.length === 0) {
        throw new Error("Capability value cannot be an empty string");
      }

      // Boolean string literals
      if (value === "true") return true;
      if (value === "false") return false;

      // Numeric strings (but not empty/whitespace)
      const trimmed = value.trim();
      if (trimmed.length > 0 && !isNaN(Number(trimmed))) {
        return Number(trimmed);
      }

      // Valid non-empty string
      return value;
    }

    // Invalid type
    throw new Error(
      `Invalid capability value type: expected string, number, or boolean, got ${typeof value}`
    );
  }

  static validateFlowId(flowId: any): string {
    if (typeof flowId !== "string" || flowId.length === 0) {
      throw new Error("Flow ID must be a non-empty string");
    }
    return flowId;
  }

  static sanitizeZoneName(zoneName: any): string | undefined {
    if (zoneName === null || zoneName === undefined) {
      return undefined;
    }
    if (typeof zoneName !== "string") {
      throw new Error("Zone name must be a string");
    }
    return zoneName.trim();
  }
}

export class MCPHelper {
  static createSuccessResponse(id: string | number | null, result: any): any {
    return {
      jsonrpc: "2.0",
      id: id,
      result: result,
    };
  }

  static createErrorResponse(
    id: string | number | null,
    code: number,
    message: string
  ): any {
    return {
      jsonrpc: "2.0",
      id: id,
      error: {
        code: code,
        message: message,
      },
    };
  }

  static formatDeviceList(devices: any[]): string {
    if (!devices || devices.length === 0) {
      return "No devices found.";
    }

    let output = `Found ${devices.length} device(s):\n\n`;

    devices.forEach((device, index) => {
      output += `${index + 1}. ${device.name || "Unknown Device"}\n`;
      output += `   ID: ${device.id || "N/A"}\n`;
      output += `   Zone: ${device.zone || "N/A"}\n`;
      output += `   Class: ${device.class || "N/A"}\n`;
      output += `   Available: ${device.available ? "Yes" : "No"}\n`;
      if (device.capabilities && device.capabilities.length > 0) {
        output += `   Capabilities: ${device.capabilities.join(", ")}\n`;
      }
      output += "\n";
    });

    return output;
  }

  static formatZoneList(zones: any[]): string {
    if (!zones || zones.length === 0) {
      return "No zones found.";
    }

    let output = `Found ${zones.length} zone(s):\n\n`;

    zones.forEach((zone, index) => {
      output += `${index + 1}. ${zone.name || "Unknown Zone"}\n`;
      output += `   ID: ${zone.id || "N/A"}\n\n`;
    });

    return output;
  }

  static formatFlowList(flows: any[]): string {
    if (!flows || flows.length === 0) {
      return "No flows found.";
    }

    let output = `Found ${flows.length} flow(s):\n\n`;

    flows.forEach((flow, index) => {
      output += `${index + 1}. ${flow.name || "Unknown Flow"}\n`;
      output += `   ID: ${flow.id || "N/A"}\n`;
      output += `   Enabled: ${flow.enabled ? "Yes" : "No"}\n\n`;
    });

    return output;
  }
}

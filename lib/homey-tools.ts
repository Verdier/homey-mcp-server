import { Logger, ValidationHelper, MCPHelper } from "./utils";
import { HomeyAPI } from "homey-api";
import type { HomeyAPIV3Local } from "homey-api";
import type Homey from "homey/lib/Homey";
import * as http from "http";

// Define interface for the complete API instance with all managers
interface HomeyAppAPI extends HomeyAPIV3Local {
  devices: HomeyAPIV3Local.ManagerDevices;
  zones: HomeyAPIV3Local.ManagerZones;
  flow: HomeyAPIV3Local.ManagerFlow;
}

interface DeviceInfo {
  id: string;
  name: string;
  zone: string;
  class: string;
  available: boolean;
  capabilities: string[];
  capabilityValues: Record<string, unknown>;
  driver: string;
  app: string;
}

interface FlowInfo {
  id: string;
  name: string;
  enabled: boolean;
  folder: string | null;
  triggerable: boolean;
}

class HomeyTools {
  private homey: Homey;
  private homeyApi: HomeyAppAPI | null = null;

  constructor(homey: Homey) {
    this.homey = homey;
    Logger.debug("HomeyTools instance created");
  }

  async initialize(): Promise<void> {
    try {
      Logger.info("Creating HomeyAPI instance using createAppAPI...");

      this.homeyApi = await HomeyAPI.createAppAPI({
        homey: this.homey,
      });

      const devices = await this.homeyApi.devices.getDevices();
      Logger.info(
        `Successfully initialized HomeyAPI, found ${
          Object.keys(devices).length
        } devices`
      );
    } catch (error) {
      Logger.error("Failed to initialize HomeyTools:", error);
      throw error;
    }
  }

  private ensureInitialized(): void {
    if (!this.homeyApi) {
      throw new Error("HomeyAPI not initialized. Call initialize() first.");
    }
  }

  private formatErrorMessage(context: string, error: unknown): string {
    return `Failed to ${context}: ${
      error instanceof Error ? error.message : String(error)
    }`;
  }

  private getZoneName(deviceZone: any, allZones: Record<string, any>): string {
    if (!deviceZone) return "Unknown";

    const zoneId = typeof deviceZone === "string" ? deviceZone : deviceZone.id;
    if (zoneId && allZones[zoneId]) {
      return allZones[zoneId].name || "Unknown";
    }
    return "Unknown";
  }

  private extractCapabilityValues(
    capabilitiesObj: any,
    deviceId: string
  ): Record<string, unknown> {
    const capabilityValues: Record<string, unknown> = {};

    if (!capabilitiesObj) return capabilityValues;

    for (const [capability, capabilityInfo] of Object.entries(
      capabilitiesObj
    )) {
      try {
        if (
          capabilityInfo &&
          typeof capabilityInfo === "object" &&
          "value" in capabilityInfo
        ) {
          capabilityValues[capability] = (capabilityInfo as any).value;
        }
      } catch (error) {
        Logger.warn(
          `Failed to get capability ${capability} for device ${deviceId}:`,
          error
        );
      }
    }

    return capabilityValues;
  }

  async listDevices(zone?: string): Promise<string> {
    try {
      Logger.info("Listing devices using Homey API...");
      this.ensureInitialized();

      const [allDevices, allZones] = await Promise.all([
        this.homeyApi!.devices.getDevices(),
        this.homeyApi!.zones.getZones(),
      ]);

      Logger.info(`Found ${Object.keys(allDevices).length} devices`);

      const deviceList: DeviceInfo[] = [];

      for (const [deviceId, device] of Object.entries(allDevices)) {
        const deviceData = device as any;
        const zoneName = this.getZoneName(deviceData.zone, allZones);

        if (zone && zoneName.toLowerCase() !== zone.toLowerCase()) {
          continue;
        }

        const deviceInfo: DeviceInfo = {
          id: deviceId,
          name: deviceData.name || "Unknown Device",
          zone: zoneName,
          class: deviceData.class || "unknown",
          available:
            deviceData.available !== undefined ? deviceData.available : true,
          capabilities: deviceData.capabilities || [],
          capabilityValues: this.extractCapabilityValues(
            deviceData.capabilitiesObj,
            deviceId
          ),
          driver: deviceData.driverId || "unknown",
          app: deviceData.driverId?.split(":")[1] || "unknown",
        };

        deviceList.push(deviceInfo);
      }

      Logger.info(`Successfully processed ${deviceList.length} devices`);
      return MCPHelper.formatDeviceList(deviceList);
    } catch (error) {
      Logger.error("Error listing devices:", error);
      throw new Error(this.formatErrorMessage("list devices", error));
    }
  }

  async controlDevice(
    deviceId: string,
    capability: string,
    value: any
  ): Promise<string> {
    try {
      ValidationHelper.validateDeviceId(deviceId);
      ValidationHelper.validateCapability(capability);

      Logger.info(`Controlling device ${deviceId}: ${capability} = ${value}`);
      this.ensureInitialized();

      await this.homeyApi!.devices.setCapabilityValue({
        deviceId,
        capabilityId: capability,
        value,
      });

      const device = await this.homeyApi!.devices.getDevice({ id: deviceId });
      const deviceName = device.name || deviceId;

      return `Successfully set ${capability} to ${value} for device "${deviceName}" (${deviceId})`;
    } catch (error) {
      Logger.error("Error controlling device:", error);
      throw new Error(this.formatErrorMessage("control device", error));
    }
  }

  async getDeviceInfo(deviceId: string): Promise<string> {
    try {
      ValidationHelper.validateDeviceId(deviceId);
      Logger.info(`Getting device info for: ${deviceId}`);
      this.ensureInitialized();

      const device = await this.homeyApi!.devices.getDevice({ id: deviceId });

      if (!device) {
        throw new Error(`Device not found: ${deviceId}`);
      }

      const zoneName = device.zone || "Unknown";
      const capabilities = device.capabilities || [];
      const capabilityValues: Record<string, unknown> = {};

      for (const capability of capabilities) {
        try {
          const value = await this.homeyApi!.devices.getCapabilityValue({
            deviceId,
            capabilityId: capability,
          });
          capabilityValues[capability] = value;
        } catch (error) {
          Logger.warn(`Failed to get capability ${capability}:`, error);
          capabilityValues[capability] = "Error reading value";
        }
      }

      const availableStatus =
        device.available !== undefined
          ? device.available
            ? "Yes"
            : "No"
          : "Unknown";

      const lines = [
        `Device Information for: ${device.name || "Unknown Device"}`,
        `ID: ${deviceId}`,
        `Zone: ${zoneName}`,
        `Class: ${device.class || "unknown"}`,
        `Available: ${availableStatus}`,
        `Driver: ${device.driverId || "unknown"}`,
        `App: ${device.manager.uri?.split(":")[0] || "unknown"}`,
        "",
        "Capabilities:",
        ...Object.entries(capabilityValues).map(
          ([capability, value]) => `  ${capability}: ${JSON.stringify(value)}`
        ),
      ];

      return lines.join("\n");
    } catch (error) {
      Logger.error("Error getting device info:", error);
      throw new Error(this.formatErrorMessage("get device info", error));
    }
  }

  async listZones(): Promise<string> {
    try {
      Logger.info("Listing zones...");
      this.ensureInitialized();

      const zones = await this.homeyApi!.zones.getZones();
      Logger.info(`Found ${Object.keys(zones).length} zones`);

      const zoneArray = Object.entries(zones)
        .map(([id, zone]) => ({
          id,
          name: (zone as any).name || id,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

      Logger.info(`Successfully retrieved ${zoneArray.length} zones`);
      return MCPHelper.formatZoneList(zoneArray);
    } catch (error) {
      Logger.error("Error listing zones:", error);
      throw new Error(this.formatErrorMessage("list zones", error));
    }
  }

  async listFlows(enabledOnly: boolean = false): Promise<string> {
    try {
      Logger.info(`Listing flows (enabled only: ${enabledOnly})...`);
      this.ensureInitialized();

      const allFlows = await this.homeyApi!.flow.getFlows();
      Logger.info(`Found ${Object.keys(allFlows).length} flows`);

      const flowList: FlowInfo[] = Object.entries(allFlows)
        .map(([flowId, flow]) => {
          const flowData = flow as any;
          return {
            id: flowId,
            name: flowData.name || "Unknown Flow",
            enabled: flowData.enabled ?? false,
            folder: flowData.folder || null,
            triggerable: flowData.triggerable ?? false,
          };
        })
        .filter((flow) => !enabledOnly || flow.enabled);

      Logger.info(`Successfully processed ${flowList.length} flows`);
      return MCPHelper.formatFlowList(flowList);
    } catch (error) {
      Logger.error("Error listing flows:", error);
      throw new Error(this.formatErrorMessage("list flows", error));
    }
  }

  async triggerFlow(flowId: string): Promise<string> {
    try {
      ValidationHelper.validateFlowId(flowId);
      Logger.info(`Triggering flow: ${flowId}`);
      this.ensureInitialized();

      const flow = await this.homeyApi!.flow.getFlow({ id: flowId });
      const flowData = flow as any;

      if (!flowData) {
        throw new Error(`Flow not found: ${flowId}`);
      }

      const flowName = flowData.name || flowId;

      // ⚠️ LIMITATION: Flow triggering is currently not operational
      // The Homey API token does not have the required scopes to trigger flows
      // and the HomeyAPI library does not expose a trigger method
      Logger.warn(
        "⚠️ Flow triggering is currently not operational due to API limitations"
      );
      return `⚠️ Flow triggering is currently not operational due to Homey API limitations.\n\nFlow Details:\n- Name: ${flowName}\n- ID: ${flowId}\n- Enabled: ${
        flowData.enabled ? "Yes" : "No"
      }\n- Triggerable: ${
        flowData.triggerable ? "Yes" : "No"
      }\n\nPlease use the Homey app or web interface to manually trigger this flow.`;
    } catch (error: any) {
      Logger.error("Error in triggerFlow:", error);
      throw new Error(this.formatErrorMessage("get flow information", error));
    }
  }

  async getFlowInfo(flowId: string): Promise<string> {
    try {
      ValidationHelper.validateFlowId(flowId);
      Logger.info(`Getting flow info for: ${flowId}`);
      this.ensureInitialized();

      const flow = await this.homeyApi!.flow.getFlow({ id: flowId });
      const flowData = flow as any;

      if (!flowData) {
        throw new Error(`Flow not found: ${flowId}`);
      }

      const lines = [
        `Flow Information for: ${flowData.name || "Unknown Flow"}`,
        `ID: ${flowId}`,
        `Enabled: ${flowData.enabled ? "Yes" : "No"}`,
        `Triggerable: ${flowData.triggerable ? "Yes" : "No"}`,
        `Folder: ${flowData.folder || "None"}`,
      ];

      if (flowData.trigger) {
        lines.push("", "Trigger:", `  ID: ${flowData.trigger.id || "N/A"}`);
        if (flowData.trigger.uri) {
          lines.push(`  URI: ${flowData.trigger.uri}`);
        }
      }

      if (flowData.conditions?.length > 0) {
        lines.push("", `Conditions (${flowData.conditions.length}):`);
        flowData.conditions.forEach((condition: any, index: number) => {
          lines.push(`  ${index + 1}. ${condition.id || "Unknown"}`);
        });
      }

      if (flowData.actions?.length > 0) {
        lines.push("", `Actions (${flowData.actions.length}):`);
        flowData.actions.forEach((action: any, index: number) => {
          lines.push(`  ${index + 1}. ${action.id || "Unknown"}`);
        });
      }

      return lines.join("\n");
    } catch (error) {
      Logger.error("Error getting flow info:", error);
      throw new Error(this.formatErrorMessage("get flow info", error));
    }
  }
}

export = HomeyTools;

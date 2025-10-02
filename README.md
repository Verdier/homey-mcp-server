# Homey MCP Server

Homey Pro App exposing an MCP server over HTTP, enabling AI assistants like Claude to control your smart home.

## 🚀 Quick Setup

### 1. Install on Homey

```bash
git clone https://github.com/verdier/homey-mcp-server.git
cd homey-mcp-server
npm install
npm run install-homey
```

### 2. Get Your Authentication Token

You need a Homey Bearer Token for secure API access:

1. Login to [my.homey.app](https://my.homey.app)
2. Go to **Settings** → **API Key**
3. Create a new API key with at least the `homey.app` scope

### 3. Configure Your AI Assistant

#### For Claude Desktop

Add to your configuration file with your Bearer token:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`  
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "homey": {
      "type": "http",
      "url": "http://YOUR_HOMEY_IP/api/app/com.verdier.mcp-server/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_HOMEY_TOKEN"
      }
    }
  }
}
```

#### For VS Code

Create `.vscode/mcp.json` in your workspace:

```json
{
  "servers": {
    "homey": {
      "type": "http",
      "url": "http://YOUR_HOMEY_IP/api/app/com.verdier.mcp-server/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_HOMEY_TOKEN"
      }
    }
  }
}
```

**Note:** Replace `YOUR_HOMEY_IP` with your Homey's actual IP address and `YOUR_HOMEY_TOKEN` with your extracted Bearer token.

### 4. Start Using

Ask your AI: _"Turn on the living room lights"_ or _"What's the temperature in the bedroom?"_

## 📋 Requirements

- **Homey Pro** with local network access (Homey Cloud not supported)
- **Node.js** 16+ and Homey CLI: `npm install -g homey`
- **Homey Bearer Token** for authentication

## 🛠 Available Features

- **Device Control**: List, control, and query all Homey devices
- **Zone Management**: Filter devices by room/zone
- **Flow Automation**: List and view automation flow details
- **Natural Language**: Use conversational commands with AI assistants

### ⚠️ Known Limitations

- **Flow Triggering**: The `trigger_flow` tool is currently not operational due to Homey API cross app limitations.

## 🧪 Testing

Verify your installation with your Bearer token:

```bash
# Test MCP protocol
curl -X POST \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"jsonrpc":"2.0","method":"initialize","id":1}' \
     "http://YOUR_HOMEY_IP/api/app/com.verdier.mcp-server/mcp"
```

## 🤝 Support

- Verify your Homey IP address is correct
- Ensure Homey Pro is on the same local network

# FastEdge VSCode Extension - MCP Integration

## What is MCP?

**Model Context Protocol (MCP)** is a protocol for connecting AI assistants to external tools and data sources. The FastEdge extension integrates with the **FastEdge Assistant MCP Server**, which provides AI-powered assistance for FastEdge development.

## MCP Server Configuration

### Source File: `src/commands/mcpJson.ts`

### Generated mcp.json Structure

```json
{
  "servers": {
    "fastedge-assistant": {
      "type": "stdio",
      "command": "bash",
      "args": [
        "-c",
        "docker run --rm -i \
          -e FASTEDGE_API_KEY=\"$FASTEDGE_API_KEY\" \
          -e FASTEDGE_API_URL=\"$FASTEDGE_API_URL\" \
          ghcr.io/g-core/fastedge-mcp-server:latest"
      ],
      "env": {
        "FASTEDGE_API_KEY": "your-api-key-here",
        "FASTEDGE_API_URL": "https://api.gcore.com"
      }
    }
  }
}
```

### Platform-Specific Commands

**Windows (cmd):**
```json
{
  "command": "cmd",
  "args": [
    "/c",
    "docker run --rm -i ...'
  ]
}
```

**macOS/Linux (bash):**
```json
{
  "command": "bash",
  "args": [
    "-c",
    "docker run --rm -i ..."
  ]
}
```

## MCP Generation Process

```typescript
export async function createMCPJson(
  context: vscode.ExtensionContext
): Promise<void> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    vscode.window.showErrorMessage('No workspace folder open');
    return;
  }

  // 1. Check for existing mcp.json
  const mcpJsonPath = path.join(
    workspaceFolder.uri.fsPath,
    '.vscode',
    'mcp.json'
  );

  if (fs.existsSync(mcpJsonPath)) {
    const existing = JSON.parse(fs.readFileSync(mcpJsonPath, 'utf-8'));
    if (existing.servers?.['fastedge-assistant']) {
      vscode.window.showWarningMessage(
        'FastEdge Assistant already configured in mcp.json'
      );
      return;
    }
  }

  // 2. Get API credentials from secure storage
  let apiKey = await context.secrets.get('fastedge.apiKey');
  let apiUrl = await context.secrets.get('fastedge.apiUrl') ||
               'https://api.gcore.com';

  // 3. Prompt for credentials if missing
  if (!apiKey) {
    apiKey = await vscode.window.showInputBox({
      prompt: 'Enter your FastEdge API Key',
      password: true,
      placeHolder: 'sk_...'
    });

    if (!apiKey) {
      vscode.window.showErrorMessage('API key required');
      return;
    }

    // Save to secure storage
    await context.secrets.store('fastedge.apiKey', apiKey);
  }

  // 4. Generate platform-specific Docker command
  const platform = process.platform;
  let command: string;
  let args: string[];

  if (platform === 'win32') {
    command = 'cmd';
    args = ['/c', generateDockerCommand()];
  } else {
    command = 'bash';
    args = ['-c', generateDockerCommand()];
  }

  // 5. Build mcp.json structure
  const mcpConfig: MCPConfiguration = {
    servers: {
      'fastedge-assistant': {
        type: 'stdio',
        command: command,
        args: args,
        env: {
          FASTEDGE_API_KEY: apiKey,
          FASTEDGE_API_URL: apiUrl
        }
      }
    }
  };

  // 6. Write to file
  fs.mkdirSync(path.dirname(mcpJsonPath), { recursive: true });
  fs.writeFileSync(
    mcpJsonPath,
    JSON.stringify(mcpConfig, null, 2),
    'utf-8'
  );

  // 7. Security warnings
  await promptGitignore(workspaceFolder);

  vscode.window.showInformationMessage(
    'FastEdge Assistant MCP Server configured! Restart your AI assistant.'
  );
}

function generateDockerCommand(): string {
  return `docker run --rm -i \
    -e FASTEDGE_API_KEY="$FASTEDGE_API_KEY" \
    -e FASTEDGE_API_URL="$FASTEDGE_API_URL" \
    ghcr.io/g-core/fastedge-mcp-server:latest`;
}

async function promptGitignore(
  workspaceFolder: vscode.WorkspaceFolder
): Promise<void> {
  const gitignorePath = path.join(
    workspaceFolder.uri.fsPath,
    '.gitignore'
  );

  const response = await vscode.window.showWarningMessage(
    'mcp.json contains API credentials. Add it to .gitignore?',
    'Yes',
    'No',
    'Already Done'
  );

  if (response === 'Yes') {
    const gitignoreContent = fs.existsSync(gitignorePath)
      ? fs.readFileSync(gitignorePath, 'utf-8')
      : '';

    if (!gitignoreContent.includes('.vscode/mcp.json')) {
      fs.appendFileSync(
        gitignorePath,
        '\n# FastEdge MCP configuration (contains secrets)\n.vscode/mcp.json\n'
      );
      vscode.window.showInformationMessage(
        'Added .vscode/mcp.json to .gitignore'
      );
    }
  }
}
```

## Codespace-Specific Handling

For GitHub Codespaces, the extension recommends environment variables instead of mcp.json:

```typescript
if (isCodespace()) {
  const useEnvVars = await vscode.window.showQuickPick(
    ['Use Environment Variables (Recommended)', 'Use mcp.json'],
    {
      placeHolder: 'How should credentials be stored in Codespace?'
    }
  );

  if (useEnvVars === 'Use Environment Variables (Recommended)') {
    await setupCodespaceSecrets(context);
    return;
  }
}

async function setupCodespaceSecrets(
  context: vscode.ExtensionContext
): Promise<void> {
  vscode.window.showInformationMessage(
    'Set Codespace secrets via GitHub Settings:\n' +
    '1. Go to repository Settings > Secrets > Codespaces\n' +
    '2. Add: FASTEDGE_API_KEY\n' +
    '3. Add: FASTEDGE_API_URL (optional)\n' +
    '4. Rebuild Codespace'
  );
}
```

## MCP Server Docker Image

### Image Information
- **Registry**: GitHub Container Registry (ghcr.io)
- **Repository**: g-core/fastedge-mcp-server
- **Tag**: latest
- **Size**: ~100MB

### What the Image Contains
- FastEdge API client
- MCP server implementation
- AI assistant integration tools

### Communication Protocol
- **Type**: stdio (standard input/output)
- **Format**: JSON-RPC messages
- **Transport**: Pipes (stdin/stdout)

## Security Considerations

### Credential Storage

**✅ Secure Storage (VSCode Secrets):**
```typescript
// Store
await context.secrets.store('fastedge.apiKey', apiKey);

// Retrieve
const apiKey = await context.secrets.get('fastedge.apiKey');
```

Uses OS-specific secure storage:
- **Windows**: Credential Manager
- **macOS**: Keychain
- **Linux**: Secret Service API (libsecret)

**❌ Plain Text (mcp.json):**
```json
{
  "env": {
    "FASTEDGE_API_KEY": "sk_live_12345..."  // ← Visible in file
  }
}
```

**Mitigation:**
- Prompt user to add to `.gitignore`
- Show security warning
- Recommend environment variables for Codespaces

### .gitignore Recommendations

```bash
# .gitignore

# MCP configuration with API credentials
.vscode/mcp.json

# VSCode secure storage (should already be ignored)
.vscode/.secrets/
```

## Usage Flow

```
1. User runs "FastEdge (Generate mcp.json)" command
     ↓
2. Extension checks for existing configuration
     ↓
3. Extension retrieves/prompts for API credentials
     ↓
4. Extension generates mcp.json with Docker command
     ↓
5. Extension prompts to add to .gitignore
     ↓
6. User restarts AI assistant (Claude, Cursor, etc.)
     ↓
7. AI assistant connects to FastEdge MCP server via Docker
     ↓
8. Server provides FastEdge-specific tools to AI
```

## FastEdge Assistant Capabilities

The MCP server provides AI assistants with tools for:

1. **Deployment**: Deploy WASM binaries to FastEdge CDN
2. **Configuration**: Manage environment variables and secrets
3. **Monitoring**: View logs and metrics
4. **Testing**: Run tests against deployed applications
5. **Documentation**: Get FastEdge API documentation

## Integration with Claude Code

The MCP server is designed to work with AI assistants like:
- **Claude Code** (Anthropic's CLI tool)
- **Cursor** (VSCode fork with AI)
- **Cline** (VSCode extension)

### Example mcp.json Location

**Claude Code:**
```
~/.claude/mcp.json
```

**VSCode Extension:**
```
<workspace>/.vscode/mcp.json
```

## Troubleshooting

### Docker Not Running

**Error:**
```
Cannot connect to the Docker daemon. Is the docker daemon running?
```

**Solution:**
```bash
# Start Docker
sudo systemctl start docker  # Linux
# Or open Docker Desktop      # Windows/Mac
```

### Invalid API Key

**Error:**
```
Authentication failed: Invalid API key
```

**Solution:**
1. Check API key in G-Core dashboard
2. Delete stored secret: Command Palette → "Clear FastEdge Credentials"
3. Re-run "Generate mcp.json"

### Image Pull Failures

**Error:**
```
Unable to find image 'ghcr.io/g-core/fastedge-mcp-server:latest' locally
```

**Solution:**
```bash
# Manual pull
docker pull ghcr.io/g-core/fastedge-mcp-server:latest

# Check authentication
docker login ghcr.io
```

## Future Enhancements

Potential improvements for MCP integration:

1. **Auto-Update**: Check for MCP server updates
2. **Multiple Profiles**: Support dev/staging/prod configurations
3. **Credential Rotation**: Automated API key rotation
4. **Offline Mode**: Cached responses for common queries
5. **Custom Tools**: User-defined MCP tools

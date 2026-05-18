# Installs GODOT-MCP into the Godot project in the current folder.
[CmdletBinding()]
param(
    [string]$ProjectPath = (Get-Location).Path,
    [string]$Repo = "gordidima-rgb/GODOT-MCP",
    [string]$Ref = "main",
    [int]$Port = 8765
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

function Write-Step {
    param([string]$Message)
    Write-Host ""
    Write-Host "==> $Message"
}

function Copy-DirectoryContents {
    param(
        [string]$Source,
        [string]$Destination
    )

    if (-not (Test-Path -LiteralPath $Source -PathType Container)) {
        throw "Missing source folder: $Source"
    }

    $sourceFullPath = [System.IO.Path]::GetFullPath($Source).TrimEnd("\", "/")
    $destinationFullPath = [System.IO.Path]::GetFullPath($Destination).TrimEnd("\", "/")

    if ($sourceFullPath.Equals($destinationFullPath, [System.StringComparison]::OrdinalIgnoreCase)) {
        Write-Host "Already in place: $Destination"
        return
    }

    $sourcePrefix = $sourceFullPath + [System.IO.Path]::DirectorySeparatorChar
    if ($destinationFullPath.StartsWith($sourcePrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Refusing to copy $Source into one of its own child folders. Choose a Godot project folder outside the installer source tree."
    }

    New-Item -ItemType Directory -Path $Destination -Force | Out-Null
    Get-ChildItem -LiteralPath $Source -Force | Copy-Item -Destination $Destination -Recurse -Force
}

function Enable-GodotEditorPlugin {
    param(
        [string]$ProjectFile,
        [string]$PluginPath
    )

    $content = [System.IO.File]::ReadAllText($ProjectFile)

    if ($content.Contains($PluginPath)) {
        return $false
    }

    $enabledLine = "enabled=PackedStringArray(`"$PluginPath`")"
    $sectionMatch = [regex]::Match($content, "(?ms)^\[editor_plugins\]\r?\n.*?(?=^\[|\z)")

    if ($sectionMatch.Success) {
        $section = $sectionMatch.Value
        $enabledMatch = [regex]::Match($section, "(?m)^enabled=PackedStringArray\((?<items>[^\)]*)\)")

        if ($enabledMatch.Success) {
            $items = $enabledMatch.Groups["items"].Value.Trim()
            if ([string]::IsNullOrWhiteSpace($items)) {
                $newItems = "`"$PluginPath`""
            }
            else {
                $newItems = "$items, `"$PluginPath`""
            }

            $newEnabledLine = "enabled=PackedStringArray($newItems)"
            $newSection = $section.Substring(0, $enabledMatch.Index) + $newEnabledLine + $section.Substring($enabledMatch.Index + $enabledMatch.Length)
        }
        else {
            $newSection = $section.TrimEnd() + [Environment]::NewLine + $enabledLine + [Environment]::NewLine
        }

        $content = $content.Substring(0, $sectionMatch.Index) + $newSection + $content.Substring($sectionMatch.Index + $sectionMatch.Length)
    }
    else {
        $content = $content.TrimEnd() + [Environment]::NewLine + [Environment]::NewLine
        $content += "[editor_plugins]" + [Environment]::NewLine + [Environment]::NewLine
        $content += $enabledLine + [Environment]::NewLine
    }

    $backupPath = Join-Path (Split-Path -Parent $ProjectFile) ("project.godot.godot-mcp-backup-" + (Get-Date -Format "yyyyMMdd-HHmmss"))
    Copy-Item -LiteralPath $ProjectFile -Destination $backupPath -Force

    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($ProjectFile, $content, $utf8NoBom)
    Write-Host "Saved backup: $backupPath"
    return $true
}

$projectRoot = [System.IO.Path]::GetFullPath((Resolve-Path -LiteralPath $ProjectPath).Path)
$projectFile = Join-Path $projectRoot "project.godot"

if (-not (Test-Path -LiteralPath $projectFile -PathType Leaf)) {
    throw "Run this from a Godot project folder, or pass -ProjectPath. The folder must contain project.godot."
}

$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("godot-mcp-install-" + [System.Guid]::NewGuid().ToString("N"))
$zipPath = Join-Path $tempRoot "source.zip"
$extractPath = Join-Path $tempRoot "source"
$archiveUrl = "https://github.com/$Repo/archive/refs/heads/$Ref.zip"
$sourceRoot = $null

try {
    $localSourceRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
    if (
        (Test-Path -LiteralPath (Join-Path $localSourceRoot "addons\ai_mcp_bridge") -PathType Container) -and
        (Test-Path -LiteralPath (Join-Path $localSourceRoot "tools\mcp-godot") -PathType Container)
    ) {
        Write-Step "Using local GODOT-MCP files"
        $sourceRoot = Get-Item -LiteralPath $localSourceRoot
    }
    else {
        Write-Step "Downloading GODOT-MCP"
        New-Item -ItemType Directory -Path $tempRoot -Force | Out-Null
        Invoke-WebRequest -Uri $archiveUrl -OutFile $zipPath
        Expand-Archive -LiteralPath $zipPath -DestinationPath $extractPath -Force
        $sourceRoot = Get-ChildItem -LiteralPath $extractPath -Directory | Select-Object -First 1
    }

    if ($null -eq $sourceRoot) {
        throw "Could not find GODOT-MCP source files."
    }

    Write-Step "Copying the Godot editor plugin"
    Copy-DirectoryContents `
        -Source (Join-Path $sourceRoot.FullName "addons\ai_mcp_bridge") `
        -Destination (Join-Path $projectRoot "addons\ai_mcp_bridge")

    Write-Step "Copying the local MCP server"
    Copy-DirectoryContents `
        -Source (Join-Path $sourceRoot.FullName "tools\mcp-godot") `
        -Destination (Join-Path $projectRoot "tools\mcp-godot")

    $envExampleSource = Join-Path $sourceRoot.FullName ".env.example"
    $envExampleDestination = Join-Path $projectRoot ".env.example"
    if ((Test-Path -LiteralPath $envExampleSource -PathType Leaf) -and -not (Test-Path -LiteralPath $envExampleDestination -PathType Leaf)) {
        Copy-Item -LiteralPath $envExampleSource -Destination $envExampleDestination
    }

    Write-Step "Enabling the AI MCP Bridge plugin"
    $changedProjectFile = Enable-GodotEditorPlugin `
        -ProjectFile $projectFile `
        -PluginPath "res://addons/ai_mcp_bridge/plugin.cfg"

    if (-not $changedProjectFile) {
        Write-Host "The plugin was already enabled in project.godot."
    }

    $serverPath = Join-Path $projectRoot "tools\mcp-godot\src\server.mjs"
    $serverTomlPath = $serverPath.Replace("\", "/")
    $projectTomlPath = $projectRoot.Replace("\", "/")
    $codexConfig = @"
[mcp_servers.godotMCP]
command = "node"
args = [ "$serverTomlPath", "--project-root", "$projectTomlPath" ]
startup_timeout_sec = 20
env = { GODOT_PROJECT_ROOT = "$projectTomlPath", GODOT_MCP_PORT = "$Port" }
"@

    $codexConfigPath = Join-Path $projectRoot "godot-mcp.codex.toml"
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($codexConfigPath, $codexConfig + [Environment]::NewLine, $utf8NoBom)

    Write-Step "Checking Node.js"
    $node = Get-Command node -ErrorAction SilentlyContinue
    if ($null -eq $node) {
        Write-Warning "Node.js was not found. Install Node.js 18 or newer before connecting an AI client."
    }
    else {
        Write-Host "Node.js found: $($node.Source)"
        & $node.Source (Join-Path $projectRoot "tools\mcp-godot\test\smoke.mjs")
    }

    Write-Step "Done"
    Write-Host "Open or restart Godot 4.x, then look for the AI MCP Bridge dock."
    Write-Host "Codex config was saved here:"
    Write-Host $codexConfigPath
    Write-Host ""
    Write-Host $codexConfig
}
finally {
    if ((Test-Path -LiteralPath $tempRoot) -and $tempRoot.StartsWith([System.IO.Path]::GetTempPath(), [System.StringComparison]::OrdinalIgnoreCase)) {
        Remove-Item -LiteralPath $tempRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
}

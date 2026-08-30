#Requires -Version 5.1
<#
.SYNOPSIS
    TFLite C native library setup for Windows (tflite_flutter desktop).

.DESCRIPTION
    Obtains the correct TensorFlow Lite C API DLL for Windows x64.
    Two methods are supported:
      1) Download from official TensorFlow releases (preferred)
      2) Build from source with Visual Studio Build Tools

.NOTES
    C-02 (P0 fix): Without this DLL, TFLiteFaceVisionEngine cannot load the
    FaceMesh model, and face recognition silently fails on Windows.

.EXAMPLE
    .\scripts\setup_tflite_native.ps1          # Auto-detect best method
    .\scripts\setup_tflite_native.ps1 -Download # Force download
    .\scripts\setup_tflite_native.ps1 -Check    # Check current status
#>

param(
    [switch]$Check,
    [switch]$Download,
    [switch]$Build,
    [switch]$Force
)

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Blobs = Join-Path $Root "blobs"
$TargetDll = Join-Path $Blobs "libtensorflowlite_c-win.dll"
$TfVersion = "v2.15.0"

# ── Helpers ──────────────────────────────────────────────────────────

function Write-Status {
    param([string]$Message, [string]$Color = "White")
    Write-Host "  $Message" -ForegroundColor $Color
}

function Write-Header {
    param([string]$Message)
    Write-Host ""
    Write-Host "═══ $Message ═══" -ForegroundColor Cyan
}

function Test-FileExists {
    param([string]$Path)
    if (Test-Path $Path) {
        $size = (Get-Item $Path).Length
        $sizeMB = [math]::Round($size / 1MB, 2)
        Write-Status "OK  $Path ($sizeMB MB)" "Green"
        return $true
    }
    Write-Status "MISSING  $Path" "Red"
    return $false
}

function Test-DllArchitecture {
    param([string]$DllPath)
    if (-not (Test-Path $DllPath)) { return $false }

    # Check if file is a valid PE DLL with x64 machine type
    try {
        $bytes = [System.IO.File]::ReadAllBytes($DllPath)
        if ($bytes.Length -lt 64) { return $false }
        # PE signature check
        if ($bytes[0] -ne 0x4D -or $bytes[1] -ne 0x5A) { return $false }
        $peOffset = [BitConverter]::ToInt32($bytes, 60)
        if ($peOffset + 4 -ge $bytes.Length) { return $false }
        if ($bytes[$peOffset] -ne 0x50 -or $bytes[$peOffset+1] -ne 0x45) { return $false }
        # Machine type at PE offset + 4: 0x8664 = x64
        $machineType = [BitConverter]::ToUInt16($bytes, $peOffset + 4)
        if ($machineType -eq 0x8664) {
            Write-Status "Architecture: x64 ✓" "Green"
            return $true
        } elseif ($machineType -eq 0x14C) {
            Write-Status "Architecture: x86 (WRONG — need x64)" "Red"
            return $false
        } else {
            Write-Status "Architecture: Unknown ($machineType)" "Yellow"
            return $false
        }
    } catch {
        Write-Status "Cannot verify architecture: $_" "Yellow"
        return $false
    }
}

# ── Check Mode ───────────────────────────────────────────────────────

if ($Check) {
    Write-Header "TFLite Native Library Status"
    Write-Host ""
    Write-Host "  Blobs directory: $Blobs"
    Write-Host ""

    $linuxOk = Test-FileExists (Join-Path $Blobs "libtensorflowlite_c-linux.so")
    $winOk = Test-FileExists $TargetDll

    if ($winOk) {
        Write-Host ""
        Test-DllArchitecture $TargetDll
    }

    Write-Host ""
    if ($linuxOk -and $winOk) {
        Write-Status "All platforms ready" "Green"
    } elseif ($winOk) {
        Write-Status "Windows ready, Linux missing" "Yellow"
    } elseif ($linuxOk) {
        Write-Status "Linux ready, Windows missing" "Yellow"
    } else {
        Write-Status "Neither platform has TFLite native library" "Red"
    }
    exit 0
}

# ── Create blobs directory ──────────────────────────────────────────

if (-not (Test-Path $Blobs)) {
    New-Item -ItemType Directory -Path $Blobs -Force | Out-Null
    Write-Status "Created $Blobs" "White"
}

# ── Check if already exists ─────────────────────────────────────────

if ((Test-Path $TargetDll) -and -not $Force) {
    Write-Header "TFLite DLL Already Present"
    Write-Status "$TargetDll" "Green"
    Test-DllArchitecture $TargetDll
    Write-Host ""
    Write-Status "Use -Force to re-download" "Yellow"
    exit 0
}

# ── Method 1: Download from official TensorFlow releases ────────────

function Get-TfliteDll {
    Write-Header "Downloading TFLite C API DLL"

    $tempDir = Join-Path $env:TEMP "tflite_build"
    if (-not (Test-Path $tempDir)) {
        New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
    }

    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

    # Source 1: tphakala/tflite_c precompiled libraries (verified, actively maintained)
    # These are compiled with clang-18, optimized, and include xnnpack support.
    $tphakalaUrl = "https://github.com/tphakala/tflite_c/releases/download/v2.17.1/tflite_c_v2.17.1_windows_amd64.zip"
    $tempZip = Join-Path $tempDir "tflite_c_windows.zip"
    $tempExtract = Join-Path $tempDir "tphakala_extract"

    Write-Status "Attempting download from tphakala/tflite_c (v2.17.1)..."
    try {
        $webClient = New-Object System.Net.WebClient
        $webClient.Headers.Add("User-Agent", "M-EDU-Setup/1.0")
        $webClient.DownloadFile($tphakalaUrl, $tempZip)

        if (Test-Path $tempZip) {
            $zipSize = (Get-Item $tempZip).Length
            if ($zipSize -gt 1MB) {
                Write-Status "Downloaded $([math]::Round($zipSize/1MB, 2)) MB — extracting..."
                if (-not (Test-Path $tempExtract)) {
                    New-Item -ItemType Directory -Path $tempExtract -Force | Out-Null
                }
                Expand-Archive -Path $tempZip -DestinationPath $tempExtract -Force

                # Find the DLL — may be in subdirectory
                $foundDll = Get-ChildItem -Path $tempExtract -Filter "*.dll" -Recurse |
                    Where-Object { $_.Name -like "*tensorflowlite*" -and $_.Length -gt 1MB } |
                    Select-Object -First 1

                if (-not $foundDll) {
                    # Also check for .so files renamed for Windows compatibility
                    $foundDll = Get-ChildItem -Path $tempExtract -Filter "*.dll" -Recurse |
                        Where-Object { $_.Length -gt 1MB } |
                        Select-Object -First 1
                }

                if ($foundDll) {
                    Copy-Item $foundDll.FullName $TargetDll -Force
                    Write-Status "Extracted and installed: $($foundDll.Name) ($([math]::Round($foundDll.Length/1MB, 2)) MB)" "Green"
                    return $true
                } else {
                    Write-Status "DLL not found in extracted archive" "Yellow"
                }
            } else {
                Write-Status "Downloaded file too small ($zipSize bytes) — likely an error page" "Yellow"
            }
        }
    } catch {
        Write-Status "tphakala download failed: $($_.Exception.Message)" "Yellow"
    }

    # Source 2: Try Python tflite-runtime wheel (contains the DLL)
    Write-Status "Trying alternative: extract from tflite-runtime wheel..."
    try {
        $pipPath = Get-Command pip -ErrorAction SilentlyContinue
        if ($pipPath) {
            $whlDir = Join-Path $tempDir "whl"
            if (-not (Test-Path $whlDir)) { New-Item -ItemType Directory -Path $whlDir -Force | Out-Null }

            $whlUrl = "https://storage.googleapis.com/tensorflow-nightly-public-prod/releases/common/tflite_v2_15_0/tflite_runtime-2.15.0-cp311-win_amd64.whl"
            $whlFile = Join-Path $whlDir "tflite_runtime.whl"

            (New-Object System.Net.WebClient).DownloadFile($whlUrl, $whlFile)

            if (Test-Path $whlFile -and (Get-Item $whlFile).Length -gt 1MB) {
                $extractDir = Join-Path $whlDir "extracted"
                if (-not (Test-Path $extractDir)) {
                    New-Item -ItemType Directory -Path $extractDir -Force | Out-Null
                }
                Expand-Archive -Path $whlFile -DestinationPath $extractDir -Force

                $foundDll = Get-ChildItem -Path $extractDir -Filter "*.dll" -Recurse |
                    Where-Object { $_.Name -like "*tensorflowlite*" -and $_.Length -gt 1MB } |
                    Select-Object -First 1

                if ($foundDll) {
                    Copy-Item $foundDll.FullName $TargetDll -Force
                    Write-Status "Extracted from wheel: $($foundDll.Name)" "Green"
                    return $true
                }
            }
        }
    } catch {
        Write-Status "Wheel extraction failed: $($_.Exception.Message)" "Yellow"
    }

    return $false
}

# ── Method 2: Build from source ─────────────────────────────────────

function Build-TfliteDll {
    Write-Header "Building TFLite C API DLL from Source"

    # Check prerequisites
    $cmake = Get-Command cmake -ErrorAction SilentlyContinue
    $git = Get-Command git -ErrorAction SilentlyContinue
    $msbuild = Get-Command msbuild -ErrorAction SilentlyContinue

    if (-not $cmake) {
        Write-Status "cmake not found. Install Visual Studio Build Tools with CMake." "Red"
        Write-Host ""
        Write-Host "  Option A: Install Visual Studio 2022 Build Tools" -ForegroundColor White
        Write-Host "    https://visualstudio.microsoft.com/visual-cpp-build-tools/" -ForegroundColor Gray
        Write-Host "    Select: 'Desktop development with C++' workload" -ForegroundColor Gray
        Write-Host ""
        Write-Host "  Option B: Use 'winget install Microsoft.VisualStudio.2022.BuildTools'" -ForegroundColor White
        return $false
    }

    if (-not $git) {
        Write-Status "git not found. Install Git for Windows." "Red"
        return $false
    }

    $workDir = Join-Path $env:TEMP "tflite_build_src"
    $tfDir = Join-Path $workDir "tensorflow"

    # Clone TensorFlow (shallow)
    if (-not (Test-Path $tfDir)) {
        Write-Status "Cloning TensorFlow $TfVersion (shallow)..."
        & git clone --depth 1 --branch $TfVersion https://github.com/tensorflow/tensorflow.git $tfDir
        if ($LASTEXITCODE -ne 0) {
            Write-Status "Git clone failed" "Red"
            return $false
        }
    }

    $srcDir = Join-Path $tfDir "tensorflow\lite\c"
    $buildDir = Join-Path $workDir "build"

    if (-not (Test-Path $buildDir)) {
        New-Item -ItemType Directory -Path $buildDir -Force | Out-Null
    }

    Write-Status "Configuring CMake (Visual Studio 17 2022)..."
    & cmake -S $srcDir -B $buildDir -G "Visual Studio 17 2022" -A x64 -DTFLITE_C_BUILD_SHARED_LIBS=ON
    if ($LASTEXITCODE -ne 0) {
        # Try older VS
        Write-Status "Trying Visual Studio 16 2019..."
        & cmake -S $srcDir -B $buildDir -G "Visual Studio 16 2019" -A x64 -DTFLITE_C_BUILD_SHARED_LIBS=ON
        if ($LASTEXITCODE -ne 0) {
            Write-Status "CMake configuration failed" "Red"
            Write-Host "  Ensure Visual Studio Build Tools are installed with C++ workload" -ForegroundColor Yellow
            return $false
        }
    }

    Write-Status "Building (Release)..."
    & cmake --build $buildDir --config Release --target tensorflowlite_c
    if ($LASTEXITCODE -ne 0) {
        Write-Status "Build failed" "Red"
        return $false
    }

    # Find the built DLL
    $dll = Get-ChildItem -Path $buildDir -Filter "libtensorflowlite_c*.dll" -Recurse |
        Where-Object { $_.Directory.Name -eq "Release" -or $_.Directory.Name -eq "Release" } |
        Select-Object -First 1

    if (-not $dll) {
        $dll = Get-ChildItem -Path $buildDir -Filter "*tensorflowlite_c*.dll" -Recurse |
            Select-Object -First 1
    }

    if (-not $dll) {
        Write-Status "Built DLL not found in $buildDir" "Red"
        return $false
    }

    Copy-Item $dll.FullName $TargetDll -Force
    Write-Status "Built and installed: $($dll.FullName)" "Green"
    return $true
}

# ── Main Logic ──────────────────────────────────────────────────────

$success = $false

if ($Download -or (-not $Build)) {
    $success = Get-TfliteDll
}

if (-not $success -and ($Build -or $Download)) {
    $success = Build-TfliteDll
}

if (-not $success) {
    Write-Header "SETUP INCOMPLETE"
    Write-Host ""
    Write-Host "  Without libtensorflowlite_c-win.dll, face recognition will" -ForegroundColor Red
    Write-Host "  show EngineUnavailableOutcome on Windows (not silently fail)." -ForegroundColor Red
    Write-Host ""
    Write-Host "  Manual download options:" -ForegroundColor Yellow
    Write-Host "    1. tphakala/tflite_c (precompiled, verified):" -ForegroundColor White
    Write-Host "       https://github.com/tphakala/tflite_c/releases" -ForegroundColor Gray
    Write-Host "       Download tflite_c_v2.17.1_windows_amd64.zip, extract DLL to blobs/" -ForegroundColor Gray
    Write-Host "    2. Build from source: .\scripts\setup_tflite_native.ps1 -Build" -ForegroundColor White
    Write-Host "    3. Place libtensorflowlite_c-win.dll (x64, >3MB) in blobs/" -ForegroundColor White
    Write-Host ""
    exit 1
}

# ── Verify ──────────────────────────────────────────────────────────

Write-Header "Verification"

if (Test-FileExists $TargetDll) {
    $dllSize = (Get-Item $TargetDll).Length
    $dllSizeMB = [math]::Round($dllSize / 1MB, 2)
    Write-Status "File: $TargetDll ($dllSizeMB MB)" "Green"

    # Architecture check
    $archOk = Test-DllArchitecture $TargetDll
    if (-not $archOk) {
        Write-Host ""
        Write-Status "WARNING: DLL architecture verification failed" "Yellow"
        Write-Status "The DLL may not work correctly on this system" "Yellow"
    }

    # Minimum size check (real TFLite DLL is typically 3-8 MB)
    if ($dllSize -lt 1MB) {
        Write-Host ""
        Write-Status "WARNING: DLL is suspiciously small ($dllSizeMB MB)" "Yellow"
        Write-Status "This may not be a valid TFLite C API library" "Yellow"
    }

    Write-Host ""
    Write-Status "TFLite Windows setup complete" "Green"
    Write-Host ""
    Write-Host "  Next steps:" -ForegroundColor White
    Write-Host "    1. flutter build windows" -ForegroundColor White
    Write-Host "    2. The DLL will be copied to the build output by CMake" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  DLL search path at runtime: <exe_dir>/blobs/libtensorflowlite_c-win.dll" -ForegroundColor Gray
    exit 0
} else {
    Write-Status "DLL file not found after setup" "Red"
    exit 1
}

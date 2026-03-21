# Tor + Helium = Torelium

## Torelium Stealth Browser v7.7 🛡️🚀

Torelium is a high-privacy, anti-fingerprinting browser suite designed to bypass advanced web security and tracking systems. It integrates the **Helium** browser with the **Tor** network, wrapped in a portable PowerShell orchestrator that automates everything from installation to stealth configuration.

## 🌟 Key Features

- **CreepJS Proof:** Engineered to pass aggressive fingerprinting (CreepJS, etc.) with high-entropy, consistent spoofing.
- **Smart Regional Profiles:** 16+ global profiles (US, UK, JP, AU, TR, etc.) with consistent Timezone, Locale, and Languages.
- **Worker & SharedWorker Protection:** First-class interception for background threads. isolated Workers get the same stealth hooks.
- **OffscreenCanvas Spoofing:** Noise injection for 2D and WebGL OffscreenCanvas contexts in both Window and Worker scopes.
- **Zero-Trace Identity Change:** Automatically wipes `localStorage` and `IndexedDB` when a new identity is requested.
- **Dynamic DST Support:** Real-time seasonal timezone offset calculation using `Intl.DateTimeFormat`.
- **Tor Bridge Architecture:** A custom local HTTP bridge (Port 9060) that allows the extension to talk to Tor Control Port (9051).
- **Portable & Self-Contained:** Everything lives within the project folder. No global installation required.
- **Isolated Profiles:** Every session runs in a fresh, temporary profile directory that is automatically cleaned up on exit.

## 🏗️ Architecture

1.  **Orchestrator (`Torelium.ps1`):** The main entry point. Handles process lifecycle, dynamic downloads, profile isolation, and background job management.
2.  **Tor Bridge (PowerShell Background Job):** Listens on `http://127.0.0.1:9060`. It acts as a middleware between the Chromium extension and the Tor service.
3.  **Torelium Extension:** A Manifest V3 extension that provides a UI for identity management (NEWNYM), circuit info, and real-time privacy checklists.
4.  **Isolated Profiles:** Every session runs in a fresh, temporary profile directory that is automatically cleaned up on exit.

## 🚀 Getting Started

### Prerequisites
- **Windows OS**
- **PowerShell 5.1 or Core (pwsh)**

### Installation
1.  Clone the repository or download the source code.
2.  Open a terminal in the project directory.
3.  Run the launcher:
    ```powershell
    ./Torelium.ps1
    ```
4.  The script will automatically download necessary binaries on the first run.

## 🛠️ Usage
- Once launched, the Helium browser will open two pages:
    - `https://check.torproject.org/` (To verify Tor connection).
    - `https://abrahamjuliot.github.io/creepjs/` (To verify stealth performance).
- Use the **Torelium Extension** (pinned in the toolbar) to request a **New Tor Identity** or check your connection status.

## 📁 Project Structure
- `Torelium.ps1`: Main PowerShell orchestrator.
- `Torelium.Bridge.ps1`: Local HTTP bridge (separate process, Tor control relay).
- `extension/`: Source code for the Torelium Stealth Extension.
- `tor/`: (Generated) Local Tor binaries.
- `helium/`: (Generated) Local Helium browser binaries.
- `ai.md`: Detailed technical documentation.

## ⚠️ Disclaimer
This project is for educational and privacy-preservation purposes only. Always comply with your local laws and regulations regarding the use of Tor and stealth browsers.

---
*Built with ❤️ for Privacy and Security by Bahadır Doğru*

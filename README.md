# Tor + Helium = Torelium

## Torelium Stealth Browser v7.6 🛡️🚀

Torelium is a high-privacy, anti-fingerprinting browser suite designed to bypass advanced web security and tracking systems. It integrates the **Helium** browser with the **Tor** network, wrapped in a portable PowerShell orchestrator that automates everything from installation to stealth configuration.

## 🌟 Key Features

- **CreepJS Proof:** Engineered to pass advanced fingerprinting tests (CreepJS, etc.) with consistent spoofing.
- **Dynamic Downloader:** Automatically downloads and configures the latest **Tor Expert Bundle** and **Helium Browser** within the project directory. No pre-installation required.
- **Tor Bridge Architecture:** A custom-built local HTTP bridge (Port 9060) that allows the browser extension to communicate with the Tor Control Port (9051) bypassing Manifest V3 socket limitations.
- **Portable & Self-Contained:** Everything lives within the project folder. Move the folder to any Windows machine and run.
- **CDP Leak Protection:** Hybrid locking mechanism to prevent hardware and timezone leaks via background workers (ServiceWorker/WebWorker).
- **Stealth Injection:** Automatically injects a custom privacy extension into every session for real-time spoofing and circuit control.

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
- `extension/`: Source code for the Torelium Stealth Extension.
- `tor/`: (Generated) Local Tor binaries.
- `helium/`: (Generated) Local Helium browser binaries.
- `ai.md`: Detailed technical documentation.

## ⚠️ Disclaimer
This project is for educational and privacy-preservation purposes only. Always comply with your local laws and regulations regarding the use of Tor and stealth browsers.

---
*Built with ❤️ for Privacy and Security by Bahadır Doğru*

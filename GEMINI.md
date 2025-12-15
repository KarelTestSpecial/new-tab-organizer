# Project Context: New Tab Organizer

## Project Overview
This project is a **Chrome Extension** (Manifest V3) that replaces the default "New Tab" page with a highly customizable dashboard. It features a system of interactive panels for notes and bookmarks, supporting multiple independent views (Workspaces A, B, and C).

### Core Technologies
*   **Frontend:** HTML5, CSS3, Vanilla JavaScript (ES6+).
*   **Storage:** `chrome.storage.sync` (settings, text data) and `chrome.storage.local` (images, larger data).
*   **Permissions:** `bookmarks`, `storage`, `tabs`.
*   **Libraries:** `Sortable.min.js` (for drag-and-drop functionality).

## Architecture & File Structure
*   **Manifest:** `manifest.json` defines the extension configuration, permissions, and `chrome_url_overrides` for the new tab page.
*   **Views:**
    *   `panelA.html`: The default entry point (New Tab Page).
    *   `panelB.html`, `panelC.html`: Additional independent workspaces.
*   **Logic (`js/`):**
    *   `app.js`: Main entry point. Handles DOM initialization, state management (save/load), view identification, and startup redirection logic.
    *   `panels.js`: Logic for panel creation, manipulation, and moving panels between views.
    *   `bookmarks.js`: Handles interactions with the Chrome Bookmarks API.
    *   `settings_logic.js`: Manages user preferences and import/export functionality.
*   **Styles:** `css/style.css` contains all styles, including light/dark mode themes.

## Building and Running
Since this is a vanilla JavaScript project, there is no compile step.

1.  **Load Extension:**
    *   Open Chrome and go to `chrome://extensions`.
    *   Enable "Developer mode".
    *   Click "Load unpacked".
    *   Select the root directory of this project.
2.  **Test:**
    *   Open a new tab to see `panelA.html`.
    *   Navigate to `panelB.html` or `panelC.html` via the sidebar interface to test other workspaces.

## Development Conventions
*   **State Management:** The application state is serialized to JSON and stored in `chrome.storage`. `app.js` contains the primary `saveState` function that scrapes the DOM to persist changes.
*   **View context:** Functions often check `getCurrentView()` (returns 'A', 'B', or 'C') to determine which storage key to use (`panelsState`, `panelsState_B`, `panelsState_C`).
*   **DOM Manipulation:** UI is largely generated dynamically via JavaScript. Ensure event listeners are delegated or attached when elements are created.
*   **CSS:** Uses standard CSS variables for theming.
*   **Linting/Formatting:** No explicit linter config found; follow existing style (standard indentation, semicolons, single quotes preferred).

### **System Prompt: RAM-Constrained Chromebook Developer (Debian 12)**
*   **Datum Context:**  December 2025

#### **1. User & Systeemprofiel**
*   **Hardware:** Acer Chromebook 314 (CB314-1H-C16Y)
    *   **CPU:** Intel Celeron N4020 (2 cores, 2 threads)
    *   **RAM:** 4GB (**DE PRIMAIRE KRITIEKE BEPERKING**)
*   **Besturingssysteem:** Google Chrome OS v 142.0.7444.234 (64-bits)
*   **Ontwikkelomgeving (Chrostini):**
    *   **Distributie:** Debian 12 (Bookworm)
    *   **Kernel:** `6.6.99-08726-g28eab9a1f61e` (SMP PREEMPT_DYNAMIC x86_64)
    *   **Opslag:** 25,0 GB Totale Schijfruimte (Beperkt, maar beheersbaar)

#### **2. Core Technology & Tooling Stack**

*   **Primaire IDE:** Google Antigravity (`https://antigravity.google/`)
*   **AI-Assistenten & Modellen:**
    *   **Tools:** Google Jules 2.0, Gemini-CLI.
    *   **Standaard Modellen:** `gemini-pro-latest`, `gemini-flash-latest`.
    *   **Speciale Toegang:** Ik heb toegang tot `gemini-3.0` via zowel **Google Antigravity** als de **Gemini-CLI**.
*   **Programmeertalen & Runtimes:**
    *   **Python 3:** (LET OP: **STRIKTE VENV-VEREISTE** wegens PEP 668 op Debian 12)
    *   **Node.js:** v22+ (via NVM; **STRIKT `pnpm` gebruiken**)
    *   **Java:** OpenJDK 17 (Headless & JDK)
    *   **C/C++:** GCC 12, LLVM 15
*   **Versiebeheer:** Git v2.39.5

#### **3. CRUCIALE RICHTLIJNEN & OPERATIEVE REGELS**

**Regel #1: Prioriteit #1 - Extreem RAM-Beheer**
Mijn 4GB RAM is de meest kritieke bottleneck. Alle oplossingen, commando's en workflows moeten geoptimaliseerd zijn voor een minimaal geheugengebruik.
*   **Vermijd Zware Processen:** Stel geen oplossingen voor die resource-intensieve applicaties, daemons of zware achtergrondprocessen vereisen. Geef altijd de voorkeur aan lichtgewicht CLI-tools boven GUI-alternatieven binnen de Linux-omgeving.
*   **Beperk Parallelle Taken:** Wees voorzichtig met commando's die veel processen spawnen (bv. beperk het aantal jobs bij `make -j` tot maximaal 2).
*   **Adviseer Geheugenbesparende Alternatieven:** Denk proactief mee. Als een taak (bv. een grote data-analyse, een zware build) waarschijnlijk te veel RAM verbruikt, stel dan direct een cloud-gebaseerde oplossing voor (bv. Google Colab, Cloud Shell, een kleine VM).
*   **Geef Commando's voor Monitoring:** Adviseer periodiek het gebruik van `htop` of `free -h` om de geheugensituatie te controleren.

**Regel #2: Proactief Opslagbeheer**
Hoewel minder kritiek dan RAM, moet de 25,0 GB schijfruimte efficiënt worden beheerd.
*   **Regelmatig Opschonen:** Adviseer periodiek het uitvoeren van opschoonacties.
*   **Specifieke Commando's:** Gebruik en adviseer commando's zoals:
    *   `sudo apt autoremove --purge`
    *   `sudo apt clean`
    *   `pnpm store prune`

**Regel #3: Strikte Regels voor Project Management (NIET ONDERHANDELBAAR)**
Deze regels zijn essentieel voor een stabiel en efficiënt systeem.

*   **Voor Git & GitHub (SSH Only):**
    Voor interacties met remote repositories:
    *   **Gebruik altijd SSH:** `git@github.com:username/repo.git`
    *   HTTPS niet gebruiken voor cloning of remotes.

*   **Voor Python (PEP 668):**
    Een globale `pip install` is **verboden en onmogelijk**. Elk Python-project dat dependencies vereist, **MOET** beginnen met de volgende workflow:
    ```bash
    python3 -m venv venv
    source venv/bin/activate
    pip install <package_name>
    ```

*   **Voor Node.js:**
    Gebruik **UITSLUITEND `pnpm`** voor alle projecten om schijfruimte te besparen. Vermijd `npm` en `yarn`.

*   **Voor Frontend Development (JS/TS):**
    Gebruik **UITSLUITEND Vite** voor het opzetten van nieuwe projecten. De reden is de extreme efficiëntie op een RAM- en CPU-beperkt systeem. De standaard workflow is:
    ```bash
    # 1. Maak het project aan met de interactieve wizard
    pnpm create vite

    # 2. Volg de instructies
    cd <project-name>
    pnpm install
    pnpm dev
    ```

#### **4. Kennisbank & Referenties**

Ik ben bekend met en geïnteresseerd in de volgende technologieën en methodologieën. Integreer deze kennis waar relevant.

*   **Officiële AI Documentatie:**
    *   Gemini API Models: `https://ai.google.dev/gemini-api/docs/models`
    *   Gemini API Quickstarts: `https://ai.google.dev/gemini-api/docs/quickstart`
*   **Ontwikkelmethodologieën & Frameworks:**
    *   BMAD-METHOD: `https://github.com/bmad-code-org/BMAD-METHOD`
    *   KiloCode.ai: `https://kilocode.ai/docs`
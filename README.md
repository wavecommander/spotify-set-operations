# spotify-set-operations

Apply mathematical set operations (Union, Intersection, Difference, Symmetric Difference) to Spotify playlists and albums to create new curated playlists.

Available as both a **modern graphical standalone PWA** (Web Components & ES Modules) and a **Python CLI tool**.

---

## 🚀 Graphical Web App (PWA)

The web app is a standalone, client-side Progressive Web App built with native **JavaScript ES Modules** and **Web Components (Custom Elements & Shadow DOM)**.

### Features
* **100% Graphical Operation Pipeline**: No cryptic mathematical syntax or symbol tables. Work directly with real playlist and album names, cover art, and metadata on the presentation layer.
* **Venn Diagram Operation Symbols**: Intuitive visual buttons representing operations:
  * **Union ($\cup$)**: Both circles filled — *Combine all tracks*
  * **Intersection ($\cap$)**: Center lens filled — *Only tracks shared in both*
  * **Difference ($\setminus$)**: Left circle filled — *Subtract tracks in second collection from first*
  * **Symmetric Difference ($\Delta$)**: Outer lobes filled — *Only tracks unique to either collection*
* **Dynamic SVG Venn Visualizer**: Interactive two-way Venn diagram displaying live track counts in each partition ($A \setminus B$, $A \cap B$, $B \setminus A$). Click any partition to filter the preview table!
### Features
* **100% Graphical Operation Pipeline**: No cryptic mathematical syntax or symbol tables. Work directly with real playlist and album names, cover art, and metadata on the presentation layer.
* **Venn Diagram Operation Symbols**: Intuitive visual buttons representing operations:
  * **Union ($\cup$)**: Both circles filled — *Combine all tracks*
  * **Intersection ($\cap$)**: Center lens filled — *Only tracks shared in both*
  * **Difference ($\setminus$)**: Left circle filled — *Subtract tracks in second collection from first*
  * **Symmetric Difference ($\Delta$)**: Outer lobes filled — *Only tracks unique to either collection*
* **Dynamic SVG Venn Visualizer**: Interactive multi-step Venn diagrams displaying live track counts in each partition ($A \setminus B$, $A \cap B$, $B \setminus A$). Click any partition to filter the preview table!
* **Cross-Platform Track Resolution & Deduplication**:
  * Normalize and deduplicate songs across **Spotify** and **YouTube Music** using canonical identity keys (`isrc:...` or `meta:title::artist`).
  * Cross-platform export engine automatically resolves tracks between Spotify and YouTube Music with duration validation ($\pm 15$s tolerance) and persistent caching.
* **Pluggable Architecture**: Built on a decoupled `MusicProvider` contract, with full support for:
  * **Spotify** (OAuth 2.0 PKCE)
  * **YouTube Music** (Google OAuth 2.0 PKCE + Client Secret & YouTube Data API v3)
* **Pure Client-Side PWA**: Zero build step required, offline caching via Service Worker (`sw.js`), and installable on desktop and mobile.

### Running the Web App Locally

You can run the web app with any static HTTP server:

```shell
# Using Node (npm start)
npm start

# Or using Python's built-in HTTP server
python3 -m http.server 3000
```
Then open [http://localhost:3000](http://localhost:3000) (or [http://127.0.0.1:8888](http://127.0.0.1:8888)) in your browser.

To run the automated test suite:
```shell
npm test
```

### Spotify & YouTube Music Setup

Click the **Settings** gear icon in the top right to configure your developer credentials:

#### 1. Spotify
- Uses OAuth 2.0 with PKCE directly from the browser.
- Configure your **Client ID** and **Redirect URI** (e.g. `http://127.0.0.1:8888/callback`).
- Make sure your redirect URI is added to your app's Redirect URIs in the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard/applications).

#### 2. YouTube Music
- Uses Google OAuth 2.0 with PKCE.
- Configure your **Google Client ID**, **Client Secret** (required by Google for Web Application credentials), and **Redirect URI** in the YouTube Music settings tab.
- Enable the **YouTube Data API v3** in your [Google Cloud Console](https://console.cloud.google.com/apis/library/youtube.googleapis.com).
- Add your redirect URI to **Authorized redirect URIs** in your Google Cloud OAuth 2.0 Client.
- Works with all free and premium YouTube Music accounts!

---

## 💻 Python CLI Tool

The repository also includes the original command-line script in [cli.py](file:///home/benw/dev/spotify-set-operations/cli.py).

### Usage

Export your Spotify credentials as environment variables:

```shell
export SPOTIPY_CLIENT_ID='YOUR_CLIENT_ID'
export SPOTIPY_CLIENT_SECRET='YOUR_CLIENT_SECRET'
export SPOTIPY_REDIRECT_URI='YOUR_REDIRECT_URI'
```

Search for playlists and albums:
```shell
python3 cli.py --playlist-search 'QUERY'
python3 cli.py --album-search 'QUERY'
```

Run set operations interactively or non-interactively:
```shell
# Interactive
python3 cli.py --playlist-ids ID1 ID2 --album-ids ALBUM_ID

# Scripted non-interactive
python3 cli.py -y --playlist-ids ID1 ID2 --name 'My Playlist' --expr 'A | B'
```

### Proof of Concept
A union of 51 playlists that yielded a playlist with 11,000 songs:
```shell
python3 cli.py --playlist-ids 1qVaRy6kQoZkkyIHFPfJsW 2REb6YDnp5qH9IIkMza580 ...
```
Expression:
`A | B | C | D | E | F | G | H | I | J | K | L | M | N | O | P | Q | R | S | T | U | V | W | X | Y | Z | *A | *B | ...`

---

## 🛠 Project Structure

```
spotify-set-operations/
├── index.html                      # PWA entry point
├── manifest.webmanifest            # Standalone PWA manifest
├── sw.js                           # Service worker for offline shell caching
├── package.json                    # Scripts and project metadata
├── css/
│   ├── theme.css                   # Dark theme design tokens
│   ├── main.css                    # Base layout, typography, and reset
│   └── venn.css                    # Venn diagrams and graphical pipeline styles
├── js/
│   ├── app.js                      # Bootstrap & service worker registration
│   ├── core/
│   │   ├── models.js               # Unified Track, MusicCollection, and UserProfile models
│   │   ├── set-engine.js           # Pure set math & Venn partition calculator
│   │   ├── graph-engine.js         # Backend ID-driven pipeline evaluator
│   │   └── track-resolver.js       # Cross-platform resolution & caching engine
│   ├── providers/
│   │   ├── provider-interface.js   # Abstract MusicProvider interface
│   │   ├── provider-registry.js    # Multi-service registry & switcher
│   │   ├── spotify/                # Spotify PKCE Auth and Web API client
│   │   └── ytmusic/                # YouTube Music PKCE Auth, API client & normalizer
│   ├── components/                 # Custom Elements Web Components (<sso-*>)
│   └── utils/                      # PKCE, SVG icons, and LocalStorage helpers
├── test/                           # Automated unit test suite (node --test)
├── cli.py                          # Python CLI script
└── README.md
```

# CarbonPulse

CarbonPulse is a responsive, buildless web prototype based on the hackathon proposal in `CarbonPulse_Refined_Hackathon_Proposal_2026.docx`.

It turns a resident's monthly electricity usage into an explainable emissions estimate, practical household actions, and a clearly labelled precinct scenario.

The **Climate view** combines:

- an interactive Leaflet township map with household-footprint and current-atmosphere modes, light/dark styles, and township/Malaysia extents;
- live no-key Open-Meteo weather and CAMS air-quality model feeds with Malaysian timestamps and labelled fallback data;
- a Global Warming API atmospheric CO2 reference;
- a macro-to-micro 1850–2030 timeline; and
- an Elmina community energy-savings simulator.

## Run locally

From the repository root, run:

```powershell
python -m http.server 4173 --directory dist
```

Then open `http://localhost:4173/#precinct`.

The app stores demo preferences in browser `localStorage`. No bill image or household data is uploaded.

## Map provider note

The app uses CARTO Dark Matter or Positron when a Basemaps API key is available and automatically uses Esri's corresponding dark/light gray tiles when it is not. Copy `dist/config.example.js` to `dist/config.local.js`, add a website-restricted key, and run the app through the local server above. `config.local.js` is optional and ignored by Git so the key is never committed. When the optional file is absent, the browser may show its failed request in DevTools; the app safely continues with the Esri fallback.

Atmospheric values are regional model estimates, not township sensors. Household CO2e values and tree equivalents are explicitly labelled scenarios rather than audited inventory or offset results.

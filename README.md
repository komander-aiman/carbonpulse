# CarbonPulse

CarbonPulse is a responsive, buildless web prototype based on the hackathon proposal in `CarbonPulse_Refined_Hackathon_Proposal_2026.docx`.

It turns a resident's monthly electricity usage into an explainable emissions estimate, practical household actions, and a clearly labelled precinct scenario.

The **Precinct pulse** view combines:

- an interactive Leaflet township map with household, atmospheric CO2, and air-quality layers;
- live no-key Open-Meteo weather and CAMS air-quality feeds with labelled fallback data;
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

The requested CARTO Dark Matter URL is retained in `dist/app.js`. CARTO began requiring a free basemap key in September 2026, so the no-key version uses OpenStreetMap tiles with a local dark treatment. If a CARTO key is supplied as `window.CARBONPULSE_CARTO_KEY` before `app.js` loads, the app uses Dark Matter instead.

Atmospheric values are regional model estimates, not township sensors. Household CO2e values and tree equivalents are explicitly labelled scenarios rather than audited inventory or offset results.

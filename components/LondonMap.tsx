"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, GeoJSON, CircleMarker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { Feature, FeatureCollection } from "geojson";
import type { PathOptions, Layer } from "leaflet";
import { useTheme } from "./ThemeProvider";

interface ApartmentMarker {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  googleMapsUri: string;
  neighbourhood?: { name: string; borough: string };
}

interface StationMarker {
  name: string;
  lat: number;
  lng: number;
  lines: string[];
}

interface Props {
  selectedOptions: Record<string, string>;
  districts: { location: string; borough: string; postcodeDistrict: string }[];
  apartments?: ApartmentMarker[];
  stations?: StationMarker[];
  onScanApartment?: (id: string) => void;
  scanningApartmentId?: string | null;
}

// Throughline palette, Day and Night. Leaflet writes colours into SVG
// attributes, which can't read CSS variables, so the values live here.
const PALETTE = {
  light: { yes: "#16786c", no: "#b3261e", maybe: "#c4621c", none: "#888983", edge: "#dcdcd5", bg: "#f4f4f1", focus: "#2547c7", station: "#87398c", stationEdge: "#5a2560", muted: "#626368" },
  dark: { yes: "#6cc5b6", no: "#f2a49b", maybe: "#f6b985", none: "#6f706c", edge: "#2b2c30", bg: "#131416", focus: "#7e97f2", station: "#d39bd6", stationEdge: "#87398c", muted: "#90918c" },
};

const TILE_DARK = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const TILE_LIGHT = "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";

export default function LondonMap({ selectedOptions, districts, apartments = [], stations = [], onScanApartment, scanningApartmentId }: Props) {
  const [geoJsonData, setGeoJsonData] = useState<FeatureCollection | null>(null);
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const C = PALETTE[isDark ? "dark" : "light"];

  useEffect(() => {
    fetch("/data/london_postcodes.json")
      .then((res) => res.json())
      .then(setGeoJsonData);
  }, []);

  function findDistrictsForPostcode(postcodeDistrict: string): string {
    return districts
      .filter((d) => d.postcodeDistrict.split(",").map((s) => s.trim()).includes(postcodeDistrict))
      .map((d) => d.location)
      .join(", ");
  }

  function style(feature: Feature | undefined): PathOptions {
    if (!feature) return {};
    const name = feature.properties?.Name;
    const option = selectedOptions[name];
    return {
      fillColor: option ? (C[option as "yes" | "no" | "maybe"] ?? C.none) : C.none,
      fillOpacity: 0.5,
      weight: 1,
      color: C.edge,
    };
  }

  function onEachFeature(feature: Feature, layer: Layer) {
    const name = feature.properties?.Name ?? "";
    const matchedDistricts = findDistrictsForPostcode(name);
    layer.bindTooltip(`<strong>${name}</strong>${matchedDistricts ? `<br/>${matchedDistricts}` : ""}`);
  }

  if (!geoJsonData) return <div className="flex-1 bg-[var(--bg-secondary)]" />;

  return (
    <MapContainer
      key={theme}
      center={[51.5074, -0.1278]}
      zoom={10}
      className="h-full w-full"
      style={{ background: C.bg }}
    >
      <TileLayer
        url={isDark ? TILE_DARK : TILE_LIGHT}
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />
      <GeoJSON key={JSON.stringify(selectedOptions)} data={geoJsonData} style={style} onEachFeature={onEachFeature} />
      {apartments.map((a) => (
        <CircleMarker
          key={a.id}
          center={[a.lat, a.lng]}
          radius={6}
          pathOptions={{ color: C.focus, fillColor: C.focus, fillOpacity: 0.85, weight: 1 }}
        >
          <Popup>
            <div style={{ minWidth: 180 }}>
              <strong>{a.name}</strong>
              <br />
              <span style={{ fontSize: 12, color: "#626368" }}>{a.address}</span>
              {a.neighbourhood && (
                <>
                  <br />
                  <span style={{ fontSize: 11, color: "#626368" }}>
                    {a.neighbourhood.name} · {a.neighbourhood.borough}
                  </span>
                </>
              )}
              <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
                <a href={a.googleMapsUri} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "#2547c7" }}>
                  Maps ↗
                </a>
                <a href={`/apartments/${a.id}`} style={{ fontSize: 12, color: "#2547c7" }}>
                  Details →
                </a>
                {onScanApartment && (
                  <button
                    onClick={() => onScanApartment(a.id)}
                    disabled={scanningApartmentId === a.id}
                    style={{ fontSize: 12, color: "#2547c7", background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline" }}
                  >
                    {scanningApartmentId === a.id ? "Scanning..." : "Scan"}
                  </button>
                )}
              </div>
            </div>
          </Popup>
        </CircleMarker>
      ))}
      {stations.map((s) => (
        <CircleMarker
          key={s.name}
          center={[s.lat, s.lng]}
          radius={8}
          pathOptions={{ color: C.stationEdge, fillColor: C.station, fillOpacity: 0.9, weight: 2 }}
        >
          <Popup>
            <div style={{ minWidth: 150 }}>
              <strong>{s.name}</strong>
              <br />
              <span style={{ fontSize: 12, color: "#626368" }}>{s.lines.join(", ")}</span>
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}

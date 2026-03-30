"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, GeoJSON } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { Feature, FeatureCollection } from "geojson";
import type { PathOptions, Layer } from "leaflet";
import { useTheme } from "./ThemeProvider";

interface Props {
  selectedOptions: Record<string, string>;
  districts: { location: string; borough: string; postcodeDistrict: string }[];
}

const OPTION_COLORS: Record<string, string> = {
  yes: "#22c55e",
  no: "#ef4444",
  maybe: "#f59e0b",
};

const TILE_DARK = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const TILE_LIGHT = "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";

export default function LondonMap({ selectedOptions, districts }: Props) {
  const [geoJsonData, setGeoJsonData] = useState<FeatureCollection | null>(null);
  const { theme } = useTheme();
  const isDark = theme === "dark";

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
      fillColor: option ? OPTION_COLORS[option] ?? "#9ca3af" : "#9ca3af",
      fillOpacity: 0.5,
      weight: 1,
      color: isDark ? "#374151" : "#d1d5db",
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
      style={{ background: isDark ? "#111827" : "#f9fafb" }}
    >
      <TileLayer
        url={isDark ? TILE_DARK : TILE_LIGHT}
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />
      <GeoJSON key={JSON.stringify(selectedOptions)} data={geoJsonData} style={style} onEachFeature={onEachFeature} />
    </MapContainer>
  );
}

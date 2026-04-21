/**
 * MapPicker — interactive Leaflet map with a draggable marker.
 * - Does NOT call onLocationChange on initial mount (no fake coords).
 * - Waits for parent to supply initialLat/initialLng (from GPS), then flies there.
 * - Drag or click anywhere after that to adjust.
 */
import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { geocodeApi } from "@/services/api";
import { Loader2 } from "lucide-react";

// Fix bundler-broken default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

export interface LocationResult {
  lat: number;
  lng: number;
  address: string;
  city: string;
}

interface Props {
  initialLat?: number;
  initialLng?: number;
  onLocationChange: (result: LocationResult) => void;
}

const FALLBACK_LAT = 20.5937; // India center — neutral default
const FALLBACK_LNG = 78.9629;

export default function MapPicker({ initialLat, initialLng, onLocationChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<L.Map | null>(null);
  const markerRef    = useRef<L.Marker | null>(null);
  const initialised  = useRef(false);

  // Track whether we've received real coords yet
  const [waiting, setWaiting] = useState(!initialLat);

  // Reverse-geocode a position and fire callback
  const reportPosition = async (lat: number, lng: number) => {
    try {
      const geo = await geocodeApi.reverse(lat, lng);
      onLocationChange({ lat, lng, address: geo.address ?? "", city: geo.city ?? "" });
    } catch {
      onLocationChange({ lat, lng, address: `${lat.toFixed(5)}, ${lng.toFixed(5)}`, city: "" });
    }
  };

  // ── Initialize map once ─────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || initialised.current) return;
    initialised.current = true;

    const startLat = initialLat ?? FALLBACK_LAT;
    const startLng = initialLng ?? FALLBACK_LNG;
    const startZoom = initialLat ? 16 : 5; // zoom out when no GPS yet

    const map = L.map(containerRef.current, {
      center: [startLat, startLng],
      zoom: startZoom,
      zoomControl: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);

    const marker = L.marker([startLat, startLng], {
      draggable: true,
      // Make marker invisible until real coords arrive (if no GPS yet)
      opacity: initialLat ? 1 : 0,
    }).addTo(map);

    // Drag end → report new position
    marker.on("dragend", () => {
      const { lat, lng } = marker.getLatLng();
      setWaiting(false);
      reportPosition(lat, lng);
    });

    // Click anywhere → move marker + report
    map.on("click", (e: L.LeafletMouseEvent) => {
      marker.setLatLng(e.latlng);
      marker.setOpacity(1);
      setWaiting(false);
      reportPosition(e.latlng.lat, e.latlng.lng);
    });

    mapRef.current   = map;
    markerRef.current = marker;

    return () => {
      map.remove();
      mapRef.current    = null;
      markerRef.current = null;
      initialised.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Fly to real GPS position when parent provides it ────────
  useEffect(() => {
    if (initialLat == null || initialLng == null) return;
    if (!mapRef.current || !markerRef.current) return;

    markerRef.current.setLatLng([initialLat, initialLng]);
    markerRef.current.setOpacity(1);
    mapRef.current.flyTo([initialLat, initialLng], 16, { duration: 1.2 });
    setWaiting(false);
  }, [initialLat, initialLng]);

  return (
    <div style={{ position: "relative", height: "320px", width: "100%" }}>
      {/* Map container */}
      <div
        ref={containerRef}
        style={{ height: "100%", width: "100%", borderRadius: "1rem", overflow: "hidden" }}
      />

      {/* Loading overlay — shown until GPS arrives */}
      {waiting && (
        <div
          style={{
            position: "absolute", inset: 0,
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            background: "rgba(255,255,255,0.75)",
            backdropFilter: "blur(4px)",
            borderRadius: "1rem",
            zIndex: 1000,
            gap: "10px",
          }}
        >
          <Loader2 style={{ width: 28, height: 28, color: "hsl(110 55% 26%)", animation: "spin 1s linear infinite" }} />
          <span style={{ fontSize: 13, color: "hsl(140 12% 38%)", fontWeight: 500 }}>
            Fetching your location…
          </span>
          <span style={{ fontSize: 11, color: "hsl(140 12% 55%)" }}>
            Allow location access in your browser
          </span>
        </div>
      )}
    </div>
  );
}

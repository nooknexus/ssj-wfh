"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { Button } from "@/components/ui/button";
import { LocateFixed } from "lucide-react";

// Fix missing marker icons in Next.js
const customIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

function LocationMarker({ position, setPosition }: { position: L.LatLng | null; setPosition: (p: L.LatLng) => void }) {
  const map = useMapEvents({
    click(e) {
      setPosition(e.latlng);
    },
  });

  useEffect(() => {
    if (position) {
      map.flyTo(position, map.getZoom());
    }
  }, [position, map]);

  return position === null ? null : (
    <Marker position={position} icon={customIcon} />
  );
}

export default function LocationMap({
  initialLocation,
  onConfirm,
  onCancel,
  readOnly = false,
}: {
  initialLocation: { lat: number; lng: number } | null;
  onConfirm?: (loc: { lat: number; lng: number }) => void;
  onCancel?: () => void;
  readOnly?: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  const [position, setPosition] = useState<L.LatLng | null>(
    initialLocation ? L.latLng(initialLocation.lat, initialLocation.lng) : null
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (initialLocation && !position) {
      setPosition(L.latLng(initialLocation.lat, initialLocation.lng));
    }
  }, [initialLocation, position]);

  if (!mounted) {
    return <div className={readOnly ? "h-[150px] w-full animate-pulse bg-slate-100 rounded-xl" : "h-[300px] w-full animate-pulse bg-slate-100 rounded-md"} />;
  }

  const mapCenter = position ? [position.lat, position.lng] : [13.7563, 100.5018];
  
  return (
    <div className="flex flex-col gap-4">
      <div className={readOnly ? "h-[150px] w-full rounded-xl overflow-hidden relative z-0 border border-slate-200" : "h-[300px] w-full rounded-md overflow-hidden relative z-0"}>
        <MapContainer
          key={readOnly ? `readonly-${initialLocation?.lat}-${initialLocation?.lng}` : "editable-map"}
          center={mapCenter as L.LatLngExpression}
          zoom={position ? 15 : 6}
          scrollWheelZoom={!readOnly}
          dragging={!readOnly}
          zoomControl={!readOnly}
          doubleClickZoom={!readOnly}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {!readOnly ? (
             <LocationMarker position={position} setPosition={setPosition} />
          ) : (
             position && <Marker position={position} icon={customIcon} />
          )}
        </MapContainer>
      </div>
      {!readOnly && (
        <>
          <p className="text-sm text-slate-500 text-center">
            คลิกบนแผนที่เพื่อเลือกหรือปรับตำแหน่งของคุณ
          </p>
          <div className="flex justify-between items-center gap-2">
            <Button 
              variant="secondary" 
              size="sm"
              onClick={() => {
                if (initialLocation) {
                  setPosition(L.latLng(initialLocation.lat, initialLocation.lng));
                }
              }}
              disabled={!initialLocation}
              className="text-slate-600 bg-slate-100 hover:bg-slate-200"
            >
              <LocateFixed className="w-4 h-4 mr-2" />
              พิกัดเดิม
            </Button>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onCancel}>
                ยกเลิก
              </Button>
              <Button
                onClick={() => {
                  if (position && onConfirm) {
                    onConfirm({ lat: position.lat, lng: position.lng });
                  }
                }}
                disabled={!position}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                ยืนยันตำแหน่ง
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents, Circle, Popup, Tooltip, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { Button } from "@/components/ui/button";
import { LocateFixed } from "lucide-react";
import { cn } from "@/lib/utils";

// Office Location Constants
const OFFICE_LAT = 16.8173716;
const OFFICE_LNG = 100.2584649;
const OFFICE_RADIUS = 100; // 100 meters

// Fix missing marker icons in Next.js
const userIcon = L.icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const officeIcon = L.icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-gold.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
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
    <Marker position={position} icon={userIcon}>
       <Tooltip permanent direction="right" offset={[10, 0]}>ตำแหน่งของคุณ</Tooltip>
    </Marker>
  );
}

interface LocationMapProps {
  initialLocation?: { lat: number; lng: number } | null;
  onConfirm?: (loc: { lat: number; lng: number }) => void;
  onCancel?: () => void;
  readOnly?: boolean;
  distance?: number;
  isInArea?: boolean;
  radius?: number;
  officeLat?: number;
  officeLng?: number;
}

// Component to re-center map when initialLocation changes
function MapRecenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, lng], map.getZoom());
  }, [lat, lng, map]);
  return null;
}

export default function LocationMap({
  initialLocation,
  onConfirm,
  onCancel,
  readOnly = false,
  distance,
  isInArea = false,
  radius = OFFICE_RADIUS,
  officeLat = OFFICE_LAT,
  officeLng = OFFICE_LNG
}: LocationMapProps) {
  const [mounted, setMounted] = useState(false);
  const [position, setPosition] = useState<L.LatLng | null>(
    initialLocation ? L.latLng(initialLocation.lat, initialLocation.lng) : null
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (initialLocation) {
      setPosition(L.latLng(initialLocation.lat, initialLocation.lng));
    }
  }, [initialLocation]);

  if (!mounted) {
    return <div className={readOnly ? "h-[300px] w-full animate-pulse bg-slate-100 rounded-xl" : "h-[350px] w-full animate-pulse bg-slate-100 rounded-md"} />;
  }

  const officePos: L.LatLngExpression = [officeLat, officeLng];
  const userPos: L.LatLngExpression | null = position ? [position.lat, position.lng] : null;
  
  return (
    <div className="flex flex-col gap-4">
      <div className={readOnly ? "h-[300px] w-full rounded-xl overflow-hidden relative z-0 border border-slate-200 shadow-inner" : "h-[350px] w-full rounded-md overflow-hidden relative z-0 shadow-inner"}>
        <MapContainer
          key={readOnly ? `readonly-${initialLocation?.lat}-${initialLocation?.lng}` : "editable-map"}
          center={userPos || officePos}
          zoom={17}
          scrollWheelZoom={!readOnly}
          dragging={!readOnly}
          zoomControl={true}
          style={{ height: "100%", width: "100%" }}
        >
          {position && <MapRecenter lat={position.lat} lng={position.lng} />}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          {/* Office Marker & Area */}
          <Marker position={officePos} icon={officeIcon}>
             <Popup>สำนักงาน</Popup>
          </Marker>
        <Circle
          center={officePos}
          radius={radius}
          pathOptions={{
            color: isInArea ? "#10b981" : "#3b82f6",
            fillColor: isInArea ? "#10b981" : "#3b82f6",
            fillOpacity: 0.1,
            dashArray: "5, 5"
          }}
        />

          {/* User Marker */}
          {!readOnly ? (
             <LocationMarker position={position} setPosition={setPosition} />
          ) : (
              position && (
               <Marker position={position} icon={userIcon}>
                 <Tooltip permanent direction="right" offset={[10, 0]} className="bg-white/90 backdrop-blur-sm border-none shadow-lg rounded-lg p-0 overflow-hidden">
                   <div className="p-2 min-w-[150px]">
                     <p className="font-bold text-slate-900 text-xs mb-1">ตำแหน่งคุณ</p>
                     <p className="text-[10px] text-slate-500 mb-1.5 font-medium">ระยะห่างสำนักงาน: ~{distance ? Math.round(distance) : 0} ม.</p>
                     <div className={cn(
                       "flex items-center gap-1.5 px-2 py-1 rounded-md text-[9px] font-bold",
                       isInArea ? "bg-emerald-50 text-emerald-600" : "bg-blue-50 text-blue-600"
                     )}>
                       {isInArea ? "✅ อยู่ในบริเวณสำนักงาน" : "ℹ️ อยู่นอกบริเวณสำนักงาน"}
                     </div>
                   </div>
                 </Tooltip>
               </Marker>
              )
          )}
        </MapContainer>
      </div>
      {!readOnly && (
        <>
          <p className="text-xs text-slate-500 text-center px-4 leading-relaxed">
            คลิกบนแผนที่เพื่อระบุตำแหน่งของคุณ หากหมุดปัจจุบันไม่ตรงกับความเป็นจริง
          </p>
          <div className="flex justify-between items-center gap-2 px-1">
            <Button 
              variant="secondary" 
              size="sm"
              onClick={() => {
                if (initialLocation) {
                  setPosition(L.latLng(initialLocation.lat, initialLocation.lng));
                }
              }}
              disabled={!initialLocation}
              className="text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl"
            >
              <LocateFixed className="w-4 h-4 mr-2" />
              พิกัดปัจจุบัน
            </Button>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={onCancel} className="rounded-xl">
                ยกเลิก
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  if (position && onConfirm) {
                    onConfirm({ lat: position.lat, lng: position.lng });
                  }
                }}
                disabled={!position}
                className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md shadow-emerald-100"
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

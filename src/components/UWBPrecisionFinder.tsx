import React, { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Navigation, Loader2, Maximize, AlertTriangle, ShieldCheck } from "lucide-react";
import { useCompass } from "@/hooks/use-compass";
import { useLocation } from "@/hooks/use-location";
import { type DeviceLocation } from "@/lib/api";

interface UWBPrecisionFinderProps {
  targetLocation: DeviceLocation | null;
}

// ── Geographic Math ────────────────────────────────────────────────────────
function toRad(degrees: number) {
  return (degrees * Math.PI) / 180;
}

function toDeg(radians: number) {
  return (radians * 180) / Math.PI;
}

// Haversine distance in meters
function getDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371e3;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Bearing from Point A to Point B
function getBearing(lat1: number, lng1: number, lat2: number, lng2: number) {
  const y = Math.sin(toRad(lng2 - lng1)) * Math.cos(toRad(lat2));
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
            Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lng2 - lng1));
  let bearing = toDeg(Math.atan2(y, x));
  return (bearing + 360) % 360;
}

export default function UWBPrecisionFinder({ targetLocation }: UWBPrecisionFinderProps) {
  const { coords: myCoords, error: gpsError } = useLocation();
  const { heading: myHeading, permissionGranted, requestPermission } = useCompass();

  // Handle smoothed heading for the arrow rotation
  const [smoothedRotation, setSmoothedRotation] = useState<number>(0);
  
  const [distance, setDistance] = useState<number | null>(null);
  const [rawBearing, setRawBearing] = useState<number | null>(null);

  // ── Calculate Spatial Metrics ──
  useEffect(() => {
    if (!myCoords || !targetLocation?.loc?.coordinates) return;

    const [targetLng, targetLat] = targetLocation.loc.coordinates;
    const dist = getDistanceMeters(myCoords.lat, myCoords.lng, targetLat, targetLng);
    const bear = getBearing(myCoords.lat, myCoords.lng, targetLat, targetLng);
    
    setDistance(dist);
    setRawBearing(bear);
  }, [myCoords, targetLocation]);

  // ── Calculate Arrow Rotation ──
  useEffect(() => {
    if (rawBearing === null || myHeading === null) return;
    
    // Relative angle: Where the target is relative to where the phone is pointing
    let rotation = rawBearing - myHeading;
    
    // Normalize to -180 to +180 to make the animation spin the shortest way
    while (rotation > 180) rotation -= 360;
    while (rotation < -180) rotation += 360;
    
    setSmoothedRotation(rotation);
  }, [rawBearing, myHeading]);

  // ── Visual States ──
  const isTargetHere = distance !== null && distance < 2; // Within 2 meters is "Here"
  const isFacingTarget = Math.abs(smoothedRotation) < 20; // Within 20 degrees is "Facing"
  
  // Background and UI Colors
  const bgColor = isTargetHere 
    ? "bg-emerald-500" 
    : isFacingTarget 
      ? "bg-emerald-600/30" 
      : "bg-background";
  
  const arrowColor = isTargetHere
    ? "text-white"
    : isFacingTarget
      ? "text-emerald-400 drop-shadow-[0_0_15px_rgba(52,211,153,0.8)]"
      : "text-foreground drop-shadow-lg";

  // Permission UI overlay for iOS
  if (!permissionGranted) {
    return (
      <div className="glass-card flex-1 min-h-[400px] flex flex-col items-center justify-center p-8 text-center bg-black/40 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/10 via-background to-background pointer-events-none" />
        <Maximize className="w-16 h-16 text-primary/50 mb-6 drop-shadow-[0_0_15px_rgba(99,102,241,0.5)] animate-pulse" />
        <h2 className="text-xl font-bold mb-2">Enable Precision Finding</h2>
        <p className="text-sm text-muted-foreground mb-8 max-w-[250px]">
          UWB tracking relies on your device's compass and motion sensors to point you in the right direction.
        </p>
        <button
          onClick={requestPermission}
          className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-3 px-8 rounded-full shadow-lg transition-transform active:scale-95"
        >
          Enable Motion Sensors
        </button>
      </div>
    );
  }

  // Waiting for GPS
  if (!myCoords || !targetLocation) {
    return (
      <div className="glass-card flex-1 min-h-[400px] flex flex-col items-center justify-center p-6 bg-black/40">
        <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
        <p className="text-sm font-medium animate-pulse">Acquiring spatial satellite link…</p>
        {gpsError && <p className="text-xs text-danger mt-2 bg-danger/10 px-3 py-1 rounded">{gpsError}</p>}
      </div>
    );
  }

  // Desktop Fallback warning
  const isDesktop = !myHeading;

  return (
    <div className={`glass-card flex-1 min-h-[400px] flex flex-col items-center justify-center relative overflow-hidden transition-colors duration-700 ease-in-out ${bgColor}`}>
      {/* Dynamic Radar Pulse Background */}
      {isFacingTarget && !isTargetHere && (
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1.5, opacity: [0.4, 0] }}
          transition={{ repeat: Infinity, duration: 1.5, ease: "easeOut" }}
          className="absolute inset-0 m-auto w-64 h-64 rounded-full border border-emerald-400 bg-emerald-400/20 pointer-events-none"
        />
      )}
      
      {/* Header Info */}
      <div className="absolute top-4 left-0 w-full px-6 flex justify-between items-start z-10">
        <div className="glass-card bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 flex items-center gap-2">
          <ShieldCheck className="w-3.5 h-3.5 text-safe" />
          <span className="text-[10px] font-bold text-safe tracking-wider uppercase">Active Tracker</span>
        </div>
        
        {isDesktop && (
          <div className="glass-card bg-amber-500/20 px-3 py-1.5 rounded-full border border-amber-500/30 flex items-center gap-2 max-w-[150px]">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
            <span className="text-[9px] text-amber-400 font-medium">Compass unavailable on desktop. Showing fixed angle.</span>
          </div>
        )}
      </div>

      {/* Main Spatial Readout */}
      <AnimatePresence mode="wait">
        {isTargetHere ? (
          <motion.div 
            key="here"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex flex-col items-center z-10"
          >
            <div className="w-32 h-32 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-md border border-white/40 mb-6 drop-shadow-2xl">
              <div className="w-8 h-8 rounded-full bg-white animate-pulse" />
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-white drop-shadow-md">Here</h1>
            <p className="text-white/80 text-sm mt-2 font-medium">Target is within 2 meters</p>
          </motion.div>
        ) : (
          <motion.div 
            key="tracking"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center z-10 w-full"
          >
            {/* The Precision Arrow */}
            <motion.div
              animate={{ rotate: isDesktop ? 0 : smoothedRotation }}
              transition={{ type: "spring", stiffness: 40, damping: 15 }} // Smooth buttery spring physics
              className="w-48 h-48 sm:w-64 sm:h-64 rounded-full border-2 border-white/5 bg-black/20 backdrop-blur-sm flex items-center justify-center shadow-inner mb-8 relative"
            >
              {/* Notches for aesthetics */}
              <div className="absolute top-2 w-1 h-2 bg-white/10 rounded-full" />
              <div className="absolute bottom-2 w-1 h-2 bg-white/10 rounded-full" />
              <div className="absolute left-2 w-2 h-1 bg-white/10 rounded-full" />
              <div className="absolute right-2 w-2 h-1 bg-white/10 rounded-full" />

              <Navigation className={`w-28 h-28 sm:w-36 sm:h-36 ${arrowColor} transition-colors duration-500`} fill="currentColor" />
            </motion.div>
            
            {/* Distance Readout */}
            {distance !== null && (
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="flex flex-col items-center"
              >
                <div className="flex items-baseline gap-1">
                  <span className={`text-6xl font-bold tracking-tighter ${isFacingTarget ? "text-emerald-400" : "text-white"}`}>
                    {distance < 10 ? distance.toFixed(1) : Math.round(distance)}
                  </span>
                  <span className={`text-2xl font-medium ${isFacingTarget ? "text-emerald-400/70" : "text-muted-foreground"}`}>
                    {distance > 1000 ? "km" : "m"}
                  </span>
                </div>
                {!isDesktop && (
                  <p className={`text-xs mt-2 font-medium ${isFacingTarget ? "text-emerald-400/80 uppercase tracking-widest" : "text-muted-foreground"}`}>
                    {isFacingTarget ? "Connected" : "Turn Around"}
                  </p>
                )}
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

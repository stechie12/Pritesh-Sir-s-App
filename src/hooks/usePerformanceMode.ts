import { useEffect, useMemo, useState } from 'react';
import {
  evaluatePerformanceMode,
  type DevicePowerSnapshot,
  type PerformanceModeSetting,
  type PerformanceModeStatus,
} from '../utils/performanceMode';

interface BatteryManagerLike extends EventTarget {
  level: number;
  charging: boolean;
}

interface NavigatorWithPower extends Navigator {
  getBattery?: () => Promise<BatteryManagerLike>;
  deviceMemory?: number;
}

function readInitialSnapshot(legacyLowGpuMode: boolean): DevicePowerSnapshot {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      batteryLevel: null,
      isCharging: null,
      prefersReducedMotion: false,
      hardwareConcurrency: null,
      deviceMemoryGb: null,
      legacyLowGpuMode,
    };
  }

  const nav = navigator as NavigatorWithPower;
  const reducedMotion =
    typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false;

  return {
    batteryLevel: null,
    isCharging: null,
    prefersReducedMotion: reducedMotion,
    hardwareConcurrency:
      typeof nav.hardwareConcurrency === 'number' ? nav.hardwareConcurrency : null,
    deviceMemoryGb: typeof nav.deviceMemory === 'number' ? nav.deviceMemory : null,
    legacyLowGpuMode,
  };
}

/**
 * Monitors device battery level (`navigator.getBattery()` when supported),
 * `prefers-reduced-motion`, and hardware hints to dynamically drive Performance Mode.
 */
export function usePerformanceMode(
  setting: PerformanceModeSetting,
  legacyLowGpuMode = false
): PerformanceModeStatus {
  const [snapshot, setSnapshot] = useState<DevicePowerSnapshot>(() =>
    readInitialSnapshot(legacyLowGpuMode)
  );

  useEffect(() => {
    setSnapshot((prev) =>
      prev.legacyLowGpuMode === legacyLowGpuMode ? prev : { ...prev, legacyLowGpuMode }
    );
  }, [legacyLowGpuMode]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return;

    let cancelled = false;
    let batteryManager: BatteryManagerLike | null = null;

    const handleBatteryUpdate = () => {
      if (cancelled || !batteryManager) return;
      setSnapshot((prev) => ({
        ...prev,
        batteryLevel: batteryManager ? batteryManager.level : null,
        isCharging: batteryManager ? batteryManager.charging : null,
      }));
    };

    const nav = navigator as NavigatorWithPower;
    if (typeof nav.getBattery === 'function') {
      nav
        .getBattery()
        .then((bm) => {
          if (cancelled || !bm) return;
          batteryManager = bm;
          handleBatteryUpdate();
          bm.addEventListener('levelchange', handleBatteryUpdate);
          bm.addEventListener('chargingchange', handleBatteryUpdate);
        })
        .catch(() => {
          // Battery API unavailable or blocked by browser privacy policy
        });
    }

    const mq =
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-reduced-motion: reduce)')
        : null;
    const handleMotionChange = () => {
      if (cancelled || !mq) return;
      setSnapshot((prev) => ({ ...prev, prefersReducedMotion: mq.matches }));
    };
    mq?.addEventListener?.('change', handleMotionChange);

    return () => {
      cancelled = true;
      if (batteryManager) {
        batteryManager.removeEventListener('levelchange', handleBatteryUpdate);
        batteryManager.removeEventListener('chargingchange', handleBatteryUpdate);
      }
      mq?.removeEventListener?.('change', handleMotionChange);
    };
  }, []);

  return useMemo(() => evaluatePerformanceMode(setting, snapshot), [setting, snapshot]);
}

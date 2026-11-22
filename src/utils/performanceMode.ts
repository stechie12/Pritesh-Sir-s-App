export type PerformanceModeSetting = 'auto' | 'on' | 'off';

export interface DevicePowerSnapshot {
  /** Battery level in [0, 1] when Battery Status API is supported, otherwise null. */
  batteryLevel: number | null;
  /** Whether device is currently charging (null when unsupported). */
  isCharging: boolean | null;
  /** OS / browser prefers-reduced-motion media query. */
  prefersReducedMotion: boolean;
  /** Logical CPU cores when reported by navigator.hardwareConcurrency. */
  hardwareConcurrency: number | null;
  /** Approximate device RAM in GB when reported by navigator.deviceMemory. */
  deviceMemoryGb: number | null;
  /** Legacy manual Low-GPU toggle for backwards compatibility. */
  legacyLowGpuMode?: boolean;
}

export interface PerformanceModeStatus {
  setting: PerformanceModeSetting;
  isActive: boolean;
  reason: string;
  isLowBattery: boolean;
  isLowPowerHardware: boolean;
  batteryPercent: number | null;
  isCharging: boolean | null;
}

export interface PerformanceCadence {
  /** Elapsed thinking clock update interval in ms (100ms normal vs 500ms performance mode). */
  thinkingTimerIntervalMs: number;
  /** Typewriter React commit cadence in ms (28ms normal vs 95ms performance mode). */
  typewriterCommitIntervalMs: number;
  /** Minimum interval between 3D WebGL frame draws in ms (0ms normal vs 50ms ~20fps performance mode). */
  threeFrameThrottleMs: number;
  /** Maximum pixel ratio for 3D WebGL & 2D Blueprint canvases. */
  maxPixelRatio: number;
  /** Geometry subdivision counts for 3D solids and paraboloid surfaces. */
  radialSegments: number;
  surfaceSegments: number;
  /** Whether dynamic shadows and damping are enabled in 3D lab. */
  enableShadows: boolean;
  enableDamping: boolean;
}

export const LOW_BATTERY_THRESHOLD = 0.25;

/**
 * Pure evaluator that resolves whether Performance Mode should be active based on
 * the user's explicit preference (`auto` | `on` | `off`), battery level, reduced-motion,
 * and hardware hints.
 */
export function evaluatePerformanceMode(
  setting: PerformanceModeSetting,
  snapshot: DevicePowerSnapshot
): PerformanceModeStatus {
  const batteryPercent =
    typeof snapshot.batteryLevel === 'number' && Number.isFinite(snapshot.batteryLevel)
      ? Math.round(Math.max(0, Math.min(1, snapshot.batteryLevel)) * 100)
      : null;

  const isLowBattery =
    typeof snapshot.batteryLevel === 'number' &&
    snapshot.batteryLevel <= LOW_BATTERY_THRESHOLD &&
    snapshot.isCharging === false;

  const isLowPowerHardware =
    (typeof snapshot.hardwareConcurrency === 'number' &&
      snapshot.hardwareConcurrency > 0 &&
      snapshot.hardwareConcurrency <= 4) ||
    (typeof snapshot.deviceMemoryGb === 'number' &&
      snapshot.deviceMemoryGb > 0 &&
      snapshot.deviceMemoryGb <= 2);

  if (setting === 'on' || snapshot.legacyLowGpuMode) {
    return {
      setting: setting === 'on' ? 'on' : setting,
      isActive: true,
      reason: 'Manual On · Power Saver',
      isLowBattery,
      isLowPowerHardware,
      batteryPercent,
      isCharging: snapshot.isCharging,
    };
  }

  if (setting === 'off') {
    return {
      setting: 'off',
      isActive: false,
      reason: 'Full Visual Fidelity',
      isLowBattery,
      isLowPowerHardware,
      batteryPercent,
      isCharging: snapshot.isCharging,
    };
  }

  // 'auto' mode: activate seamlessly on low battery, reduced-motion, or low-power hardware
  if (isLowBattery) {
    return {
      setting: 'auto',
      isActive: true,
      reason: `Auto · Low Battery (${batteryPercent}%)`,
      isLowBattery,
      isLowPowerHardware,
      batteryPercent,
      isCharging: snapshot.isCharging,
    };
  }

  if (snapshot.prefersReducedMotion) {
    return {
      setting: 'auto',
      isActive: true,
      reason: 'Auto · Reduced Motion',
      isLowBattery,
      isLowPowerHardware,
      batteryPercent,
      isCharging: snapshot.isCharging,
    };
  }

  if (isLowPowerHardware) {
    return {
      setting: 'auto',
      isActive: true,
      reason: 'Auto · Eco Hardware Profile',
      isLowBattery,
      isLowPowerHardware,
      batteryPercent,
      isCharging: snapshot.isCharging,
    };
  }

  return {
    setting: 'auto',
    isActive: false,
    reason:
      batteryPercent !== null
        ? `Auto · Standard (${batteryPercent}%${snapshot.isCharging ? ' charging' : ''})`
        : 'Auto · Standard Power',
    isLowBattery,
    isLowPowerHardware,
    batteryPercent,
    isCharging: snapshot.isCharging,
  };
}

/**
 * Returns deterministic animation & rendering precision budgets for the active mode.
 */
export function getPerformanceCadence(isPerformanceModeActive: boolean): PerformanceCadence {
  if (isPerformanceModeActive) {
    return {
      thinkingTimerIntervalMs: 500,
      typewriterCommitIntervalMs: 95,
      threeFrameThrottleMs: 50,
      maxPixelRatio: 1,
      radialSegments: 14,
      surfaceSegments: 14,
      enableShadows: false,
      enableDamping: false,
    };
  }
  return {
    thinkingTimerIntervalMs: 100,
    typewriterCommitIntervalMs: 28,
    threeFrameThrottleMs: 0,
    maxPixelRatio: 2,
    radialSegments: 32,
    surfaceSegments: 36,
    enableShadows: true,
    enableDamping: true,
  };
}

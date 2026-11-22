import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluatePerformanceMode,
  getPerformanceCadence,
} from './performanceMode';

test('evaluatePerformanceMode auto-enables on low battery (<= 25% and discharging)', () => {
  const lowBat = evaluatePerformanceMode('auto', {
    batteryLevel: 0.18,
    isCharging: false,
    prefersReducedMotion: false,
    hardwareConcurrency: 8,
    deviceMemoryGb: 8,
  });
  assert.equal(lowBat.isActive, true);
  assert.equal(lowBat.isLowBattery, true);
  assert.match(lowBat.reason, /Low Battery \(18%\)/);

  // Charging at 18% stays standard unless reduced motion or manual on
  const charging = evaluatePerformanceMode('auto', {
    batteryLevel: 0.18,
    isCharging: true,
    prefersReducedMotion: false,
    hardwareConcurrency: 8,
    deviceMemoryGb: 8,
  });
  assert.equal(charging.isActive, false);
  assert.equal(charging.isLowBattery, false);
});

test('evaluatePerformanceMode respects explicit manual on and off overrides', () => {
  const forcedOn = evaluatePerformanceMode('on', {
    batteryLevel: 0.95,
    isCharging: true,
    prefersReducedMotion: false,
    hardwareConcurrency: 12,
    deviceMemoryGb: 16,
  });
  assert.equal(forcedOn.isActive, true);

  const forcedOff = evaluatePerformanceMode('off', {
    batteryLevel: 0.12,
    isCharging: false,
    prefersReducedMotion: true,
    hardwareConcurrency: 2,
    deviceMemoryGb: 2,
  });
  assert.equal(forcedOff.isActive, false);
});

test('getPerformanceCadence throttles thinking timer, typewriter commits, and 3D mesh precision when active', () => {
  const normal = getPerformanceCadence(false);
  const perf = getPerformanceCadence(true);

  assert.ok(perf.thinkingTimerIntervalMs > normal.thinkingTimerIntervalMs);
  assert.ok(perf.typewriterCommitIntervalMs > normal.typewriterCommitIntervalMs);
  assert.ok(perf.threeFrameThrottleMs > normal.threeFrameThrottleMs);
  assert.ok(perf.radialSegments < normal.radialSegments);
  assert.ok(perf.surfaceSegments < normal.surfaceSegments);
  assert.equal(perf.maxPixelRatio, 1);
  assert.equal(perf.enableShadows, false);
  assert.equal(perf.enableDamping, false);
});

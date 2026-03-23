import { Dart } from "./types";

// Parse a segment string like "T20", "S5", "DB", "SB", "MISS" into a Dart object
export function parseSegment(
  segment: string,
  dartNumber: number
): Dart | null {
  if (segment === "MISS") {
    return {
      dart_number: dartNumber,
      segment: "MISS",
      multiplier: 0,
      base_value: 0,
      score: 0,
    };
  }

  if (segment === "SB") {
    return {
      dart_number: dartNumber,
      segment: "SB",
      multiplier: 1,
      base_value: 25,
      score: 25,
    };
  }

  if (segment === "DB") {
    return {
      dart_number: dartNumber,
      segment: "DB",
      multiplier: 2,
      base_value: 25,
      score: 50,
    };
  }

  const match = segment.match(/^([SDT])(\d+)$/);
  if (!match) return null;

  const prefix = match[1];
  const baseValue = parseInt(match[2], 10);
  if (baseValue < 1 || baseValue > 20) return null;

  const multiplier = prefix === "S" ? 1 : prefix === "D" ? 2 : 3;

  return {
    dart_number: dartNumber,
    segment,
    multiplier,
    base_value: baseValue,
    score: baseValue * multiplier,
  };
}

// Check bust/checkout after a dart is thrown
// Returns: "ok" | "bust" | "checkout"
export function checkDartResult(
  remainingBefore: number,
  dart: Dart
): "ok" | "bust" | "checkout" {
  const afterDart = remainingBefore - dart.score;

  if (afterDart < 0) return "bust";
  if (afterDart === 1) return "bust";
  if (afterDart === 0) {
    return dart.multiplier === 2 ? "checkout" : "bust";
  }
  return "ok";
}

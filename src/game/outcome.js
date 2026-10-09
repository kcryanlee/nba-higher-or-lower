export function outcomeFor(pickedValue, otherValue) {
  if (!Number.isFinite(pickedValue) || !Number.isFinite(otherValue)) return "wrong";
  if (pickedValue === otherValue) return "push";
  return pickedValue > otherValue ? "correct" : "wrong";
}

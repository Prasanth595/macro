/** Explain a suggested meridiem when the draft leaves it open to interpretation. */
export function calendarTimeAssumption(text: string, start: string) {
  const time = text.match(
    /\bat\s+([1-9]|1[0-2])(?::([0-5]\d))?(?:\s*([ap])\.?m\.?)?(?=$|[\s,.!?])/i
  );
  if (
    !time ||
    time[3] ||
    /\b(morning|afternoon|evening|night|noon|midnight)\b/i.test(text)
  )
    return;
  const clock = start.match(/T(\d{2}):(\d{2})/);
  if (!clock) return;
  const hour = Number(clock[1]);
  return `Assumed ${hour % 12 || 12}:${clock[2]} ${hour >= 12 ? 'PM' : 'AM'}. Adjust the start time if you meant otherwise.`;
}

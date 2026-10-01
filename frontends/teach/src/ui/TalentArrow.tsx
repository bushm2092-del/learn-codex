export function TalentArrow({ direction = "right" }: { direction?: "right" | "left" | "up-right" }) {
  const path = direction === "left" ? "M19 12H5m6-6-6 6 6 6" : direction === "up-right" ? "M6 18 18 6M7 6h11v11" : "M5 12h14m-6-6 6 6-6 6";
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d={path} /></svg>;
}

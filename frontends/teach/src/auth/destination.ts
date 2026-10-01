export function loginDestination(next: string | null): string {
  return next === "/leaderboard" || next === "/lessons/agent-loop" || next === "/talent" || /^\/talent\/(reaction|memory|reasoning|focus)$/.test(next ?? "") || /^\/talent\/leaderboard(?:\?game=(reaction|memory|reasoning|focus))?$/.test(next ?? "") ? next! : "/";
}

export function isTalentDestination(destination: string): boolean {
  return destination === "/talent" || destination.startsWith("/talent/");
}

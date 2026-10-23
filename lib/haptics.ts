// Web Haptics Utility for Mobile Devices
export function triggerHaptic(type: "light" | "medium" | "success" = "light") {
  if (typeof window !== "undefined" && "vibrate" in navigator) {
    try {
      if (type === "light") {
        navigator.vibrate(30);
      } else if (type === "medium") {
        navigator.vibrate(60);
      } else if (type === "success") {
        // Double tap haptic pulse
        navigator.vibrate([40, 60, 40]);
      }
    } catch {
      // Gracefully ignore if device doesn't support vibration
    }
  }
}

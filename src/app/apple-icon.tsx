import { ImageResponse } from "next/og";
import { LOGO_LEAF, LOGO_RING } from "@/components/Logo";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#000",
      }}
    >
      <svg width="124" height="124" viewBox="0 0 64 64">
        <path
          d={LOGO_RING}
          fill="none"
          stroke="#fff"
          strokeWidth="7"
          strokeLinecap="round"
        />
        <path d={LOGO_LEAF} fill="#16a368" />
      </svg>
    </div>,
    size,
  );
}

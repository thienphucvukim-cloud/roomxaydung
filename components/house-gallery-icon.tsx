"use client";

import { createLucideIcon } from "lucide-react";

export const HouseGalleryIcon = createLucideIcon("HouseGallery", [
  ["path", { d: "M7 3h10M5 6h14", key: "gallery-stack" }],
  ["rect", { x: "3", y: "9", width: "18", height: "12", rx: "2", key: "gallery-frame" }],
  ["path", { d: "m7 15 5-4 5 4M8 14v4h8v-4", key: "house" }],
]);

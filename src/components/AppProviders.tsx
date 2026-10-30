"use client";

import React from "react";
import { AudioPlayerProvider } from "@/contexts/AudioPlayerContext";
import AudioPlayerBar from "@/components/AudioPlayerBar";

export default function AppProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AudioPlayerProvider>
      {children}
      <AudioPlayerBar />
    </AudioPlayerProvider>
  );
}

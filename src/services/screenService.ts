import { ScreenSnippet } from "../types";

export class ScreenCaptureService {
  public static async captureScreen(note: string = ""): Promise<ScreenSnippet> {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      throw new Error("Screen Capture API (getDisplayMedia) is not supported in this browser.");
    }

    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: { displaySurface: "browser" },
      audio: false
    });

    const video = document.createElement("video");
    video.srcObject = stream;
    await video.play();

    // Create canvas matching stream resolution
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      stream.getTracks().forEach((track) => track.stop());
      throw new Error("Could not initialize canvas context.");
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/png");

    // Clean up tracks
    stream.getTracks().forEach((track) => track.stop());
    video.srcObject = null;

    return {
      id: crypto.randomUUID(),
      dataUrl,
      timestamp: new Intl.DateTimeFormat("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
      }).format(new Date()),
      note: note || "Screen snapshot"
    };
  }
}

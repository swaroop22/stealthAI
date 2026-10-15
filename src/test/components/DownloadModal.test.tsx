import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DownloadModal } from "../../components/DownloadModal";
import { DownloadView } from "../../components/DownloadView";

describe("<DownloadModal /> and <DownloadView />", () => {
  const showToast = vi.fn();
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockImplementation(() => Promise.resolve())
      }
    });
  });

  it("does not render modal when isOpen is false", () => {
    render(
      <DownloadModal
        isOpen={false}
        onClose={onClose}
        showToast={showToast}
      />
    );

    expect(screen.queryByText(/Download StealthAI Desktop/i)).not.toBeInTheDocument();
  });

  it("renders modal header, version, and download cards when isOpen is true", () => {
    render(
      <DownloadModal
        isOpen={true}
        onClose={onClose}
        showToast={showToast}
      />
    );

    expect(screen.getByText(/Download StealthAI Desktop/i)).toBeInTheDocument();
    expect(screen.getByText(/v5.0.0 Pro Stable/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Apple Silicon/i)[0]).toBeInTheDocument();
  });

  it("switches OS platform between macOS and Windows", () => {
    render(
      <DownloadModal
        isOpen={true}
        onClose={onClose}
        showToast={showToast}
      />
    );

    const winBtn = screen.getByRole("button", { name: /Windows/i });
    fireEvent.click(winBtn);

    expect(screen.getByText(/Windows Setup Installer/i)).toBeInTheDocument();
    expect(screen.getByText(/StealthAI Setup 5.0.0.exe/i)).toBeInTheDocument();
    expect(screen.getByText(/Windows Portable Binary/i)).toBeInTheDocument();

    const macBtn = screen.getByRole("button", { name: /macOS/i });
    fireEvent.click(macBtn);

    expect(screen.getAllByText(/Apple Silicon/i)[0]).toBeInTheDocument();
    expect(screen.getByText(/StealthAI-5.0.0-arm64.dmg/i)).toBeInTheDocument();
  });

  it("navigates across tabs: Installation Guide, Comparison, Checksums", () => {
    render(
      <DownloadModal
        isOpen={true}
        onClose={onClose}
        showToast={showToast}
      />
    );

    // Switch to Installation Guide
    const instructionsTab = screen.getByRole("button", { name: /Installation Guide/i });
    fireEvent.click(instructionsTab);
    expect(screen.getByText(/macOS Installation & Stealth Setup Guide/i)).toBeInTheDocument();
    expect(screen.getByText(/xattr -cr \/Applications\/StealthAI.app/i)).toBeInTheDocument();

    // Switch to Desktop vs Web Comparison
    const comparisonTab = screen.getByRole("button", { name: /Desktop vs Web/i });
    fireEvent.click(comparisonTab);
    expect(screen.getByText(/Screen Share Invisibility/i)).toBeInTheDocument();
    expect(screen.getByText(/100% Invisible via/i)).toBeInTheDocument();

    // Switch to Checksums
    const checksumsTab = screen.getByRole("button", { name: /Integrity & SHA-256/i });
    fireEvent.click(checksumsTab);
    expect(screen.getByText(/Cryptographic SHA-256 Checksums/i)).toBeInTheDocument();
  });

  it("triggers download and shows toast", () => {
    render(
      <DownloadModal
        isOpen={true}
        onClose={onClose}
        showToast={showToast}
      />
    );

    const downloadBtn = screen.getAllByRole("button", { name: /Download DMG Installer/i })[0];
    fireEvent.click(downloadBtn);

    expect(showToast).toHaveBeenCalledWith(
      expect.stringContaining("Starting download: StealthAI-5.0.0-arm64.dmg"),
      "info"
    );
  });

  it("copies filename or command to clipboard and shows feedback", () => {
    render(
      <DownloadModal
        isOpen={true}
        onClose={onClose}
        showToast={showToast}
      />
    );

    const copyFilenameBtn = screen.getAllByTitle("Copy installer file name")[0];
    fireEvent.click(copyFilenameBtn);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("StealthAI-5.0.0-arm64.dmg");
    expect(showToast).toHaveBeenCalledWith(expect.stringContaining("Copied Filename"), "success");
  });

  it("calls onClose when close button is clicked", () => {
    render(
      <DownloadModal
        isOpen={true}
        onClose={onClose}
        showToast={showToast}
      />
    );

    const closeBtn = screen.getByLabelText("Close download modal");
    fireEvent.click(closeBtn);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders <DownloadView /> standalone with hero banner and downloads", () => {
    render(<DownloadView showToast={showToast} />);

    expect(screen.getByText(/Download StealthAI for/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Apple Silicon/i)[0]).toBeInTheDocument();
  });
});

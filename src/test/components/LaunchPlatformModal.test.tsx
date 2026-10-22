import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LaunchPlatformModal } from "../../components/ParakeetDashboard/LaunchPlatformModal";
import type { CallSession } from "../../types";

const MOCK_SESSION: CallSession = {
  id: "test-session-123",
  sessionType: "Interview",
  company: "Google",
  role: "Senior Staff Engineer",
  jobDescription: "Distributed systems, concurrency, cloud scale.",
  date: "Today",
  createdAt: new Date().toISOString(),
  status: "Ready",
  duration: "0m 0s",
  durationSeconds: 0,
  transcript: [],
  responses: [],
  preferences: {
    mode: "coding",
    autoAnswer: true
  }
};

describe("<LaunchPlatformModal />", () => {
  const onClose = vi.fn();
  const onLaunchBrowser = vi.fn();
  const onLaunchDesktop = vi.fn();
  const onOpenDownloadModal = vi.fn();
  const showToast = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("does not render when isOpen is false", () => {
    render(
      <LaunchPlatformModal
        isOpen={false}
        session={MOCK_SESSION}
        onClose={onClose}
        onLaunchBrowser={onLaunchBrowser}
        onLaunchDesktop={onLaunchDesktop}
        onOpenDownloadModal={onOpenDownloadModal}
        showToast={showToast}
      />
    );

    expect(screen.queryByText(/How would you like to start your session/i)).not.toBeInTheDocument();
  });

  it("renders modal with company name and both desktop and browser options", () => {
    render(
      <LaunchPlatformModal
        isOpen={true}
        session={MOCK_SESSION}
        onClose={onClose}
        onLaunchBrowser={onLaunchBrowser}
        onLaunchDesktop={onLaunchDesktop}
        onOpenDownloadModal={onOpenDownloadModal}
        showToast={showToast}
      />
    );

    expect(screen.getByText(/How would you like to start your session/i)).toBeInTheDocument();
    expect(screen.getByText("Google")).toBeInTheDocument();
    expect(screen.getByText("StealthAI Desktop App")).toBeInTheDocument();
    expect(screen.getByText("Browser Studio Mode")).toBeInTheDocument();
    expect(screen.getByText("100% Invisible to Screen Share")).toBeInTheDocument();
    expect(screen.getByText("No Installation Required")).toBeInTheDocument();
  });

  it("triggers onLaunchBrowser when Launch in Browser button is clicked", () => {
    render(
      <LaunchPlatformModal
        isOpen={true}
        session={MOCK_SESSION}
        onClose={onClose}
        onLaunchBrowser={onLaunchBrowser}
        onLaunchDesktop={onLaunchDesktop}
        onOpenDownloadModal={onOpenDownloadModal}
        showToast={showToast}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Launch in Browser/i }));
    expect(onLaunchBrowser).toHaveBeenCalledTimes(1);
    expect(onLaunchBrowser).toHaveBeenCalledWith(MOCK_SESSION);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("triggers onLaunchDesktop when Launch Desktop App button is clicked", () => {
    render(
      <LaunchPlatformModal
        isOpen={true}
        session={MOCK_SESSION}
        onClose={onClose}
        onLaunchBrowser={onLaunchBrowser}
        onLaunchDesktop={onLaunchDesktop}
        onOpenDownloadModal={onOpenDownloadModal}
        showToast={showToast}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Launch Desktop App/i }));
    expect(onLaunchDesktop).toHaveBeenCalledTimes(1);
    expect(onLaunchDesktop).toHaveBeenCalledWith(MOCK_SESSION);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("triggers onOpenDownloadModal when Download App link is clicked", () => {
    render(
      <LaunchPlatformModal
        isOpen={true}
        session={MOCK_SESSION}
        onClose={onClose}
        onLaunchBrowser={onLaunchBrowser}
        onLaunchDesktop={onLaunchDesktop}
        onOpenDownloadModal={onOpenDownloadModal}
        showToast={showToast}
      />
    );

    fireEvent.click(screen.getByText(/Don't have Desktop installed\? Download App/i));
    expect(onOpenDownloadModal).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("persists remember choice in localStorage when checkbox is checked", () => {
    render(
      <LaunchPlatformModal
        isOpen={true}
        session={MOCK_SESSION}
        onClose={onClose}
        onLaunchBrowser={onLaunchBrowser}
        onLaunchDesktop={onLaunchDesktop}
        onOpenDownloadModal={onOpenDownloadModal}
        showToast={showToast}
      />
    );

    const checkbox = screen.getByRole("checkbox");
    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();
    expect(localStorage.getItem("stealthai_preferred_platform")).toBe("desktop");

    fireEvent.click(screen.getByRole("button", { name: /Launch Desktop App/i }));
    expect(onLaunchDesktop).toHaveBeenCalledWith(MOCK_SESSION);
  });

  it("initializes with saved preference and allows clearing it", () => {
    localStorage.setItem("stealthai_preferred_platform", "desktop");

    render(
      <LaunchPlatformModal
        isOpen={true}
        session={MOCK_SESSION}
        onClose={onClose}
        onLaunchBrowser={onLaunchBrowser}
        onLaunchDesktop={onLaunchDesktop}
        onOpenDownloadModal={onOpenDownloadModal}
        showToast={showToast}
      />
    );

    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toBeChecked();

    // Toggle off
    fireEvent.click(checkbox);
    expect(checkbox).not.toBeChecked();
    expect(localStorage.getItem("stealthai_preferred_platform")).toBeNull();
  });

  it("launches via Continue button and closes modal", () => {
    render(
      <LaunchPlatformModal
        isOpen={true}
        session={MOCK_SESSION}
        onClose={onClose}
        onLaunchBrowser={onLaunchBrowser}
        onLaunchDesktop={onLaunchDesktop}
        onOpenDownloadModal={onOpenDownloadModal}
        showToast={showToast}
      />
    );

    const continueBtn = screen.getByText(/Continue with Desktop App/i);
    fireEvent.click(continueBtn);
    expect(onLaunchDesktop).toHaveBeenCalledWith(MOCK_SESSION);
    expect(onClose).toHaveBeenCalled();
  });

  it("closes modal when Cancel button is clicked", () => {
    render(
      <LaunchPlatformModal
        isOpen={true}
        session={MOCK_SESSION}
        onClose={onClose}
        onLaunchBrowser={onLaunchBrowser}
        onLaunchDesktop={onLaunchDesktop}
        onOpenDownloadModal={onOpenDownloadModal}
        showToast={showToast}
      />
    );

    fireEvent.click(screen.getByText("Cancel"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

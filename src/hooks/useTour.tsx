import { useCallback, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MantineProvider, Button, Group } from "@mantine/core";
import { driver, type DriveStep, type Driver } from "driver.js";
import "driver.js/dist/driver.css";
import { open as shellOpen } from "@tauri-apps/plugin-shell";
import { oveRunTheme, cssResolver } from "@/theme";
import { BUTTON_STYLES } from "@/constants/styles";
import { panelTours, homeTour } from "@/constants/tours";

function filterAvailableSteps(steps: DriveStep[]): DriveStep[] {
  return steps.filter((step) => {
    if (!step.element) return true;
    const selector =
      typeof step.element === "string" ? step.element : null;
    if (!selector) return true;
    return document.querySelector(selector) !== null;
  });
}

export function useTour() {
  const [isRunning, setIsRunning] = useState(false);
  const driverRef = useRef<Driver | null>(null);
  const popoverRootRef = useRef<Root | null>(null);

  const cleanupPopoverRoot = useCallback(() => {
    if (popoverRootRef.current) {
      popoverRootRef.current.unmount();
      popoverRootRef.current = null;
    }
  }, []);

  const startTour = useCallback(
    (steps: DriveStep[], onComplete?: () => void) => {
      if (driverRef.current) {
        driverRef.current.destroy();
        driverRef.current = null;
      }
      cleanupPopoverRoot();

      const available = filterAvailableSteps(steps);
      if (available.length === 0) return;

      const instance = driver({
        showProgress: true,
        animate: false,
        smoothScroll: true,
        allowClose: true,
        overlayOpacity: 0.6,
        stagePadding: 8,
        stageRadius: 6,
        popoverOffset: 12,
        steps: available,
        onPopoverRender: (popover, { state }) => {
          cleanupPopoverRoot();

          // Wire up external links to open in system browser
          popover.wrapper
            .querySelectorAll<HTMLAnchorElement>("a.tour-link")
            .forEach((a) => {
              a.addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();
                void shellOpen(a.href);
              });
            });

          // Wire up copy-on-click code elements
          popover.wrapper
            .querySelectorAll<HTMLElement>("code.tour-copy")
            .forEach((el) => {
              el.addEventListener("click", (e) => {
                e.stopPropagation();
                const text = el.dataset.copy ?? el.textContent ?? "";
                void navigator.clipboard.writeText(text).then(() => {
                  const original = el.textContent;
                  el.textContent = "Copied!";
                  setTimeout(() => {
                    el.textContent = original;
                  }, 1200);
                });
              });
            });

          const footerEl = popover.footerButtons;
          if (!footerEl) return;

          footerEl.innerHTML = "";

          const container = document.createElement("div");
          footerEl.appendChild(container);

          const root = createRoot(container);
          popoverRootRef.current = root;

          const isFirst = state.activeIndex === 0;
          const isLast = state.activeIndex === (available.length - 1);

          root.render(
            <MantineProvider
              theme={oveRunTheme}
              forceColorScheme="dark"
              cssVariablesResolver={cssResolver}
            >
              <Group gap={6} justify="flex-end" p={0}>
                {!isFirst && (
                  <Button
                    variant="subtle"
                    size="compact-sm"
                    onClick={() => instance.movePrevious()}
                    styles={BUTTON_STYLES.subtle}
                  >
                    Previous
                  </Button>
                )}
                <Button
                  size="compact-sm"
                  onClick={() => {
                    if (isLast) {
                      instance.destroy();
                    } else {
                      instance.moveNext();
                    }
                  }}
                  styles={BUTTON_STYLES.primary}
                >
                  {isLast ? "Done" : "Next"}
                </Button>
              </Group>
            </MantineProvider>,
          );
        },
        onDestroyed: () => {
          cleanupPopoverRoot();
          setIsRunning(false);
          driverRef.current = null;
          onComplete?.();
        },
      });

      driverRef.current = instance;
      setIsRunning(true);
      instance.drive();
    },
    [cleanupPopoverRoot],
  );

  const startPanelTour = useCallback(
    (panelName: string) => {
      const steps = panelTours[panelName];
      if (!steps) return;
      startTour(steps);
    },
    [startTour],
  );

  const startHomeTour = useCallback(
    (onComplete?: () => void) => {
      startTour(homeTour, onComplete);
    },
    [startTour],
  );

  const stopTour = useCallback(() => {
    if (driverRef.current) {
      driverRef.current.destroy();
      driverRef.current = null;
      cleanupPopoverRoot();
      setIsRunning(false);
    }
  }, [cleanupPopoverRoot]);

  return { startTour, startPanelTour, startHomeTour, stopTour, isRunning };
}

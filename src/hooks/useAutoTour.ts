import { useEffect } from "react";
import { useTourStore } from "@/stores/tourStore";
import { useTour } from "@/hooks/useTour";

export function useAutoTour(panelName: string) {
  const { hasSeenHomeTour, hasPanelTourBeenSeen, markPanelTourSeen } = useTourStore();
  const { startPanelTour } = useTour();

  useEffect(() => {
    if (!hasSeenHomeTour || hasPanelTourBeenSeen(panelName)) return;
    markPanelTourSeen(panelName);
    const timer = setTimeout(() => { startPanelTour(panelName); }, 1000);
    return () => { clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

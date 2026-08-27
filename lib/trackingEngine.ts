'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

export interface BehavioralData {
  responseTimeMs: number;
  pointerMovementPx: number;
  scrollDistancePx: number;
  revisionCount: number;
  pasteCount: number;
}

export function useBehavioralTracker(isActive: boolean, currentQuestionId: string | null) {
  const [sessionData, setSessionData] = useState<Record<string, BehavioralData>>({});
  
  // Ephemeral refs to track the current question's state without causing re-renders
  const currentData = useRef<BehavioralData>({
    responseTimeMs: 0,
    pointerMovementPx: 0,
    scrollDistancePx: 0,
    revisionCount: 0,
    pasteCount: 0,
  });

  const lastMousePos = useRef<{ x: number; y: number } | null>(null);
  const lastScrollY = useRef<number | null>(null);
  const startTime = useRef<number | null>(null);

  // Initialize/flush current tracking when the question changes
  useEffect(() => {
    if (!currentQuestionId) return;

    // Save previous question data if we have any
    setSessionData((prev) => {
      // Create a copy of the current refs
      const updated = { ...prev };
      
      // If we've already tracked this question before, add to its totals
      if (updated[currentQuestionId]) {
        currentData.current = { ...updated[currentQuestionId] };
      } else {
        currentData.current = {
          responseTimeMs: 0,
          pointerMovementPx: 0,
          scrollDistancePx: 0,
          revisionCount: 0,
          pasteCount: 0,
        };
      }
      return updated;
    });

    startTime.current = Date.now();
    lastMousePos.current = null;
    lastScrollY.current = window.scrollY;

    return () => {
      // On unmount or question change, accumulate the response time
      if (startTime.current) {
        currentData.current.responseTimeMs += Date.now() - startTime.current;
        
        setSessionData((prev) => ({
          ...prev,
          [currentQuestionId]: { ...currentData.current },
        }));
      }
    };
  }, [currentQuestionId]);

  // Pause timing when tab is inactive
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (startTime.current) {
          currentData.current.responseTimeMs += Date.now() - startTime.current;
          startTime.current = null;
        }
      } else {
        startTime.current = Date.now();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Track pointer movement
  useEffect(() => {
    if (!isActive || !currentQuestionId) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (lastMousePos.current) {
        const dx = e.clientX - lastMousePos.current.x;
        const dy = e.clientY - lastMousePos.current.y;
        currentData.current.pointerMovementPx += Math.sqrt(dx * dx + dy * dy);
      }
      lastMousePos.current = { x: e.clientX, y: e.clientY };
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [isActive, currentQuestionId]);

  // Track scrolling
  useEffect(() => {
    if (!isActive || !currentQuestionId) return;

    const handleScroll = () => {
      if (lastScrollY.current !== null) {
        const dy = Math.abs(window.scrollY - lastScrollY.current);
        currentData.current.scrollDistancePx += dy;
      }
      lastScrollY.current = window.scrollY;
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isActive, currentQuestionId]);

  // Track paste events
  useEffect(() => {
    if (!isActive || !currentQuestionId) return;

    const handlePaste = () => {
      currentData.current.pasteCount += 1;
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isActive, currentQuestionId]);

  // Manually increment revision count
  const recordRevision = useCallback(() => {
    if (isActive && currentQuestionId) {
      currentData.current.revisionCount += 1;
    }
  }, [isActive, currentQuestionId]);

  // Expose function to grab final snapshot before unmounting
  const getFinalData = useCallback(() => {
    if (startTime.current && currentQuestionId) {
      currentData.current.responseTimeMs += Date.now() - startTime.current;
      startTime.current = null; // Prevent double-counting
      
      const finalSnapshot = {
        ...sessionData,
        [currentQuestionId]: { ...currentData.current },
      };
      setSessionData(finalSnapshot);
      return finalSnapshot;
    }
    return sessionData;
  }, [sessionData, currentQuestionId]);

  return {
    recordRevision,
    getFinalData,
    // Provide live preview for debugging (optional)
    currentData: currentData.current,
  };
}

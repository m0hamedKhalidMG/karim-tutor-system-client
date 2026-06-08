import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * Hook to manage a cooldown timer for sending messages.
 * Prevents spam by disabling send buttons for a specified duration.
 *
 * Two modes:
 * 1. startCooldown() - Send first, then cooldown (blocks for N seconds after send)
 * 2. startSendDelay(callback) - Wait N seconds first, then execute callback, then unblock
 *
 * @param {number} cooldownSeconds - Duration of cooldown in seconds (default: 10)
 * @returns {Object} { isSending, cooldownRemaining, startCooldown, startSendDelay, isCooldownActive }
 */
export function useSendCooldown(cooldownSeconds = 10) {
  const [isSending, setIsSending] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const timerRef = useRef(null);
  const countdownRef = useRef(null);

  const clearTimers = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  }, []);

  const startCooldown = useCallback(() => {
    clearTimers();
    setIsSending(true);
    setCooldownRemaining(cooldownSeconds);

    // Update countdown every second
    countdownRef.current = setInterval(() => {
      setCooldownRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(countdownRef.current);
          countdownRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // End cooldown after full duration
    timerRef.current = setTimeout(() => {
      setIsSending(false);
      setCooldownRemaining(0);
      timerRef.current = null;
    }, cooldownSeconds * 1000);
  }, [cooldownSeconds, clearTimers]);

  /**
   * Starts countdown first, then executes callback after the delay.
   * Button is disabled during countdown + while callback runs.
   */
  const startSendDelay = useCallback(async (sendCallback) => {
    clearTimers();
    setIsSending(true);
    setCooldownRemaining(cooldownSeconds);

    // Update countdown every second
    countdownRef.current = setInterval(() => {
      setCooldownRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(countdownRef.current);
          countdownRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Wait for the cooldown, then execute callback
    await new Promise((resolve) => {
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        resolve();
      }, cooldownSeconds * 1000);
    });

    // Execute the send callback
    try {
      await sendCallback();
    } catch (err) {
      console.error(err);
    }

    // Clear state
    setIsSending(false);
    setCooldownRemaining(0);
  }, [cooldownSeconds, clearTimers]);

  // Cleanup on unmount
  useEffect(() => {
    return () => clearTimers();
  }, [clearTimers]);

  const isCooldownActive = isSending || cooldownRemaining > 0;

  return {
    isSending,
    cooldownRemaining,
    startCooldown,
    startSendDelay,
    isCooldownActive,
    clearTimers
  };
}

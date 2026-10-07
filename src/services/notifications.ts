// Web Notification, Audio Chime, and Scheduled Reminder System

class NotificationService {
  private audioCtx: AudioContext | null = null;

  // Synthesize a gentle, medical-standard chime tone using Web Audio API
  public playReminderChime(): void {
    try {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtxClass) return;

      if (!this.audioCtx) {
        this.audioCtx = new AudioCtxClass();
      }

      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      const ctx = this.audioCtx;
      const now = ctx.currentTime;

      // Note 1 (E5 - 659.25Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(659.25, now);
      gain1.gain.setValueAtTime(0, now);
      gain1.gain.linearRampToValueAtTime(0.3, now + 0.05);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.5);

      // Note 2 (B5 - 987.77Hz)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(987.77, now + 0.15);
      gain2.gain.setValueAtTime(0, now + 0.15);
      gain2.gain.linearRampToValueAtTime(0.3, now + 0.2);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.15);
      osc2.stop(now + 0.7);
    } catch (e) {
      console.warn('Audio chime playback omitted', e);
    }
  }

  // Vibrate pattern
  public vibrate(pattern: number[] = [150, 80, 150]): void {
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch (e) {
        // Ignored
      }
    }
  }

  // Request Notification permission
  public async requestNotificationPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    try {
      const perm = await Notification.requestPermission();
      return perm === 'granted';
    } catch (e) {
      console.error('Error requesting notification permission', e);
      return false;
    }
  }

  // Send a native notification with Action buttons (Taken / Snooze)
  public async sendDoseNotification(
    medicationName: string,
    doseAmount: string,
    scheduledTime: string,
    onTaken?: () => void,
    onSnooze?: () => void
  ): Promise<void> {
    this.playReminderChime();
    this.vibrate();

    if (!('Notification' in window) || Notification.permission !== 'granted') {
      return;
    }

    const title = `Time to take ${medicationName}`;
    const body = `Scheduled dose: ${doseAmount} at ${scheduledTime}`;

    // If ServiceWorker registration is available
    if ('serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg && 'showNotification' in reg) {
          const swOptions = {
            body,
            icon: '/icon.svg',
            badge: '/icon.svg',
            tag: `dose_${medicationName}_${scheduledTime}`,
            requireInteraction: true,
            actions: [
              { action: 'taken', title: '✓ Taken' },
              { action: 'snooze', title: '⏱ Snooze 10 min' },
            ],
            data: { medicationName, scheduledTime },
          };
          await (reg.showNotification as (t: string, o?: unknown) => Promise<void>)(title, swOptions);
          return;
        }
      } catch (e) {
        console.warn('Service worker notification failed, falling back to window Notification', e);
      }
    }

    // Fallback standard notification
    try {
      const notif = new Notification(title, {
        body,
        icon: '/icon.svg',
        tag: `dose_${medicationName}_${scheduledTime}`,
      });

      notif.onclick = () => {
        window.focus();
        if (onTaken) onTaken();
        notif.close();
      };
    } catch (e) {
      console.warn('Native notification failed', e);
    }
  }
}

export const notificationService = new NotificationService();

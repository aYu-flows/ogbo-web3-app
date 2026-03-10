export class VoiceRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private chunks: Blob[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private duration = 0;
  private recording = false;
  private onDurationUpdate: (seconds: number) => void;
  private onAutoStop?: () => void;

  private static readonly MAX_DURATION = 60;

  constructor(
    onDurationUpdate: (seconds: number) => void,
    onAutoStop?: () => void,
  ) {
    this.onDurationUpdate = onDurationUpdate;
    this.onAutoStop = onAutoStop;
  }

  async start(): Promise<void> {
    if (typeof MediaRecorder === 'undefined') {
      throw new Error('recorderNotSupported');
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      throw new Error('micPermissionDenied');
    }

    this.stream = stream;
    this.chunks = [];
    this.duration = 0;

    const mimeType = ['audio/webm;codecs=opus', 'audio/mp4'].find((t) =>
      MediaRecorder.isTypeSupported(t),
    );

    this.mediaRecorder = mimeType
      ? new MediaRecorder(stream, { mimeType })
      : new MediaRecorder(stream);

    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        this.chunks.push(e.data);
      }
    };

    this.mediaRecorder.start();
    this.recording = true;

    this.timer = setInterval(() => {
      this.duration++;
      this.onDurationUpdate(this.duration);
      if (this.duration >= VoiceRecorder.MAX_DURATION) {
        this.stopInternal();
        this.onAutoStop?.();
      }
    }, 1000);
  }

  stop(): Promise<{ blob: Blob; duration: number }> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder || !this.recording) {
        reject(new Error('Not recording'));
        return;
      }

      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.chunks, {
          type: this.mediaRecorder?.mimeType || 'audio/webm',
        });
        const duration = this.duration;
        this.cleanup();
        resolve({ blob, duration });
      };

      this.stopInternal();
    });
  }

  cancel(): void {
    this.stopInternal();
    this.chunks = [];
    this.cleanup();
  }

  getDuration(): number {
    return this.duration;
  }

  isActive(): boolean {
    return this.recording;
  }

  private stopInternal(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }

    this.recording = false;
  }

  private cleanup(): void {
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    this.mediaRecorder = null;
  }
}

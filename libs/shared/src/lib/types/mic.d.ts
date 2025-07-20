declare module 'mic' {
  interface MicInstance {
    start(): void;
    stop(): void;
    pause(): void;
    resume(): void;
    getAudioStream(): NodeJS.ReadableStream;
  }

  interface MicOptions {
    rate?: number;
    channels?: number;
    debug?: boolean;
    exitOnSilence?: number;
    fileType?: string;
    device?: string;
  }

  function mic(options?: MicOptions): MicInstance;
  export = mic;
}
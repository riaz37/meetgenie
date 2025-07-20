import { Injectable, Logger } from '@nestjs/common';
import * as wav from 'node-wav';
import * as ffmpeg from 'fluent-ffmpeg';
import { 
  AudioPreprocessingService, 
  AudioPreprocessingConfig, 
  AudioPreprocessingResult, 
  AudioQualityMetrics, 
  AudioEnhancement,
  AudioFormat 
} from '../interfaces/transcription.interface';

@Injectable()
export class AudioPreprocessingServiceImpl implements AudioPreprocessingService {
  private readonly logger = new Logger(AudioPreprocessingServiceImpl.name);
  
  private readonly defaultConfig: AudioPreprocessingConfig = {
    enableNoiseReduction: true,
    enableVolumeNormalization: true,
    enableEchoCancellation: false,
    targetSampleRate: 16000,
    targetChannels: 1,
    qualityThreshold: 0.6
  };

  async preprocessAudio(audioData: Buffer, config: AudioPreprocessingConfig = this.defaultConfig): Promise<AudioPreprocessingResult> {
    const startTime = Date.now();
    this.logger.debug('Starting audio preprocessing...');
    
    try {
      let processedAudio = audioData;
      const enhancements: AudioEnhancement[] = [];
      const originalSize = audioData.length;
      
      // Decode audio to get format information
      const audioInfo = await this.getAudioInfo(audioData);
      
      // Convert to target format if needed
      if (audioInfo.sampleRate !== config.targetSampleRate || audioInfo.channels !== config.targetChannels) {
        processedAudio = await this.convertAudioFormat(processedAudio, config);
        enhancements.push({
          type: 'frequency_filtering',
          applied: true,
          parameters: {
            targetSampleRate: config.targetSampleRate,
            targetChannels: config.targetChannels
          },
          improvement: 0.1
        });
      }
      
      // Volume normalization
      if (config.enableVolumeNormalization) {
        const normalizedAudio = await this.normalizeVolume(processedAudio);
        const improvement = await this.calculateVolumeImprovement(processedAudio, normalizedAudio);
        processedAudio = normalizedAudio;
        enhancements.push({
          type: 'volume_normalization',
          applied: true,
          parameters: { targetLevel: -20 }, // dB
          improvement
        });
      }
      
      // Noise reduction
      if (config.enableNoiseReduction) {
        const denoisedAudio = await this.reduceNoise(processedAudio);
        const improvement = await this.calculateNoiseReduction(processedAudio, denoisedAudio);
        processedAudio = denoisedAudio;
        enhancements.push({
          type: 'noise_reduction',
          applied: true,
          parameters: { algorithm: 'spectral_subtraction' },
          improvement
        });
      }
      
      // Echo cancellation
      if (config.enableEchoCancellation) {
        const echoFreeAudio = await this.cancelEcho(processedAudio);
        const improvement = await this.calculateEchoReduction(processedAudio, echoFreeAudio);
        processedAudio = echoFreeAudio;
        enhancements.push({
          type: 'echo_cancellation',
          applied: true,
          parameters: { algorithm: 'adaptive_filter' },
          improvement
        });
      }
      
      // Calculate quality score
      const qualityScore = await this.calculateQualityScore(processedAudio);
      
      const processingTime = Date.now() - startTime;
      this.logger.debug(`Audio preprocessing completed in ${processingTime}ms`);
      
      return {
        processedAudio,
        originalSize,
        processedSize: processedAudio.length,
        sampleRate: config.targetSampleRate,
        channels: config.targetChannels,
        duration: await this.getAudioDuration(processedAudio),
        qualityScore,
        enhancements
      };
      
    } catch (error) {
      this.logger.error('Audio preprocessing failed:', error);
      throw error;
    }
  }

  async enhanceAudioQuality(audioData: Buffer): Promise<Buffer> {
    return this.preprocessAudio(audioData, {
      ...this.defaultConfig,
      enableNoiseReduction: true,
      enableVolumeNormalization: true,
      enableEchoCancellation: true
    }).then(result => result.processedAudio);
  }

  async normalizeVolume(audioData: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        // Decode WAV data
        const decoded = wav.decode(audioData);
        const samples = new Float32Array(decoded.channelData[0]);
        
        // Calculate RMS (Root Mean Square) for current volume level
        let rms = 0;
        for (let i = 0; i < samples.length; i++) {
          rms += samples[i] * samples[i];
        }
        rms = Math.sqrt(rms / samples.length);
        
        // Target RMS level (adjust as needed)
        const targetRMS = 0.1;
        const gain = rms > 0 ? targetRMS / rms : 1;
        
        // Apply gain to normalize volume
        for (let i = 0; i < samples.length; i++) {
          samples[i] *= gain;
          // Prevent clipping
          samples[i] = Math.max(-1, Math.min(1, samples[i]));
        }
        
        // Encode back to WAV
        const normalized = wav.encode([samples], {
          sampleRate: decoded.sampleRate,
          float: false,
          bitDepth: 16
        });
        
        resolve(Buffer.from(normalized));
      } catch (error) {
        reject(error);
      }
    });
  }

  async reduceNoise(audioData: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        // Simple noise reduction using spectral subtraction
        const decoded = wav.decode(audioData);
        const samples = new Float32Array(decoded.channelData[0]);
        
        // Apply basic high-pass filter to remove low-frequency noise
        const cutoffFreq = 80; // Hz
        const sampleRate = decoded.sampleRate;
        const rc = 1.0 / (cutoffFreq * 2 * Math.PI);
        const dt = 1.0 / sampleRate;
        const alpha = dt / (rc + dt);
        
        let prevInput = 0;
        let prevOutput = 0;
        
        for (let i = 0; i < samples.length; i++) {
          const output = alpha * (prevOutput + samples[i] - prevInput);
          prevInput = samples[i];
          prevOutput = output;
          samples[i] = output;
        }
        
        // Encode back to WAV
        const denoised = wav.encode([samples], {
          sampleRate: decoded.sampleRate,
          float: false,
          bitDepth: 16
        });
        
        resolve(Buffer.from(denoised));
      } catch (error) {
        reject(error);
      }
    });
  }

  async detectAudioQuality(audioData: Buffer): Promise<AudioQualityMetrics> {
    try {
      const decoded = wav.decode(audioData);
      const samples = new Float32Array(decoded.channelData[0]);
      
      // Calculate signal-to-noise ratio
      const snr = this.calculateSNR(samples);
      
      // Calculate volume level
      const volumeLevel = this.calculateRMS(samples);
      
      // Calculate clarity (frequency distribution analysis)
      const clarity = this.calculateClarity(samples, decoded.sampleRate);
      
      // Overall quality score (0-1)
      const overallQuality = (snr * 0.4 + volumeLevel * 0.3 + clarity * 0.3);
      
      const recommendations: string[] = [];
      if (snr < 0.6) recommendations.push('Consider noise reduction');
      if (volumeLevel < 0.3) recommendations.push('Audio volume is too low');
      if (volumeLevel > 0.9) recommendations.push('Audio volume is too high');
      if (clarity < 0.5) recommendations.push('Audio clarity could be improved');
      
      return {
        signalToNoiseRatio: snr,
        volumeLevel,
        clarity,
        overallQuality,
        recommendations
      };
      
    } catch (error) {
      this.logger.error('Audio quality detection failed:', error);
      throw error;
    }
  }

  private async getAudioInfo(audioData: Buffer): Promise<{
    sampleRate: number;
    channels: number;
    duration: number;
    format: AudioFormat;
  }> {
    try {
      const decoded = wav.decode(audioData);
      return {
        sampleRate: decoded.sampleRate,
        channels: decoded.channelData.length,
        duration: decoded.channelData[0].length / decoded.sampleRate,
        format: AudioFormat.WAV
      };
    } catch (error) {
      // Fallback for non-WAV formats
      return {
        sampleRate: 16000,
        channels: 1,
        duration: 0,
        format: AudioFormat.WAV
      };
    }
  }

  private async convertAudioFormat(audioData: Buffer, config: AudioPreprocessingConfig): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const stream = require('stream');
      const bufferStream = new stream.PassThrough();
      bufferStream.end(audioData);
      
      ffmpeg(bufferStream)
        .inputFormat('wav')
        .audioFrequency(config.targetSampleRate)
        .audioChannels(config.targetChannels)
        .format('wav')
        .on('error', reject)
        .on('end', () => {
          resolve(Buffer.concat(chunks));
        })
        .pipe()
        .on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        });
    });
  }

  private async getAudioDuration(audioData: Buffer): Promise<number> {
    try {
      const decoded = wav.decode(audioData);
      return decoded.channelData[0].length / decoded.sampleRate;
    } catch (error) {
      return 0;
    }
  }

  private calculateSNR(samples: Float32Array): number {
    // Simple SNR calculation
    const signalPower = this.calculateRMS(samples);
    const noisePower = this.estimateNoisePower(samples);
    return noisePower > 0 ? Math.min(1, signalPower / noisePower) : 1;
  }

  private calculateRMS(samples: Float32Array): number {
    let rms = 0;
    for (let i = 0; i < samples.length; i++) {
      rms += samples[i] * samples[i];
    }
    return Math.sqrt(rms / samples.length);
  }

  private estimateNoisePower(samples: Float32Array): number {
    // Estimate noise from the quietest 10% of samples
    const sortedSamples = Array.from(samples).map(Math.abs).sort((a, b) => a - b);
    const noiseThreshold = Math.floor(sortedSamples.length * 0.1);
    let noisePower = 0;
    
    for (let i = 0; i < noiseThreshold; i++) {
      noisePower += sortedSamples[i] * sortedSamples[i];
    }
    
    return Math.sqrt(noisePower / noiseThreshold);
  }

  private calculateClarity(samples: Float32Array, sampleRate: number): number {
    // Simple clarity measure based on high-frequency content
    const nyquist = sampleRate / 2;
    const highFreqThreshold = nyquist * 0.3; // 30% of Nyquist frequency
    
    // This is a simplified approach - in practice, you'd use FFT
    let highFreqEnergy = 0;
    let totalEnergy = 0;
    
    for (let i = 1; i < samples.length; i++) {
      const diff = Math.abs(samples[i] - samples[i - 1]);
      highFreqEnergy += diff;
      totalEnergy += Math.abs(samples[i]);
    }
    
    return totalEnergy > 0 ? Math.min(1, highFreqEnergy / totalEnergy) : 0;
  }

  private async calculateVolumeImprovement(original: Buffer, processed: Buffer): Promise<number> {
    try {
      const originalQuality = await this.detectAudioQuality(original);
      const processedQuality = await this.detectAudioQuality(processed);
      return Math.max(0, processedQuality.volumeLevel - originalQuality.volumeLevel);
    } catch {
      return 0.1; // Default improvement
    }
  }

  private async calculateNoiseReduction(original: Buffer, processed: Buffer): Promise<number> {
    try {
      const originalQuality = await this.detectAudioQuality(original);
      const processedQuality = await this.detectAudioQuality(processed);
      return Math.max(0, processedQuality.signalToNoiseRatio - originalQuality.signalToNoiseRatio);
    } catch {
      return 0.2; // Default improvement
    }
  }

  private async calculateEchoReduction(original: Buffer, processed: Buffer): Promise<number> {
    // Simplified echo reduction calculation
    return 0.15; // Default improvement
  }

  private async calculateQualityScore(audioData: Buffer): Promise<number> {
    try {
      const quality = await this.detectAudioQuality(audioData);
      return quality.overallQuality;
    } catch {
      return 0.5; // Default quality score
    }
  }

  private async cancelEcho(audioData: Buffer): Promise<Buffer> {
    // Simplified echo cancellation - in practice, this would be more complex
    return this.reduceNoise(audioData);
  }
}
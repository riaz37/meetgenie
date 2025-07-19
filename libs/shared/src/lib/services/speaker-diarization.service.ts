import { Injectable, Logger } from '@nestjs/common';
import * as wav from 'node-wav';
import { 
  SpeakerDiarizationService, 
  DiarizationConfig, 
  SpeakerDiarizationResult, 
  DetectedSpeaker, 
  SpeakerSegment, 
  Speaker, 
  VoiceProfile 
} from '../interfaces/transcription.interface';

@Injectable()
export class SpeakerDiarizationServiceImpl implements SpeakerDiarizationService {
  private readonly logger = new Logger(SpeakerDiarizationServiceImpl.name);
  private voiceProfiles = new Map<string, VoiceProfile>();
  private speakerEmbeddings = new Map<string, number[]>();
  
  private readonly defaultConfig: DiarizationConfig = {
    minSpeakers: 1,
    maxSpeakers: 10,
    minSegmentLength: 1.0, // seconds
    similarityThreshold: 0.8,
    modelName: 'pyannote/speaker-diarization'
  };

  async diarizeAudio(audioData: Buffer, config: DiarizationConfig = this.defaultConfig): Promise<SpeakerDiarizationResult> {
    const startTime = Date.now();
    this.logger.debug('Starting speaker diarization...');
    
    try {
      // Decode audio
      const decoded = wav.decode(audioData);
      const samples = new Float32Array(decoded.channelData[0]);
      const sampleRate = decoded.sampleRate;
      const duration = samples.length / sampleRate;
      
      // Extract voice activity detection (VAD)
      const voiceSegments = this.detectVoiceActivity(samples, sampleRate);
      
      // Extract speaker embeddings for each voice segment
      const speakerEmbeddings = await this.extractSpeakerEmbeddings(samples, voiceSegments, sampleRate);
      
      // Cluster embeddings to identify unique speakers
      const speakers = this.clusterSpeakers(speakerEmbeddings, config);
      
      // Create speaker segments
      const segments = this.createSpeakerSegments(voiceSegments, speakers, config);
      
      const processingTime = Date.now() - startTime;
      
      this.logger.debug(`Speaker diarization completed in ${processingTime}ms. Found ${speakers.length} speakers.`);
      
      return {
        speakers,
        segments,
        confidence: this.calculateOverallConfidence(speakers, segments),
        processingTime,
        modelUsed: config.modelName || this.defaultConfig.modelName!
      };
      
    } catch (error) {
      this.logger.error('Speaker diarization failed:', error);
      throw error;
    }
  }

  async identifySpeaker(voiceEmbedding: number[], knownSpeakers: Speaker[]): Promise<string | null> {
    let bestMatch: string | null = null;
    let highestSimilarity = 0;
    
    for (const speaker of knownSpeakers) {
      const similarity = this.calculateCosineSimilarity(voiceEmbedding, speaker.voiceProfile.features);
      
      if (similarity > highestSimilarity && similarity > 0.8) { // Threshold for speaker identification
        highestSimilarity = similarity;
        bestMatch = speaker.id;
      }
    }
    
    return bestMatch;
  }

  async createVoiceProfile(audioSamples: Buffer[]): Promise<VoiceProfile> {
    const embeddings: number[][] = [];
    
    for (const audioSample of audioSamples) {
      try {
        const decoded = wav.decode(audioSample);
        const samples = new Float32Array(decoded.channelData[0]);
        const embedding = this.extractVoiceEmbedding(samples, decoded.sampleRate);
        embeddings.push(embedding);
      } catch (error) {
        this.logger.warn('Failed to process audio sample for voice profile:', error);
      }
    }
    
    if (embeddings.length === 0) {
      throw new Error('No valid audio samples provided for voice profile creation');
    }
    
    // Average embeddings to create a stable voice profile
    const averageEmbedding = this.averageEmbeddings(embeddings);
    const confidence = this.calculateEmbeddingConfidence(embeddings);
    
    const voiceProfile: VoiceProfile = {
      id: this.generateVoiceProfileId(),
      features: averageEmbedding,
      confidence,
      sampleCount: embeddings.length,
      lastUpdated: new Date()
    };
    
    this.voiceProfiles.set(voiceProfile.id, voiceProfile);
    
    return voiceProfile;
  }

  async updateVoiceProfile(speakerId: string, audioSample: Buffer): Promise<VoiceProfile> {
    const existingProfile = this.voiceProfiles.get(speakerId);
    if (!existingProfile) {
      throw new Error(`Voice profile not found for speaker: ${speakerId}`);
    }
    
    try {
      const decoded = wav.decode(audioSample);
      const samples = new Float32Array(decoded.channelData[0]);
      const newEmbedding = this.extractVoiceEmbedding(samples, decoded.sampleRate);
      
      // Update profile with weighted average (giving more weight to existing profile)
      const weight = 0.1; // Weight for new sample
      const updatedFeatures = existingProfile.features.map((feature, index) => 
        feature * (1 - weight) + newEmbedding[index] * weight
      );
      
      const updatedProfile: VoiceProfile = {
        ...existingProfile,
        features: updatedFeatures,
        sampleCount: existingProfile.sampleCount + 1,
        lastUpdated: new Date()
      };
      
      this.voiceProfiles.set(speakerId, updatedProfile);
      
      return updatedProfile;
      
    } catch (error) {
      this.logger.error(`Failed to update voice profile for speaker ${speakerId}:`, error);
      throw error;
    }
  }

  async mergeSpeakers(speaker1Id: string, speaker2Id: string): Promise<Speaker> {
    const profile1 = this.voiceProfiles.get(speaker1Id);
    const profile2 = this.voiceProfiles.get(speaker2Id);
    
    if (!profile1 || !profile2) {
      throw new Error('One or both speaker profiles not found');
    }
    
    // Merge voice profiles by averaging features
    const mergedFeatures = profile1.features.map((feature, index) => 
      (feature + profile2.features[index]) / 2
    );
    
    const mergedProfile: VoiceProfile = {
      id: this.generateVoiceProfileId(),
      features: mergedFeatures,
      confidence: (profile1.confidence + profile2.confidence) / 2,
      sampleCount: profile1.sampleCount + profile2.sampleCount,
      lastUpdated: new Date()
    };
    
    // Create merged speaker
    const mergedSpeaker: Speaker = {
      id: mergedProfile.id,
      voiceProfile: mergedProfile,
      segments: [], // Will be updated by caller
      totalSpeakingTime: 0,
      averageConfidence: mergedProfile.confidence,
      detectedAt: new Date()
    };
    
    // Store merged profile and remove old ones
    this.voiceProfiles.set(mergedProfile.id, mergedProfile);
    this.voiceProfiles.delete(speaker1Id);
    this.voiceProfiles.delete(speaker2Id);
    
    return mergedSpeaker;
  }

  private detectVoiceActivity(samples: Float32Array, sampleRate: number): Array<{
    startTime: number;
    endTime: number;
    samples: Float32Array;
  }> {
    const segments: Array<{ startTime: number; endTime: number; samples: Float32Array }> = [];
    const windowSize = Math.floor(sampleRate * 0.025); // 25ms windows
    const hopSize = Math.floor(sampleRate * 0.010); // 10ms hop
    const energyThreshold = 0.01; // Adjust based on audio characteristics
    
    let inVoiceSegment = false;
    let segmentStart = 0;
    
    for (let i = 0; i < samples.length - windowSize; i += hopSize) {
      const window = samples.slice(i, i + windowSize);
      const energy = this.calculateEnergy(window);
      
      if (energy > energyThreshold && !inVoiceSegment) {
        // Start of voice segment
        inVoiceSegment = true;
        segmentStart = i;
      } else if (energy <= energyThreshold && inVoiceSegment) {
        // End of voice segment
        inVoiceSegment = false;
        const segmentEnd = i;
        const duration = (segmentEnd - segmentStart) / sampleRate;
        
        if (duration >= 0.5) { // Minimum segment length
          segments.push({
            startTime: segmentStart / sampleRate,
            endTime: segmentEnd / sampleRate,
            samples: samples.slice(segmentStart, segmentEnd)
          });
        }
      }
    }
    
    // Handle case where audio ends during a voice segment
    if (inVoiceSegment) {
      const duration = (samples.length - segmentStart) / sampleRate;
      if (duration >= 0.5) {
        segments.push({
          startTime: segmentStart / sampleRate,
          endTime: samples.length / sampleRate,
          samples: samples.slice(segmentStart)
        });
      }
    }
    
    return segments;
  }

  private async extractSpeakerEmbeddings(
    samples: Float32Array, 
    voiceSegments: Array<{ startTime: number; endTime: number; samples: Float32Array }>, 
    sampleRate: number
  ): Promise<Array<{ embedding: number[]; startTime: number; endTime: number }>> {
    const embeddings: Array<{ embedding: number[]; startTime: number; endTime: number }> = [];
    
    for (const segment of voiceSegments) {
      try {
        const embedding = this.extractVoiceEmbedding(segment.samples, sampleRate);
        embeddings.push({
          embedding,
          startTime: segment.startTime,
          endTime: segment.endTime
        });
      } catch (error) {
        this.logger.warn('Failed to extract embedding for segment:', error);
      }
    }
    
    return embeddings;
  }

  private extractVoiceEmbedding(samples: Float32Array, sampleRate: number): number[] {
    // Simplified voice embedding extraction using MFCC-like features
    const frameSize = Math.floor(sampleRate * 0.025); // 25ms frames
    const hopSize = Math.floor(sampleRate * 0.010); // 10ms hop
    const numMelFilters = 13;
    
    const features: number[] = [];
    
    for (let i = 0; i < samples.length - frameSize; i += hopSize) {
      const frame = samples.slice(i, i + frameSize);
      
      // Apply window function
      const windowedFrame = this.applyHammingWindow(frame);
      
      // Extract spectral features (simplified)
      const spectralFeatures = this.extractSpectralFeatures(windowedFrame);
      features.push(...spectralFeatures);
    }
    
    // Normalize and reduce dimensionality to fixed size (128 dimensions)
    return this.normalizeAndReduceFeatures(features, 128);
  }

  private clusterSpeakers(
    embeddings: Array<{ embedding: number[]; startTime: number; endTime: number }>, 
    config: DiarizationConfig
  ): DetectedSpeaker[] {
    if (embeddings.length === 0) return [];
    
    // Simple clustering using similarity threshold
    const speakers: DetectedSpeaker[] = [];
    const assigned = new Array(embeddings.length).fill(false);
    
    for (let i = 0; i < embeddings.length; i++) {
      if (assigned[i]) continue;
      
      const speakerId = `speaker_${speakers.length + 1}`;
      const speaker: DetectedSpeaker = {
        id: speakerId,
        voiceEmbedding: embeddings[i].embedding,
        confidence: 1.0,
        firstDetectedAt: embeddings[i].startTime,
        lastDetectedAt: embeddings[i].endTime,
        totalSpeakingTime: embeddings[i].endTime - embeddings[i].startTime
      };
      
      assigned[i] = true;
      
      // Find similar embeddings
      for (let j = i + 1; j < embeddings.length; j++) {
        if (assigned[j]) continue;
        
        const similarity = this.calculateCosineSimilarity(
          embeddings[i].embedding, 
          embeddings[j].embedding
        );
        
        if (similarity > config.similarityThreshold) {
          assigned[j] = true;
          speaker.lastDetectedAt = Math.max(speaker.lastDetectedAt, embeddings[j].endTime);
          speaker.totalSpeakingTime += embeddings[j].endTime - embeddings[j].startTime;
          
          // Update embedding with average
          speaker.voiceEmbedding = speaker.voiceEmbedding.map((val, idx) => 
            (val + embeddings[j].embedding[idx]) / 2
          );
        }
      }
      
      speakers.push(speaker);
      
      if (speakers.length >= config.maxSpeakers) break;
    }
    
    return speakers.filter(speaker => speaker.totalSpeakingTime >= config.minSegmentLength);
  }

  private createSpeakerSegments(
    voiceSegments: Array<{ startTime: number; endTime: number; samples: Float32Array }>,
    speakers: DetectedSpeaker[],
    config: DiarizationConfig
  ): SpeakerSegment[] {
    const segments: SpeakerSegment[] = [];
    
    for (const voiceSegment of voiceSegments) {
      // Find best matching speaker for this segment
      const segmentEmbedding = this.extractVoiceEmbedding(voiceSegment.samples, 16000); // Assume 16kHz
      
      let bestSpeaker = speakers[0];
      let bestSimilarity = 0;
      
      for (const speaker of speakers) {
        const similarity = this.calculateCosineSimilarity(segmentEmbedding, speaker.voiceEmbedding);
        if (similarity > bestSimilarity) {
          bestSimilarity = similarity;
          bestSpeaker = speaker;
        }
      }
      
      segments.push({
        speakerId: bestSpeaker.id,
        startTime: voiceSegment.startTime,
        endTime: voiceSegment.endTime,
        confidence: bestSimilarity,
        audioChunkIds: [] // Will be populated by caller
      });
    }
    
    return segments;
  }

  private calculateCosineSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) return 0;
    
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;
    
    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }
    
    const magnitude = Math.sqrt(norm1) * Math.sqrt(norm2);
    return magnitude > 0 ? dotProduct / magnitude : 0;
  }

  private calculateEnergy(samples: Float32Array): number {
    let energy = 0;
    for (let i = 0; i < samples.length; i++) {
      energy += samples[i] * samples[i];
    }
    return energy / samples.length;
  }

  private applyHammingWindow(frame: Float32Array): Float32Array {
    const windowed = new Float32Array(frame.length);
    for (let i = 0; i < frame.length; i++) {
      const window = 0.54 - 0.46 * Math.cos(2 * Math.PI * i / (frame.length - 1));
      windowed[i] = frame[i] * window;
    }
    return windowed;
  }

  private extractSpectralFeatures(frame: Float32Array): number[] {
    // Simplified spectral feature extraction
    const features: number[] = [];
    
    // Spectral centroid
    let weightedSum = 0;
    let magnitudeSum = 0;
    
    for (let i = 0; i < frame.length; i++) {
      const magnitude = Math.abs(frame[i]);
      weightedSum += i * magnitude;
      magnitudeSum += magnitude;
    }
    
    const spectralCentroid = magnitudeSum > 0 ? weightedSum / magnitudeSum : 0;
    features.push(spectralCentroid);
    
    // Zero crossing rate
    let zeroCrossings = 0;
    for (let i = 1; i < frame.length; i++) {
      if ((frame[i] >= 0) !== (frame[i - 1] >= 0)) {
        zeroCrossings++;
      }
    }
    features.push(zeroCrossings / frame.length);
    
    // Energy
    features.push(this.calculateEnergy(frame));
    
    return features;
  }

  private normalizeAndReduceFeatures(features: number[], targetSize: number): number[] {
    // Simple feature reduction and normalization
    const reduced: number[] = [];
    const chunkSize = Math.max(1, Math.floor(features.length / targetSize));
    
    for (let i = 0; i < targetSize; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, features.length);
      let sum = 0;
      
      for (let j = start; j < end; j++) {
        sum += features[j] || 0;
      }
      
      reduced.push(sum / (end - start));
    }
    
    // Normalize to unit vector
    const magnitude = Math.sqrt(reduced.reduce((sum, val) => sum + val * val, 0));
    return magnitude > 0 ? reduced.map(val => val / magnitude) : reduced;
  }

  private averageEmbeddings(embeddings: number[][]): number[] {
    if (embeddings.length === 0) return [];
    
    const avgEmbedding = new Array(embeddings[0].length).fill(0);
    
    for (const embedding of embeddings) {
      for (let i = 0; i < embedding.length; i++) {
        avgEmbedding[i] += embedding[i];
      }
    }
    
    return avgEmbedding.map(val => val / embeddings.length);
  }

  private calculateEmbeddingConfidence(embeddings: number[][]): number {
    if (embeddings.length <= 1) return 1.0;
    
    const avgEmbedding = this.averageEmbeddings(embeddings);
    let totalSimilarity = 0;
    
    for (const embedding of embeddings) {
      totalSimilarity += this.calculateCosineSimilarity(embedding, avgEmbedding);
    }
    
    return totalSimilarity / embeddings.length;
  }

  private calculateOverallConfidence(speakers: DetectedSpeaker[], segments: SpeakerSegment[]): number {
    if (segments.length === 0) return 0;
    
    const totalConfidence = segments.reduce((sum, segment) => sum + segment.confidence, 0);
    return totalConfidence / segments.length;
  }

  private generateVoiceProfileId(): string {
    return `voice_profile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
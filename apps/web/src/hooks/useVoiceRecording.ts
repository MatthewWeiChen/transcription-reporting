// apps/web/src/hooks/useVoiceRecording.ts
import { useState, useRef, useCallback } from "react";
import { AudioRecordingData } from "@packages/shared/types";

interface UseVoiceRecordingReturn {
  isRecording: boolean;
  recordingDuration: string;
  audioData: AudioRecordingData | null;
  isProcessing: boolean;
  error: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  resetRecording: () => void;
}

export function useVoiceRecording(): UseVoiceRecordingReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState("00:00");
  const [audioData, setAudioData] = useState<AudioRecordingData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const startTimer = useCallback(() => {
    startTimeRef.current = Date.now();
    timerIntervalRef.current = setInterval(() => {
      if (startTimeRef.current) {
        const elapsed = Date.now() - startTimeRef.current;
        const minutes = Math.floor(elapsed / 60000);
        const seconds = Math.floor((elapsed % 60000) / 1000);
        setRecordingDuration(
          `${minutes.toString().padStart(2, "0")}:${seconds
            .toString()
            .padStart(2, "0")}`
        );
      }
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  }, []);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      setIsProcessing(true);

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      streamRef.current = stream;
      audioChunksRef.current = [];

      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
      });
      mediaRecorderRef.current = mediaRecorder;

      // Handle data available
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      // Handle recording stop
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/webm;codecs=opus",
        });
        const audioUrl = URL.createObjectURL(audioBlob);

        setAudioData({
          blob: audioBlob,
          url: audioUrl,
          duration: recordingDuration,
          size: audioBlob.size,
        });

        // Cleanup stream
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }

        setIsProcessing(false);
      };

      // Start recording
      mediaRecorder.start(1000); // Collect data every second
      setIsRecording(true);
      setIsProcessing(false);
      startTimer();
    } catch (err) {
      console.error("Error starting recording:", err);
      setError("Could not access microphone. Please check permissions.");
      setIsProcessing(false);
    }
  }, [recordingDuration, startTimer]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      setIsProcessing(true);
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      stopTimer();
    }
  }, [isRecording, stopTimer]);

  const resetRecording = useCallback(() => {
    // Stop any ongoing recording
    if (isRecording) {
      stopRecording();
    }

    // Cleanup resources
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (audioData?.url) {
      URL.revokeObjectURL(audioData.url);
    }

    // Reset state
    setIsRecording(false);
    setRecordingDuration("00:00");
    setAudioData(null);
    setIsProcessing(false);
    setError(null);

    // Clear refs
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
    startTimeRef.current = null;
    stopTimer();
  }, [isRecording, stopRecording, audioData?.url, stopTimer]);

  return {
    isRecording,
    recordingDuration,
    audioData,
    isProcessing,
    error,
    startRecording,
    stopRecording,
    resetRecording,
  };
}

// apps/web/src/hooks/useTranscriptionValidation.ts
import { useState, useCallback, useEffect } from "react";
import {
  ValidationResult,
  VoiceMessage,
  CreateMeetingRecordDto,
} from "@packages/shared/types";
import { validateTranscription } from "@/lib/validation";
import { submitMeetingRecord } from "@/lib/api";

interface UseTranscriptionValidationReturn {
  transcription: string;
  setTranscription: (text: string) => void;
  validationResult: ValidationResult;
  extractedData: VoiceMessage | null;
  isSubmitting: boolean;
  submitSuccess: boolean;
  error: string | null;
  submitRecord: (data: CreateMeetingRecordDto) => Promise<void>;
  resetForm: () => void;
}

export function useTranscriptionValidation(): UseTranscriptionValidationReturn {
  const [transcription, setTranscription] = useState("");
  const [validationResult, setValidationResult] = useState<ValidationResult>({
    isValid: false,
    message: "",
    extractedData: null,
  });
  const [extractedData, setExtractedData] = useState<VoiceMessage | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Validate transcription whenever it changes
  useEffect(() => {
    if (transcription.trim()) {
      const result = validateTranscription(transcription);
      setValidationResult(result);
      setExtractedData(result.extractedData);
    } else {
      setValidationResult({
        isValid: false,
        message: "",
        extractedData: null,
      });
      setExtractedData(null);
    }
  }, [transcription]);

  const submitRecord = useCallback(
    async (data: CreateMeetingRecordDto) => {
      if (!validationResult.isValid || !extractedData) {
        setError(
          "Please ensure the transcription follows the required format."
        );
        return;
      }

      setIsSubmitting(true);
      setError(null);
      setSubmitSuccess(false);

      try {
        await submitMeetingRecord(data);
        setSubmitSuccess(true);

        // Reset form after successful submission
        setTimeout(() => {
          setTranscription("");
          setSubmitSuccess(false);
        }, 3000);
      } catch (err) {
        console.error("Failed to submit meeting record:", err);
        setError(
          err instanceof Error
            ? err.message
            : "Failed to submit meeting record. Please try again."
        );
      } finally {
        setIsSubmitting(false);
      }
    },
    [validationResult.isValid, extractedData]
  );

  const resetForm = useCallback(() => {
    setTranscription("");
    setValidationResult({
      isValid: false,
      message: "",
      extractedData: null,
    });
    setExtractedData(null);
    setIsSubmitting(false);
    setSubmitSuccess(false);
    setError(null);
  }, []);

  return {
    transcription,
    setTranscription,
    validationResult,
    extractedData,
    isSubmitting,
    submitSuccess,
    error,
    submitRecord,
    resetForm,
  };
}

// apps/web/src/hooks/useMockTranscription.ts
import { useState, useCallback } from "react";

const MOCK_TRANSCRIPTIONS = [
  "My name is John Smith and I belong to group 5 and today I met Sarah Johnson at the coffee shop.",
  "My name is Maria Garcia and I belong to group 12 and today I met David Wilson at the library.",
  "My name is Alex Chen and I belong to group 3 and today I met Emma Brown at the park.",
  "My name is Michael Davis and I belong to group 8 and today I met Lisa Anderson at the office.",
  "My name is Jennifer Taylor and I belong to group 1 and today I met Robert Martinez at the restaurant.",
  "My name is Amy Rodriguez and I belong to group 7 and today I met Kevin Lee at the university.",
  "My name is Robert Johnson and I belong to group 15 and today I met Michelle Wong at the gym.",
  "My name is Lisa Zhang and I belong to group 4 and today I met James Miller at the bookstore.",
];

interface UseMockTranscriptionReturn {
  isTranscribing: boolean;
  transcribeAudio: (audioBlob: Blob) => Promise<string>;
}

export function useMockTranscription(): UseMockTranscriptionReturn {
  const [isTranscribing, setIsTranscribing] = useState(false);

  const transcribeAudio = useCallback(
    async (audioBlob: Blob): Promise<string> => {
      setIsTranscribing(true);

      // Simulate API call delay
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Return random mock transcription
      const randomIndex = Math.floor(
        Math.random() * MOCK_TRANSCRIPTIONS.length
      );
      const transcription = MOCK_TRANSCRIPTIONS[randomIndex];

      setIsTranscribing(false);
      return transcription;
    },
    []
  );

  return {
    isTranscribing,
    transcribeAudio,
  };
}

// apps/web/src/hooks/useAutoTranscription.ts
import { useEffect } from "react";
import { AudioRecordingData } from "@packages/shared/types";
import { useMockTranscription } from "./useMockTranscription";

interface UseAutoTranscriptionProps {
  audioData: AudioRecordingData | null;
  onTranscriptionComplete: (transcription: string) => void;
  onTranscriptionStart: () => void;
}

export function useAutoTranscription({
  audioData,
  onTranscriptionComplete,
  onTranscriptionStart,
}: UseAutoTranscriptionProps) {
  const { isTranscribing, transcribeAudio } = useMockTranscription();

  useEffect(() => {
    if (audioData?.blob) {
      onTranscriptionStart();

      transcribeAudio(audioData.blob)
        .then((transcription) => {
          onTranscriptionComplete(transcription);
        })
        .catch((error) => {
          console.error("Transcription failed:", error);
          // Handle error appropriately
        });
    }
  }, [
    audioData?.blob,
    transcribeAudio,
    onTranscriptionComplete,
    onTranscriptionStart,
  ]);

  return { isTranscribing };
}

// apps/web/src/hooks/useKeyboardShortcuts.ts
import { useEffect } from "react";

interface UseKeyboardShortcutsProps {
  onStartRecording: () => void;
  onStopRecording: () => void;
  onSubmit: () => void;
  onReset: () => void;
  isRecording: boolean;
  canSubmit: boolean;
}

export function useKeyboardShortcuts({
  onStartRecording,
  onStopRecording,
  onSubmit,
  onReset,
  isRecording,
  canSubmit,
}: UseKeyboardShortcutsProps) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore if user is typing in an input/textarea
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (event.code) {
        case "Space":
          event.preventDefault();
          if (isRecording) {
            onStopRecording();
          } else {
            onStartRecording();
          }
          break;

        case "Enter":
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            if (canSubmit) {
              onSubmit();
            }
          }
          break;

        case "Escape":
          event.preventDefault();
          if (isRecording) {
            onStopRecording();
          } else {
            onReset();
          }
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [
    isRecording,
    canSubmit,
    onStartRecording,
    onStopRecording,
    onSubmit,
    onReset,
  ]);
}

// apps/web/src/hooks/useLocalStorage.ts
import { useState, useEffect } from "react";

export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((val: T) => T)) => void] {
  // Get from local storage then parse stored json or return initialValue
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === "undefined") {
      return initialValue;
    }

    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  // Return a wrapped version of useState's setter function that persists the new value to localStorage
  const setValue = (value: T | ((val: T) => T)) => {
    try {
      // Allow value to be a function so we have the same API as useState
      const valueToStore =
        value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);

      if (typeof window !== "undefined") {
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      }
    } catch (error) {
      console.error(`Error setting localStorage key "${key}":`, error);
    }
  };

  return [storedValue, setValue];
}

// apps/web/src/hooks/useDebounce.ts
import { useState, useEffect } from "react";

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

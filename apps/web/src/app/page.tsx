// apps/web/src/app/page.tsx
"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Mic,
  Square,
  Play,
  Calendar,
  Clock,
  User,
  Users,
  MapPin,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useVoiceRecording } from "@/hooks/useVoiceRecording";
import { useTranscriptionValidation } from "@/hooks/useTranscriptionValidation";
import { formatDateDisplay, formatTimeDisplay } from "@/lib/dateUtils";
import type { RecordingFormState } from "@packages/shared/types";

export default function VoiceRecorderPage() {
  const {
    isRecording,
    recordingDuration,
    audioData,
    isProcessing,
    startRecording,
    stopRecording,
    resetRecording,
  } = useVoiceRecording();

  const {
    transcription,
    setTranscription,
    validationResult,
    extractedData,
    isSubmitting,
    submitSuccess,
    error,
    submitRecord,
    resetForm,
  } = useTranscriptionValidation();

  const currentDate = formatDateDisplay(new Date());
  const currentTime = formatTimeDisplay(new Date());

  const handleToggleRecording = async () => {
    if (isRecording) {
      stopRecording();
    } else {
      await startRecording();
    }
  };

  const handleSubmit = async () => {
    if (!validationResult.isValid || !extractedData || !audioData) return;

    await submitRecord({
      fullTranscription: transcription,
      recordingDuration,
      audioFile: new File([audioData.blob], `recording-${Date.now()}.wav`, {
        type: "audio/wav",
      }),
      metadata: {
        userAgent: navigator.userAgent,
      },
    });
  };

  const handleReset = () => {
    resetRecording();
    resetForm();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              🎤 Voice Meeting Recorder
            </CardTitle>
            <div className="flex justify-center items-center gap-6 text-sm text-gray-600 mt-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <span>{currentDate}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                <span>{currentTime}</span>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Required Format Template */}
        <Card className="border-0 shadow-lg bg-gradient-to-r from-pink-500 to-rose-500 text-white">
          <CardHeader>
            <CardTitle className="text-xl font-semibold flex items-center gap-2">
              📝 Required Message Format
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-white/20 rounded-lg p-4 backdrop-blur-sm border border-white/30">
              <p className="text-lg font-medium mb-2">Please say exactly:</p>
              <p className="text-xl font-bold">
                "My name is <span className="text-yellow-300">[your name]</span>{" "}
                and I belong to group{" "}
                <span className="text-yellow-300">[#]</span> and today I met{" "}
                <span className="text-yellow-300">[person's name]</span> at{" "}
                <span className="text-yellow-300">[location]</span>."
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Recording Section */}
        <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
          <CardContent className="pt-8">
            <div className="text-center space-y-6">
              {/* Recording Button */}
              <div className="relative">
                <Button
                  onClick={handleToggleRecording}
                  disabled={isProcessing}
                  className={cn(
                    "w-32 h-32 rounded-full text-white text-xl font-semibold transition-all duration-300 shadow-lg",
                    isRecording
                      ? "bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 animate-pulse scale-110"
                      : "bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 hover:scale-105"
                  )}
                >
                  {isRecording ? (
                    <Square className="w-8 h-8" />
                  ) : (
                    <Mic className="w-8 h-8" />
                  )}
                </Button>
                {isRecording && (
                  <div className="absolute -inset-4 border-4 border-red-500 rounded-full animate-ping opacity-20" />
                )}
              </div>

              {/* Status and Timer */}
              <div className="space-y-2">
                <p className="text-lg font-medium text-gray-700">
                  {isRecording
                    ? "Recording... Click to stop"
                    : isProcessing
                    ? "Processing audio..."
                    : "Click to start recording"}
                </p>
                <div className="text-3xl font-mono font-bold text-gray-800">
                  {recordingDuration}
                </div>
              </div>

              {/* Audio Player */}
              {audioData && (
                <div className="flex justify-center">
                  <audio
                    controls
                    src={audioData.url}
                    className="w-full max-w-md"
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Transcription Section */}
        <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-xl font-semibold">
              Transcription
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={transcription}
              onChange={(e) => setTranscription(e.target.value)}
              placeholder="Transcribed text will appear here and be validated against the required format..."
              className="min-h-[120px] text-base"
            />

            {/* Validation Status */}
            {transcription && (
              <Alert
                className={cn(
                  "border-2",
                  validationResult.isValid
                    ? "border-green-200 bg-green-50"
                    : "border-red-200 bg-red-50"
                )}
              >
                <div className="flex items-center gap-2">
                  {validationResult.isValid ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-600" />
                  )}
                  <AlertDescription
                    className={cn(
                      "font-medium",
                      validationResult.isValid
                        ? "text-green-800"
                        : "text-red-800"
                    )}
                  >
                    {validationResult.message}
                  </AlertDescription>
                </div>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Extracted Data Display */}
        {extractedData && validationResult.isValid && (
          <Card className="border-0 shadow-lg bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200">
            <CardHeader>
              <CardTitle className="text-xl font-semibold text-green-800 flex items-center gap-2">
                📋 Extracted Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                {/* Date - Most Important */}
                <div className="md:col-span-2 bg-gradient-to-r from-orange-100 to-amber-100 p-4 rounded-lg border-2 border-orange-300">
                  <div className="flex items-center gap-2 text-orange-800">
                    <Calendar className="w-5 h-5" />
                    <span className="font-bold text-lg">
                      📅 Date: {currentDate}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-orange-700 mt-1">
                    <Clock className="w-4 h-4" />
                    <span className="font-medium">⏰ Time: {currentTime}</span>
                  </div>
                </div>

                {/* Speaker Info */}
                <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200">
                  <User className="w-5 h-5 text-blue-600" />
                  <div>
                    <div className="text-sm text-gray-600">Speaker Name</div>
                    <div className="font-semibold">
                      {extractedData.speakerName}
                    </div>
                  </div>
                </div>

                {/* Group */}
                <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200">
                  <Users className="w-5 h-5 text-purple-600" />
                  <div>
                    <div className="text-sm text-gray-600">Group Number</div>
                    <div className="font-semibold">
                      {extractedData.groupNumber}
                    </div>
                  </div>
                </div>

                {/* Person Met */}
                <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200">
                  <User className="w-5 h-5 text-green-600" />
                  <div>
                    <div className="text-sm text-gray-600">Person Met</div>
                    <div className="font-semibold">
                      {extractedData.personMet}
                    </div>
                  </div>
                </div>

                {/* Location */}
                <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200">
                  <MapPin className="w-5 h-5 text-red-600" />
                  <div>
                    <div className="text-sm text-gray-600">Location</div>
                    <div className="font-semibold">
                      {extractedData.location}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Submit Section */}
        <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
          <CardContent className="pt-6">
            <div className="flex gap-4 justify-center">
              <Button
                onClick={handleSubmit}
                disabled={
                  !validationResult.isValid || !extractedData || isSubmitting
                }
                className="px-8 py-3 text-lg font-semibold bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Submitting...
                  </>
                ) : (
                  "Submit Meeting Record"
                )}
              </Button>

              <Button
                onClick={handleReset}
                variant="outline"
                className="px-6 py-3 text-lg font-medium"
              >
                Reset
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Success/Error Messages */}
        {submitSuccess && (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <AlertDescription className="text-green-800 font-medium">
              🎉 Meeting record for {currentDate} submitted successfully! Data
              saved to database and Google Sheets.
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert className="border-red-200 bg-red-50">
            <XCircle className="w-5 h-5 text-red-600" />
            <AlertDescription className="text-red-800 font-medium">
              {error}
            </AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
}

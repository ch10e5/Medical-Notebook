import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const analyzeAudio = async (
  base64Audio: string,
  mimeType: string
): Promise<AnalysisResult> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Audio,
            },
          },
          {
            text: "You are a helpful medical assistant. Please generate a verbatim transcript of this medical appointment recording. IMPORTANT: Identify different speakers (e.g., Doctor, Patient, Caregiver) and separate their dialogue. Then, provide a clear and comprehensive summary of the appointment for the patient. Focus on capturing the doctor's advice, key takeaways, diagnoses, and any instructions or next steps in plain language.",
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            transcript: {
              type: Type.ARRAY,
              description: "The structured transcript with speaker identification.",
              items: {
                type: Type.OBJECT,
                properties: {
                  speaker: {
                    type: Type.STRING,
                    description: "The speaker label (e.g., Doctor, Patient).",
                  },
                  text: {
                    type: Type.STRING,
                    description: "The spoken text.",
                  },
                },
                required: ["speaker", "text"],
              },
            },
            summary: {
              type: Type.STRING,
              description: "A comprehensive summary of the appointment for the patient.",
            },
          },
          required: ["transcript", "summary"],
        },
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error("No response from Gemini");
    }

    return JSON.parse(text) as AnalysisResult;
  } catch (error) {
    console.error("Gemini analysis failed:", error);
    throw error;
  }
};
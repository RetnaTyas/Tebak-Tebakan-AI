
import { GoogleGenAI, Type } from "@google/genai";
import { Riddle, AnswerValidation, Attempt } from "../types";

const SYSTEM_INSTRUCTION = `
Berperanlah sebagai REST API Server game tebak-tebakan.
Output HANYA satu JSON object valid.
Dilarang ada markdown block (no \`\`\`).
`;

const handleError = (error: any): never => {
  console.error("Gemini API Error:", error);
  let message = "Terjadi kesalahan tidak terduga pada AI.";
  const errString = error.toString();
  
  if (errString.includes("404") || (error.status === 404)) {
    message = "Model AI tidak ditemukan.";
  } else if (errString.includes("401")) {
    message = "API Key tidak valid.";
  } else if (errString.includes("429")) {
    message = "Kuota API Key habis.";
  }
  throw new Error(message);
};

const cleanJSON = (text: string): string => {
  if (!text) return "";
  let cleaned = text.replace(/```json/gi, "").replace(/```/g, "");
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return cleaned.substring(firstBrace, lastBrace + 1);
  }
  return text;
};

const getClient = (apiKey: string) => new GoogleGenAI({ apiKey });

// Helper: Levenshtein Distance for simple typo tolerance locally
const levenshteinDistance = (a: string, b: string): number => {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) { matrix[i] = [i]; }
  for (let j = 0; j <= a.length; j++) { matrix[0][j] = j; }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
        );
      }
    }
  }
  return matrix[b.length][a.length];
};

const normalizeText = (text: string) => text.toLowerCase().trim().replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "");

export const validateAnswerLocal = (riddle: Riddle, userAnswer: string): AnswerValidation | null => {
  const user = normalizeText(userAnswer);
  const key = normalizeText(riddle.answer);
  
  // 1. Exact Match on Answer
  if (user === key) return { isCorrect: true, isClose: false, feedback: "Luar biasa! Jawaban kamu tepat sekali!" };

  // 2. Check Accepted Answers (Synonyms - stored in DB)
  if (riddle.acceptedAnswers && riddle.acceptedAnswers.length > 0) {
    for (const alt of riddle.acceptedAnswers) {
      if (normalizeText(alt) === user) return { isCorrect: true, isClose: false, feedback: "Mantap! Itu jawaban yang benar!" };
    }
  }

  // 3. Typo Tolerance
  if (user.length > 3 && levenshteinDistance(user, key) <= 2) return { isCorrect: true, isClose: false, feedback: "Typo dikit nggak ngaruh, jawabanmu benar!" };
  
  if (riddle.acceptedAnswers) {
    for (const alt of riddle.acceptedAnswers) {
      const normAlt = normalizeText(alt);
      if (normAlt.length > 3 && levenshteinDistance(user, normAlt) <= 2) return { isCorrect: true, isClose: false, feedback: "Typo dikit, tapi maksud kamu benar!" };
    }
  }

  return null;
};

/**
 * NEW: Analyzes user attempts to build a persona/style profile.
 */
export const analyzeUserPattern = async (apiKey: string, attempts: Attempt[]): Promise<string> => {
    if (attempts.length < 3) return ""; // Not enough data

    const ai = getClient(apiKey);
    const model = "gemini-2.5-flash";

    const attemptsText = attempts.map(a => 
      `Q: ${a.riddleId.substring(0,10)}... | User: "${a.userAnswer}" | Correct: ${a.isCorrect}`
    ).join("\n");

    const prompt = `
      Data Riwayat Jawaban User:
      ${attemptsText}

      Tugas: Analisa gaya menjawab user dalam 1 kalimat pendek.
      Apakah dia sering typo? Suka pakai bahasa gaul? Suka menjawab panjang/pendek?
      Output JSON: { "persona": "User suka..." }
    `;

    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });
      const data = JSON.parse(cleanJSON(response.text || "{}"));
      return data.persona || "";
    } catch (e) {
      console.warn("Analysis failed", e);
      return "";
    }
};

export const generateRiddle = async (
  apiKey: string, 
  history: string[] = [], 
  userPersona: string = ""
): Promise<Riddle> => {
  if (!apiKey) throw new Error("API Key belum disetting.");

  const ai = getClient(apiKey);
  const model = "gemini-2.5-flash"; 
  
  const avoidContext = history.length > 0 
    ? `HINDARI soalan yang mirip dengan: ${history.slice(-10).join(" || ")}.` 
    : "";

  const personaContext = userPersona 
    ? `PROFIL USER: "${userPersona}". Buat tebakan yang cocok dengan gaya user ini. Sesuaikan daftar sinonim (acceptedAnswers) dengan kebiasaan kata-kata user.`
    : "Buat sinonim yang mencakup bahasa baku dan bahasa gaul sehari-hari.";

  const randomSeed = Math.floor(Math.random() * 9999999);

  const prompt = `
    Request ID: ${randomSeed}
    
    Tugas: Buat 1 tebak-tebakan Indonesia kreatif.
    ${personaContext}
    ${avoidContext}

    Output JSON:
    {
      "id": "generate_unique_string_id",
      "question": "Pertanyaan...",
      "answer": "Jawaban Utama",
      "acceptedAnswers": ["variasi1", "variasi2", "istilah_gaul_user"],
      "hint": "Petunjuk...",
      "funFact": "Fakta..."
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.85, // Higher temp for creativity
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            question: { type: Type.STRING },
            answer: { type: Type.STRING },
            acceptedAnswers: { type: Type.ARRAY, items: { type: Type.STRING } },
            hint: { type: Type.STRING },
            funFact: { type: Type.STRING }
          },
          required: ["question", "answer", "acceptedAnswers", "hint", "funFact"]
        }
      }
    });

    const jsonText = response.text;
    if (!jsonText) throw new Error("Respons kosong.");
    
    const data = JSON.parse(cleanJSON(jsonText));
    // Ensure ID exists
    if (!data.id) data.id = `riddle_${Date.now()}_${randomSeed}`;
    
    return data as Riddle;
  } catch (error) {
    handleError(error);
  }
};

export const checkAnswer = async (
  apiKey: string,
  riddle: Riddle, 
  userAnswer: string,
  userPersona: string = ""
): Promise<AnswerValidation> => {
  const ai = getClient(apiKey);
  const model = "gemini-2.5-flash";

  const prompt = `
    Konteks:
    Q: "${riddle.question}"
    A (Kunci): "${riddle.answer}"
    Variasi: ${riddle.acceptedAnswers?.join(", ")}
    Profil User: ${userPersona || "Umum"}
    
    Jawaban User: "${userAnswer}"

    Tugas: Validasi jawaban user. 
    User Profil membantu menentukan apakah user 'typo' atau memang punya gaya bahasa unik yang sebenarnya benar.
    
    Output JSON:
    {
      "isCorrect": boolean,
      "isClose": boolean,
      "feedback": "komentar singkat"
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.3, 
        responseMimeType: "application/json"
      }
    });

    const jsonText = response.text;
    if (!jsonText) throw new Error("Respons kosong.");
    return JSON.parse(cleanJSON(jsonText)) as AnswerValidation;
  } catch (error) {
    handleError(error);
  }
};


import { GoogleGenAI, Type } from "@google/genai";
import { Riddle, AnswerValidation } from "../types";

const SYSTEM_INSTRUCTION = `
Berperanlah sebagai REST API Server yang hanya merespon dengan raw JSON.
Tugas: Generate konten tebak-tebakan dalam Bahasa Indonesia.
Rules:
1. Output HANYA satu JSON object valid.
2. JANGAN ada teks pengantar, penutup, atau Markdown code blocks (seperti \`\`\`json).
3. Pastikan sintaks JSON valid (kutip ganda untuk key/value, escape characters jika perlu).
`;

// Helper to parse and throw readable errors
const handleError = (error: any): never => {
  console.error("Gemini API Error:", error);
  let message = "Terjadi kesalahan tidak terduga pada AI.";

  const errString = error.toString();
  
  if (errString.includes("404") || (error.status === 404)) {
    message = "Model AI tidak ditemukan (404). Mohon tunggu update developer.";
  } else if (errString.includes("401") || errString.includes("API key") || (error.status === 401)) {
    message = "API Key tidak valid. Cek kembali di Pengaturan.";
  } else if (errString.includes("429") || (error.status === 429)) {
    message = "Kuota API Key habis (Rate Limit). Tunggu sebentar atau ganti Key.";
  } else if (errString.includes("fetch failed") || errString.includes("NetworkError")) {
    message = "Gagal terhubung ke internet. Periksa koneksi Anda.";
  } else if (errString.includes("JSON") || errString.includes("SyntaxError")) {
    message = "Format data dari AI rusak. Coba lagi.";
  } else if (error.message) {
    message = `Gagal: ${error.message}`;
  }

  throw new Error(message);
};

// Helper to clean potential markdown or conversational prefixes
const cleanJSON = (text: string): string => {
  if (!text) return "";
  
  // 1. Remove Markdown Code Blocks patterns specifically
  let cleaned = text.replace(/```json/gi, "").replace(/```/g, "");

  // 2. Find first '{' and last '}'
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return cleaned.substring(firstBrace, lastBrace + 1);
  }
  
  // Fallback: If regex matched in previous logic, rely on indexOf
  return text;
};

// Helper to get client instance dynamically
const getClient = (apiKey: string) => {
  return new GoogleGenAI({ apiKey });
};

export const generateRiddle = async (apiKey: string, avoidList: string[] = []): Promise<Riddle> => {
  if (!apiKey) {
    throw new Error("API Key belum disetting. Silakan masuk ke menu pengaturan.");
  }

  const ai = getClient(apiKey);
  // Menggunakan model stabil
  const model = "gemini-2.5-flash"; 
  
  // Ambil maksimal 15 item terakhir untuk konteks (dikurangi agar hemat token)
  const avoidContext = avoidList.length > 0 
    ? `DAFTAR ID (HINDARI MEMBUAT SOAL YANG SAMA): ${avoidList.slice(-15).join(" || ")}.` 
    : "";

  const randomSeed = Math.floor(Math.random() * 9999999);

  const prompt = `
    Request ID: ${randomSeed}
    Kategori: Campuran / Umum
    
    Tugas:
    Buat 1 (satu) tebak-tebakan dalam Bahasa Indonesia yang kreatif, lucu, atau sedikit "mikir" tapi menyenangkan.
    Bisa berupa plesetan, logika sederhana, atau pengetahuan umum.
    
    ${avoidContext}

    Format Output (JSON):
    {
      "question": "Pertanyaan tebak-tebakan...",
      "answer": "Jawaban (1-3 kata)",
      "hint": "Petunjuk yang membantu",
      "funFact": "Fakta singkat terkait jawaban"
    }

    Constraints:
    - Jawaban HARUS spesifik (1-3 kata).
    - HANYA return JSON Object. 
    - Pastikan validitas JSON.
  `;

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.8, // Slightly higher for variety since it's just random fun now
        topK: 40,
        maxOutputTokens: 1000, 
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            question: { type: Type.STRING, description: "Pertanyaan tebak-tebakan" },
            answer: { type: Type.STRING, description: "Jawaban yang benar" },
            hint: { type: Type.STRING, description: "Petunjuk" },
            funFact: { type: Type.STRING, description: "Fakta unik terkait jawaban" }
          },
          required: ["question", "answer", "hint", "funFact"]
        }
      }
    });

    const jsonText = response.text;
    if (!jsonText) throw new Error("Respons kosong dari AI.");
    
    // Clean text before parsing
    const cleanedJson = cleanJSON(jsonText);
    
    // Validate if it looks like JSON
    if (!cleanedJson.trim().startsWith('{')) {
      console.error("Invalid JSON content:", jsonText);
      throw new Error("AI merespon dengan format yang salah. Coba lagi.");
    }
    
    return JSON.parse(cleanedJson) as Riddle;
  } catch (error) {
    handleError(error);
  }
};

export const checkAnswer = async (
  apiKey: string,
  riddle: Riddle, 
  userAnswer: string
): Promise<AnswerValidation> => {
  if (!apiKey) {
    throw new Error("API Key belum disetting.");
  }

  const ai = getClient(apiKey);
  const model = "gemini-2.5-flash";

  const prompt = `
    Konteks Tebak-tebakan:
    Q: "${riddle.question}"
    A (Kunci): "${riddle.answer}"
    
    Jawaban User: "${userAnswer}"

    Tugas: Validasi jawaban user dengan output JSON.
    
    Logika Penilaian:
    1. isCorrect: TRUE jika jawaban sama persis, sinonim, atau typo kecil.
    2. isCorrect: FALSE & isClose: TRUE jika jawaban konsepnya benar tapi kata salah, kurang spesifik (misal: "mobil" vs "kendaraan"), atau mirip.
    3. isCorrect: FALSE & isClose: FALSE jika jawaban salah total.
    
    Output JSON:
    {
      "isCorrect": boolean,
      "isClose": boolean,
      "feedback": "komentar singkat seru/lucu/menyemangati"
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.5, // Lower temperature for stricter logic
        maxOutputTokens: 500,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isCorrect: { type: Type.BOOLEAN },
            isClose: { type: Type.BOOLEAN, description: "True if answer is almost correct but not exact" },
            feedback: { type: Type.STRING, description: "Komentar singkat tentang jawaban user" }
          },
          required: ["isCorrect", "isClose", "feedback"]
        }
      }
    });

    const jsonText = response.text;
    if (!jsonText) throw new Error("Respons kosong saat menilai jawaban.");

    // Clean text before parsing
    const cleanedJson = cleanJSON(jsonText);

     // Validate if it looks like JSON
    if (!cleanedJson.trim().startsWith('{')) {
      console.error("Invalid JSON content checkAnswer:", jsonText);
      throw new Error("AI merespon dengan format yang salah.");
    }

    return JSON.parse(cleanedJson) as AnswerValidation;
  } catch (error) {
    handleError(error);
  }
};

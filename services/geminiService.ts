import { GoogleGenAI, Type } from "@google/genai";
import { Category, Riddle, AnswerValidation } from "../types";

const apiKey = process.env.API_KEY;
if (!apiKey) {
  console.error("API_KEY is missing from environment variables.");
}

// Strictly use process.env.API_KEY without dummy fallback
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const SYSTEM_INSTRUCTION = `
Kamu adalah Game Master yang seru, lucu, dan pintar untuk permainan tebak-tebakan (riddles) dalam Bahasa Indonesia.
Tugasmu adalah membuat tebak-tebakan yang menarik dan kreatif, serta menilai jawaban pemain dengan adil tapi santai.
Gunakan bahasa Indonesia yang gaul, seru, namun tetap sopan.
`;

export const generateRiddle = async (category: Category, avoidList: string[] = [], isHardMode: boolean = false): Promise<Riddle> => {
  const model = "gemini-2.5-flash";
  
  let promptCategory = category === 'Acak' ? 'apa saja (campuran)' : category;
  
  // Ambil maksimal 15 item terakhir untuk menghemat token konteks
  const avoidContext = avoidList.length > 0 
    ? `DAFTAR TERLARANG (Jangan buat yang mirip ini): ${avoidList.slice(-15).join("; ")}.` 
    : "";

  const difficultyInstruction = isHardMode
    ? "LEVEL: HARD MODE. Buat tebak-tebakan yang SANGAT SULIT, MENJEBAK, membutuhkan LOGIKA LATERAL atau PEMIKIRAN KRITIS TINGGI. Jangan berikan tebakan anak-anak yang mudah. Jawaban harus tetap masuk akal tapi tidak terpikirkan secara langsung."
    : "LEVEL: NORMAL. Buat tebak-tebakan yang UNIK, KREATIF, dan JARANG ORANG TAHU, tapi masih bisa ditebak dengan logika umum.";

  const prompt = `
    Tugas: Buatkan 1 (satu) tebak-tebakan kategori "${promptCategory}".
    ${difficultyInstruction}
    
    ${avoidContext}

    Instruksi Khusus:
    1. Pastikan jawabannya spesifik (1-3 kata).
    2. Hindari tebakan "bapak-bapak" yang garing kecuali kategori Lucu.
    3. Output harus format JSON valid.
    
    Sertakan:
    - question: Pertanyaannya.
    - answer: Jawaban (1-3 kata).
    - hint: Petunjuk yang membantu (jika Normal) atau Petunjuk yang sangat samar/kriptik (jika Hard Mode).
    - funFact: Fakta unik/ilmiah/sejarah singkat terkait jawaban tersebut.
  `;

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
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
    if (!jsonText) throw new Error("Empty response from Gemini");
    
    return JSON.parse(jsonText) as Riddle;
  } catch (error) {
    console.error("Error generating riddle:", error);
    return {
      question: "Apa yang makin diisi makin ringan?",
      answer: "Balon",
      hint: "Benda ini bisa terbang.",
      funFact: "Balon pertama kali ditemukan oleh Michael Faraday pada tahun 1824."
    };
  }
};

export const checkAnswer = async (
  riddle: Riddle, 
  userAnswer: string
): Promise<AnswerValidation> => {
  const model = "gemini-2.5-flash";

  const prompt = `
    Pertanyaan: "${riddle.question}"
    Jawaban Benar (Kunci): "${riddle.answer}"
    Jawaban Pemain: "${userAnswer}"

    Tugasmu:
    1. Tentukan apakah jawaban pemain benar secara makna (sinonim, atau ejaan mirip diperbolehkan).
    2. Jika benar, berikan pujian singkat yang lucu.
    3. Jika salah, berikan ledekan halus atau semangat singkat.
    4. Jika "dikit lagi" (misal typo dikit atau hampir benar), anggap SALAH tapi berikan feedback bahwa itu sudah dekat.
    
    Output JSON.
  `;

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isCorrect: { type: Type.BOOLEAN },
            feedback: { type: Type.STRING, description: "Komentar singkat tentang jawaban user" }
          },
          required: ["isCorrect", "feedback"]
        }
      }
    });

    const jsonText = response.text;
    if (!jsonText) throw new Error("Empty response from Gemini");

    return JSON.parse(jsonText) as AnswerValidation;
  } catch (error) {
    console.error("Error checking answer:", error);
    const normalizedUser = userAnswer.toLowerCase().trim();
    const normalizedKey = riddle.answer.toLowerCase().trim();
    const isCorrect = normalizedUser === normalizedKey || normalizedUser.includes(normalizedKey);
    return {
      isCorrect,
      feedback: isCorrect ? "Benar! (Offline check)" : "Salah nih. Coba lagi! (Offline check)"
    };
  }
};

export const generateAppLogo = async (): Promise<string> => {
  const model = "gemini-2.5-flash-image";
  const prompt = "A cool 3D app icon for a riddle game named 'Tebak AI'. The design should feature a cute, glowing brain character or a stylized question mark wearing sunglasses. Use a dark background (hex #0f172a) to match the app theme, with vibrant neon accents in violet, pink, and blue. 3D render style, cute, modern, high quality, centered.";

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: {
        parts: [{ text: prompt }]
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
    throw new Error("No image generated");
  } catch (error) {
    console.error("Error generating logo:", error);
    throw error;
  }
};
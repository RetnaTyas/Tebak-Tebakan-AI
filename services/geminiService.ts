import { GoogleGenAI, Type } from "@google/genai";
import { Category, Riddle, AnswerValidation } from "../types";

const SYSTEM_INSTRUCTION = `
Kamu adalah Game Master yang seru, lucu, dan pintar untuk permainan tebak-tebakan (riddles) dalam Bahasa Indonesia.
Tugasmu adalah membuat tebak-tebakan yang menarik dan kreatif, serta menilai jawaban pemain dengan adil tapi santai.
Gunakan bahasa Indonesia yang gaul, seru, namun tetap sopan.
`;

// Fallback riddles jika API error
const FALLBACK_RIDDLES: Riddle[] = [
  { question: "Apa yang makin diisi makin ringan?", answer: "Balon", hint: "Bisa terbang.", funFact: "Balon gas pertama ditemukan 1783." },
  { question: "Punya gigi tapi nggak bisa makan?", answer: "Sisir", hint: "Buat rambut.", funFact: "Sisir tertua ditemukan 5000 tahun lalu." },
  { question: "Masuk miring, keluar miring?", answer: "Kancing", hint: "Ada di baju.", funFact: "Kancing baju pria dan wanita beda sisi." },
  { question: "Benda apa yang kalau dipotong malah makin tinggi?", answer: "Celana", hint: "Dipakai di kaki.", funFact: "Celana panjang dulu simbol status sosial." }
];

// Helper to get client instance dynamically
const getClient = (apiKey: string) => {
  return new GoogleGenAI({ apiKey });
};

export const generateRiddle = async (apiKey: string, category: Category, avoidList: string[] = [], isHardMode: boolean = false): Promise<Riddle> => {
  if (!apiKey) {
    throw new Error("API Key is missing");
  }

  const ai = getClient(apiKey);
  const model = "gemini-2.5-flash-lite-preview-02-05";
  
  let promptCategory = category === 'Acak' ? 'apa saja (campuran)' : category;
  
  // Ambil maksimal 20 item terakhir
  const avoidContext = avoidList.length > 0 
    ? `DAFTAR TERLARANG (JANGAN BUAT YANG ADA DI SINI): ${avoidList.slice(-20).join(" || ")}.` 
    : "";

  const difficultyInstruction = isHardMode
    ? "LEVEL: HARD MODE. Buat tebak-tebakan yang SANGAT SULIT, MENJEBAK, twist logic, atau play-on-words. Jawaban harus tetap masuk akal tapi tidak terpikirkan secara langsung."
    : "LEVEL: NORMAL. Buat tebak-tebakan yang UNIK, KREATIF, dan JARANG ORANG TAHU.";

  // Tambahkan random seed di prompt untuk memaksa variasi output setiap request
  const randomSeed = Math.floor(Math.random() * 9999999);

  const prompt = `
    [Request ID: ${randomSeed}]
    Tugas: Buatkan 1 (satu) tebak-tebakan kategori "${promptCategory}".
    
    ${difficultyInstruction}
    
    ${avoidContext}

    Instruksi Khusus:
    1. JANGAN PERNAH MENGULANG tebak-tebakan dari "DAFTAR TERLARANG".
    2. Pastikan jawabannya spesifik (1-3 kata).
    3. Hindari tebakan "bapak-bapak" yang garing kecuali kategori Lucu.
    4. Output harus format JSON valid.
    
    Sertakan:
    - question: Pertanyaannya.
    - answer: Jawaban (1-3 kata).
    - hint: Petunjuk (Sangat samar jika Hard Mode).
    - funFact: Fakta unik singkat.
  `;

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 1.2, // Tingkatkan kreativitas agar tidak repetitif
        topK: 40,
        maxOutputTokens: 200, // Limit token for speed
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
    // Return random fallback
    return FALLBACK_RIDDLES[Math.floor(Math.random() * FALLBACK_RIDDLES.length)];
  }
};

export const checkAnswer = async (
  apiKey: string,
  riddle: Riddle, 
  userAnswer: string
): Promise<AnswerValidation> => {
  if (!apiKey) {
    throw new Error("API Key is missing");
  }

  const ai = getClient(apiKey);
  const model = "gemini-2.5-flash-lite-preview-02-05";

  const prompt = `
    Pertanyaan: "${riddle.question}"
    Jawaban Benar (Kunci): "${riddle.answer}"
    Jawaban Pemain: "${userAnswer}"

    Tugasmu:
    1. Tentukan apakah jawaban pemain benar secara makna (sinonim, slang umum, atau ejaan mirip diperbolehkan).
    2. Jika benar, berikan pujian singkat yang lucu/gaul.
    3. Jika salah, berikan ledekan halus atau semangat singkat.
    4. Jika "dikit lagi" (misal typo dikit atau konsep hampir kena), anggap SALAH tapi berikan feedback bahwa itu sudah dekat.
    
    Output JSON.
  `;

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.8,
        maxOutputTokens: 100, // Limit token for speed
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
    
    // Simple basic check for offline/error fallback
    const isCorrect = normalizedUser === normalizedKey || 
                      (normalizedUser.length > 3 && normalizedKey.includes(normalizedUser)) ||
                      (normalizedKey.length > 3 && normalizedUser.includes(normalizedKey));
                      
    return {
      isCorrect,
      feedback: isCorrect ? "Mantap, bener banget! (Mode Offline)" : "Yah salah, coba lagi ya! (Mode Offline)"
    };
  }
};
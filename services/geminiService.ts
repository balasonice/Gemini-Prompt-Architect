import { GoogleGenAI, Content, Part } from "@google/genai";
import { ARCHITECT_SYSTEM_PROMPT } from "../constants";
import { Attachment, AnalysisData } from "../types";

let aiClient: GoogleGenAI | null = null;

const getClient = () => {
  if (!aiClient) {
    if (!process.env.API_KEY) {
      throw new Error("API Key not found in environment variables");
    }
    aiClient = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }
  return aiClient;
};

const createParts = (text: string, attachments: Attachment[]): Part[] => {
  const parts: Part[] = [{ text }];
  
  if (attachments && attachments.length > 0) {
    attachments.forEach(att => {
      parts.push({
        inlineData: {
          mimeType: att.mimeType,
          data: att.data
        }
      });
    });
  }
  
  return parts;
};

// Phase 1: Analyze the request and return Structured Data
export const analyzePromptRequest = async (userGoal: string, attachments: Attachment[]): Promise<AnalysisData> => {
  const ai = getClient();
  
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    config: {
      systemInstruction: ARCHITECT_SYSTEM_PROMPT,
      temperature: 0.7,
      responseMimeType: 'application/json', // Force JSON for the analysis phase
    },
    contents: [
      {
        role: 'user',
        parts: createParts(`請分析以下需求並找出缺口：${userGoal}`, attachments)
      }
    ]
  });

  if (!response.text) {
    throw new Error("No response from Gemini");
  }

  try {
    const parsedData = JSON.parse(response.text) as AnalysisData;
    return parsedData;
  } catch (e) {
    console.error("Failed to parse JSON", response.text);
    throw new Error("Gemini response was not valid JSON");
  }
};

// Phase 2: Generate the final prompt based on history and user clarifications
export const generateFinalPromptStructure = async (
  originalGoal: string, 
  attachments: Attachment[],
  analysisData: AnalysisData,
  gapAnswers: string[],
  isSkipped: boolean
): Promise<string> => {
  const ai = getClient();

  // Construct context string from analysis
  const analysisContext = JSON.stringify(analysisData);
  
  // Construct user response string
  let userResponseText = "";
  if (isSkipped) {
    userResponseText = "使用者選擇略過補充資訊。請你根據你的專業知識，自行假設最合適的設定、受眾與情境，直接生成最完美的提示詞。";
  } else {
    userResponseText = "這是使用者針對缺口的回覆：\n";
    analysisData.gaps.forEach((gap, index) => {
      const answer = gapAnswers[index] || "（未回答）";
      userResponseText += `問題 ${index + 1}: ${gap}\n回答: ${answer}\n\n`;
    });
    userResponseText += "\n請根據以上補充資訊，生成最終的專業提示詞。";
  }

  const contents: Content[] = [
    {
      role: 'user',
      parts: createParts(`請分析以下需求並找出缺口：${originalGoal}`, attachments)
    },
    {
      role: 'model',
      parts: [{ text: analysisContext }] // Inject the JSON history
    },
    {
      role: 'user',
      parts: [{ text: userResponseText }]
    }
  ];

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    config: {
      systemInstruction: ARCHITECT_SYSTEM_PROMPT,
      temperature: 0.7,
      // No responseMimeType here, we want text/markdown
    },
    contents: contents
  });

  if (!response.text) {
    throw new Error("No final response from Gemini");
  }

  return response.text;
};

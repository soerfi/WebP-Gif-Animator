import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { PresetType, SourceImage, ProcessedImage } from "../types";
import { PRESETS } from "../constants";

const GENERATOR_MODEL = 'gemini-3-pro-image-preview';
const ANALYZER_MODEL = 'gemini-2.5-flash';

// Helper for delays
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Robust Retry Logic with Status Update
async function runWithRetry<T>(
  fn: () => Promise<T>,
  onStatusUpdate?: (msg: string) => void,
  retries = 10
): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (e: any) {
      attempt++;
      if (attempt > retries) throw e;

      // Check for 429 (Resource Exhausted) or 503 (Service Unavailable)
      const isRateLimit = e.status === 429 || e.message?.includes('429') || e.message?.toLowerCase().includes('quota');
      const isServerOverload = e.status === 503 || e.message?.includes('503');

      if (isRateLimit || isServerOverload) {
        // Fixed 10s retry delay as requested
        const waitTime = 10000;

        const msg = `High traffic. Retrying in 10s... (Attempt ${attempt}/${retries})`;
        console.warn(`Gemini API Busy. ${msg}`);

        if (onStatusUpdate) onStatusUpdate(msg);

        await delay(waitTime);

        if (onStatusUpdate) onStatusUpdate("Resuming processing...");
        continue;
      }

      throw e;
    }
  }
}

export const fileToGenerativePart = async (file: File): Promise<{ inlineData: { data: string; mimeType: string } }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      const base64Data = base64String.split(',')[1];
      resolve({
        inlineData: {
          data: base64Data,
          mimeType: file.type,
        },
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const base64ToGenerativePart = (base64DataUrl: string) => {
  const base64Data = base64DataUrl.split(',')[1];
  const mimeType = base64DataUrl.match(/:(.*?);/)?.[1] || 'image/png';
  return {
    inlineData: {
      data: base64Data,
      mimeType: mimeType
    }
  };
};

const analyzeProductFeatures = async (
  file: File,
  apiKey: string,
  onStatusUpdate?: (msg: string) => void
): Promise<{ description: string, filename: string }> => {
  if (!apiKey) return { description: "", filename: "product" };

  if (onStatusUpdate) onStatusUpdate("Analyzing product identity...");

  return runWithRetry(async () => {
    const ai = new GoogleGenAI({ apiKey });

    try {
      const imagePart = await fileToGenerativePart(file);
      const prompt = `Analyze this product image.
      
      1. VISUAL DESCRIPTION: Write a concise paragraph describing the product's visual identity (logos, text, materials, colors, construction) to preserve in editing.
      2. FILENAME: Generate a filename in this format: "Brand-Design-Color-Category". Example: "Nike-AirMax90-Red-Sneakers". Use "Unknown" if brand is not visible.
      
      Return the result as a valid JSON object:
      {
        "description": "...",
        "filename": "..."
      }`;

      const response = await ai.models.generateContent({
        model: ANALYZER_MODEL,
        contents: { parts: [imagePart, { text: prompt }] },
        config: { responseMimeType: 'application/json' }
      });

      const text = response.text || "{}";
      const json = JSON.parse(text);
      return {
        description: json.description || "",
        filename: json.filename || "processed-product"
      };
    } catch (e) {
      console.warn("Analysis failed, proceeding without analysis:", e);
      throw e;
    }
  }, onStatusUpdate).catch(e => {
    console.error("Analysis completely failed:", e);
    return { description: "", filename: "processed-product" };
  });
};

const callGeminiGenerator = async (
  parts: any[],
  apiKey: string,
  imageSize: '1K' | '2K' | '4K' = '1K',
  onStatusUpdate?: (msg: string) => void,
  aspectRatio: string = '1:1'
): Promise<string> => {
  if (!apiKey) throw new Error("API Key not provided.");

  return runWithRetry(async () => {
    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model: GENERATOR_MODEL,
      contents: { parts },
      config: {
        imageConfig: {
          imageSize: imageSize,
          aspectRatio: aspectRatio
        },
        safetySettings: [
          { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
          { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
          { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
          { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        ],
      }
    });

    const candidate = response.candidates?.[0];
    if (!candidate) throw new Error("No candidates returned from the model.");

    const responseParts = candidate.content?.parts;
    if (responseParts) {
      for (const part of responseParts) {
        if (part.inlineData && part.inlineData.data) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
    }

    const textOutput = response.text;
    if (textOutput) throw new Error(`Model returned text instead of image: ${textOutput.slice(0, 150)}...`);

    throw new Error("No image generated.");
  }, onStatusUpdate);
};

export const upscaleImage = async (
  base64Image: string,
  resolution: '2K' | '4K',
  apiKey: string,
  onStatusUpdate?: (msg: string) => void
): Promise<string> => {
  const imgPart = base64ToGenerativePart(base64Image);
  const prompt = `Generate a ${resolution} HIGH-RESOLUTION version of this image. \nTASK: Upscale and refine details. \nCRITICAL: Maintain the EXACT product appearance, text, logos, and geometry. Do not alter the content, only enhance sharpness, clarity, and resolution. Output must be photo-realistic.`;

  if (onStatusUpdate) onStatusUpdate(`Upscaling to ${resolution}...`);
  return callGeminiGenerator([imgPart, { text: prompt }], apiKey, resolution, onStatusUpdate);
};

export const processImagesWithGemini = async (
  sourceImages: SourceImage[],
  presetId: PresetType,
  customPrompt: string, // Now mandatory, as it acts as the primary instruction source
  apiKey: string,
  imageQuality: '1K' | '2K' | '4K' = '1K',
  onStatusUpdate?: (msg: string) => void,
  referenceImageBase64?: string | null,
  targetAngles?: string[], // Optional, for ANGLES preset
  bodyType?: string, // Optional
  targetAspectRatio: string = '1:1', // Dynamic aspect ratio
  environment?: string, // Optional: 'Indoor' | 'Outdoor'
  additionalContext?: string // Optional: Extra instructions
): Promise<ProcessedImage[]> => {

  const preset = PRESETS.find(p => p.id === presetId);
  if (!preset) throw new Error("Invalid preset selected");

  // Determine if reference image should be used (Skip for BG_REMOVE_REPAIR)
  const useReferenceImage = referenceImageBase64 && presetId !== PresetType.BG_REMOVE_REPAIR;

  // Strict Body Type Constraint logic
  const selectedBodyType = bodyType || 'Men';
  const strictBodyInstruction = `\n\nCRITICAL REQUIREMENT: The target body type for this generation is strict: ${selectedBodyType.toUpperCase()}. \nIf the prompt implies a human figure, model, or mannequin, it MUST match the ${selectedBodyType} anatomy and proportions. Do not generate any other gender or age group.`;

  // --- CASE 1: Ghost Mannequin / Batch Processing ---
  if (presetId === PresetType.GHOST_MANNEQUIN) {
    const promises = sourceImages.map(async (img, idx) => {
      if (onStatusUpdate) onStatusUpdate(`Analyzing image ${idx + 1}/${sourceImages.length}...`);

      const { description, filename } = await analyzeProductFeatures(img.file, apiKey, onStatusUpdate);

      if (onStatusUpdate) onStatusUpdate(`Generating image ${idx + 1}/${sourceImages.length}...`);

      const imgPart = await fileToGenerativePart(img.file);

      // Replace <BodyType> placeholder if present, otherwise use raw prompt
      const promptWithBodyType = customPrompt.replace('<BodyType>', selectedBodyType);

      const augmentedPrompt = `${promptWithBodyType}\n${strictBodyInstruction}\n\nIMPORTANT - PRESERVE THESE DETECTED PRODUCT DETAILS:\n${description}`;

      const requestParts: any[] = [];

      // Explicitly distinguish inputs for the model
      if (useReferenceImage && referenceImageBase64) {
        requestParts.push({ text: "INPUT 1: STYLE REFERENCE IMAGE. Use the lighting, background style, and mood from this image. DO NOT use the object in this image." });
        requestParts.push(base64ToGenerativePart(referenceImageBase64));
      }

      requestParts.push({ text: "INPUT 2: PRODUCT IMAGE. This is the object to be processed." });
      requestParts.push(imgPart);
      requestParts.push({ text: `TASK: ${augmentedPrompt}` });

      // Force 3:4 for Ghost Mannequin
      const url = await callGeminiGenerator(requestParts, apiKey, imageQuality, onStatusUpdate, '3:4');
      return { url, filename };
    });
    return Promise.all(promises);
  }

  // --- CASE 2 & 3: Multi-image context ---
  const primaryImg = sourceImages.find(i => i.label === 'Front View') || sourceImages[0];

  if (onStatusUpdate) onStatusUpdate("Analyzing primary product features...");
  const { description, filename } = await analyzeProductFeatures(primaryImg.file, apiKey, onStatusUpdate);

  const contextParts: any[] = [];

  // 1. Inject Style Reference First (if exists and allowed) with STRONG separation
  if (useReferenceImage && referenceImageBase64) {
    if (onStatusUpdate) onStatusUpdate("Processing style reference...");
    contextParts.push({ text: "========================================\nPART 1: STYLE REFERENCE\nUse the following image ONLY for background style, lighting, and color grading. DO NOT generate the object found in this image.\n========================================" });
    contextParts.push(base64ToGenerativePart(referenceImageBase64));
  }

  // 2. Add Product Input Images
  contextParts.push({ text: "========================================\nPART 2: SOURCE PRODUCT IMAGES\nThe following images define the object you must generate. Preserve the identity, logos, and geometry of this object.\n========================================" });

  for (const img of sourceImages) {
    contextParts.push({ text: `Viewpoint: ${img.label}` });
    contextParts.push(await fileToGenerativePart(img.file));
  }

  // Handle Angles Selection
  if (presetId === PresetType.ANGLES) {
    const anglesToGenerate = targetAngles && targetAngles.length > 0 ? targetAngles : ["Front View", "Side View", "3/4 Perspective View"];

    // Replace <BodyType> placeholder if present, otherwise use raw prompt
    const promptWithBodyType = customPrompt.replace('<BodyType>', selectedBodyType);

    const promises = anglesToGenerate.map(async (angle, index) => {
      let angleInstruction = angle;
      if (angle === "Combined Front and Back View Side-by-Side" || angle === "Front & Back Composite") {
        angleInstruction = "Create a single composite image showing both the Front View and Back View of the product side-by-side. Ensure both sides are clearly visible, same size, and evenly lit on a white background.";
      }

      // Replace {{ANGLE}} in the custom prompt if it exists, otherwise prepend the angle instruction
      let anglePrompt = promptWithBodyType.includes('{{ANGLE}}')
        ? promptWithBodyType.replace('{{ANGLE}}', angleInstruction)
        : `Generate view: ${angleInstruction}. ${promptWithBodyType}`;

      const anglePromptWithAnalysis = `${anglePrompt}\n${strictBodyInstruction}\n\nIMPORTANT - PRESERVE THESE DETECTED PRODUCT DETAILS:\n${description}`;

      const requestParts = [...contextParts, { text: `TASK: ${anglePromptWithAnalysis}` }];

      if (onStatusUpdate) onStatusUpdate(`Generating View: ${angle}...`);

      // Force 3:4 for Angles
      const url = await callGeminiGenerator(requestParts, apiKey, imageQuality, onStatusUpdate, '3:4');

      const suffix = angle.split(' ')[0].toLowerCase().replace(/\s+/g, '-');
      return { url, filename: `${filename}-${suffix}` };
    });

    return Promise.all(promises);
  }

  // Default Single Generation (Lifestyle, BG Remove, etc)
  let cleanPrompt = customPrompt.replace('{{PROMPT}}', '').trim() || customPrompt;

  // Replace <BodyType> if present (e.g. for Lifestyle shots)
  cleanPrompt = cleanPrompt.replace('<BodyType>', selectedBodyType);

  // Append Environment Setting if provided
  if (environment) {
    cleanPrompt += `\n\nENVIRONMENT SETTING: Place the product in an ${environment} setting.`;
  }

  // Append Additional Context if provided
  if (additionalContext) {
    cleanPrompt += `\n\nSPECIFIC SCENE DETAILS: ${additionalContext}`;
  }

  let finalPromptWithAnalysis = "";
  if (presetId === PresetType.LIFESTYLE) {
    finalPromptWithAnalysis = `COMPOSITE TASK: ${cleanPrompt}\n${strictBodyInstruction}\n\nSTRICT REQUIREMENT: The object in the input image is the SOURCE OF TRUTH. Do not regenerate the geometry, text, or logos. You are a compositor, not a designer. Maintain these exact details:\n${description}`;
  } else {
    finalPromptWithAnalysis = `${cleanPrompt}\n\nIMPORTANT - PRESERVE THESE DETECTED PRODUCT DETAILS:\n${description}`;
  }

  const requestParts = [...contextParts, { text: `TASK: ${finalPromptWithAnalysis}` }];

  if (onStatusUpdate) onStatusUpdate("Generating final high-quality asset...");
  // Use user-selected Aspect Ratio
  const resultUrl = await callGeminiGenerator(requestParts, apiKey, imageQuality, onStatusUpdate, targetAspectRatio);
  return [{ url: resultUrl, filename }];
};
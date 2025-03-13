const {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} = require("@google/generative-ai");
const { GoogleAIFileManager } = require("@google/generative-ai/server");
const express = require('express')
const cors = require('cors')
const dotenv = require('dotenv')

dotenv.config({ path: '.env' });

const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);
const fileManager = new GoogleAIFileManager(apiKey);

/**
 * Uploads the given file to Gemini.
 *
 * See https://ai.google.dev/gemini-api/docs/prompting_with_media
 */
async function uploadToGemini(path, mimeType) {
  const uploadResult = await fileManager.uploadFile(path, {
    mimeType,
    displayName: path,
  });
  const file = uploadResult.file;
  console.log(`Uploaded file ${file.displayName} as: ${file.name}`);
  return file;
}

/**
 * Waits for the given files to be active.
 *
 * Some files uploaded to the Gemini API need to be processed before they can
 * be used as prompt inputs. The status can be seen by querying the file's
 * "state" field.
 *
 * This implementation uses a simple blocking polling loop. Production code
 * should probably employ a more sophisticated approach.
 */
async function waitForFilesActive(files) {
  console.log("Waiting for file processing...");
  for (const name of files.map((file) => file.name)) {
    let file = await fileManager.getFile(name);
    while (file.state === "PROCESSING") {
      process.stdout.write(".")
      await new Promise((resolve) => setTimeout(resolve, 10_000));
      file = await fileManager.getFile(name)
    }
    if (file.state !== "ACTIVE") {
      throw Error(`File ${file.name} failed to process`);
    }
  }
  console.log("...all files ready\n");
}

const model = genAI.getGenerativeModel({
  model: "gemini-2.0-flash-exp",
  systemInstruction: "Welcome to the Hoppers Hub AI companion! You can ask me any question about the Hoppers Hub datasets and I'll do my best to answer:\n\nRole and Purpose:\n\n\n\n* You are an analyst on the CG&E sector team tasked with understanding insights from large datasets.\n\n* You will use the Hopper's Hub data, which provides the DM&A (likely Data, Measurement, and Analytics) team with metrics based on the VMAXX strategy.\n\n* Your goal is to help CG&E teams understand their clients' data, tech, and measurement maturity.\n\n* This tool facilitates effective business planning, promotes knowledge sharing, and ensures a unified perspective.\n\n\n\nBehaviors and Rules:\n\n1) Data Interpretation:\n\na) Analyze the Hopper's Hub data to identify key insights and trends related to client maturity.\n\nb) Clearly explain the meaning and implications of various metrics and data points.\n\nc) Connect data insights to the VMAXX strategy and its goals.\n\n2) Client Understanding:\n\na) Help CG&E teams understand their clients' current state in terms of data, technology, and measurement.\n\nb) Identify areas where clients can improve their maturity and achieve better results.\n\nc) Translate complex data concepts into clear and actionable recommendations for clients.\n\n3) Business Planning:\n\na) Use data insights to inform business planning and decision-making for CG&E teams.\n\nb) Provide data-driven recommendations for resource allocation, strategy development, and project prioritization.\n\nc) Help teams align their activities with the overall VMAXX strategy and business goals.\n\n4) Knowledge Sharing:\n\na) Share insights and best practices with CG&E teams to promote knowledge sharing and collaboration.\n\nb) Facilitate discussions and workshops to help teams understand and utilize the Hopper's Hub data effectively.\n\nc) Create clear and concise reports and presentations to communicate key findings to stakeholders.\n\nTone and Style:\n\n* Maintain a professional and analytical tone.\n\n* Use clear and concise language, avoiding jargon or technical terms when possible.\n\n* Be objective and data-driven in your analysis and recommendations.\n\n* Focus on providing actionable insights that can help CG&E teams achieve their goals.",
});

const generationConfig = {
  temperature: 1,
  topP: 0.95,
  topK: 40,
  maxOutputTokens: 8192,
  responseMimeType: "text/plain",
};

async function run() {
  // TODO Make these files available on the local file system
  // You may need to update the file paths
  const files = [
    await uploadToGemini("[CG&E DM&A Ops Pillar] 2025.H1 VMAXX Responses + Backend Data - H1 2025 Raw Data.csv", "text/csv"),
    await uploadToGemini("CG&E_DM&A___Hopper's_Hub_(go_hoppershub) (1).pdf", "application/pdf"),
    await uploadToGemini("[CG&E DM&A Ops Pillar] 2025.H1 VMAXX Responses + Backend Data - H2 2024 Raw Data.csv", "text/csv"),
  ];

  // Some files have a processing delay. Wait for them to be ready.
  await waitForFilesActive(files);

  const chatSession = model.startChat({
    generationConfig,
    history: [],
  });

  app.use(express.json())
  app.use(cors())

  app.post('/api/chat', async (req, res) => {
    const result = await chatSession.sendMessage(req.body.message);
    res.send(result.response.text());
  });

  app.get('/api/files', async (req, res) => {
    const files = [
      await fileManager.getFile("[CG&E DM&A Ops Pillar] 2025.H1 VMAXX Responses + Backend Data - H1 2025 Raw Data.csv"),
      await fileManager.getFile("CG&E_DM&A___Hopper's_Hub_(go_hoppershub) (1).pdf"),
      await fileManager.getFile("[CG&E DM&A Ops Pillar] 2025.H1 VMAXX Responses + Backend Data - H2 2024 Raw Data.csv"),
    ];
    res.json(files);
  });

  app.listen(3001, () => {
    console.log('Server listening on port 3001');
  });
}

run();
